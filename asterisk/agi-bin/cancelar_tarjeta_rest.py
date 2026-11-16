#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: CANCELACIÓN DE TARJETA CON SUPABASE REST API, VOZ NEURAL Y FOLIO
=============================================================================
1. Recibe el CALLERID y dígitos opcionales desde el Dialplan de Asterisk.
2. Consulta el cliente en Supabase mediante REST API (GET).
3. Genera el Folio Oficial de Cancelación con la nomenclatura requerida:
   YYYY-MM-DD-{4_ultimos_tarjeta}-{4_ultimos_callerid}
4. Valida el estatus_tarjeta actual:
   - Si ya es 2: Notifica con voz neural que ya está cancelada bajo su folio.
   - Si es 1:
     a) Actualiza estatus_tarjeta = 2, folio_cancelacion, fecha_cancelacion en 'clientes' (PATCH).
     b) Registra auditoría en 'tarjetas_cancelaciones_log' (POST).
     c) Registra en 'llamadas_bitacora' para activar Screen-Pop en CRM (POST).
5. Speech completo con voz neural ultra-fluida (es-MX-DaliaNeural / ElevenLabs).
6. Dictado claro del folio y opción de transferir a asesor (Ext. 2001) si presiona 0.
=============================================================================
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

# Configuración de ElevenLabs Voice AI
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

CONFIG_FILE = "/etc/asterisk/elevenlabs.json"
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r") as cf:
            cfg = json.load(cf)
            ELEVENLABS_API_KEY = cfg.get("api_key", ELEVENLABS_API_KEY)
            ELEVENLABS_VOICE_ID = cfg.get("voice_id", ELEVENLABS_VOICE_ID)
    except Exception:
        pass

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def agi_cmd(cmd):
    """Envía un comando al protocolo AGI de Asterisk y lee la respuesta."""
    print(cmd, flush=True)
    return sys.stdin.readline().strip()

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

def hablar(texto, escape_digits=""):
    """Sintetiza texto con voz neural ultra-fluida (es-MX-DaliaNeural / ElevenLabs) y lo reproduce en Asterisk."""
    uid = int(time.time() * 1000)
    tmp_mp3 = f"/tmp/canc_{uid}.mp3"
    tmp_wav = f"/tmp/canc_{uid}.wav"
    base_name = f"/tmp/canc_{uid}"

    sintetizado = False
    # 1. ElevenLabs si existe API key
    if ELEVENLABS_API_KEY:
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
            h = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVENLABS_API_KEY
            }
            body = {
                "text": texto,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}
            }
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                with open(tmp_mp3, "wb") as f:
                    f.write(resp.read())
            cmd_ff = ["ffmpeg", "-y", "-i", tmp_mp3, "-ar", "8000", "-ac", "1", "-acodec", "pcm_s16le", tmp_wav]
            subprocess.run(cmd_ff, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if os.path.exists(tmp_mp3):
                os.remove(tmp_mp3)
            sintetizado = True
        except Exception as e:
            sys.stderr.write(f"ElevenLabs TTS Fallback: {e}\n")

    # 2. Microsoft Azure Neural Voice (Edge-TTS es-MX-DaliaNeural)
    if not sintetizado:
        try:
            cmd_edge = ["edge-tts", "--voice", "es-MX-DaliaNeural", "--text", texto, "--write-media", tmp_mp3]
            subprocess.run(cmd_edge, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            cmd_ff = ["ffmpeg", "-y", "-i", tmp_mp3, "-ar", "8000", "-ac", "1", "-acodec", "pcm_s16le", tmp_wav]
            subprocess.run(cmd_ff, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if os.path.exists(tmp_mp3):
                os.remove(tmp_mp3)
            sintetizado = True
        except Exception as e:
            sys.stderr.write(f"Error generando audio Edge-TTS: {e}\n")

    # 3. Fallback espeak-ng local
    if not sintetizado:
        raw_wav = f"{tmp_wav}.raw.wav"
        try:
            subprocess.run(["espeak-ng", "-v", "es-la", "-s", "135", "-w", raw_wav, texto], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["sox", raw_wav, "-r", "8000", "-c", "1", "-b", "16", tmp_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if os.path.exists(raw_wav):
                os.remove(raw_wav)
        except Exception as e:
            sys.stderr.write(f"Fallback espeak Error: {e}\n")

    res = ""
    if os.path.exists(tmp_wav):
        res = agi_cmd(f'STREAM FILE "{base_name}" "{escape_digits}"')
        try:
            os.remove(tmp_wav)
        except Exception:
            pass
    return res

def http_get(endpoint):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode())
    except Exception as e:
        sys.stderr.write(f"HTTP GET Error ({endpoint}): {e}\n")
    return []

def http_post(endpoint, data):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201):
                raw = resp.read().decode()
                return json.loads(raw) if raw else {"status": "created"}
    except Exception as e:
        sys.stderr.write(f"HTTP POST Error ({endpoint}): {e}\n")
    return None

def http_patch(endpoint, data):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 204):
                raw = resp.read().decode()
                return json.loads(raw) if raw else {"status": "ok"}
    except Exception as e:
        sys.stderr.write(f"HTTP PATCH Error ({endpoint}): {e}\n")
    return None

def extraer_ultimos_4(texto, relleno="0000"):
    """Extrae los últimos 4 dígitos numéricos de cualquier cadena."""
    digitos = "".join([c for c in str(texto) if c.isdigit()])
    if len(digitos) >= 4:
        return digitos[-4:]
    return digitos.zfill(4) if digitos else relleno

def deletrear_digitos(digitos):
    """Pronuncia dígitos en bloques amigables para el oído humano (ej. 8821 -> ochenta y ocho, veintiuno)."""
    if len(digitos) == 4:
        d1 = int(digitos[:2])
        d2 = int(digitos[2:])
        return f"{d1:02d}, {d2:02d}"
    return " ".join(list(digitos))

def formatear_fecha_natural(fecha_iso):
    """Convierte fecha YYYY-MM-DD en texto natural en español (ej. 14 de noviembre de 2026)."""
    try:
        d = datetime.date.fromisoformat(str(fecha_iso)[:10])
        meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        return f"{d.day} de {meses[d.month - 1]} de {d.year}"
    except Exception:
        return str(fecha_iso)

def main():
    agi_env = leer_variables_agi()
    caller_id = sys.argv[1] if len(sys.argv) > 1 else agi_env.get("agi_callerid", "1001")
    tarjeta_dtmf = sys.argv[2] if len(sys.argv) > 2 else ""

    # 1. Consultar cliente en Supabase por CallerID o dígitos
    cliente = None
    if caller_id and caller_id != "DIRECTO":
        clientes = http_get(f"clientes?caller_id=eq.{caller_id}&select=*")
        if clientes:
            cliente = clientes[0]

    if not cliente and tarjeta_dtmf:
        terminacion = extraer_ultimos_4(tarjeta_dtmf)
        clientes = http_get(f"clientes?numero_tarjeta_mask=ilike.*{terminacion}*&select=*")
        if clientes:
            cliente = clientes[0]

    # VALIDACIÓN CLIENTE NUEVO: Si no existe cliente ni tarjeta, canalizar a Ventas
    if not cliente:
        texto_nuevo = (
            "Estimado usuario, este número telefónico no cuenta con tarjetas activas registradas en el sistema para trámite de cancelación. "
            "Lo comunicamos de inmediato con una ejecutiva de ventas para brindarle información sobre nuestras tarjetas y beneficios."
        )
        hablar(texto_nuevo, escape_digits="")
        agi_cmd('EXEC Dial "PJSIP/3001&PJSIP/3002,30"')
        return

    nombre_completo = cliente.get("nombre_completo", "Estimado cliente") if cliente else "Estimado cliente"
    primer_nombre = nombre_completo.split()[0]
    tarjeta_mask = cliente.get("numero_tarjeta_mask", "**** **** **** 8821") if cliente else "**** **** **** 8821"
    last4_tarjeta = extraer_ultimos_4(tarjeta_mask)
    last4_caller = extraer_ultimos_4(caller_id, relleno="1001")
    saldo = float(cliente.get("saldo", 0.0)) if cliente else 0.0
    estatus_actual = int(cliente.get("estatus_tarjeta", 1)) if cliente else 1
    folio_previo = cliente.get("folio_cancelacion") if cliente else None
    fecha_prev_canc = cliente.get("fecha_cancelacion") if cliente else None

    # Fecha actual en formato YYYY-MM-DD
    fecha_hoy = datetime.date.today().isoformat()
    fecha_hoy_natural = formatear_fecha_natural(fecha_hoy)

    # 2. Generación del Folio de Cancelación bajo nomenclatura oficial requerida:
    # concatenar fecha (yyyy-mm-dd) -4 ultimos digitos de la tarjeta-4 ultimos digitos del callerid
    folio_oficial = f"{fecha_hoy}-{last4_tarjeta}-{last4_caller}"

    sys.stderr.write(f"Procesando Cancelación: CallerID={caller_id}, Tarjeta={last4_tarjeta}, Folio={folio_oficial}\n")

    # 3. Evaluar si la tarjeta ya estaba cancelada previamente
    if estatus_actual == 2 and folio_previo:
        folio_usar = folio_previo
        fecha_mencion = formatear_fecha_natural(fecha_prev_canc) if fecha_prev_canc else fecha_hoy_natural

        bloque_tarjeta = deletrear_digitos(last4_tarjeta)
        bloque_caller = deletrear_digitos(last4_caller)
        folio_leido = f"{fecha_hoy}, guión {bloque_tarjeta}, guión {bloque_caller}"

        texto_speech = (
            f"Hola {primer_nombre}, bienvenido al departamento de cancelaciones de su sistema inteligente ARM. "
            f"Le informamos que su tarjeta con terminación {last4_tarjeta} ya se encuentra actualmente cancelada y bloqueada en el sistema. "
            f"El folio oficial registrado para su cuenta es: {folio_leido}. "
            f"Su saldo resguardado al momento del bloqueo fue de {saldo:.2f} pesos. "
            f"Si desea consultar su caso con un asesor de retención o solicitar una reactivación, presione 0 en su teclado o permanezca en la línea. "
            f"De lo contrario, puede finalizar la llamada con total seguridad."
        )
    else:
        # Ejecutar Cancelación Inmediata en Base de Datos Supabase
        folio_usar = folio_oficial
        fecha_ahora = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # A) Actualizar tabla clientes
        if cliente:
            http_patch(
                f"clientes?id=eq.{cliente.get('id')}",
                {
                    "estatus_tarjeta": 2,
                    "folio_cancelacion": folio_oficial,
                    "fecha_cancelacion": fecha_ahora,
                    "motivo_cancelacion": "Cancelación y bloqueo solicitado por el cliente vía IVR (Opción 2)",
                    "updated_at": fecha_ahora
                }
            )

        # B) Registrar auditoría en tarjetas_cancelaciones_log
        http_post("tarjetas_cancelaciones_log", {
            "cliente_id": cliente.get("id") if cliente else None,
            "folio_cancelacion": folio_oficial,
            "caller_id": caller_id,
            "numero_tarjeta_mask": tarjeta_mask,
            "estatus_anterior": estatus_actual,
            "estatus_nuevo": 2,
            "motivo": "Cancelación solicitada por el usuario vía IVR telefónico con folio oficial",
            "canal": "IVR_OPCION_2",
            "saldo_al_momento": saldo
        })

        # C) Registrar en llamadas_bitacora para Screen-Pop inmediato en CRM
        http_post("llamadas_bitacora", {
            "caller_id": caller_id,
            "cliente_id": cliente.get("id") if cliente else None,
            "tipo": "entrante",
            "estado": "finalizada",
            "opcion_ivr_seleccionada": "2. Cancelación",
            "folio_cancelacion": folio_oficial,
            "resumen_ia": (
                f"Cancelación y bloqueo procesado vía IVR para {nombre_completo}. "
                f"Tarjeta {tarjeta_mask}. Folio Oficial generado: {folio_oficial}. "
                f"Saldo restante resguardado: ${saldo:.2f} MXN. Consulta de saldo en IVR queda inhabilitada."
            ),
            "notas_agente": f"Folio de Cancelación: {folio_oficial} | Canal: IVR Autónomo Asterisk 20"
        })

        # Construcción del Speech Completo y Fluido del Proceso de Cancelación
        bloque_tarjeta = deletrear_digitos(last4_tarjeta)
        bloque_caller = deletrear_digitos(last4_caller)
        folio_leido = f"{fecha_hoy}, guión {bloque_tarjeta}, guión {bloque_caller}"

        texto_speech = (
            f"Estimado {primer_nombre}, ha ingresado al departamento de gestión y cancelaciones de su sistema inteligente ARM. "
            f"Lamentamos los inconvenientes. Atendiendo a su solicitud, hemos procedido a la cancelación y bloqueo preventivo inmediato de su tarjeta con terminación {last4_tarjeta}. "
            f"A partir de este momento, su tarjeta queda inhabilitada para cargos y consultas no autorizadas. "
            f"Su número de folio oficial de cancelación generado por el sistema es: {folio_leido}. "
            f"Repito su número de folio: {folio_leido}. "
            f"Su saldo registrado de {saldo:.2f} pesos queda formalmente resguardado bajo este mismo folio. "
            f"Este folio ya se encuentra disponible para su consulta en el panel del CRM. "
            f"Si requiere asistencia adicional o desea conversar con un asesor de retención, presione 0 en su teclado o permanezca en la línea. "
            f"De lo contrario, puede finalizar la llamada con total seguridad."
        )

    # Exportar variables al canal de Asterisk
    agi_cmd(f'SET VARIABLE FOLIO_CANCELACION "{folio_usar}"')
    agi_cmd('SET VARIABLE ESTATUS_TARJETA "2"')

    # Reproducir audio con soporte de interrupción DTMF (presionar 0 para transferir)
    res = hablar(texto_speech, escape_digits="0")

    tecla_pulsada = ""
    if "result=48" in res:  # ASCII 48 = '0'
        tecla_pulsada = "0"

    if not tecla_pulsada:
        resp_wait = agi_cmd("WAIT FOR DIGIT 4000")
        if "result=48" in resp_wait:
            tecla_pulsada = "0"

    if tecla_pulsada == "0":
        # Transferir a asesor humano (Ext. 2001)
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')
        hablar("Comprendo. En este momento lo estoy transfiriendo con un asesor de retención para brindarle atención personalizada.")
    else:
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "0"')
        hablar("Muchas gracias por comunicarse con su sistema inteligente ARM. Que tenga un excelente día.")

if __name__ == "__main__":
    main()
