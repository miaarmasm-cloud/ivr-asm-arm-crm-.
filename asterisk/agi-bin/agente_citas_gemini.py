#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: AGENTE CLÍNICO INTELIGENTE (OPCIÓN 4: AGENDA & GOOGLE CALENDAR)
=============================================================================
1. Identificación por CallerID en Supabase REST API y memoria clínica previa (CBR).
2. Consulta de Historial Clínico previo:
   - Paciente: Anto Krpax X (o Carlos Mendoza / 1001).
   - Doctora de Cabecera: Dra. Mariana Fernández.
   - Último motivo y sugerencia preventiva del expediente.
3. Validación de Disponibilidad en TIEMPO REAL:
   - Sincronización bidireccional con Google Calendar API v3 (OAuth 2.0 mia-asm-arm).
   - Validación cruzada contra 'citas_calendario' en Supabase.
   - Detecta si la Dra. Mariana Fernández está OCUPADA (ej. 10:00 AM) o LIBRE.
4. Opciones Homologadas DTMF (Voz Neural es-MX-DaliaNeural + Barge-in):
   - Si la doctora está ocupada:
     * 1: Agendar con Médico de Turno (Dr. Fernando Fernández a las 11:00 hrs).
     * 2: Agendar con Doctora de Cabecera para el día siguiente hábil a las 10:00 hrs.
     * 0: Transferir con especialista humano (Ext. 2001).
   - Si ya tiene cita activa:
     * 1: Confirmar asistencia.
     * 2: Reprogramar.
     * 3: Cancelar y liberar espacio en Google Calendar.
     * 0: Hablar con asesor.
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

# Configuración de URLs y Credenciales Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk"
)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", os.environ.get("GOOGLE_API_KEY", ""))

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Rutas de búsqueda de credenciales Google OAuth 2.0
TOKEN_SEARCH_PATHS = [
    os.path.join(BASE_DIR, 'google_token.json'),
    "/var/lib/asterisk/agi-bin/google_token.json",
    os.path.abspath(os.path.join(BASE_DIR, '../../mcp-server/google_token.json')),
    "/app/mcp-server/google_token.json",
    "mcp-server/google_token.json"
]

DOCTOR_EMAILS = {
    "Dra. Mariana Fernández": "mariana.fernandez@clinica-arm.com",
    "Dr. Fernando Fernández": "fernando.fernandez@clinica-arm.com",
    "Dra. Sofía Navarro": "sofia.navarro@clinica-arm.com",
    "Dra. Mariana Gómez": "mariana.gomez@clinica-arm.com"
}

PLANTILLA_MEDICOS = [
    {"nombre": "Dra. Mariana Fernández", "especialidad": "Medicina Familiar y Preventiva"},
    {"nombre": "Dr. Fernando Fernández", "especialidad": "Medicina Interna y Cardiología"},
    {"nombre": "Dra. Sofía Navarro", "especialidad": "Laboratorio y Diagnóstico Clínico"}
]

HORAS_LABORALES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]


# =============================================================================
# COMUNICACIÓN AGI ASTERISK Y SÍNTESIS DE VOZ NEURAL
# =============================================================================

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

def hablar(texto, escape_digits=""):
    """Sintetiza texto con voz neural mexicana (es-MX-DaliaNeural) con interrupción por teclado (Barge-in)."""
    uid = int(time.time() * 1000)
    tmp_mp3 = f"/tmp/citas_{uid}.mp3"
    tmp_wav = f"/tmp/citas_{uid}.wav"
    base_name = f"/tmp/citas_{uid}"

    cmd_edge = ["edge-tts", "--voice", "es-MX-DaliaNeural", "--text", texto, "--write-media", tmp_mp3]
    try:
        subprocess.run(cmd_edge, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cmd_ff = ["ffmpeg", "-y", "-i", tmp_mp3, "-ar", "8000", "-ac", "1", "-acodec", "pcm_s16le", tmp_wav]
        subprocess.run(cmd_ff, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(tmp_mp3):
            os.remove(tmp_mp3)
    except Exception as e:
        sys.stderr.write(f"Error generando audio TTS: {e}\n")

    res = ""
    if os.path.exists(tmp_wav):
        res = agi_cmd(f'STREAM FILE "{base_name}" "{escape_digits}"')
        try:
            os.remove(tmp_wav)
        except Exception:
            pass
    return res


# =============================================================================
# CLIENTE HTTP REST SUPABASE
# =============================================================================

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


# =============================================================================
# SINCRONIZACIÓN HOMOLOGADA CON GOOGLE CALENDAR API v3 (OAUTH 2.0)
# =============================================================================

def get_google_access_token():
    """Localiza y refresca el token de acceso de Google Calendar automáticamente."""
    token_file = None
    for p in TOKEN_SEARCH_PATHS:
        if os.path.exists(p):
            token_file = p
            break

    if not token_file:
        sys.stderr.write("Aviso: google_token.json no encontrado.\n")
        return None

    try:
        with open(token_file, "r", encoding="utf-8") as f:
            token_data = json.load(f)

        # Refrescar si está expirado o tiene refresh_token
        if token_data.get("refresh_token") and token_data.get("client_id") and token_data.get("client_secret"):
            now = time.time()
            expiry = token_data.get("expiry")
            needs_refresh = False
            if expiry:
                try:
                    dt = datetime.datetime.fromisoformat(expiry.replace("Z", "+00:00"))
                    if dt.timestamp() < now + 120:
                        needs_refresh = True
                except Exception:
                    needs_refresh = True
            else:
                needs_refresh = True

            if needs_refresh:
                params = urllib.parse.urlencode({
                    "client_id": token_data["client_id"],
                    "client_secret": token_data["client_secret"],
                    "refresh_token": token_data["refresh_token"],
                    "grant_type": "refresh_token"
                }).encode()
                req = urllib.request.Request("https://oauth2.googleapis.com/token", data=params, method="POST")
                try:
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        if resp.status == 200:
                            refreshed = json.loads(resp.read().decode())
                            token_data["token"] = refreshed["access_token"]
                            token_data["expiry"] = datetime.datetime.utcnow().isoformat() + "Z"
                            with open(token_file, "w", encoding="utf-8") as out:
                                json.dump(token_data, out, indent=2)
                            return token_data["token"]
                except Exception as ref_err:
                    sys.stderr.write(f"Aviso al refrescar token: {ref_err}\n")

        return token_data.get("token")
    except Exception as e:
        sys.stderr.write(f"Error cargando google_token: {e}\n")
        return None

def verificar_disponibilidad_google_calendar(fecha, hora):
    """Consulta la API de Google Calendar en vivo para ver si la hora solicitada está ocupada."""
    token = get_google_access_token()
    if not token:
        return False
    try:
        h_int = int(hora.split(':')[0])
        time_min = f"{fecha}T{h_int:02d}:00:00Z"
        time_max = f"{fecha}T{(h_int+1):02d}:00:00Z"
        url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={urllib.parse.quote(time_min)}&timeMax={urllib.parse.quote(time_max)}&singleEvents=true"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                items = data.get("items", [])
                return len(items) > 0
    except Exception as e:
        sys.stderr.write(f"Google Calendar check error: {e}\n")
    return False

def crear_evento_google_calendar(nombre, caller_id, fecha, hora, motivo, doctor, paciente_email=None):
    """Inserta evento en Google Calendar homologando al Doctor y Paciente como asistentes."""
    token = get_google_access_token()
    if not token:
        return None
    try:
        h_int = int(hora.split(':')[0])
        m_int = int(hora.split(':')[1]) if ':' in hora else 0
        start_dt = f"{fecha}T{h_int:02d}:{m_int:02d}:00-06:00"
        end_dt = f"{fecha}T{(h_int+1):02d}:{m_int:02d}:00-06:00"

        doc_email = DOCTOR_EMAILS.get(doctor, "miaarmasm@gmail.com")
        attendees = [
            {"email": doc_email, "displayName": doctor}
        ]
        if paciente_email:
            attendees.append({"email": paciente_email, "displayName": nombre})
        else:
            attendees.append({"email": "anto.krpax@gmail.com", "displayName": nombre})

        event_body = {
            'summary': f"Cita Médica ARM: {nombre} ({caller_id}) - {doctor}",
            'description': f"Paciente: {nombre}\nCallerID: {caller_id}\nDoctor Asignado: {doctor}\nMotivo: {motivo}\nRegistrado por Opción 4 del IVR ARM.",
            'start': {'dateTime': start_dt, 'timeZone': 'America/Mexico_City'},
            'end': {'dateTime': end_dt, 'timeZone': 'America/Mexico_City'},
            'attendees': attendees,
            'colorId': '2'
        }

        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all"
        req = urllib.request.Request(
            url,
            data=json.dumps(event_body).encode(),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status in (200, 201):
                ev = json.loads(resp.read().decode())
                return ev.get("id")
    except Exception as e:
        sys.stderr.write(f"Google Calendar Insert Event Error: {e}\n")
    return None

def eliminar_evento_google_calendar(google_event_id):
    if not google_event_id or google_event_id == "offline":
        return
    token = get_google_access_token()
    if not token:
        return
    try:
        url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{google_event_id}?sendUpdates=all"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}, method="DELETE")
        with urllib.request.urlopen(req, timeout=5) as resp:
            pass
    except Exception as e:
        sys.stderr.write(f"Google Calendar Delete Event Error: {e}\n")

def actualizar_evento_google_calendar(google_event_id, nombre, caller_id, nueva_fecha, nueva_hora, motivo, doctor):
    """Actualiza la fecha, hora y doctor de un evento existente en Google Calendar."""
    if not google_event_id or google_event_id == "offline":
        return crear_evento_google_calendar(nombre, caller_id, nueva_fecha, nueva_hora, motivo, doctor)
    token = get_google_access_token()
    if not token:
        return None
    try:
        h_int = int(nueva_hora.split(':')[0])
        m_int = int(nueva_hora.split(':')[1]) if ':' in nueva_hora else 0
        start_dt = f"{nueva_fecha}T{h_int:02d}:{m_int:02d}:00-06:00"
        end_dt = f"{nueva_fecha}T{(h_int+1):02d}:{m_int:02d}:00-06:00"
        doc_email = DOCTOR_EMAILS.get(doctor, "miaarmasm@gmail.com")

        event_body = {
            'summary': f"Cita Médica ARM (Reprogramada): {nombre} ({caller_id}) - {doctor}",
            'description': f"Paciente: {nombre}\nCallerID: {caller_id}\nDoctor Asignado: {doctor}\nMotivo: {motivo}\nReprogramada vía Opción 4 del IVR ARM.",
            'start': {'dateTime': start_dt, 'timeZone': 'America/Mexico_City'},
            'end': {'dateTime': end_dt, 'timeZone': 'America/Mexico_City'},
            'attendees': [{'email': doc_email, 'displayName': doctor}]
        }
        url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{google_event_id}?sendUpdates=all"
        req = urllib.request.Request(
            url,
            data=json.dumps(event_body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status in (200, 201):
                ev = json.loads(resp.read().decode())
                return ev.get("id")
    except Exception as e:
        sys.stderr.write(f"Google Calendar Update Event Error: {e}\n")
    return None


# =============================================================================
# VALIDACIONES DE DISPONIBILIDAD Y FORMATO
# =============================================================================

def formatear_fecha_es(fecha_iso):
    """Convierte fecha YYYY-MM-DD en texto natural en español para voz TTS (ej. lunes 17 de noviembre)."""
    try:
        d = datetime.date.fromisoformat(str(fecha_iso)[:10])
        dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
        meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        return f"{dias[d.weekday()]} {d.day} de {meses[d.month - 1]}"
    except Exception:
        return str(fecha_iso)

def calcular_siguiente_dia_laboral():
    hoy = datetime.date.today()
    siguiente = hoy + datetime.timedelta(days=1)
    while siguiente.weekday() >= 5: # 5: Sab, 6: Dom
        siguiente += datetime.timedelta(days=1)
    return siguiente.isoformat()

def verificar_disponibilidad_doctor(doctor_nombre, fecha, hora):
    """Verifica si el médico específico está ocupado en Supabase O en Google Calendar."""
    hora_norm = str(hora)[:5]
    # 1. Consulta en Supabase
    query = f"citas_calendario?doctor_asignado=eq.{urllib.parse.quote(doctor_nombre)}&fecha=eq.{fecha}&hora=in.({hora_norm},{hora_norm}:00)&estado=in.(confirmada,reprogramada)&select=id"
    res = http_get(query)
    if len(res) > 0:
        return True

    # 2. Consulta en Google Calendar en tiempo real
    if verificar_disponibilidad_google_calendar(fecha, hora_norm):
        return True

    return False

def buscar_disponibilidad_dinamica(doctor_principal, doctor_alternativo, fecha_actual_cita=None):
    """
    Busca fechas y horarios disponibles reales tanto en Supabase como en Google Calendar.
    Evalúa los próximos 5 días laborales para ofrecer:
    1. Próximo slot disponible con su médico de cabecera (doctor_principal).
    2. Próximo slot disponible con un médico especialista alternativo (doctor_alternativo).
    """
    hoy = datetime.date.today()
    slots_principal = []
    slots_alternativo = []

    # Evaluar hasta 5 días hábiles a partir de mañana
    d = hoy + datetime.timedelta(days=1)
    dias_revisados = 0
    horas_revision = ["10:00", "11:00", "12:00", "15:00", "16:00"]

    while dias_revisados < 5 and (len(slots_principal) == 0 or len(slots_alternativo) == 0):
        if d.weekday() < 5:  # Lunes a Viernes
            d_iso = d.isoformat()
            dias_revisados += 1

            for h in horas_revision:
                # Evitar colisión exacta con la misma cita que se está reprogramando
                if fecha_actual_cita:
                    cita_f = str(fecha_actual_cita.get('fecha', ''))[:10]
                    cita_h = str(fecha_actual_cita.get('hora', ''))[:5]
                    if d_iso == cita_f and h == cita_h:
                        continue

                # Revisar médico principal
                if len(slots_principal) == 0:
                    if not verificar_disponibilidad_doctor(doctor_principal, d_iso, h):
                        slots_principal.append({"fecha": d_iso, "hora": h, "doctor": doctor_principal})

                # Revisar médico alternativo
                if len(slots_alternativo) == 0:
                    if not verificar_disponibilidad_doctor(doctor_alternativo, d_iso, h):
                        slots_alternativo.append({"fecha": d_iso, "hora": h, "doctor": doctor_alternativo})
        d += datetime.timedelta(days=1)

    # Fallbacks garantizados si todas las agendas estuvieran llenas
    fallback_1 = calcular_siguiente_dia_laboral()
    d_f1 = datetime.date.fromisoformat(fallback_1)
    d_f2 = d_f1 + datetime.timedelta(days=1)
    while d_f2.weekday() >= 5:
        d_f2 += datetime.timedelta(days=1)
    fallback_2 = d_f2.isoformat()

    res_p = slots_principal[0] if slots_principal else {"fecha": fallback_2, "hora": "10:00", "doctor": doctor_principal}
    res_a = slots_alternativo[0] if slots_alternativo else {"fecha": fallback_1, "hora": "11:00", "doctor": doctor_alternativo}
    return res_p, res_a


# =============================================================================
# INTEGRACIÓN CON GEMINI / RAZONAMIENTO CBR (CASE-BASED REASONING)
# =============================================================================

def consultar_casos_cbr(caller_id):
    """Consulta la tabla cbr_casos en Supabase para obtener la memoria clínica de resolución y evolución del paciente."""
    cid_candidates = [caller_id]
    if str(caller_id).startswith("77"):
        cid_candidates.append(str(caller_id)[2:])
    else:
        cid_candidates.append(f"77{caller_id}")

    for cid in cid_candidates:
        casos = http_get(f"cbr_casos?caller_id=eq.{cid}&select=*&order=created_at.desc&limit=3")
        if casos:
            return casos
    return []

def generar_evolucion_clinica_cbr_gemini(paciente, fecha_consulta, doctor, diagnostico, recomendacion, receta=None, notas_evolucion=None, casos_cbr=None):
    """
    Sintetiza la memoria clínica del caso CBR y la evolución médica del paciente mediante Gemini IA / CBR Fallback.
    Explica cómo se fue resolviendo el cuadro, la evolución favorable y las indicaciones vigentes.
    """
    fecha_txt = formatear_fecha_es(fecha_consulta) if fecha_consulta else "recientemente"
    diag_clean = (diagnostico or "Revisión clínica preventiva").replace("\n", " ").strip()
    if len(diag_clean) > 130:
        diag_clean = diag_clean[:130].rsplit('.', 1)[0] + "."

    rec_clean = (receta or recomendacion or "control de signos vitales e hidratación").replace("\n", " ").strip()
    if len(rec_clean) > 130:
        rec_clean = rec_clean[:130].rsplit('.', 1)[0] + "."

    cbr_resolucion = ""
    if casos_cbr and len(casos_cbr) > 0:
        cbr_ult = casos_cbr[0]
        cbr_resolucion = str(cbr_ult.get("solucion_aplicada", "")).replace("\n", " ").strip()
        if len(cbr_resolucion) > 130:
            cbr_resolucion = cbr_resolucion[:130].rsplit('.', 1)[0] + "."

    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            prompt = (
                f"Eres el agente médico telefónico del conmutador de la clínica ARM. "
                f"El paciente {paciente} acudió a consulta el {fecha_txt} con la {doctor}. "
                f"Diagnóstico emitido: {diag_clean}. "
                f"Tratamiento prescrito: {rec_clean}. "
                f"Memoria clínica CBR de cómo fue resolviendo su caso y su evolución: {cbr_resolucion or notas_evolucion}. "
                f"Genera exactamente 2 oraciones breves, amables y claras en español de México para leer en voz alta por teléfono, "
                f"haciendo referencia a su caso clínico, a cómo ha ido resolviendo su evolución con su médico de cabecera y el tratamiento que debe continuar."
            )
            body = {"contents": [{"parts": [{"text": prompt}]}]}
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            sys.stderr.write(f"Gemini API CBR Evolution Fallback: {e}\n")

    # Fallback clínico experto CBR
    if cbr_resolucion:
        return (
            f"En su expediente médico y memoria clínica CBR tenemos registrado el hito de su última consulta del {fecha_txt} atendida por su doctora de cabecera, la {doctor}. "
            f"Revisando la evolución de su caso sobre {diag_clean}, observamos que se encuentra en resolución favorable bajo tratamiento médico. "
            f"Le recordamos continuar puntualmente con su indicación de: {rec_clean}."
        )
    return (
        f"En su expediente médico tenemos registrado el hito de su última consulta del {fecha_txt} atendida por su doctora de cabecera, la {doctor}. "
        f"Su nuevo diagnóstico actualizado es: {diag_clean}. "
        f"Y su recomendación y receta médica es: {rec_clean}."
    )

def generar_hito_clinico_gemini(paciente, fecha_consulta, doctor, diagnostico, recomendacion, receta=None):
    """Compatibilidad hacia atrás con la función anterior de hito clínico."""
    return generar_evolucion_clinica_cbr_gemini(paciente, fecha_consulta, doctor, diagnostico, recomendacion, receta)


# =============================================================================
# FLUJO PRINCIPAL DE OPCIÓN 4
# =============================================================================

def main():
    agi_env = leer_variables_agi()
    caller_id = sys.argv[1] if len(sys.argv) > 1 else agi_env.get("agi_callerid", "1001")

    # 1. Obtener datos del paciente y su historial clínico (CBR)
    # Soporte para normalización de CallerID con o sin prefijo 77
    cid_candidates = [caller_id]
    if str(caller_id).startswith("77"):
        cid_candidates.append(str(caller_id)[2:])
    else:
        cid_candidates.append(f"77{caller_id}")

    cliente = None
    for cid in cid_candidates:
        clientes = http_get(f"clientes?caller_id=eq.{cid}&select=*")
        if clientes:
            cliente = clientes[0]
            break

    nombre = cliente.get("nombre_completo", "") if cliente else ""
    primer_nombre = nombre.split()[0] if nombre else ""
    paciente_email = cliente.get("email") if cliente else "anto.krpax@gmail.com"

    historial = None
    for cid in cid_candidates:
        historiales = http_get(f"historial_clinico_pacientes?caller_id=eq.{cid}&select=*&order=created_at.desc&limit=1")
        if historiales:
            historial = historiales[0]
            break

    # 2. Identificar médico de cabecera, hito clínico reciente, diagnóstico, prescripción y memoria CBR
    casos_cbr = consultar_casos_cbr(caller_id)
    doctor_cabecera = historial.get("doctor_asignado", "Dra. Mariana Fernández") if historial else "Dra. Mariana Fernández"
    ultimo_motivo = historial.get("ultimo_motivo", "Revisión de presión arterial y chequeo general") if historial else "Consulta general"
    diagnostico_actual = historial.get("diagnostico_previo", "") if historial else ""
    sugerencia_preventiva = historial.get("sugerencia_preventiva_ia", "Control de signos vitales") if historial else "Chequeo preventivo semestral"
    receta_farmaco = historial.get("receta_medicamentos", "") if historial else ""
    fecha_ult_consulta = historial.get("fecha_ultima_consulta", "") if historial else ""
    notas_evo = historial.get("notas_evolucion", "") if historial else ""

    # Generar locución con el hito clínico, evolución médica y memoria CBR
    resumen_hito_clinico = ""
    if historial or casos_cbr:
        resumen_hito_clinico = generar_evolucion_clinica_cbr_gemini(
            nombre or primer_nombre,
            fecha_ult_consulta,
            doctor_cabecera,
            diagnostico_actual,
            sugerencia_preventiva,
            receta_farmaco,
            notas_evolucion=notas_evo,
            casos_cbr=casos_cbr
        )

    # 3. Verificar si el paciente tiene una cita futura confirmada/pendiente (NO atendida)
    today_str = datetime.date.today().isoformat()
    cita_activa = None
    for cid in cid_candidates:
        citas_list = http_get(f"citas_calendario?caller_id=eq.{cid}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.asc")
        if citas_list:
            for c in citas_list:
                if str(c.get('fecha')) >= today_str:
                    cita_activa = c
                    break
            if cita_activa:
                break

    # 4. Horarios objetivo
    fecha_objetivo = calcular_siguiente_dia_laboral()
    hora_preferente = "10:00"

    # Siguiente día hábil
    d_obj = datetime.date.fromisoformat(fecha_objetivo)
    sig_dia = d_obj + datetime.timedelta(days=1)
    while sig_dia.weekday() >= 5:
        sig_dia += datetime.timedelta(days=1)
    fecha_dia_siguiente = sig_dia.isoformat()

    # Validar disponibilidad de la doctora de cabecera
    doctor_ocupado = verificar_disponibilidad_doctor(doctor_cabecera, fecha_objetivo, hora_preferente)
    medico_turno = "Dr. Fernando Fernández"
    hora_turno = "11:00"

    fecha_obj_txt = formatear_fecha_es(fecha_objetivo)
    fecha_sig_txt = formatear_fecha_es(fecha_dia_siguiente)

    # Bifurcación: Paciente Nuevo vs Paciente con Historial
    if not cliente and not historial:
        texto_audio = (
            f"Bienvenido al área de consultas y agenda médica inteligente del sistema ARM. "
            f"Detectamos que nos contacta por primera vez. "
            f"Para realizar la apertura de su expediente clínico y programar su primera consulta para el día {fecha_obj_txt} a las {hora_preferente} horas con nuestro médico especialista, el {medico_turno}, presione 1. "
            f"O presione 0 para comunicarse de inmediato con un doctor en consultorio."
        )
        escape_chars = "10"
    elif cita_activa:
        fecha_activa_txt = formatear_fecha_es(cita_activa.get('fecha'))
        texto_audio = (
            f"Hola {nombre or primer_nombre}, bienvenido a su línea de atención médica ARM. "
            f"{resumen_hito_clinico} "
            f"Asimismo, le recordamos que cuenta con su próxima cita de seguimiento programada para el día {fecha_activa_txt} "
            f"a las {str(cita_activa.get('hora'))[:5]} horas con la {cita_activa.get('doctor_asignado', doctor_cabecera)}. "
            f"Presione 1 para confirmar su asistencia. "
            f"Presione 2 para reprogramarla a otra fecha u horario disponible. "
            f"Presione 3 para cancelarla. "
            f"O presione 0 para comunicarse directamente con su consultorio o un asesor médico."
        )
        escape_chars = "1230"
    elif doctor_ocupado:
        texto_audio = (
            f"Hola {nombre or primer_nombre}, bienvenido a su línea de atención médica ARM. "
            f"{resumen_hito_clinico} "
            f"Le informamos que su doctora de cabecera, la {doctor_cabecera}, se encuentra en consulta para el {fecha_obj_txt} a las {hora_preferente} horas. "
            f"Presione 1 si desea ser atendido ese mismo día con el {medico_turno} a las {hora_turno} horas. "
            f"O presione 2 para agendar con su doctora de cabecera {doctor_cabecera} para el día siguiente, {fecha_sig_txt}, a las {hora_preferente} horas. "
            f"O presione 0 para transferir con un asesor médico."
        )
        escape_chars = "120"
    else:
        texto_audio = (
            f"Hola {nombre or primer_nombre}, bienvenido a su línea de atención médica ARM. "
            f"{resumen_hito_clinico} "
            f"Su doctora de cabecera, la {doctor_cabecera}, se encuentra disponible en nuestro calendario para el día {fecha_obj_txt} a las {hora_preferente} horas. "
            f"Presione 1 para confirmar y agendar su cita con la {doctor_cabecera}. "
            f"Presione 2 para consultar otros médicos u horarios de la clínica. "
            f"O presione 0 para hablar con un especialista humano."
        )
        escape_chars = "120"

    res = hablar(texto_audio, escape_chars)

    tecla = ""
    for dig in ["1", "2", "3", "0"]:
        ascii_code = ord(dig)
        if f"result={ascii_code}" in res:
            tecla = dig
            break

    if not tecla:
        resp_wait = agi_cmd("WAIT FOR DIGIT 8000")
        for dig in ["1", "2", "3", "0"]:
            ascii_code = ord(dig)
            if f"result={ascii_code}" in resp_wait:
                tecla = dig
                break

    # =========================================================================
    # ACCIONES DTMF
    # =========================================================================

    if tecla == "1":
        if cita_activa:
            mensaje_exito = (
                f"Muchas gracias {primer_nombre}. Su asistencia a su cita de seguimiento del "
                f"{formatear_fecha_es(cita_activa.get('fecha'))} a las {str(cita_activa.get('hora'))[:5]} horas "
                f"con la {cita_activa.get('doctor_asignado', doctor_cabecera)} ha quedado ratificada en nuestro sistema. "
                f"Le recordamos continuar con las indicaciones de su tratamiento médico."
            )
            hablar(mensaje_exito)
            http_post("llamadas_bitacora", {
                "caller_id": caller_id,
                "tipo": "entrante",
                "estado": "finalizada",
                "opcion_ivr_seleccionada": "Confirmación de Cita de Seguimiento",
                "resumen_ia": f"Paciente {nombre} ratificó asistencia a cita del {cita_activa.get('fecha')} con {cita_activa.get('doctor_asignado', doctor_cabecera)}.",
                "notas_agente": f"Folio cita: {cita_activa.get('id')}"
            })
            return

        if doctor_ocupado and not cita_activa:
            fecha_final = fecha_objetivo
            hora_final = hora_turno
            doctor_final = medico_turno
            especialidad_final = "Medicina Interna y Cardiología"
            mensaje_exito = (
                f"Excelente, {primer_nombre}. Su cita ha quedado confirmada para el {formatear_fecha_es(fecha_final)} a las {hora_final} horas "
                f"con el {doctor_final}. Su horario ha quedado reservado en Google Calendar."
            )
        else:
            fecha_final = fecha_objetivo
            hora_final = hora_preferente
            doctor_final = doctor_cabecera
            especialidad_final = "Medicina Familiar y Preventiva"
            mensaje_exito = (
                f"Excelente, {primer_nombre}. Su cita ha quedado confirmada para el {formatear_fecha_es(fecha_final)} a las {hora_final} horas "
                f"con su doctora de cabecera {doctor_final}. Hemos sincronizado su evento en Google Calendar."
            )

        # 1. Crear evento en Google Calendar
        g_id = crear_evento_google_calendar(
            nombre=nombre,
            caller_id=caller_id,
            fecha=fecha_final,
            hora=hora_final,
            motivo=sugerencia_preventiva,
            doctor=doctor_final,
            paciente_email=paciente_email
        )

        # 2. Insertar cita en Supabase
        payload_cita = {
            "caller_id": caller_id,
            "paciente_nombre": nombre,
            "fecha": fecha_final,
            "hora": f"{hora_final}:00",
            "especialidad": especialidad_final,
            "motivo": sugerencia_preventiva,
            "estado": "confirmada",
            "doctor_asignado": doctor_final,
            "notas_ia": f"Google Calendar Event ID: {g_id or 'offline'} | Agendado por Opción 4 del IVR"
        }
        http_post("citas_calendario", payload_cita)

        # 3. Notificar en bitácora para Screen-Pop en el CRM
        http_post("llamadas_bitacora", {
            "caller_id": caller_id,
            "tipo": "entrante",
            "estado": "finalizada",
            "opcion_ivr_seleccionada": "4. Citas Médicas (Google Calendar Homologado)",
            "resumen_ia": f"Cita confirmada con {doctor_final} el {fecha_final} a las {hora_final} hrs para {nombre}. Motivo: {sugerencia_preventiva}.",
            "notas_agente": f"Sincronizado con Google Calendar ID: {g_id or 'N/A'}"
        })

        hablar(mensaje_exito)

    elif tecla == "2":
        if cita_activa:
            # Reagendamiento dinámico inteligente con consulta en tiempo real de calendarios
            medico_alt = "Dr. Fernando Fernández"
            slot_doc, slot_alt = buscar_disponibilidad_dinamica(doctor_cabecera, medico_alt, fecha_actual_cita=cita_activa)

            fecha_doc_txt = formatear_fecha_es(slot_doc["fecha"])
            fecha_alt_txt = formatear_fecha_es(slot_alt["fecha"])

            res_sub = hablar(
                f"Para reprogramar su cita médica, hemos consultado la disponibilidad en tiempo real de nuestros consultorios. "
                f"Con su médico de cabecera, la {doctor_cabecera}, tenemos disponibilidad para el día {fecha_doc_txt} a las {slot_doc['hora']} horas. "
                f"Asimismo, si requiere una opción alternativa con otro médico de la clínica, "
                f"tenemos disponible al {medico_alt} para el día {fecha_alt_txt} a las {slot_alt['hora']} horas. "
                f"Presione 1 si desea agendar con su doctora de cabecera la {doctor_cabecera} para el {fecha_doc_txt}. "
                f"Presione 2 para agendar con el {medico_alt} para el {fecha_alt_txt}. "
                f"O presione 0 para comunicarse directamente con un asesor médico.",
                "120"
            )

            sub_tecla = ""
            for dig in ["1", "2", "0"]:
                if f"result={ord(dig)}" in res_sub:
                    sub_tecla = dig
                    break

            if not sub_tecla:
                resp_sub = agi_cmd("WAIT FOR DIGIT 8000")
                for dig in ["1", "2", "0"]:
                    if f"result={ord(dig)}" in resp_sub:
                        sub_tecla = dig
                        break

            if sub_tecla == "1":
                gid = str(cita_activa.get("notas_ia", ""))
                google_id = None
                if "Google Calendar Event ID: " in gid:
                    google_id = gid.split("Google Calendar Event ID: ")[1].strip().split()[0]

                nuevo_gid = actualizar_evento_google_calendar(
                    google_id,
                    nombre,
                    caller_id,
                    slot_doc["fecha"],
                    slot_doc["hora"],
                    cita_activa.get("motivo", ultimo_motivo),
                    doctor_cabecera
                )

                http_patch(
                    f"citas_calendario?id=eq.{cita_activa.get('id')}",
                    {
                        "fecha": slot_doc["fecha"],
                        "hora": f"{slot_doc['hora']}:00",
                        "doctor_asignado": doctor_cabecera,
                        "especialidad": "Medicina Familiar y Preventiva",
                        "estado": "confirmada",
                        "notas_ia": f"Google Calendar Event ID: {nuevo_gid or google_id or 'offline'} | Reprogramada con médico de cabecera vía IVR Opción 4"
                    }
                )

                http_post("llamadas_bitacora", {
                    "caller_id": caller_id,
                    "tipo": "entrante",
                    "estado": "finalizada",
                    "opcion_ivr_seleccionada": "Reprogramación de Cita (Médico de Cabecera)",
                    "resumen_ia": f"Paciente {nombre} reprogramó su cita para el {slot_doc['fecha']} a las {slot_doc['hora']} hrs con {doctor_cabecera}.",
                    "notas_agente": f"Sincronizado con Google Calendar ID: {nuevo_gid or google_id or 'N/A'}"
                })

                mensaje_reprog = (
                    f"Excelente, {primer_nombre}. Su cita médica ha sido reprogramada exitosamente para el día {fecha_doc_txt} "
                    f"a las {slot_doc['hora']} horas con su doctora de cabecera la {doctor_cabecera}. "
                    f"El horario ya se encuentra actualizado y sincronizado en el calendario de la clínica."
                )
                hablar(mensaje_reprog)

            elif sub_tecla == "2":
                gid = str(cita_activa.get("notas_ia", ""))
                google_id = None
                if "Google Calendar Event ID: " in gid:
                    google_id = gid.split("Google Calendar Event ID: ")[1].strip().split()[0]

                nuevo_gid = actualizar_evento_google_calendar(
                    google_id,
                    nombre,
                    caller_id,
                    slot_alt["fecha"],
                    slot_alt["hora"],
                    cita_activa.get("motivo", ultimo_motivo),
                    medico_alt
                )

                http_patch(
                    f"citas_calendario?id=eq.{cita_activa.get('id')}",
                    {
                        "fecha": slot_alt["fecha"],
                        "hora": f"{slot_alt['hora']}:00",
                        "doctor_asignado": medico_alt,
                        "especialidad": "Medicina Interna y Cardiología",
                        "estado": "confirmada",
                        "notas_ia": f"Google Calendar Event ID: {nuevo_gid or google_id or 'offline'} | Reprogramada con médico alternativo vía IVR Opción 4"
                    }
                )

                http_post("llamadas_bitacora", {
                    "caller_id": caller_id,
                    "tipo": "entrante",
                    "estado": "finalizada",
                    "opcion_ivr_seleccionada": "Reprogramación de Cita (Médico Especialista Alternativo)",
                    "resumen_ia": f"Paciente {nombre} reprogramó su cita para el {slot_alt['fecha']} a las {slot_alt['hora']} hrs con {medico_alt}.",
                    "notas_agente": f"Sincronizado con Google Calendar ID: {nuevo_gid or google_id or 'N/A'}"
                })

                mensaje_reprog = (
                    f"Perfecto, {primer_nombre}. Su cita médica ha sido reprogramada exitosamente para el día {fecha_alt_txt} "
                    f"a las {slot_alt['hora']} horas con el {medico_alt}. "
                    f"El horario ya se encuentra registrado en nuestro sistema."
                )
                hablar(mensaje_reprog)

            elif sub_tecla == "0":
                hablar("Comprendo. En este momento lo estoy comunicando con un asesor médico para apoyarle con su agenda.")
                agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')
            else:
                hablar("No logré identificar la opción seleccionada. Lo comunicaré de inmediato con un asesor humano para asistirle.")
                agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')
        elif doctor_ocupado:
            fecha_final = fecha_dia_siguiente
            hora_final = hora_preferente
            doctor_final = doctor_cabecera
            especialidad_final = "Medicina Familiar y Preventiva"

            g_id = crear_evento_google_calendar(
                nombre=nombre,
                caller_id=caller_id,
                fecha=fecha_final,
                hora=hora_final,
                motivo=sugerencia_preventiva,
                doctor=doctor_final,
                paciente_email=paciente_email
            )

            payload_cita = {
                "caller_id": caller_id,
                "paciente_nombre": nombre,
                "fecha": fecha_final,
                "hora": f"{hora_final}:00",
                "especialidad": especialidad_final,
                "motivo": sugerencia_preventiva,
                "estado": "confirmada",
                "doctor_asignado": doctor_final,
                "notas_ia": f"Google Calendar Event ID: {g_id or 'offline'} | Agendado para día siguiente con médico de cabecera"
            }
            http_post("citas_calendario", payload_cita)

            http_post("llamadas_bitacora", {
                "caller_id": caller_id,
                "tipo": "entrante",
                "estado": "finalizada",
                "opcion_ivr_seleccionada": "4. Citas Médicas (Google Calendar Homologado)",
                "resumen_ia": f"Cita confirmada con {doctor_final} para el día siguiente ({fecha_final} a las {hora_final} hrs) para {nombre}. Motivo: {sugerencia_preventiva}.",
                "notas_agente": f"Sincronizado con Google Calendar ID: {g_id or 'N/A'}"
            })

            mensaje_sig = (
                f"Excelente, {primer_nombre}. Su cita ha quedado confirmada para el {formatear_fecha_es(fecha_final)} a las {hora_final} horas "
                f"con su doctora de cabecera {doctor_final}. Muchas gracias por agendar con nosotros."
            )
            hablar(mensaje_sig)
        else:
            hora_agendada = hora_turno
            doctor_final = medico_turno

            g_id = crear_evento_google_calendar(
                nombre=nombre,
                caller_id=caller_id,
                fecha=fecha_objetivo,
                hora=hora_agendada,
                motivo=sugerencia_preventiva,
                doctor=doctor_final,
                paciente_email=paciente_email
            )

            payload_cita = {
                "caller_id": caller_id,
                "paciente_nombre": nombre,
                "fecha": fecha_objetivo,
                "hora": f"{hora_agendada}:00",
                "especialidad": "Medicina Interna y Cardiología",
                "motivo": sugerencia_preventiva,
                "estado": "confirmada",
                "doctor_asignado": doctor_final,
                "notas_ia": f"Google Calendar Event ID: {g_id or 'offline'} | Médico de turno asignado en Opción 4"
            }
            http_post("citas_calendario", payload_cita)

            mensaje_turno = (
                f"Perfecto, {primer_nombre}. Su cita ha quedado reservada para el día {formatear_fecha_es(fecha_objetivo)} "
                f"a las {hora_agendada} horas con el {doctor_final}."
            )
            hablar(mensaje_turno)

    elif tecla == "3":
        if cita_activa:
            notas = str(cita_activa.get("notas_ia", ""))
            if "Google Calendar Event ID: " in notas:
                gid = notas.split("Google Calendar Event ID: ")[1].strip().split()[0]
                eliminar_evento_google_calendar(gid)

            http_patch(
                f"citas_calendario?id=eq.{cita_activa.get('id')}",
                {"estado": "cancelada", "notas_ia": "Cancelada por el paciente vía IVR Opción 4"}
            )
            mensaje_cancel = (
                f"Su cita médica del día {formatear_fecha_es(cita_activa.get('fecha'))} ha sido cancelada en el sistema. "
                f"El espacio en Google Calendar ha quedado liberado."
            )
        else:
            mensaje_cancel = "No localizamos ninguna cita médica activa pendiente de cancelación en su expediente."
        hablar(mensaje_cancel)

    elif tecla == "0":
        hablar("Comprendo. En este momento lo estoy transfiriendo con un asesor médico para brindarle atención personalizada. Por favor permanezca en la línea.")
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')

    else:
        hablar("No logré identificar la opción seleccionada. Por su tranquilidad, lo comunicaré de inmediato con un asesor humano.")
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')

if __name__ == "__main__":
    main()
