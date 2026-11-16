#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: IDENTIFICADOR DE LLAMANTE, ADN ÚNICO Y ENRUTADOR DE CAMPAÑAS
=============================================================================
1. Homologación de ID Único e Irrepetible (UUID / ADN de llamada) para llamadas
   entrantes y salientes, asociado al CallerID y al Cliente ID de Supabase.
2. Segmentación de Campañas por DID (Atención Clientes, Doctores, Ventas, Cancelaciones).
3. Enrutamiento dinámico según opciones autorizadas de cada campaña.
4. Generación de nombre homologado de grabación: rec_<CALL_UUID>.wav.
5. Soporte de Barge-in DTMF y síntesis neuronal de voz.
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

def consultar_campana_por_did(did):
    """Consulta la tabla campanas en Supabase y determina a qué campaña pertenece el DID."""
    if not did:
        did = "8000"
    url = f"{SUPABASE_URL}/rest/v1/campanas?select=*&activo=eq.true"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                campanas = json.loads(resp.read().decode())
                for camp in campanas:
                    if str(camp.get("did_campana")) == str(did):
                        return camp
                    dids = camp.get("dids_asociados") or []
                    if str(did) in [str(d) for d in dids]:
                        return camp
    except Exception as e:
        sys.stderr.write(f"Error consultando campanas en Supabase: {e}\n")

    # Fallback predeterminado: Atención a Clientes General
    return {
        "nombre": "Atención a Clientes General",
        "slug": "atencion_clientes",
        "opciones_permitidas": ["1", "2", "3", "4"],
        "extension_agente": "2001",
        "dids_asociados": ["8009990000", "5550001000", "8000"],
        "enrutamiento_directo": None
    }

def consultar_cliente_por_callerid(caller_id):
    """Obtiene el cliente de Supabase por su CallerID (incluyendo normalización de prefijo 77 de prueba)."""
    if not caller_id:
        return None

    cid_str = str(caller_id).strip()
    candidatos = [cid_str]
    if cid_str.startswith("77"):
        candidatos.append(cid_str[2:])
    else:
        candidatos.append(f"77{cid_str}")

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    for cid in candidatos:
        url = f"{SUPABASE_URL}/rest/v1/clientes?caller_id=eq.{cid}&select=*"
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data and len(data) > 0:
                        return data[0]
        except Exception as e:
            sys.stderr.write(f"Error consultando caller_id ({cid}): {e}\n")

    return None

def registrar_inicio_llamada_bitacora(caller_id, cliente_id, did_marcado, campana, nombre_cliente=None):
    """Crea el registro de la llamada en Supabase y retorna el UUID único (ADN de la llamada)."""
    url = f"{SUPABASE_URL}/rest/v1/llamadas_bitacora"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload = {
        "caller_id": caller_id or "Desconocido",
        "cliente_id": cliente_id,
        "tipo": "entrante",
        "estado": "en_curso",
        "campana": campana.get("slug", "atencion_clientes"),
        "did_marcado": did_marcado,
        "opcion_ivr_seleccionada": f"Inicio IVR - {campana.get('nombre')}",
        "resumen_ia": f"Llamada entrante de {nombre_cliente or caller_id} al DID {did_marcado} asignado a {campana.get('nombre')}.",
        "notas_agente": f"Campaña: {campana.get('nombre')} | Agente asignado: Ext {campana.get('extension_agente')}"
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status in (200, 201):
                res_data = json.loads(resp.read().decode())
                if res_data and len(res_data) > 0:
                    call_uuid = res_data[0].get("id")
                    # Homologar nombre de la grabación con el UUID
                    grabacion_homologada = f"/var/spool/asterisk/monitor/rec_{call_uuid}.wav"
                    actualizar_grabacion_url(call_uuid, grabacion_homologada)
                    return call_uuid, grabacion_homologada
    except Exception as e:
        sys.stderr.write(f"Error creando registro en llamadas_bitacora: {e}\n")

    # Fallback UUID local si no hubiese conexión
    ts = int(time.time() * 1000)
    fake_uuid = f"call-in-{ts}-{caller_id}"
    return fake_uuid, f"/var/spool/asterisk/monitor/rec_{fake_uuid}.wav"

def actualizar_grabacion_url(call_uuid, grabacion_url):
    """Actualiza la URL homologada de la grabación para este UUID."""
    url = f"{SUPABASE_URL}/rest/v1/llamadas_bitacora?id=eq.{call_uuid}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    payload = {"grabacion_url": grabacion_url}
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="PATCH")
        with urllib.request.urlopen(req, timeout=3):
            pass
    except Exception:
        pass

def sintetizar_voz(texto, output_wav):
    """Genera audio con voz humana (ElevenLabs o Microsoft Edge-TTS)."""
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

    # Motor Edge-TTS Dalia Neural
    tmp_edge_mp3 = f"/tmp/edge_{int(time.time()*1000)}.mp3"
    try:
        cmd_edge = [
            "edge-tts",
            "--voice", "es-MX-DaliaNeural",
            "--text", texto,
            "--write-media", tmp_edge_mp3
        ]
        subprocess.run(cmd_edge, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cmd_ff = ["ffmpeg", "-y", "-i", tmp_edge_mp3, "-ar", "8000", "-ac", "1", "-acodec", "pcm_s16le", output_wav]
        subprocess.run(cmd_ff, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(tmp_edge_mp3):
            os.remove(tmp_edge_mp3)
        return True
    except Exception as e:
        sys.stderr.write(f"Fallo Edge-TTS: {e}\n")

    # Fallback local
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
    did_marcado = sys.argv[2] if len(sys.argv) > 2 else agi_env.get("agi_extension", "8000")

    # 1. Resolver Campaña por DID
    campana = consultar_campana_por_did(did_marcado)
    campana_slug = campana.get("slug", "atencion_clientes")
    campana_nombre = campana.get("nombre", "Atención General")
    extension_agente = campana.get("extension_agente", "2001")
    enrutamiento_directo = campana.get("enrutamiento_directo")

    # Si se marca la cabecera fija del conmutador (8000, 8009990000, 5550001000),
    # el menú completo de opciones (1, 2, 3, 4) es obligatorio y no desvía directo.
    if str(did_marcado).strip() in ["8000", "8009990000", "5550001000"]:
        enrutamiento_directo = None

    # 2. Consultar Cliente por CallerID
    cliente = consultar_cliente_por_callerid(caller_id)
    cliente_id = cliente.get("id") if cliente else None
    nombre_completo = cliente.get("nombre_completo", "") if cliente else ""
    primer_nombre = nombre_completo.split()[0] if nombre_completo else ""

    # 3. REGISTRAR LLAMADA Y OBTENER EL ID ÚNICO E IRREPETIBLE (ADN DE LA LLAMADA)
    call_uuid, grabacion_url = registrar_inicio_llamada_bitacora(
        caller_id=caller_id,
        cliente_id=cliente_id,
        did_marcado=did_marcado,
        campana=campana,
        nombre_cliente=nombre_completo
    )

    # 4. EXPORTAR VARIABLES AL CANAL DE ASTERISK (Con __ para herencia universal a Pata B)
    agi_cmd(f'SET VARIABLE __CALL_UUID "{call_uuid}"')
    agi_cmd(f'SET VARIABLE __CALL_RECORDING "{grabacion_url}"')
    agi_cmd(f'SET VARIABLE __CLIENTE_ID "{cliente_id or ""}"')
    agi_cmd(f'SET VARIABLE __CAMPANA "{campana_slug}"')
    agi_cmd(f'SET VARIABLE __CAMPANA_NOMBRE "{campana_nombre}"')
    agi_cmd(f'SET VARIABLE EXT_AGENTE_CAMPANA "{extension_agente}"')
    agi_cmd(f'SET VARIABLE ENRUTAR_DIRECTO "{enrutamiento_directo or ""}"')

    if cliente:
        saldo = float(cliente.get("saldo", 0.0))
        tarjeta_mask = cliente.get("numero_tarjeta_mask", "")
        estatus = int(cliente.get("estatus_tarjeta", 1))

        agi_cmd('SET VARIABLE ES_CLIENTE "1"')
        agi_cmd(f'SET VARIABLE NOMBRE_CLIENTE "{primer_nombre}"')
        agi_cmd(f'SET VARIABLE NOMBRE_COMPLETO "{nombre_completo}"')
        agi_cmd(f'SET VARIABLE SALDO_CLIENTE "{saldo:.2f}"')
        agi_cmd(f'SET VARIABLE TARJETA_MASK "{tarjeta_mask}"')
        agi_cmd(f'SET VARIABLE ESTATUS_TARJETA "{estatus}"')
    else:
        agi_cmd('SET VARIABLE ES_CLIENTE "0"')
        agi_cmd('SET VARIABLE NOMBRE_CLIENTE ""')

    # Iniciar grabación en Asterisk con el nombre homologado
    agi_cmd(f'EXEC MixMonitor "{grabacion_url},b"')

    # 5. GENERAR SPEECH Y ENRUTAR SEGÚN LA CAMPAÑA
    unique_ts = int(time.time() * 1000)
    audio_path = f"/tmp/greeting_{unique_ts}.wav"
    audio_base = f"/tmp/greeting_{unique_ts}"

    # CASO A: CAMPAÑA DE DOCTORES / CITAS MÉDICAS (Opción 4 directa)
    if enrutamiento_directo == "4" or campana_slug == "doctores":
        texto_saludo = (
            f"Hola {primer_nombre + ', ' if primer_nombre else ''}"
            f"bienvenido a la línea directa de atención médica y consultas con Inteligencia Artificial. "
            f"Lo comunicamos de inmediato con su asistente de salud."
        )
        sintetizar_voz(texto_saludo, audio_path)
        if os.path.exists(audio_path):
            agi_cmd(f'STREAM FILE "{audio_base}" ""')
            try:
                os.remove(audio_path)
            except Exception:
                pass
        agi_cmd('SET EXTENSION 4')
        agi_cmd('SET PRIORITY 1')
        return

    # CASO B: CAMPAÑA DE VENTAS (Opción 3 directa)
    if enrutamiento_directo == "3" or campana_slug == "ventas":
        texto_saludo = (
            f"Hola {primer_nombre + ', ' if primer_nombre else ''}"
            f"bienvenido al departamento comercial y ventas. Conectando con su ejecutiva asignada."
        )
        sintetizar_voz(texto_saludo, audio_path)
        if os.path.exists(audio_path):
            agi_cmd(f'STREAM FILE "{audio_base}" ""')
            try:
                os.remove(audio_path)
            except Exception:
                pass
        agi_cmd('SET EXTENSION 3')
        agi_cmd('SET PRIORITY 1')
        return

    # CASO C: CAMPAÑA DE CANCELACIONES (Opción 2 directa)
    if enrutamiento_directo == "2" or campana_slug == "cancelaciones":
        texto_saludo = (
            f"Hola {primer_nombre + ', ' if primer_nombre else ''}"
            f"ha ingresado al departamento de gestión y cancelación de tarjetas. Procesando su solicitud."
        )
        sintetizar_voz(texto_saludo, audio_path)
        if os.path.exists(audio_path):
            agi_cmd(f'STREAM FILE "{audio_base}" ""')
            try:
                os.remove(audio_path)
            except Exception:
                pass
        agi_cmd('SET EXTENSION 2')
        agi_cmd('SET PRIORITY 1')
        return

    # CASO D: CAMPAÑA DE ATENCIÓN A CLIENTES GENERAL (BIFURCACIÓN DE 2 IVRs SEGÚN HISTORIAL)
    if cliente:
        # IVR 1: CLIENTES EXISTENTES (CON HISTORIAL CLÍNICO, SALDO Y TARJETA ACTIVA)
        texto_saludo = (
            f"Hola {primer_nombre}, bienvenido nuevamente a su sistema inteligente ARM. "
            f"Marque 1 para consultar su saldo disponible. "
            f"Marque 2 para gestión o cancelación de su tarjeta. "
            f"Marque 3 para comunicarse con su ejecutiva de ventas. "
            f"O marque 4 para agendar o consultar sus citas médicas con su doctora de cabecera."
        )
    else:
        # IVR 2: CLIENTES NUEVOS (PROCESO DE ALTA, CONTRATACIÓN Y APERTURA DE EXPEDIENTE)
        texto_saludo = (
            "Bienvenido al sistema inteligente de atención a clientes ARM. "
            "Detectamos que nos contacta por primera vez desde esta línea telefónica. "
            "Marque 3 para solicitar y tramitar su nueva tarjeta con una ejecutiva de ventas. "
            "Marque 4 para agendar su primera consulta médica y aperturar su expediente clínico. "
            "O marque 1 o 2 si desea información y trámite de registro para clientes nuevos."
        )

    sintetizar_voz(texto_saludo, audio_path)

    res = ""
    if os.path.exists(audio_path):
        res = agi_cmd(f'STREAM FILE "{audio_base}" "1234"')
        try:
            os.remove(audio_path)
        except Exception:
            pass
    else:
        res = agi_cmd('STREAM FILE "ivr-bienvenida-menu" "1234"')

    # Soporte completo de Barge-in DTMF
    if "result=49" in res:
        agi_cmd('SET EXTENSION 1')
        agi_cmd('SET PRIORITY 1')
    elif "result=50" in res:
        agi_cmd('SET EXTENSION 2')
        agi_cmd('SET PRIORITY 1')
    elif "result=51" in res:
        agi_cmd('SET EXTENSION 3')
        agi_cmd('SET PRIORITY 1')
    elif "result=52" in res:
        agi_cmd('SET EXTENSION 4')
        agi_cmd('SET PRIORITY 1')

if __name__ == "__main__":
    main()
