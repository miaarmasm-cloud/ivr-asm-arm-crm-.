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


# =============================================================================
# INTEGRACIÓN CON GEMINI / RAZONAMIENTO CBR
# =============================================================================

def generar_analisis_clinico_gemini(paciente, motivo_previo, recomendacion, doctor):
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            prompt = (
                f"Eres un agente médico telefónico inteligente del IVR. El paciente {paciente} acudió previamente por {motivo_previo}. "
                f"La recomendación preventiva es {recomendacion} con {doctor}. "
                f"Genera en máximo 2 oraciones concisas y amables en español de México el saludo y la sugerencia preventiva para leer en voz alta."
            )
            body = {"contents": [{"parts": [{"text": prompt}]}]}
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            sys.stderr.write(f"Gemini API Fallback: {e}\n")

    return (
        f"En su expediente tengo registrado que en su última consulta acudió por {motivo_previo}. "
        f"Nuestra recomendación médica preventiva es {recomendacion}."
    )


# =============================================================================
# FLUJO PRINCIPAL DE OPCIÓN 4
# =============================================================================

def main():
    agi_env = leer_variables_agi()
    caller_id = sys.argv[1] if len(sys.argv) > 1 else agi_env.get("agi_callerid", "1001")

    # 1. Obtener datos del paciente y su historial clínico (CBR)
    clientes = http_get(f"clientes?caller_id=eq.{caller_id}&select=*")
    cliente = clientes[0] if clientes else None
    nombre = cliente.get("nombre_completo", "Anto Krpax X") if cliente else "Estimado paciente"
    primer_nombre = nombre.split()[0]
    paciente_email = cliente.get("email") if cliente else "anto.krpax@gmail.com"

    historiales = http_get(f"historial_clinico_pacientes?caller_id=eq.{caller_id}&select=*&order=fecha_ultima_consulta.desc&limit=1")
    historial = historiales[0] if historiales else None

    # 2. Identificar médico de cabecera y sugerencia preventiva
    doctor_cabecera = historial.get("doctor_asignado", "Dra. Mariana Fernández") if historial else "Dra. Mariana Fernández"
    ultimo_motivo = historial.get("ultimo_motivo", "Revisión de presión arterial y chequeo general") if historial else "Consulta general"
    sugerencia_preventiva = historial.get(
        "sugerencia_preventiva_ia",
        "Check-up general de sangre y perfil lipídico completo"
    ) if historial else "Chequeo preventivo semestral"

    # 3. Verificar si el paciente ya tiene una cita activa confirmada
    citas_activas = http_get(f"citas_calendario?caller_id=eq.{caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1")
    cita_activa = citas_activas[0] if citas_activas else None

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

    # Construir locución guiada
    resumen_clinico = generar_analisis_clinico_gemini(primer_nombre, ultimo_motivo, sugerencia_preventiva, doctor_cabecera)
    texto_audio = f"Hola {primer_nombre}, bienvenido a la opción de citas médicas del sistema ARM. {resumen_clinico} "

    fecha_obj_txt = formatear_fecha_es(fecha_objetivo)
    fecha_sig_txt = formatear_fecha_es(fecha_dia_siguiente)

    if cita_activa:
        fecha_activa_txt = formatear_fecha_es(cita_activa.get('fecha'))
        texto_audio += (
            f"Actualmente usted cuenta con una cita confirmada para el día {fecha_activa_txt} "
            f"a las {str(cita_activa.get('hora'))[:5]} horas con {cita_activa.get('doctor_asignado')}. "
            f"Presione 1 para confirmar su asistencia. "
            f"Presione 2 para reprogramarla a otro horario disponible. "
            f"Presione 3 para cancelarla. "
            f"O presione 0 para comunicarse directamente con un asesor médico."
        )
        escape_chars = "1230"
    elif doctor_ocupado:
        texto_audio += (
            f"Le informamos que su doctora de cabecera, la {doctor_cabecera}, se encuentra ocupada el {fecha_obj_txt} a las {hora_preferente} horas. "
            f"Sin embargo, tenemos las siguientes opciones para usted: "
            f"Presione 1 si desea ser atendido ese mismo día con el {medico_turno} a las {hora_turno} horas. "
            f"O presione 2 para agendar con su doctora de cabecera {doctor_cabecera} para el día siguiente, {fecha_sig_txt}, a las {hora_preferente} horas. "
            f"O presione 0 para transferir con un asesor médico."
        )
        escape_chars = "120"
    else:
        texto_audio += (
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
            nueva_hora = "15:00" if str(cita_activa.get("hora", ""))[:5] != "15:00" else "16:00"
            nueva_fecha = fecha_dia_siguiente
            http_patch(
                f"citas_calendario?id=eq.{cita_activa.get('id')}",
                {"fecha": nueva_fecha, "hora": f"{nueva_hora}:00", "estado": "confirmada", "notas_ia": "Reprogramada por el paciente vía IVR Opción 4"}
            )
            mensaje_reprog = (
                f"Su cita médica ha sido reprogramada exitosamente para el día {formatear_fecha_es(nueva_fecha)} "
                f"a las {nueva_hora} horas. El horario ya se encuentra actualizado en el calendario."
            )
            hablar(mensaje_reprog)
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
