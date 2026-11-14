"""
=============================================================================
SERVIDOR MCP GOOGLE CALENDAR & GESTION DE CITAS ARM
=============================================================================
Herramientas MCP para:
1. Validar disponibilidad de citas (Lunes a Viernes, 9:00 AM a 6:00 PM).
2. Agendar citas con sincronizacion bidireccional (Google Calendar + Supabase).
3. Reprogramar y cancelar citas usando CallerID como identificador.
4. Consulta de memoria clinica CBR (Historial del paciente + sugerencias preventivas).
=============================================================================
"""

import os
import sys
import json
import datetime
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional
from mcp.server.fastmcp import FastMCP
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

mcp = FastMCP("google-calendar-arm")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'google_credentials.json')
TOKEN_FILE = os.path.join(BASE_DIR, 'google_token.json')
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def db_get(endpoint: str):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode())
    except Exception as e:
        sys.stderr.write(f"DB GET Error ({endpoint}): {e}\n")
    return []

def db_post(endpoint: str, data: dict):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201):
                return json.loads(resp.read().decode())
    except Exception as e:
        sys.stderr.write(f"DB POST Error ({endpoint}): {e}\n")
    return None

def db_patch(endpoint: str, data: dict):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 204):
                raw = resp.read().decode()
                return json.loads(raw) if raw else {"status": "ok"}
    except Exception as e:
        sys.stderr.write(f"DB PATCH Error ({endpoint}): {e}\n")
    return None

def get_calendar_service():
    """Obtiene una instancia autenticada del cliente de Google Calendar v3."""
    if not os.path.exists(TOKEN_FILE):
        return None
    try:
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
                f.write(creds.to_json())
        return build('calendar', 'v3', credentials=creds)
    except Exception as e:
        sys.stderr.write(f"[Google Calendar] Error cargando credenciales: {e}\n")
        return None

# =============================================================================
# HERRAMIENTAS MCP: DISPONIBILIDAD Y CITAS
# =============================================================================

@mcp.tool()
def gcal_listar_disponibilidad(fecha: str) -> Dict[str, Any]:
    """
    Verifica los horarios disponibles para una fecha (formato YYYY-MM-DD).
    Valida rango de 9:00 AM a 6:00 PM de Lunes a Viernes.
    """
    try:
        dt = datetime.datetime.strptime(fecha, "%Y-%m-%d")
    except ValueError:
        return {"error": "Formato de fecha invalido. Use YYYY-MM-DD"}

    # Lunes=0, Viernes=4, Sabado=5, Domingo=6
    if dt.weekday() > 4:
        dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
        return {
            "disponible": False,
            "motivo": f"El dia {fecha} es {dias[dt.weekday()]}. Atencion solo de Lunes a Viernes de 9:00 a 18:00 hrs.",
            "horarios_disponibles": []
        }

    service = get_calendar_service()
    horarios_totales = [f"{h:02d}:00" for h in range(9, 18)] # 09:00 a 17:00 (turnos de 1 hr)
    horarios_ocupados = set()

    if service:
        try:
            start_time = f"{fecha}T00:00:00Z"
            end_time = f"{fecha}T23:59:59Z"
            events_result = service.events().list(
                calendarId='primary',
                timeMin=start_time,
                timeMax=end_time,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            for ev in events_result.get('items', []):
                start = ev.get('start', {}).get('dateTime', '')
                if 'T' in start:
                    hora = start.split('T')[1][:5]
                    horarios_ocupados.add(hora)
        except Exception as e:
            sys.stderr.write(f"[Google Calendar Query Error] {e}\n")

    # Tambien verificar en base de datos Supabase
    citas_db = db_get(f"citas_calendario?fecha=eq.{fecha}&estado=eq.confirmada&select=hora")
    for r in citas_db:
        hora_str = str(r.get("hora", ""))[:5]
        horarios_ocupados.add(hora_str)

    libres = [h for h in horarios_totales if h not in horarios_ocupados]

    return {
        "disponible": len(libres) > 0,
        "fecha": fecha,
        "dia_semana": ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"][dt.weekday()],
        "horarios_disponibles": libres,
        "horarios_ocupados": list(horarios_ocupados)
    }


@mcp.tool()
def gcal_agendar_cita(caller_id: str, nombre: str, fecha: str, hora: str, motivo: str) -> Dict[str, Any]:
    """
    Agenda una nueva cita médica o de servicio sincronizando Google Calendar y Supabase.
    Parámetros:
      caller_id: Identificador del llamante / paciente.
      nombre: Nombre del paciente.
      fecha: YYYY-MM-DD
      hora: HH:MM (9:00 a 17:00)
      motivo: Diagnóstico o chequeo solicitado.
    """
    # Validar disponibilidad
    disp = gcal_listar_disponibilidad(fecha)
    if not disp.get("disponible") or hora not in disp.get("horarios_disponibles", []):
        return {
            "success": False,
            "error": f"El horario {hora} del dia {fecha} no esta disponible o fuera de horario (L-V 9:00 a 18:00)."
        }

    google_event_id = None
    service = get_calendar_service()
    if service:
        try:
            h_int = int(hora.split(':')[0])
            m_int = int(hora.split(':')[1]) if ':' in hora else 0
            start_dt = f"{fecha}T{h_int:02d}:{m_int:02d}:00-06:00"
            end_dt = f"{fecha}T{(h_int+1):02d}:{m_int:02d}:00-06:00"

            event_body = {
                'summary': f"Cita Médica ARM: {nombre} ({caller_id})",
                'description': f"Paciente: {nombre}\nCallerID: {caller_id}\nMotivo: {motivo}\nRegistrado por Agente IA ARM.",
                'start': {'dateTime': start_dt, 'timeZone': 'America/Mexico_City'},
                'end': {'dateTime': end_dt, 'timeZone': 'America/Mexico_City'},
                'colorId': '2'
            }
            created = service.events().insert(calendarId='primary', body=event_body).execute()
            google_event_id = created.get('id')
        except Exception as e:
            sys.stderr.write(f"[Google Calendar Insert Error] {e}\n")

    # Guardar en Supabase
    row = {
        "caller_id": caller_id,
        "paciente_nombre": nombre,
        "fecha": fecha,
        "hora": f"{hora}:00" if len(hora) == 5 else hora,
        "estado": "confirmada",
        "motivo": motivo,
        "doctor_asignado": "Dra. Mariana Gómez",
        "notas_ia": f"Google Calendar Event ID: {google_event_id or 'offline'}"
    }
    inserted = db_post("citas_calendario", row)

    return {
        "success": True,
        "mensaje": f"Cita confirmada para {nombre} el {fecha} a las {hora} con Dra. Mariana Gómez.",
        "google_event_id": google_event_id,
        "supabase_record": inserted,
        "caller_id": caller_id,
        "fecha": fecha,
        "hora": hora,
        "motivo": motivo
    }


@mcp.tool()
def gcal_cancelar_cita(caller_id: str) -> Dict[str, Any]:
    """Cancela la cita activa más reciente del paciente por CallerID."""
    citas = db_get(f"citas_calendario?caller_id=eq.{caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1")
    if not citas:
        return {"success": False, "mensaje": f"No se encontró ninguna cita activa confirmada para CallerID {caller_id}."}

    cita = citas[0]
    cita_id = cita["id"]

    # Cancelar o eliminar evento en Google Calendar si tiene ID
    service = get_calendar_service()
    if service:
        notas = str(cita.get("notas_ia", ""))
        if "Google Calendar Event ID: " in notas:
            try:
                g_id = notas.split("Google Calendar Event ID: ")[1].strip().split()[0]
                if g_id and g_id != "offline":
                    service.events().delete(calendarId='primary', eventId=g_id).execute()
            except Exception as e:
                sys.stderr.write(f"[Google Calendar Delete Error] {e}\n")

    # Marcar como cancelada en Supabase
    db_patch(f"citas_calendario?id=eq.{cita_id}", {"estado": "cancelada", "notas_ia": "Cancelada vía ARM MCP"})

    return {
        "success": True,
        "mensaje": f"La cita del {cita['fecha']} a las {cita['hora']} ha sido cancelada exitosamente.",
        "cita_cancelada": cita
    }


@mcp.tool()
def gcal_reprogramar_cita(caller_id: str, nueva_fecha: str, nueva_hora: str) -> Dict[str, Any]:
    """Reprograma la cita activa de un paciente a una nueva fecha y hora."""
    disp = gcal_listar_disponibilidad(nueva_fecha)
    if not disp.get("disponible") or nueva_hora not in disp.get("horarios_disponibles", []):
        return {
            "success": False,
            "error": f"La nueva fecha {nueva_fecha} a las {nueva_hora} no se encuentra disponible."
        }

    citas = db_get(f"citas_calendario?caller_id=eq.{caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1")
    if not citas:
        return {"success": False, "mensaje": f"No se encontró ninguna cita activa para CallerID {caller_id}."}

    cita = citas[0]
    cita_id = cita["id"]

    db_patch(
        f"citas_calendario?id=eq.{cita_id}",
        {"fecha": nueva_fecha, "hora": f"{nueva_hora}:00" if len(nueva_hora) == 5 else nueva_hora, "estado": "confirmada", "notas_ia": f"Reprogramada a {nueva_fecha} {nueva_hora}"}
    )

    return {
        "success": True,
        "mensaje": f"Cita reprogramada con éxito para el {nueva_fecha} a las {nueva_hora}.",
        "anterior": {"fecha": cita["fecha"], "hora": cita["hora"]},
        "nueva": {"fecha": nueva_fecha, "hora": nueva_hora}
    }


@mcp.tool()
def gcal_consultar_memoria_clinica(caller_id: str) -> Dict[str, Any]:
    """
    Consulta el historial médico del paciente y genera sugerencias inteligentes proactivas
    basadas en antecedentes clínicos (CBR) para la interacción en el IVR y CRM.
    """
    hist = db_get(f"historial_clinico_pacientes?caller_id=eq.{caller_id}&select=*&order=fecha_ultima_consulta.desc&limit=1")
    if not hist:
        return {
            "cliente_frecuente": False,
            "mensaje": "Paciente nuevo sin historial clínico previo.",
            "sugerencia_preventiva": "Recomendar chequeo general de primer ingreso."
        }

    h = hist[0]
    return {
        "cliente_frecuente": True,
        "nombre_paciente": h.get("paciente_nombre"),
        "ultima_visita": h.get("fecha_ultima_consulta"),
        "ultimo_motivo": h.get("ultimo_motivo"),
        "diagnostico_previo": h.get("diagnostico_previo"),
        "sugerencia_preventiva": h.get("sugerencia_preventiva_ia") or "Chequeo preventivo general de sangre y perfil lipídico",
        "doctor_asignado": h.get("doctor_asignado") or "Dra. Mariana Gómez"
    }

if __name__ == '__main__':
    mcp.run()
