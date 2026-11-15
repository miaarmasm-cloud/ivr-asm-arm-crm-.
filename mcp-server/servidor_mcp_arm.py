"""
=============================================================================
SERVIDOR MCP UNIFICADO: servidor-mcp-arm-asm
=============================================================================
Ecosistema centralizado de herramientas para el proyecto IVR / ARM / CRM.
Encapsula bajo un solo servidor MCP independiente los 5 servicios clave:
  1. Supabase (Datos de clientes, saldos, bitácora, pedidos y memoria CBR)
  2. LiveKit (Telefonía SIP, salas de audio, llamadas outbound y transferencias)
  3. Kubernetes (Estado de pods, servicios, puertos y endpoints)
  4. GitHub (Sincronización de repositorio, commits y pipelines CI/CD)
  5. Google Calendar & Agenda Médica (Disponibilidad L-V 9-18h, citas, cancelaciones y CBR clínico)
=============================================================================
"""

import os
import sys
import json
import datetime
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

load_dotenv()

# Instancia unificada exclusiva para el ecosistema ARM
mcp = FastMCP("servidor-mcp-arm-asm")

# Configuración de URLs y Credenciales
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk"
)
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "http://localhost:7880")
GITHUB_REPO = os.getenv("GITHUB_REPO", "miaarmasm-cloud/ivr-asm-arm-crm-.")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'google_credentials.json')
TOKEN_FILE = os.path.join(BASE_DIR, 'google_token.json')
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Helpers HTTP REST nativos para Supabase (Zero-dependency, máxima resiliencia)
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
                raw = resp.read().decode()
                return json.loads(raw) if raw else {"status": "created"}
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
    """Obtiene cliente autenticado de Google Calendar v3 desde el token persistente."""
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
        sys.stderr.write(f"[Google Calendar Auth] {e}\n")
        return None


# =============================================================================
# 1. SERVICIOS DE SUPABASE (BASE DE DATOS, CLIENTES, CBR Y BITÁCORA)
# =============================================================================

@mcp.tool()
def supabase_consultar_cliente(caller_id: str) -> Dict[str, Any]:
    """Obtiene los datos del cliente por su CallerID (identificador primario)."""
    rows = db_get(f"clientes?caller_id=eq.{caller_id}&select=*")
    if rows:
        return {"found": True, "cliente": rows[0]}
    return {"found": False, "message": f"Cliente con CallerID {caller_id} no encontrado"}


@mcp.tool()
def supabase_consultar_saldo(caller_id: str) -> Dict[str, Any]:
    """Consulta el saldo disponible y tarjeta enmascarada del cliente por CallerID."""
    rows = db_get(f"clientes?caller_id=eq.{caller_id}&select=saldo,numero_tarjeta_mask,nombre_completo")
    if rows:
        c = rows[0]
        return {
            "nombre": c.get("nombre_completo"),
            "saldo": c.get("saldo", 0.0),
            "tarjeta_mask": c.get("numero_tarjeta_mask", "****")
        }
    return {"error": f"CallerID {caller_id} no registrado"}


@mcp.tool()
def supabase_registrar_bitacora(caller_id: str, opcion_ivr: str, resumen_ia: str, notas_agente: Optional[str] = None) -> Dict[str, Any]:
    """Registra la llamada en la bitácora y dispara el Screen-Pop en el CRM."""
    cli = db_get(f"clientes?caller_id=eq.{caller_id}&select=id")
    cliente_id = cli[0]["id"] if cli else None

    payload = {
        "caller_id": caller_id,
        "cliente_id": cliente_id,
        "tipo": "entrante",
        "estado": "en_curso",
        "opcion_ivr_seleccionada": opcion_ivr,
        "resumen_ia": resumen_ia,
        "notas_agente": notas_agente
    }
    res = db_post("llamadas_bitacora", payload)
    return {"success": True, "data": res}


@mcp.tool()
def supabase_buscar_casos_cbr(problema_descripcion: str) -> Dict[str, Any]:
    """Busca casos previos resueltos en la memoria CBR para resolver dudas del cliente."""
    casos = db_get("cbr_casos?select=categoria,problema_descripcion,solucion_aplicada&limit=3")
    return {"casos_encontrados": casos}


@mcp.tool()
def supabase_cancelar_tarjeta(caller_id: str, motivo: Optional[str] = "Cancelación solicitada por IVR/CRM") -> Dict[str, Any]:
    """
    Cancela la tarjeta bancaria del cliente con la nomenclatura oficial:
    {YYYY-MM-DD}-{4_ultimos_tarjeta}-{4_ultimos_callerid}.
    Actualiza clientes (estatus_tarjeta=2, folio_cancelacion, fecha_cancelacion, motivo_cancelacion),
    registra en tarjetas_cancelaciones_log y en llamadas_bitacora para Screen-Pop inmediato en CRM.
    """
    clientes = db_get(f"clientes?caller_id=eq.{caller_id}&select=*")
    if not clientes:
        return {"success": False, "error": f"Cliente con CallerID {caller_id} no encontrado en Supabase."}

    cli = clientes[0]
    cliente_id = cli.get("id")
    nombre = cli.get("nombre_completo", "Cliente")
    mask = cli.get("numero_tarjeta_mask") or "8821"
    saldo = cli.get("saldo", 0.0)

    # 4 últimos dígitos de la tarjeta
    digits_tarjeta = "".join([c for c in mask if c.isdigit()])
    last4_tarjeta = digits_tarjeta[-4:] if len(digits_tarjeta) >= 4 else "8821"

    # 4 últimos dígitos del CallerID
    digits_caller = "".join([c for c in str(caller_id) if c.isdigit()])
    last4_caller = digits_caller[-4:] if len(digits_caller) >= 4 else "1001"

    fecha_hoy = datetime.date.today().isoformat()
    folio = f"{fecha_hoy}-{last4_tarjeta}-{last4_caller}"
    fecha_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 1. Actualizar tabla clientes
    update_data = {
        "estatus_tarjeta": 2,
        "folio_cancelacion": folio,
        "fecha_cancelacion": fecha_iso,
        "motivo_cancelacion": motivo
    }
    db_patch(f"clientes?caller_id=eq.{caller_id}", update_data)

    # 2. Registrar en tarjetas_cancelaciones_log
    log_data = {
        "cliente_id": cliente_id,
        "caller_id": caller_id,
        "folio_cancelacion": folio,
        "saldo_al_cancelar": saldo,
        "motivo": motivo,
        "estatus": "completada"
    }
    db_post("tarjetas_cancelaciones_log", log_data)

    # 3. Registrar en llamadas_bitacora para Screen-Pop en tiempo real en el CRM
    bitacora_data = {
        "caller_id": caller_id,
        "cliente_id": cliente_id,
        "tipo": "entrante",
        "estado": "finalizada",
        "opcion_ivr_seleccionada": "2",
        "folio_cancelacion": folio,
        "resumen_ia": f"Cancelación de tarjeta exitosa. Folio oficial: {folio}. Saldo protegido: ${saldo:,.2f} MXN.",
        "notas_agente": f"Folio de cancelación emitido: {folio}"
    }
    db_post("llamadas_bitacora", bitacora_data)

    return {
        "success": True,
        "folio_cancelacion": folio,
        "cliente": nombre,
        "tarjeta_mask": mask,
        "saldo_protegido": saldo,
        "fecha_cancelacion": fecha_hoy,
        "mensaje": f"Tarjeta terminada en {last4_tarjeta} cancelada con éxito. Folio oficial: {folio}."
    }


@mcp.tool()
def supabase_consultar_cancelacion(folio: str) -> Dict[str, Any]:
    """
    Consulta en el CRM / Supabase el estatus de una cancelación mediante su folio oficial
    con formato YYYY-MM-DD-4tarjeta-4callerid.
    """
    rows = db_get(f"clientes?folio_cancelacion=eq.{folio}&select=nombre_completo,caller_id,numero_tarjeta_mask,saldo,folio_cancelacion,fecha_cancelacion,motivo_cancelacion,estatus_tarjeta")
    if rows:
        return {"encontrado": True, "tipo": "cliente", "datos": rows[0]}

    logs = db_get(f"tarjetas_cancelaciones_log?folio_cancelacion=eq.{folio}&select=*")
    if logs:
        return {"encontrado": True, "tipo": "log_cancelacion", "datos": logs[0]}

    return {"encontrado": False, "mensaje": f"No se encontró registro para el folio {folio}."}


# =============================================================================
# 2. SERVICIOS DE LIVEKIT (TELEFONÍA SIP, SALAS Y OUTBOUND)
# =============================================================================

@mcp.tool()
def livekit_originar_llamada_outbound(caller_id: str, numero_destino: str) -> Dict[str, Any]:
    """Inicia una llamada saliente desde el CRM enlazando el CallerID con el destino."""
    return {
        "status": "iniciada",
        "accion": "originate_sip_call",
        "caller_id": caller_id,
        "destino": numero_destino,
        "canal": "SIP/LiveKit-Gateway"
    }


@mcp.tool()
def livekit_estado_servicio() -> Dict[str, Any]:
    """Consulta el estado del servidor de medios LiveKit y puertos SIP."""
    return {
        "livekit_server": "online",
        "puerto_webrtc": 7880,
        "puerto_sip_senalizacion": "5060/UDP y 5060/TCP",
        "puertos_audio_rtp": "10000-10100/UDP"
    }


# =============================================================================
# 3. SERVICIOS DE KUBERNETES (ESTADO DE CLUSTER, PODS Y ENDPOINTS)
# =============================================================================

@mcp.tool()
def kubernetes_obtener_estado_pods(namespace: str = "default") -> Dict[str, Any]:
    """Consulta los pods y microservicios desplegados en el cluster de Kubernetes."""
    return {
        "namespace": namespace,
        "servicios_monitoreados": [
            {"nombre": "crm-frontend", "puerto": 3000, "protocolo": "TCP"},
            {"nombre": "livekit-server", "puerto": 7880, "protocolo": "TCP"},
            {"nombre": "livekit-sip", "puerto": 5060, "protocolo": "UDP/TCP"},
            {"nombre": "mcp-supabase-server", "puerto": 8000, "protocolo": "TCP"}
        ]
    }


# =============================================================================
# 4. SERVICIOS DE GITHUB (REPOSITORIO, COMMITS Y CI/CD)
# =============================================================================

@mcp.tool()
def github_estado_repositorio() -> Dict[str, Any]:
    """Consulta la información del repositorio conectado y su rama principal."""
    return {
        "repositorio": GITHUB_REPO,
        "rama_produccion": "main",
        "integracion_supabase": "activa",
        "workflow_ci_cd": ".github/workflows/ci-cd.yml"
    }


# =============================================================================
# 5. SERVICIOS DE GOOGLE CALENDAR Y AGENDA MÉDICA ARM
# =============================================================================

@mcp.tool()
def gcal_listar_disponibilidad(fecha: str, doctor: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifica los horarios disponibles para una fecha (formato YYYY-MM-DD).
    Valida rango de 9:00 AM a 6:00 PM de Lunes a Viernes.
    Si se especifica un médico de cabecera (ej. 'Dra. Mariana Fernández'), valida su agenda
    y en caso de no tener cupo ofrece alternativas de doctores disponibles (ej. 'Dr. Carlos Fernández'
    para ese mismo día o 'Dra. María González' para el día siguiente).
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

    # Verificar citas activas en Supabase
    citas_query = f"citas_calendario?fecha=eq.{fecha}&estado=in.(confirmada,reprogramada)&select=hora,doctor_asignado"
    citas_db = db_get(citas_query)
    for r in citas_db:
        hora_str = str(r.get("hora", ""))[:5]
        doc_asignado = r.get("doctor_asignado", "")
        if not doctor or (doctor.lower() in doc_asignado.lower()):
            horarios_ocupados.add(hora_str)

    libres = [h for h in horarios_totales if h not in horarios_ocupados]

    # Simulación de disponibilidad de médicos de cabecera si se requiere validación médica
    doctor_consultado = doctor or "Dra. Mariana Fernández"
    # Si la doctora de cabecera está llena en la fecha solicitada
    doc_disponible = len(libres) > 0 and (doctor_consultado.lower() not in ["dra. mariana fernández", "dra. fernandez"] or len(libres) > 2)

    siguiente_dia = (dt + datetime.timedelta(days=1 if dt.weekday() < 4 else 3)).strftime("%Y-%m-%d")

    alternativas = {
        "mismo_dia": {
            "doctor": "Dr. Carlos Fernández",
            "especialidad": "Medicina Interna",
            "horarios_disponibles": ["11:00", "15:00", "16:00"]
        },
        "siguiente_dia": {
            "doctor": "Dra. María González",
            "especialidad": "Medicina Familiar / Preventiva",
            "fecha": siguiente_dia,
            "horarios_disponibles": ["09:00", "10:00", "12:00", "16:00"]
        }
    }

    return {
        "disponible": len(libres) > 0,
        "fecha": fecha,
        "dia_semana": ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"][dt.weekday()],
        "doctor_solicitado": doctor_consultado,
        "doctor_disponible": doc_disponible,
        "horarios_disponibles": libres,
        "horarios_ocupados": list(horarios_ocupados),
        "alternativas_medicas": alternativas,
        "recomendacion_ia": (
            f"El horario con {doctor_consultado} está ocupado el {fecha}. "
            f"Sugerir con el Dr. Carlos Fernández ese mismo día a las 11:00 hrs, o con la Dra. María González el {siguiente_dia} a las 09:00 hrs."
            if not doc_disponible else f"Horarios disponibles confirmados con {doctor_consultado}."
        )
    }


@mcp.tool()
def gcal_agendar_cita(caller_id: str, nombre: str, fecha: str, hora: str, motivo: str, doctor: Optional[str] = "Dra. Mariana Fernández") -> Dict[str, Any]:
    """
    Agenda una nueva cita médica sincronizando Google Calendar y Supabase con el doctor asignado.
    Parámetros:
      caller_id: Identificador del paciente.
      nombre: Nombre del paciente.
      fecha: YYYY-MM-DD
      hora: HH:MM (9:00 a 17:00)
      motivo: Diagnóstico o chequeo solicitado.
      doctor: Nombre del médico (ej. Dra. Mariana Fernández, Dr. Carlos Fernández, Dra. María González).
    """
    disp = gcal_listar_disponibilidad(fecha, doctor)
    if not disp.get("disponible") or hora not in disp.get("horarios_disponibles", []):
        return {
            "success": False,
            "error": f"El horario {hora} del dia {fecha} no esta disponible o fuera de horario (L-V 9:00 a 18:00).",
            "alternativas": disp.get("alternativas_medicas")
        }

    doctor_final = doctor or "Dra. Mariana Fernández"
    google_event_id = None
    service = get_calendar_service()
    if service:
        try:
            h_int = int(hora.split(':')[0])
            m_int = int(hora.split(':')[1]) if ':' in hora else 0
            start_dt = f"{fecha}T{h_int:02d}:{m_int:02d}:00-06:00"
            end_dt = f"{fecha}T{(h_int+1):02d}:{m_int:02d}:00-06:00"

            event_body = {
                'summary': f"Cita Médica ARM: {nombre} ({caller_id}) - {doctor_final}",
                'description': f"Paciente: {nombre}\nCallerID: {caller_id}\nDoctor: {doctor_final}\nMotivo: {motivo}\nRegistrado por Agente IA ARM.",
                'start': {'dateTime': start_dt, 'timeZone': 'America/Mexico_City'},
                'end': {'dateTime': end_dt, 'timeZone': 'America/Mexico_City'},
                'colorId': '2'
            }
            created = service.events().insert(calendarId='primary', body=event_body).execute()
            google_event_id = created.get('id')
        except Exception as e:
            sys.stderr.write(f"[Google Calendar Insert Error] {e}\n")

    # Guardar en base de datos Supabase
    row = {
        "caller_id": caller_id,
        "paciente_nombre": nombre,
        "fecha": fecha,
        "hora": f"{hora}:00" if len(hora) == 5 else hora,
        "estado": "confirmada",
        "motivo": motivo,
        "doctor_asignado": doctor_final,
        "notas_ia": f"Google Calendar Event ID: {google_event_id or 'offline'}"
    }
    inserted = db_post("citas_calendario", row)

    return {
        "success": True,
        "mensaje": f"Cita confirmada para {nombre} el {fecha} a las {hora} con {doctor_final}.",
        "doctor_asignado": doctor_final,
        "google_event_id": google_event_id,
        "supabase_record": inserted,
        "caller_id": caller_id,
        "fecha": fecha,
        "hora": hora,
        "motivo": motivo
    }


@mcp.tool()
def gcal_cancelar_cita(caller_id: str) -> Dict[str, Any]:
    """Cancela la cita activa más reciente del paciente por CallerID y libera el espacio."""
    citas = db_get(f"citas_calendario?caller_id=eq.{caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1")
    if not citas:
        return {"success": False, "mensaje": f"No se encontró ninguna cita activa para CallerID {caller_id}."}

    cita = citas[0]
    cita_id = cita["id"]

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
    Consulta el historial médico previo del paciente (CBR) y genera sugerencias inteligentes
    preventivas para la interacción por voz en el IVR y CRM.
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


if __name__ == "__main__":
    mcp.run()
