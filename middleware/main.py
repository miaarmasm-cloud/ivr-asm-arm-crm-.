"""
=============================================================================
MIDDLEWARE IVR & ARM ORCHESTRATOR (FastAPI + Supabase + Upstash)
=============================================================================
- Maneja el flujo del IVR:
    1. Consulta de saldo
    2. Cancelación
    3. Ventas / Operador
- Entrada dual: DTMF ("1", "2", "3") y Voz ("saldo", "cancelar", "comprar")
- Registra el CallerID y emite eventos en tiempo real para el Screen-Pop del CRM
- Endpoint para Originar Llamadas Salientes (Click-to-Call desde el CRM)
=============================================================================
"""

import os
import time
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import redis

# Variables de entorno
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key")
UPSTASH_REDIS_URL = os.getenv("UPSTASH_REDIS_URL", "") # ej: rediss://default:xxx@xxx.upstash.io:6379

app = FastAPI(title="IVR ARM Middleware", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar clientes
supabase: Optional[Client] = None
try:
    if SUPABASE_URL and "your-project" not in SUPABASE_URL:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"[Warning] No se pudo conectar a Supabase: {e}")

redis_client = None
if UPSTASH_REDIS_URL:
    try:
        redis_client = redis.from_url(UPSTASH_REDIS_URL, decode_responses=True)
    except Exception as e:
        print(f"[Warning] No se pudo conectar a Redis: {e}")


# =============================================================================
# MODELOS DE DATOS
# =============================================================================

class IncomingCallPayload(BaseModel):
    call_id: str
    caller_id: str
    destination: Optional[str] = "8000"

class ProcessOptionPayload(BaseModel):
    call_id: str
    caller_id: str
    input_type: str # 'dtmf' o 'voice'
    raw_input: str  # '1', '2', '3' o transcripción de voz

class OutboundCallPayload(BaseModel):
    agent_extension: str # ej. 2001
    destination_number: str # ej. +525512345678 o 1001


# =============================================================================
# ENDPOINTS DEL IVR
# =============================================================================

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "IVR ARM Middleware",
        "database": "Supabase" if supabase else "Mock Mode",
        "cache": "Upstash Redis" if redis_client else "Local Memory Mode"
    }

@app.post("/api/ivr/incoming")
async def handle_incoming_call(payload: IncomingCallPayload):
    """
    Se ejecuta en cuanto Asterisk recibe la llamada.
    1. Captura CallerID.
    2. Guarda sesión activa en Upstash.
    3. Registra bitácora en Supabase (dispara el Screen-Pop en el CRM vía Realtime).
    4. Retorna el menú de bienvenida en audio/texto para el cliente.
    """
    call_id = payload.call_id
    caller_id = payload.caller_id

    # 1. Caché de sesión en Upstash (TTL 10 minutos)
    session_data = {
        "caller_id": caller_id,
        "step": "welcome",
        "started_at": str(time.time())
    }
    if redis_client:
        redis_client.hset(f"call:{call_id}", mapping=session_data)
        redis_client.expire(f"call:{call_id}", 600)

    # 2. Buscar datos del cliente por caller_id
    cliente_data = None
    if supabase:
        res = supabase.table("clientes").select("*").eq("caller_id", caller_id).execute()
        if res.data and len(res.data) > 0:
            cliente_data = res.data[0]

    # 3. Insertar registro en bitácora para disparar Screen-Pop en el CRM
    if supabase:
        supabase.table("llamadas_bitacora").insert({
            "caller_id": caller_id,
            "cliente_id": cliente_data["id"] if cliente_data else None,
            "tipo": "entrante",
            "estado": "en_curso",
            "opcion_ivr_seleccionada": "Inicio IVR"
        }).execute()

    nombre_cliente = cliente_data["nombre_completo"] if cliente_data else "estimado cliente"

    # 4. Respuesta para Asterisk / TTS
    return {
        "action": "play_and_collect",
        "prompt_text": f"Bienvenido {nombre_cliente}. Por favor, marque o diga: 1 para consulta de saldo, 2 para cancelación, o 3 para ventas y atención con un ejecutivo.",
        "allowed_dtmf": ["1", "2", "3"],
        "expect_voice": True,
        "timeout": 8
    }

@app.post("/api/ivr/process-option")
async def process_ivr_option(payload: ProcessOptionPayload):
    """
    Maneja la entrada dual: DTMF (teclas) o Voz (reconocimiento).
    Opciones:
      1. Consulta de saldo
      2. Cancelación
      3. Ventas / Operador
    """
    call_id = payload.call_id
    caller_id = payload.caller_id
    raw = payload.raw_input.strip().lower()

    # Mapeo híbrido DTMF y Voz
    selected_option = None
    if raw in ["1", "uno"] or "saldo" in raw or "cuenta" in raw:
        selected_option = 1
    elif raw in ["2", "dos"] or "cancelar" in raw or "cancelacion" in raw or "baja" in raw:
        selected_option = 2
    elif raw in ["3", "tres"] or "ventas" in raw or "comprar" in raw or "operador" in raw or "humano" in raw:
        selected_option = 3

    if not selected_option:
        return {
            "action": "retry",
            "prompt_text": "No pudimos reconocer su opción. Por favor presione 1 para saldo, 2 para cancelación o 3 para ventas.",
            "allowed_dtmf": ["1", "2", "3"]
        }

    # Opción 1: Consulta de Saldo
    if selected_option == 1:
        saldo_actual = 0.00
        tarjeta_mask = "****"
        estatus_tarjeta = 1
        nombre_completo = "Cliente"
        if supabase:
            res = supabase.table("clientes").select("id, saldo, numero_tarjeta_mask, nombre_completo, estatus_tarjeta").eq("caller_id", caller_id).execute()
            if res.data and len(res.data) > 0:
                saldo_actual = float(res.data[0].get("saldo", 0.00))
                tarjeta_mask = res.data[0].get("numero_tarjeta_mask", "****")
                estatus_tarjeta = int(res.data[0].get("estatus_tarjeta", 1))
                nombre_completo = res.data[0].get("nombre_completo", "Cliente")

        # REGLA DE NEGOCIO: Si estatus == 2 (Cancelada), NO regresar saldo
        if estatus_tarjeta == 2:
            if supabase:
                supabase.table("llamadas_bitacora").update({
                    "opcion_ivr_seleccionada": "1. Consulta de Saldo DENEGADA",
                    "resumen_ia": f"Consulta de saldo rechazada: Tarjeta {tarjeta_mask} se encuentra en estatus 2 (Cancelada). Saldo protegido."
                }).eq("caller_id", caller_id).execute()

            return {
                "action": "speak_and_transfer",
                "prompt_text": f"Estimado cliente, su tarjeta con terminación {tarjeta_mask[-4:]} se encuentra cancelada o bloqueada. Por seguridad, no es posible proporcionar el saldo en el IVR. Lo comunicamos con un asesor.",
                "data": {"estatus_tarjeta": 2, "saldo_bloqueado": True},
                "transfer_extension": "2001"
            }

        # Actualizar bitácora (Estatus 1 Activa)
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "1. Consulta de Saldo",
                "resumen_ia": f"El cliente consultó su saldo. Saldo informado: ${saldo_actual:.2f} MXN en tarjeta {tarjeta_mask} (Estatus 1 Activa)."
            }).eq("caller_id", caller_id).execute()

        return {
            "action": "speak_and_hangup",
            "prompt_text": f"Su saldo disponible para la tarjeta con terminación {tarjeta_mask[-4:]} es de {saldo_actual:.2f} pesos. Gracias por llamar.",
            "data": {"saldo": saldo_actual, "estatus_tarjeta": 1}
        }

    # Opción 2: Cancelación
    elif selected_option == 2:
        cliente_id = None
        estatus_actual = 1
        tarjeta_mask = "****"
        saldo_actual = 0.00
        if supabase:
            res = supabase.table("clientes").select("id, saldo, numero_tarjeta_mask, estatus_tarjeta").eq("caller_id", caller_id).execute()
            if res.data and len(res.data) > 0:
                cliente_id = res.data[0].get("id")
                estatus_actual = int(res.data[0].get("estatus_tarjeta", 1))
                tarjeta_mask = res.data[0].get("numero_tarjeta_mask", "****")
                saldo_actual = float(res.data[0].get("saldo", 0.00))

        folio = f"CAN-{int(time.time() * 1000) % 1000000}"

        if estatus_actual == 2:
            prompt_msg = f"Su tarjeta con terminación {tarjeta_mask[-4:]} ya se encuentra previamente cancelada. Lo transferimos con un asesor para aclaraciones o reposición."
        else:
            # 1. Actualizar estatus_tarjeta a 2 en la tabla clientes
            if supabase and cliente_id:
                supabase.table("clientes").update({"estatus_tarjeta": 2}).eq("id", cliente_id).execute()
                # 2. Registrar en tarjetas_cancelaciones_log (Auditoría)
                supabase.table("tarjetas_cancelaciones_log").insert({
                    "cliente_id": cliente_id,
                    "folio_cancelacion": folio,
                    "caller_id": caller_id,
                    "numero_tarjeta_mask": tarjeta_mask,
                    "estatus_anterior": 1,
                    "estatus_nuevo": 2,
                    "motivo": "Cancelación solicitada vía IVR Opción 2",
                    "canal": "IVR_OPCION_2",
                    "saldo_al_momento": saldo_actual
                }).execute()

            prompt_msg = f"Hemos registrado la cancelación de su tarjeta terminación {tarjeta_mask[-4:]} con folio {folio}. Para confirmar detalles o consultar alternativas, lo comunicamos con un asesor."

        if supabase:
            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "2. Cancelación",
                "resumen_ia": f"Solicitud de cancelación ejecutada vía IVR: Folio {folio}. Estatus tarjeta actualizado a 2 (Cancelada)."
            }).eq("caller_id", caller_id).execute()

        return {
            "action": "speak_and_transfer",
            "prompt_text": prompt_msg,
            "folio_cancelacion": folio,
            "estatus_tarjeta": 2,
            "transfer_extension": "2001"
        }

    # Opción 3: Ventas
    elif selected_option == 3:
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "3. Ventas",
                "resumen_ia": "El cliente solicitó asesoría comercial en el IVR."
            }).eq("caller_id", caller_id).execute()

        return {
            "action": "transfer",
            "prompt_text": "Transfiriendo su llamada al departamento de ventas. Por favor espere en la línea.",
            "transfer_extension": "2001"
        }


@app.post("/api/calls/originate")
async def originate_outbound_call(payload: OutboundCallPayload):
    """
    Endpoint invocado por el botón 'Llamar' en el CRM Next.js.
    Envía una petición al Asterisk REST Interface (ARI) para llamar
    al agente (ej. 2001) y enlazarlo con el cliente (destino).
    """
    # En producción se envía la petición HTTP POST a:
    # http://asterisk-host:8088/ari/channels?endpoint=PJSIP/destino&extension=2001
    print(f"[Outbound Call] Originando llamada desde {payload.agent_extension} hacia {payload.destination_number}")

    # Registrar en bitácora
    if supabase:
        supabase.table("llamadas_bitacora").insert({
            "caller_id": payload.destination_number,
            "tipo": "saliente",
            "estado": "en_curso",
            "notas_agente": f"Llamada saliente iniciada desde el CRM por agente {payload.agent_extension}"
        }).execute()

    return {
        "status": "success",
        "message": f"Llamada originada hacia {payload.destination_number}",
        "channel_id": f"outbound-{int(time.time())}"
    }
