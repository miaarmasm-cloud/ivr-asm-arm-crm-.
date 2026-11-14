#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: IDENTIFICADOR DE LLAMANTE (LEAD CONOCIDO VS NUEVO)
=============================================================================
1. Extrae el CALLERID(num) de la llamada entrante.
2. Consulta Supabase REST API en milisegundos.
3. Si el cliente existe:
   - Saludo personalizado: "Hola Carlos, bienvenido..."
   - Exporta variables al canal de Asterisk: ES_CLIENTE=1, NOMBRE, SALDO, TARJETA.
4. Si es un nuevo lead / desconocido:
   - Saludo genérico: "Bienvenido a nuestro sistema inteligente..."
   - Exporta variables: ES_CLIENTE=0.
5. Sintetiza con ElevenLabs (o fallback de alta calidad) y reproduce el audio.
=============================================================================
"""

import sys
import os
import json
import time
import urllib.request
import urllib.parse
import subprocess

# Configuración Supabase REST API
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk"
)

# Configuración ElevenLabs
CONFIG_FILE = "/etc/asterisk/elevenlabs.json"
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r") as cf:
            cfg = json.load(cf)
            ELEVENLABS_API_KEY = cfg.get("api_key", ELEVENLABS_API_KEY)
            ELEVENLABS_VOICE_ID = cfg.get("voice_id", ELEVENLABS_VOICE_ID)
    except Exception:
        pass

def agi_cmd(cmd):
    print(cmd, flush=True)
    return sys.stdin.readline().strip()

def leer_variables_agi():
    agi_env = {}
    while True:
        line = sys.stdin.readline().strip()
        if not line:
            break
        if ":" in line:
            k, v = line.split(":", 1)
            agi_env[k.strip()] = v.strip()
    return agi_env

def consultar_cliente_por_callerid(caller_id):
    if not caller_id:
        return None
    url = f"{SUPABASE_URL}/rest/v1/clientes?caller_id=eq.{caller_id}&select=*"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                if data and len(data) > 0:
                    return data[0]
    except Exception as e:
        sys.stderr.write(f"Error consultando caller_id: {e}\n")
    return None

def sintetizar_voz(texto, output_wav):
    # Intento 1: ElevenLabs si hay API Key
    if ELEVENLABS_API_KEY:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        body = {
            "text": texto,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}
        }
        tmp_mp3 = f"/tmp/el_{int(time.time()*1000)}.mp3"
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=8) as r:
                with open(tmp_mp3, "wb") as f:
                    f.write(r.read())
            cmd = ["ffmpeg", "-y", "-i", tmp_mp3, "-ar", "8000", "-ac", "1", "-acodec", "pcm_s16le", output_wav]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if os.path.exists(tmp_mp3):
                os.remove(tmp_mp3)
            return True
        except Exception as e:
            sys.stderr.write(f"Fallo ElevenLabs: {e}\n")

    # Fallback local de voz en español
    raw_wav = f"{output_wav}.raw.wav"
    try:
        subprocess.run(["espeak-ng", "-v", "es-la", "-s", "140", "-w", raw_wav, texto], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["sox", raw_wav, "-r", "8000", "-c", "1", "-b", "16", output_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(raw_wav):
            os.remove(raw_wav)
        return True
    except Exception:
        return False

def main():
    agi_env = leer_variables_agi()
    caller_id = sys.argv[1] if len(sys.argv) > 1 else agi_env.get("agi_callerid", "")

    cliente = consultar_cliente_por_callerid(caller_id)

    unique_id = int(time.time() * 1000)
    audio_path = f"/tmp/greeting_{unique_id}.wav"
    audio_base = f"/tmp/greeting_{unique_id}"

    if cliente:
        nombre_completo = cliente.get("nombre_completo", "Carlos")
        primer_nombre = nombre_completo.split()[0]
        saldo = float(cliente.get("saldo", 0.0))
        tarjeta_mask = cliente.get("numero_tarjeta_mask", "")

        # Exportar variables al canal de Asterisk
        agi_cmd('SET VARIABLE ES_CLIENTE "1"')
        agi_cmd(f'SET VARIABLE NOMBRE_CLIENTE "{primer_nombre}"')
        agi_cmd(f'SET VARIABLE NOMBRE_COMPLETO "{nombre_completo}"')
        agi_cmd(f'SET VARIABLE SALDO_CLIENTE "{saldo:.2f}"')
        agi_cmd(f'SET VARIABLE TARJETA_MASK "{tarjeta_mask}"')

        texto_saludo = (
            f"Hola {primer_nombre}, bienvenido a tu sistema inteligente ARM. "
            f"Marque 1 para consultar su saldo. "
            f"Marque 2 para cancelación. "
            f"Marque 3 para comunicarse con una ejecutiva de ventas."
        )
    else:
        # Lead nuevo o caller_id no registrado en la base
        agi_cmd('SET VARIABLE ES_CLIENTE "0"')
        agi_cmd('SET VARIABLE NOMBRE_CLIENTE ""')

        texto_saludo = (
            "Bienvenido al sistema inteligente de atención a clientes. "
            "Marque 1 para consultar su saldo. "
            "Marque 2 para cancelación. "
            "Marque 3 para comunicarse con una ejecutiva de ventas."
        )

    sintetizar_voz(texto_saludo, audio_path)

    if os.path.exists(audio_path):
        agi_cmd(f'STREAM FILE "{audio_base}" "123"')
        try:
            os.remove(audio_path)
        except Exception:
            pass
    else:
        agi_cmd('STREAM FILE "ivr-bienvenida-menu" "123"')

if __name__ == "__main__":
    main()
