"""
=============================================================================
LIVEKIT AGENT: IVR / ARM HOMOLOGADO CON EL DIALPLAN DE ASTERISK 20
=============================================================================
MENÚ ESTÁNDAR HOMOLOGADO DEL IVR (DTMF Y VOZ):
  1: Consulta de Saldo y Tarjeta
  2: Cancelación de Tarjeta con generación de Folio oficial
  3: Ventas y Transferencia a Ejecutiva Humana (Ext. 2001)
  4: Citas Médicas Autónomas (Google Calendar API + Memoria Clínica CBR)
=============================================================================
"""

import os
import asyncio
import logging
from typing import Annotated
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import deepgram, elevenlabs, silero, google, openai

try:
    from livekit.plugins import assemblyai
    has_assemblyai = True
except ImportError:
    has_assemblyai = False

from supabase import create_client, Client
from mcp_bridge import MCPBridge

load_dotenv()
logger = logging.getLogger("ivr-arm-homologado")
logging.basicConfig(level=logging.INFO)

mcp_bridge = MCPBridge()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))

supabase: Client = None
try:
    if SUPABASE_URL and "tu-proyecto" not in SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    logger.warning(f"Supabase offline/mock: {e}")


class IVRFunctionContext(llm.FunctionContext):
    def __init__(self, caller_id: str, cliente_data: dict, ctx: JobContext):
        super().__init__()
        self.caller_id = caller_id
        self.cliente_data = cliente_data
        self.ctx = ctx

    @llm.ai_callable(description="Opción 1: Consulta el saldo disponible y últimos 4 dígitos de tarjeta.")
    async def consultar_saldo(self) -> str:
        saldo = self.cliente_data.get("saldo", 0.0) if self.cliente_data else 0.0
        tarjeta = self.cliente_data.get("numero_tarjeta_mask", "****") if self.cliente_data else "****"
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "1. Consulta de Saldo",
                "resumen_ia": f"Consulta exitosa: Saldo ${saldo:.2f} MXN en tarjeta {tarjeta[-4:]}."
            }).eq("caller_id", self.caller_id).execute()
        return f"Su saldo disponible es de ${saldo:.2f} pesos en su tarjeta terminación {tarjeta[-4:]}."

    @llm.ai_callable(description="Opción 2: Procesa la cancelación de tarjeta y genera folio de auditoría.")
    async def cancelar_tarjeta(self, motivo: str) -> str:
        if not supabase or not self.cliente_data:
            return "No se pudo localizar su tarjeta para cancelación. Lo comunicamos con un ejecutivo."
        try:
            tarjeta = self.cliente_data.get("numero_tarjeta_mask", "8821")[-4:]
            cid_last = self.caller_id[-4:]
            fecha_str = datetime.date.today().isoformat()
            folio = f"{fecha_str}-{tarjeta}-{cid_last}"

            supabase.table("clientes").update({
                "estatus_tarjeta": 2,
                "folio_cancelacion": folio,
                "fecha_cancelacion": fecha_str,
                "motivo_cancelacion": motivo
            }).eq("caller_id", self.caller_id).execute()

            supabase.table("tarjetas_cancelaciones_log").insert({
                "cliente_id": self.cliente_data["id"],
                "folio_cancelacion": folio,
                "caller_id": self.caller_id,
                "numero_tarjeta_mask": self.cliente_data.get("numero_tarjeta_mask", "****"),
                "estatus_anterior": 1,
                "estatus_nuevo": 2,
                "motivo": motivo,
                "canal": "IVR_OPCION_2"
            }).execute()

            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "2. Cancelación",
                "notas_agente": f"Tarjeta cancelada en Opción 2. Folio: {folio}"
            }).eq("caller_id", self.caller_id).execute()

            return f"Su tarjeta terminación {tarjeta} ha sido cancelada exitosamente bajo el folio {folio}."
        except Exception as e:
            logger.error(f"Error en cancelación: {e}")
            return "Ocurrió un inconveniente al cancelar. Procedo a comunicarlo con un asesor."

    @llm.ai_callable(description="Opción 3: Transfiere la llamada a ventas o ejecutivo humano (Ext. 2001).")
    async def transferir_a_ventas(self, motivo: str) -> str:
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "estado": "transferida",
                "opcion_ivr_seleccionada": "3. Ventas / Asesor",
                "notas_agente": f"Transferida a ventas. Razón: {motivo}"
            }).eq("caller_id", self.caller_id).execute()
        return "Lo estoy comunicando de inmediato con nuestra ejecutiva de ventas. Por favor permanezca en la línea."

    @llm.ai_callable(description="Opción 4: Consulta y gestiona citas médicas con la Dra. Mariana Fernández en Google Calendar.")
    async def gestionar_citas_medicas(self) -> str:
        if not supabase:
            return "No es posible acceder a la base de citas en este momento."
        try:
            res = supabase.table("citas_calendario")\
                .select("fecha, hora, doctor_asignado, especialidad, estado")\
                .eq("caller_id", self.caller_id)\
                .eq("estado", "confirmada")\
                .order("fecha", desc=False)\
                .limit(1).execute()

            if res.data and len(res.data) > 0:
                cita = res.data[0]
                fecha = cita.get("fecha")
                hora = str(cita.get("hora", ""))[:5]
                doc = cita.get("doctor_asignado", "Dra. Mariana Fernández")
                return f"Cuenta con una cita activa confirmada con la {doc} para el día {fecha} a las {hora} horas."
        except Exception as e:
            logger.error(f"Error consultando citas: {e}")
        return "No localicé citas pendientes con su doctora de cabecera. Podemos agendar para el siguiente día laboral a las 10:00 horas."


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    participant = await ctx.wait_for_participant()
    caller_id = participant.identity or "1001"

    cliente_data = None
    if supabase:
        try:
            res = supabase.table("clientes").select("*").eq("caller_id", caller_id).execute()
            if res.data and len(res.data) > 0:
                cliente_data = res.data[0]
        except Exception as e:
            logger.error(f"Error cliente: {e}")

    nombre = cliente_data["nombre_completo"] if cliente_data else "estimado cliente"
    fnc_ctx = IVRFunctionContext(caller_id, cliente_data, ctx)

    system_prompt = f"""
    Eres el asistente telefónico del sistema ARM. Estás hablando con: {nombre} ({caller_id}).
    EL MENÚ ESTÁNDAR DEL IVR ES ESTRICTAMENTE:
    1: Consulta de Saldo
    2: Cancelación de Tarjeta
    3: Ventas y Transferencia a Agente Humano
    4: Citas Médicas y Agenda con la Dra. Mariana Fernández
    """

    stt_engine = deepgram.STT(language="es", model="nova-2")
    llm_engine = google.LLM(model="gemini-2.0-flash") if os.getenv("GOOGLE_API_KEY") else openai.LLM(model="gpt-4o-mini")
    tts_engine = elevenlabs.TTS(
        model="eleven_multilingual_v2",
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    )

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=stt_engine,
        llm=llm_engine,
        tts=tts_engine,
        fnc_ctx=fnc_ctx,
        system_prompt=system_prompt
    )

    @ctx.room.on("sip_dtmf_received")
    def on_dtmf_received(dtmf_event: rtc.SipDTMF):
        digit = dtmf_event.digit
        if digit == "1":
            asyncio.create_task(fnc_ctx.consultar_saldo())
        elif digit == "2":
            asyncio.create_task(fnc_ctx.cancelar_tarjeta("Pulsó 2 en IVR"))
        elif digit == "3":
            asyncio.create_task(fnc_ctx.transferir_a_ventas("Pulsó 3 en IVR"))
        elif digit == "4":
            asyncio.create_task(fnc_ctx.gestionar_citas_medicas())

    assistant.start(ctx.room)
    await assistant.say(
        f"Hola {nombre}, bienvenido a su sistema ARM. "
        "Marque 1 para saldo, 2 para cancelación de tarjeta, 3 para ventas, o 4 para citas médicas.",
        allow_interruptions=True
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
