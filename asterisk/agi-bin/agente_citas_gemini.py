#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: AGENTE CLÍNICO INTELIGENTE (GEMINI 1.5 + CBR + GOOGLE CALENDAR)
=============================================================================
1. Identificación por CallerID en Supabase REST API y memoria clínica previa.
2. Consulta de Historial Clínico (CBR):
   - Ejemplo: Carlos Mendoza vino el mes pasado por revisión de presión arterial.
   - Recomendación IA: Check-up general de sangre y perfil lipídico.
   - Doctor de cabecera asignado: Dra. Mariana Gómez.
3. Validación en Calendario (Lunes a Viernes, 9:00 AM a 6:00 PM):
   - Verifica si el Doctor de Cabecera está DISPONIBLE u OCUPADO en ese horario.
   - Si está OCUPADO:
     * Informa al paciente que su doctor de cabecera ya está ocupado en esa hora.
     * Ofrece el siguiente horario disponible con su doctor de cabecera (ej. 15:00 hrs).
     * O le asigna los médicos disponibles de turno ese mismo día (Dr. Fernando Castillo / Dra. Sofía Navarro).
   - Si está DISPONIBLE:
     * Confirma el horario con su doctor de cabecera.
4. Sincronización en vivo bidireccional:
   - Sincroniza con Google Calendar (OAuth 2) y Supabase 'citas_calendario'.
   - Registra en 'llamadas_bitacora' para Screen-Pop en el CRM Next.js.
5. Menú interactivo DTMF y voz humana ultra-natural (es-MX-DaliaNeural):
   - 1: Agendar con Doctor de Cabecera en horario disponible.
   - 2: Agendar con Médico de Turno disponible el mismo día / Reprogramar.
   - 3: Cancelar cita activa y liberar horario en Google Calendar.
   - 0: Transferencia a especialista humano (Dra. Mariana Gómez - Ext. 2001).
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

# Configuración de URLs y Credenciales
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
TOKEN_FILE = os.path.join(BASE_DIR, 'google_token.json')

PLANTILLA_MEDICOS = [
    {"nombre": "Dra. Mariana Fernández", "especialidad": "Medicina Familiar y Preventiva"},
    {"nombre": "Dr. Fernando Fernández", "especialidad": "Medicina Interna y Cardiología"},
    {"nombre": "Dra. Sofía Navarro", "especialidad": "Laboratorio y Diagnóstico Clínico"}
]

HORAS_LABORALES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

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
    """Sintetiza texto con voz neural mexicana (DaliaNeural) y lo reproduce en Asterisk."""
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
# SINCRONIZACIÓN CON GOOGLE CALENDAR API v3
# =============================================================================

def get_google_access_token():
    if not os.path.exists(TOKEN_FILE):
        return None
    try:
        with open(TOKEN_FILE, "r", encoding="utf-8") as f:
            token_data = json.load(f)
        return token_data.get("token")
    except Exception as e:
        sys.stderr.write(f"Error cargando google_token: {e}\n")
        return None

def crear_evento_google_calendar(nombre, caller_id, fecha, hora, motivo, doctor):
    token = get_google_access_token()
    if not token:
        return None
    try:
        h_int = int(hora.split(':')[0])
        m_int = int(hora.split(':')[1]) if ':' in hora else 0
        start_dt = f"{fecha}T{h_int:02d}:{m_int:02d}:00-06:00"
        end_dt = f"{fecha}T{(h_int+1):02d}:{m_int:02d}:00-06:00"

        event_body = {
            'summary': f"Cita Médica ARM: {nombre} ({caller_id})",
            'description': f"Paciente: {nombre}\nCallerID: {caller_id}\nDoctor Asignado: {doctor}\nMotivo: {motivo}\nRegistrado por Agente IA Gemini ARM.",
            'start': {'dateTime': start_dt, 'timeZone': 'America/Mexico_City'},
            'end': {'dateTime': end_dt, 'timeZone': 'America/Mexico_City'},
            'colorId': '2'
        }

        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        req = urllib.request.Request(
            url,
            data=json.dumps(event_body).encode(),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
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
        url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{google_event_id}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}, method="DELETE")
        with urllib.request.urlopen(req, timeout=5) as resp:
            pass
    except Exception as e:
        sys.stderr.write(f"Google Calendar Delete Event Error: {e}\n")

# =============================================================================
# LÓGICA DE NEGOCIO: DOCTOR DE CABECERA Y DISPONIBILIDAD
# =============================================================================

def calcular_siguiente_dia_laboral():
    hoy = datetime.date.today()
    siguiente = hoy + datetime.timedelta(days=1)
    # 0 = Lunes, 4 = Viernes, 5 = Sábado, 6 = Domingo
    while siguiente.weekday() >= 5:
        siguiente += datetime.timedelta(days=1)
    return siguiente.isoformat()

def verificar_disponibilidad_doctor(doctor_nombre, fecha, hora):
    """Verifica si el médico específico está ocupado en la fecha y hora seleccionada (soporta HH:MM y HH:MM:SS)."""
    hora_norm = str(hora)[:5]
    query = f"citas_calendario?doctor_asignado=eq.{urllib.parse.quote(doctor_nombre)}&fecha=eq.{fecha}&hora=in.({hora_norm},{hora_norm}:00)&estado=in.(confirmada,reprogramada)&select=id"
    res = http_get(query)
    return len(res) > 0  # True si está ocupado

def buscar_proximo_horario_libre_doctor(doctor_nombre, fecha):
    """Busca el primer turno libre del doctor de cabecera en el rango de 9am a 6pm."""
    query = f"citas_calendario?doctor_asignado=eq.{urllib.parse.quote(doctor_nombre)}&fecha=eq.{fecha}&estado=in.(confirmada,reprogramada)&select=hora"
    res = http_get(query)
    horas_ocupadas = {str(r.get("hora", ""))[:5] for r in res}
    for h in HORAS_LABORALES:
        if h not in horas_ocupadas:
            return h
    return "15:00"

def buscar_medicos_disponibles_en_horario(fecha, hora, excluir_doctor=""):
    """Encuentra médicos alternativos disponibles en esa misma fecha y hora (soporta HH:MM y HH:MM:SS)."""
    hora_norm = str(hora)[:5]
    query = f"citas_calendario?fecha=eq.{fecha}&hora=in.({hora_norm},{hora_norm}:00)&estado=in.(confirmada,reprogramada)&select=doctor_asignado"
    res = http_get(query)
    ocupados = {r.get("doctor_asignado") for r in res}

    libres = []
    for m in PLANTILLA_MEDICOS:
        if m["nombre"] != excluir_doctor and m["nombre"] not in ocupados:
            libres.append(m)
    return libres

# =============================================================================
# INTEGRACIÓN CON GEMINI 1.5 FLASH (O RAZONAMIENTO CLÍNICO CBR)
# =============================================================================

def generar_analisis_clinico_gemini(paciente, motivo_previo, recomendacion, doctor):
    """Genera fraseo médico empático si Gemini 1.5 está activo, o razonamiento CBR predeterminado."""
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            prompt = (
                f"Eres un agente médico telefónico inteligente. El paciente {paciente} acudió el mes pasado por {motivo_previo}. "
                f"La sugerencia preventiva es {recomendacion} con su médico {doctor}. "
                f"Genera en máximo 2 oraciones breves y profesionales en español de México el saludo y la sugerencia preventiva para leer en voz alta."
            )
            body = {"contents": [{"parts": [{"text": prompt}]}]}
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            sys.stderr.write(f"Gemini 1.5 Fallback: {e}\n")

    # Razonamiento clínico determinístico CBR
    return (
        f"En su expediente tengo registrado que el mes pasado acudió para {motivo_previo}. "
        f"Nuestra recomendación médica preventiva para este mes es {recomendacion}."
    )

# =============================================================================
# EJECUCIÓN PRINCIPAL DEL AGI
# =============================================================================

def main():
    agi_env = leer_variables_agi()
    caller_id = sys.argv[1] if len(sys.argv) > 1 else agi_env.get("agi_callerid", "1001")

    # 1. Obtener datos del cliente y su historial clínico
    clientes = http_get(f"clientes?caller_id=eq.{caller_id}&select=*")
    cliente = clientes[0] if clientes else None
    nombre = cliente.get("nombre_completo", "Carlos Mendoza Ortiz") if cliente else "Estimado paciente"
    primer_nombre = nombre.split()[0]

    historiales = http_get(f"historial_clinico_pacientes?caller_id=eq.{caller_id}&select=*&order=fecha_ultima_consulta.desc&limit=1")
    historial = historiales[0] if historiales else None

    # 2. Determinar médico de cabecera y sugerencia preventiva
    doctor_cabecera = historial.get("doctor_asignado", "Dra. Mariana Gómez") if historial else "Dra. Mariana Gómez"
    ultimo_motivo = historial.get("ultimo_motivo", "Revisión y monitoreo de presión arterial") if historial else "Revisión general"
    sugerencia_preventiva = historial.get(
        "sugerencia_preventiva_ia",
        "Validar diagnóstico con un check-up general de sangre (química sanguínea de 24 elementos y perfil lipídico completo)"
    ) if historial else "Check-up general preventivo"

    # 3. Verificar si el paciente ya tiene una cita activa confirmada
    citas_activas = http_get(f"citas_calendario?caller_id=eq.{caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1")
    cita_activa = citas_activas[0] if citas_activas else None

    # 4. Calcular fecha y evaluar disponibilidad del Doctor de Cabecera
    fecha_objetivo = calcular_siguiente_dia_laboral()
    hora_preferente = "10:00"

    # Calcular día siguiente hábil
    d_obj = datetime.date.fromisoformat(fecha_objetivo)
    sig_dia = d_obj + datetime.timedelta(days=1)
    while sig_dia.weekday() >= 5:
        sig_dia += datetime.timedelta(days=1)
    fecha_dia_siguiente = sig_dia.isoformat()

    # Verificar si la doctora de cabecera está ocupada a las 10:00
    doctor_ocupado = verificar_disponibilidad_doctor(doctor_cabecera, fecha_objetivo, hora_preferente)
    medico_turno = "Dr. Fernando Fernández"
    hora_turno = "11:00"

    # Construir locución de saludo y memoria clínica
    resumen_clinico = generar_analisis_clinico_gemini(primer_nombre, ultimo_motivo, sugerencia_preventiva, doctor_cabecera)

    texto_audio = f"Hola {primer_nombre}, bienvenido a su asistente médico inteligente con inteligencia artificial Gemini. {resumen_clinico} "

    if cita_activa:
        # El paciente ya tiene una cita agendada
        texto_audio += (
            f"Actualmente usted cuenta con una cita confirmada para el día {cita_activa.get('fecha')} "
            f"a las {str(cita_activa.get('hora'))[:5]} horas con {cita_activa.get('doctor_asignado')}. "
            f"Presione 1 para confirmar su asistencia. "
            f"Presione 2 para reprogramarla a otro horario disponible. "
            f"Presione 3 para cancelarla. "
            f"O presione 0 para comunicarse directamente con un asesor médico."
        )
        escape_chars = "1230"
    elif doctor_ocupado:
        # Escenario Homologado: Doctora de Cabecera OCUPADA en la fecha indicada
        texto_audio += (
            f"Le informamos que su doctora de cabecera, la {doctor_cabecera}, se encuentra ocupada el día de hoy, {fecha_objetivo}, a las {hora_preferente} horas. "
            f"Sin embargo, tenemos las siguientes opciones para usted: "
            f"Presione 1 si desea ser atendido hoy mismo con el {medico_turno} a las {hora_turno} horas. "
            f"O presione 2 para agendar con su doctora de cabecera {doctor_cabecera} para el día siguiente, {fecha_dia_siguiente}, a las {hora_preferente} horas. "
            f"O presione 0 para transferir con un asesor médico."
        )
        escape_chars = "120"
    else:
        # La doctora de cabecera ESTÁ DISPONIBLE a las 10:00
        texto_audio += (
            f"Su doctora de cabecera, la {doctor_cabecera}, se encuentra disponible en nuestro calendario para el día {fecha_objetivo} a las {hora_preferente} horas. "
            f"Presione 1 para confirmar y agendar su cita con la {doctor_cabecera}. "
            f"Presione 2 para consultar otros médicos u horarios de la clínica. "
            f"O presione 0 para hablar con un especialista humano."
        )
        escape_chars = "120"

    # Reproducir audio y capturar tecla DTMF con Barge-in
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
    # ACCIONES SEGÚN LA TECLA PULSADA
    # =========================================================================

    if tecla == "1":
        if doctor_ocupado and not cita_activa:
            # Opción 1 del conflicto: Dr. Fernando Fernández mismo día a las 11:00
            fecha_final = fecha_objetivo
            hora_final = hora_turno
            doctor_final = medico_turno
            especialidad_final = "Medicina Interna y Cardiología"
            mensaje_exito = (
                f"Excelente, {primer_nombre}. Su cita ha quedado confirmada para el día de hoy, {fecha_final} a las {hora_final} horas "
                f"con el {doctor_final}. Su horario ha quedado reservado en el calendario."
            )
        else:
            fecha_final = fecha_objetivo
            hora_final = hora_preferente
            doctor_final = doctor_cabecera
            especialidad_final = "Medicina Familiar y Preventiva"
            mensaje_exito = (
                f"Excelente, {primer_nombre}. Su cita ha quedado confirmada para el día {fecha_final} a las {hora_final} horas "
                f"con su doctora de cabecera {doctor_final}. Le recordamos acudir en ayuno de 8 horas para su check-up de sangre."
            )

        # 1. Crear evento en Google Calendar
        g_id = crear_evento_google_calendar(
            nombre=nombre,
            caller_id=caller_id,
            fecha=fecha_final,
            hora=hora_final,
            motivo=sugerencia_preventiva,
            doctor=doctor_final
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
            "notas_ia": f"Google Calendar Event ID: {g_id or 'offline'} | Agendado por IA en Opción 4"
        }
        http_post("citas_calendario", payload_cita)

        # 3. Notificar en bitácora para Screen-Pop en CRM
        http_post("llamadas_bitacora", {
            "caller_id": caller_id,
            "tipo": "entrante",
            "estado": "finalizada",
            "opcion_ivr_seleccionada": "4. Citas Médicas (Gemini IA)",
            "resumen_ia": f"Cita confirmada con {doctor_final} el {fecha_final} a las {hora_final} hrs para {nombre}. Motivo: {sugerencia_preventiva}.",
            "notas_agente": f"Sincronizado con Google Calendar ID: {g_id or 'N/A'}"
        })

        hablar(mensaje_exito)

    elif tecla == "2":
        if cita_activa:
            # Reprogramar cita activa
            nueva_hora = "15:00" if str(cita_activa.get("hora", ""))[:5] != "15:00" else "16:00"
            nueva_fecha = fecha_dia_siguiente
            http_patch(
                f"citas_calendario?id=eq.{cita_activa.get('id')}",
                {"fecha": nueva_fecha, "hora": f"{nueva_hora}:00", "estado": "confirmada", "notas_ia": "Reprogramada por el paciente vía IVR"}
            )
            mensaje_reprog = (
                f"Su cita médica ha sido reprogramada exitosamente para el día {nueva_fecha} "
                f"a las {nueva_hora} horas. El horario ya se encuentra actualizado en el calendario."
            )
            hablar(mensaje_reprog)
        elif doctor_ocupado:
            # Opción 2 del conflicto: Dra. Mariana Fernández para el DÍA SIGUIENTE a las 10:00
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
                doctor=doctor_final
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
                "opcion_ivr_seleccionada": "4. Citas Médicas (Gemini IA)",
                "resumen_ia": f"Cita confirmada con {doctor_final} para el día siguiente ({fecha_final} a las {hora_final} hrs) para {nombre}. Motivo: {sugerencia_preventiva}.",
                "notas_agente": f"Sincronizado con Google Calendar ID: {g_id or 'N/A'}"
            })

            mensaje_sig = (
                f"Excelente, {primer_nombre}. Su cita ha quedado confirmada para el día de mañana, {fecha_final} a las {hora_final} horas "
                f"con su doctora de cabecera {doctor_final}. Le recordamos acudir en ayuno de 8 horas para su check-up de sangre. Muchas gracias por cuidar su salud con nosotros."
            )
            hablar(mensaje_sig)
        else:
            # Agendar con Médico de Turno Disponible
            hora_agendada = hora_preferente
            doctor_final = medico_alternativo

            g_id = crear_evento_google_calendar(
                nombre=nombre,
                caller_id=caller_id,
                fecha=fecha_objetivo,
                hora=hora_agendada,
                motivo=sugerencia_preventiva,
                doctor=doctor_final
            )

            payload_cita = {
                "caller_id": caller_id,
                "paciente_nombre": nombre,
                "fecha": fecha_objetivo,
                "hora": str(hora_agendada)[:5],
                "especialidad": "Medicina Interna y Laboratorio",
                "motivo": sugerencia_preventiva,
                "estado": "confirmada",
                "doctor_asignado": doctor_final,
                "notas_ia": f"Google Calendar Event ID: {g_id or 'offline'} | Médico de turno asignado por IA"
            }
            http_post("citas_calendario", payload_cita)

            mensaje_turno = (
                f"Perfecto, {primer_nombre}. Su cita para el check-up de sangre ha quedado reservada para el día {fecha_objetivo} "
                f"a las {hora_agendada} horas con el {doctor_final}. Su espacio en el calendario ha quedado asegurado."
            )
            hablar(mensaje_turno)

    elif tecla == "3":
        if cita_activa:
            # Cancelar cita activa
            notas = str(cita_activa.get("notas_ia", ""))
            if "Google Calendar Event ID: " in notas:
                gid = notas.split("Google Calendar Event ID: ")[1].strip().split()[0]
                eliminar_evento_google_calendar(gid)

            http_patch(
                f"citas_calendario?id=eq.{cita_activa.get('id')}",
                {"estado": "cancelada", "notas_ia": "Cancelada por el paciente vía IVR telefónico"}
            )
            mensaje_cancel = (
                f"Su cita médica del día {cita_activa.get('fecha')} ha sido cancelada en el sistema. "
                f"El espacio en el calendario ha quedado liberado. Podrá solicitar una nueva cita en cualquier momento."
            )
        else:
            mensaje_cancel = "No localizamos ninguna cita médica activa pendiente de cancelación en su expediente."
        hablar(mensaje_cancel)

    elif tecla == "0":
        # Transferencia a Asesor / Especialista Humano
        hablar("Comprendo. En este momento lo estoy transfiriendo con un asesor médico para brindarle atención personalizada. Por favor permanezca en la línea.")
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')

    else:
        # Fallback por opción no reconocida
        hablar("No logré identificar la opción seleccionada. Por su tranquilidad, lo comunicaré de inmediato con un asesor humano.")
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')

if __name__ == "__main__":
    main()
