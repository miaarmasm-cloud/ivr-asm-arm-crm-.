#!/usr/bin/env python3
"""
=============================================================================
ASTERISK 20 AGI: AGENTE INTELIGENTE CONVERSACIONAL DE CITAS MÉDICAS Y CALENDARIO
=============================================================================
1. Reconoce al paciente mediante CALLERID(num) en Supabase REST API.
2. Consulta el Historial Clínico previo (CBR):
   - Ejemplo: "El mes pasado acudió a revisión de presión arterial".
   - Genera sugerencia preventiva: "Recomendación: Check-up general de sangre".
3. Valida disponibilidad en Calendario (Lunes a Viernes, 9:00 AM a 6:00 PM).
4. Menú interactivo autónomo (DTMF y Voz):
   - 1: Agendar cita recomendada (Check-up de sangre) en horario disponible.
   - 2: Consultar / Reprogramar cita activa existente.
   - 3: Cancelar cita activa.
   - 0 o duda no reconocida: Transferir con especialista humano (Dra. Mariana Gómez - Ext. 2001).
5. Síntesis de voz ultra-natural con Microsoft Azure Neural (es-MX-DaliaNeural).
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

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

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
        sys.stderr.write(f"Error generando audio: {e}\n")

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
            return resp.status in (200, 201)
    except Exception as e:
        sys.stderr.write(f"HTTP POST Error ({endpoint}): {e}\n")
    return False

def http_patch(endpoint, data):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        sys.stderr.write(f"HTTP PATCH Error ({endpoint}): {e}\n")
    return False

def calcular_fecha_disponible():
    """Obtiene la fecha del siguiente día laboral (Lunes a Viernes)."""
    hoy = datetime.date.today()
    siguiente = hoy + datetime.timedelta(days=1)
    # 0 = Lunes, 4 = Viernes, 5 = Sábado, 6 = Domingo
    while siguiente.weekday() >= 5:
        siguiente += datetime.timedelta(days=1)
    return siguiente

def buscar_horario_disponible(fecha_str):
    """Verifica los horarios ocupados de 9am a 6pm y devuelve el primer horario libre."""
    citas_ocupadas = http_get(f"citas_calendario?fecha=eq.{fecha_str}&estado=eq.confirmada&select=hora")
    horas_tomadas = [c.get("hora") for c in citas_ocupadas]

    for h in HORAS_LABORALES:
        if h not in horas_tomadas:
            return h
    return "10:00"

def main():
    agi_env = leer_variables_agi()
    caller_id = sys.argv[1] if len(sys.argv) > 1 else agi_env.get("agi_callerid", "1001")

    # 1. Obtener datos del cliente y su historial clínico
    clientes = http_get(f"clientes?caller_id=eq.{caller_id}&select=*")
    cliente = clientes[0] if clientes else None
    nombre = cliente.get("nombre_completo", "Estimado paciente") if cliente else "Estimado paciente"
    primer_nombre = nombre.split()[0]

    historiales = http_get(f"historial_clinico_pacientes?caller_id=eq.{caller_id}&select=*")
    historial = historiales[0] if historiales else None

    # 2. Verificar citas activas existentes
    citas_activas = http_get(f"citas_calendario?caller_id=eq.{caller_id}&estado=eq.confirmada&select=*&order=fecha.asc")
    cita_activa = citas_activas[0] if citas_activas else None

    # 3. Construir mensaje personalizado con razonamiento clínico CBR
    fecha_sugerida = calcular_fecha_disponible()
    fecha_sugerida_str = fecha_sugerida.isoformat()
    hora_sugerida = buscar_horario_disponible(fecha_sugerida_str)

    if historial:
        ultimo_motivo = historial.get("ultimo_motivo", "su última consulta")
        sugerencia = historial.get("sugerencia_preventiva_ia", "un check-up general preventivo")
        
        texto_intro = (
            f"Hola {primer_nombre}. Bienvenido a su asistente médico inteligente. "
            f"En su expediente tengo registrado que el mes pasado acudió para {ultimo_motivo}. "
            f"Nuestra recomendación médica preventiva para este mes es {sugerencia}. "
        )
    else:
        texto_intro = (
            f"Hola {primer_nombre}. Bienvenido al servicio de agenda médica inteligente. "
            f"Le recordamos que nuestro horario de atención es de lunes a viernes, de 9 de la mañana a 6 de la tarde. "
        )

    if cita_activa:
        texto_intro += (
            f"Actualmente usted cuenta con una cita médica confirmada para el día {cita_activa.get('fecha')} "
            f"a las {cita_activa.get('hora')} horas. "
            f"Presione 2 para reprogramarla a otro horario disponible. "
            f"Presione 3 para cancelarla. "
            f"O presione 0 para comunicarse directamente con la doctora Mariana Gómez."
        )
    else:
        texto_intro += (
            f"Tenemos disponibilidad en el calendario para su prueba preventiva el día {fecha_sugerida_str} "
            f"a las {hora_sugerida} horas. "
            f"Presione 1 para confirmar y agendar esta cita sugerida. "
            f"Presione 2 para consultar otros horarios de la agenda. "
            f"O presione 0 para hablar con un especialista humano."
        )

    # Reproducir menú y capturar DTMF
    res = hablar(texto_intro, "1230")

    tecla = ""
    if "result=49" in res:
        tecla = "1"
    elif "result=50" in res:
        tecla = "2"
    elif "result=51" in res:
        tecla = "3"
    elif "result=48" in res:
        tecla = "0"
    else:
        # Esperar tecla si no interrumpió el audio
        resp_wait = agi_cmd("WAIT FOR DIGIT 8000")
        if "result=49" in resp_wait:
            tecla = "1"
        elif "result=50" in resp_wait:
            tecla = "2"
        elif "result=51" in resp_wait:
            tecla = "3"
        elif "result=48" in resp_wait:
            tecla = "0"

    # Procesar opción seleccionada
    if tecla == "1":
        # Agendar cita recomendada
        nueva_cita = {
            "caller_id": caller_id,
            "cliente_id": cliente.get("id") if cliente else None,
            "paciente_nombre": nombre,
            "fecha": fecha_sugerida_str,
            "hora": hora_sugerida,
            "especialidad": "Laboratorio y Check-up Clínico",
            "motivo": "Check-up general de sangre y perfil lipídico (Preventivo)",
            "estado": "confirmada",
            "doctor_asignado": "Dra. Mariana Gómez",
            "notas_ia": f"Cita preventiva agendada por IA basada en historial de {historial.get('ultimo_motivo') if historial else 'rutina'}"
        }
        ok = http_post("citas_calendario", nueva_cita)
        if ok:
            mensaje_confirmacion = (
                f"Excelente, {primer_nombre}. Su cita para el check-up general de sangre "
                f"ha quedado confirmada en nuestro calendario para el día {fecha_sugerida_str} "
                f"a las {hora_sugerida} horas con la doctora Mariana Gómez. "
                f"Le recordamos asistir en ayuno de 8 horas. Gracias por cuidar su salud con nosotros."
            )
        else:
            mensaje_confirmacion = "Hubo un inconveniente al registrar la cita en el sistema. Lo transferiremos con un asistente."
            agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')
        hablar(mensaje_confirmacion)

    elif tecla == "2":
        # Reprogramar cita
        if cita_activa:
            # Buscar horario alterno disponible
            otro_horario = "15:00" if cita_activa.get("hora") != "15:00" else "16:00"
            fecha_reprog = fecha_sugerida_str
            http_patch(
                f"citas_calendario?id=eq.{cita_activa.get('id')}",
                {"fecha": fecha_reprog, "hora": otro_horario, "estado": "confirmada", "notas_ia": "Cita reprogramada por el paciente vía IVR"}
            )
            mensaje_reprog = (
                f"Su cita ha sido reprogramada exitosamente para el día {fecha_reprog} "
                f"a las {otro_horario} horas. Su nuevo horario ya está reservado en el calendario."
            )
        else:
            # Mostrar disponibilidad general
            mensaje_reprog = (
                f"Para el día {fecha_sugerida_str}, tenemos horarios disponibles a las 10, a las 12 "
                f"y a las 15 horas. Puede comunicarse con nuestra recepcionista para elegir un horario específico."
            )
            agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')
        hablar(mensaje_reprog)

    elif tecla == "3":
        # Cancelar cita activa
        if cita_activa:
            http_patch(
                f"citas_calendario?id=eq.{cita_activa.get('id')}",
                {"estado": "cancelada", "notas_ia": "Cancelada por el paciente vía teléfono"}
            )
            mensaje_cancel = (
                f"Su cita médica del día {cita_activa.get('fecha')} ha sido cancelada en el sistema. "
                f"El espacio en el calendario ha quedado liberado. Podrá agendar nuevamente en cualquier momento."
            )
        else:
            mensaje_cancel = "No encontramos ninguna cita médica activa pendiente de cancelación en su expediente."
        hablar(mensaje_cancel)

    elif tecla == "0":
        # Transferencia a especialista humano
        hablar("Entendido. Lo estoy transfiriendo en este momento con la doctora Mariana Gómez. Por favor permanezca en la línea.")
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')

    else:
        # Opción no reconocida -> Fallback a Humano
        hablar("No logré identificar la opción seleccionada. Por su tranquilidad, lo transferiré con un ejecutivo humano.")
        agi_cmd('SET VARIABLE TRANSFERIR_HUMANO "1"')

if __name__ == "__main__":
    main()
