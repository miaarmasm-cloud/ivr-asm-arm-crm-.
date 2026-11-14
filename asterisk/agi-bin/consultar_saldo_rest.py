#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: CONSULTA DE SALDO CON DTMF, SUPABASE REST API Y ELEVENLABS AI
=============================================================================
Lee los dígitos de tarjeta ingresados por DTMF (o caller_id), consulta la 
base de datos en Supabase vía REST API (sin stored procedures ni XML obsoleto),
genera la respuesta con voz humana natural vía ElevenLabs (o fallback local)
y la reproduce directamente en la llamada activa.
"""

import sys
import os
import json
import time
import datetime
import urllib.request
import urllib.parse
import subprocess

# Configuración de Supabase REST API
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk"
)

# Cargar configuración de ElevenLabs Voice AI si existe archivo dedicado
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
    """Envía un comando al protocolo AGI de Asterisk y lee la respuesta."""
    print(cmd, flush=True)
    res = sys.stdin.readline().strip()
    return res

def leer_variables_agi():
    """Lee el entorno inicial del canal que Asterisk envía por stdin."""
    agi_env = {}
    while True:
        line = sys.stdin.readline().strip()
        if not line:
            break
        if ":" in line:
            key, val = line.split(":", 1)
            agi_env[key.strip()] = val.strip()
    return agi_env

def consultar_supabase_rest(tarjeta, caller_id):
    """Consulta la tabla 'clientes' en Supabase vía REST API pura (JSON)."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # Búsqueda 1: Por dígitos de tarjeta ingresados
    if tarjeta and len(tarjeta) >= 4:
        # Últimos 4 dígitos para match con la máscara (ej. **** 8821)
        terminacion = tarjeta[-4:]
        url = f"{SUPABASE_URL}/rest/v1/clientes?numero_tarjeta_mask=ilike.*{terminacion}*&select=*"
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if data and len(data) > 0:
                        return data[0]
        except Exception as e:
            sys.stderr.write(f"Error consultando Supabase por tarjeta: {e}\n")

    # Búsqueda 2: Fallback por Caller ID de la extensión que llama
    if caller_id:
        url = f"{SUPABASE_URL}/rest/v1/clientes?caller_id=eq.{caller_id}&select=*"
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if data and len(data) > 0:
                        return data[0]
        except Exception as e:
            sys.stderr.write(f"Error consultando Supabase por caller_id: {e}\n")

    return None

def registrar_llamada_crm(cliente, caller_id, opcion, resumen):
    """Registra la bitácora de la llamada en Supabase vía REST POST."""
    url = f"{SUPABASE_URL}/rest/v1/llamadas_bitacora"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    payload = {
        "caller_id": caller_id or "Desconocido",
        "cliente_id": cliente.get("id") if cliente else None,
        "tipo": "entrante",
        "estado": "finalizada",
        "opcion_ivr_seleccionada": opcion,
        "resumen_ia": resumen,
        "fecha_hora": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=3):
            pass
    except Exception as e:
        sys.stderr.write(f"Error registrando en bitacora: {e}\n")

def sintetizar_audio_elevenlabs(texto, output_wav):
    """Genera audio con voz hiperrealista usando ElevenLabs API."""
    if not ELEVENLABS_API_KEY:
        return False

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    body = {
        "text": texto,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8
        }
    }

    tmp_mp3 = f"/tmp/elevenlabs_{int(time.time()*1000)}.mp3"
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            with open(tmp_mp3, "wb") as f:
                f.write(resp.read())

        # Convertir a formato nativo Asterisk: 8000Hz, Mono, 16-bit PCM WAV
        cmd = ["ffmpeg", "-y", "-i", tmp_mp3, "-ar", "8000", "-ac", "1", "-acodec", "pcm_s16le", output_wav]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(tmp_mp3):
            os.remove(tmp_mp3)
        return True
    except Exception as e:
        sys.stderr.write(f"Error sintetizando con ElevenLabs: {e}\n")
        return False

def sintetizar_fallback(texto, output_wav):
    """Fallback local rápido para síntesis de voz en español."""
    raw_wav = f"{output_wav}.raw.wav"
    try:
        subprocess.run(
            ["espeak-ng", "-v", "es-la", "-s", "135", "-w", raw_wav, texto],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        subprocess.run(
            ["sox", raw_wav, "-r", "8000", "-c", "1", "-b", "16", output_wav],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        if os.path.exists(raw_wav):
            os.remove(raw_wav)
        return True
    except Exception:
        return False

def main():
    agi_env = leer_variables_agi()

    # Parámetros pasados desde el Dialplan de Asterisk
    # sys.argv[1]: Dígitos DTMF ingresados por el usuario
    # sys.argv[2]: Caller ID del canal
    tarjeta_dtmf = sys.argv[1] if len(sys.argv) > 1 else ""
    caller_id = sys.argv[2] if len(sys.argv) > 2 else agi_env.get("agi_callerid", "")

    # Notificar al caller que se está procesando en la REST API
    agi_cmd('STREAM FILE "ivr-procesando-consulta" ""')

    cliente = consultar_supabase_rest(tarjeta_dtmf, caller_id)

    unique_id = int(time.time() * 1000)
    audio_path = f"/tmp/saldo_dyn_{unique_id}.wav"
    audio_agi_name = f"/tmp/saldo_dyn_{unique_id}"

    if cliente:
        nombre = cliente.get("nombre_completo", "Estimado cliente")
        saldo = float(cliente.get("saldo", 0.0))
        mask = cliente.get("numero_tarjeta_mask", "su tarjeta")
        pesos = int(saldo)
        centavos = int(round((saldo - pesos) * 100))

        centavos_str = f" con {centavos} centavos" if centavos > 0 else ""
        texto = (
            f"Hola, {nombre}. El saldo actual disponible en su tarjeta terminación {mask[-4:]} "
            f"es de {pesos} pesos{centavos_str}. "
            f"Gracias por comunicarse con nuestro sistema inteligente."
        )

        # Registrar en la bitácora del CRM
        resumen = f"Consulta exitosa de saldo: ${saldo:,.2f} MXN en tarjeta {mask} para {nombre}"
        registrar_llamada_crm(cliente, caller_id, "1. Consulta de Saldo DTMF", resumen)

    else:
        texto = (
            "Lo sentimos, no encontramos ninguna cuenta asociada a los dígitos ingresados. "
            "Por favor verifique su tarjeta o comuníquese con un ejecutivo."
        )
        registrar_llamada_crm(None, caller_id, "1. Consulta de Saldo DTMF", f"Tarjeta no encontrada: {tarjeta_dtmf}")

    # Intentar síntesis con ElevenLabs (Voz Humana de IA)
    ok = sintetizar_audio_elevenlabs(texto, audio_path)
    if not ok:
        sintetizar_fallback(texto, audio_path)

    # Reproducir el audio dinámico generado
    if os.path.exists(audio_path):
        agi_cmd(f'STREAM FILE "{audio_agi_name}" ""')
        # Limpieza diferida
        try:
            os.remove(audio_path)
        except Exception:
            pass
    else:
        agi_cmd('STREAM FILE "ivr-tarjeta-no-encontrada" ""')

if __name__ == "__main__":
    main()
