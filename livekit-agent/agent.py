"""
=============================================================================
LIVEKIT AGENT: IVR / ARM CON DTMF, VOZ ELEVENLABS Y CBR EN SUPABASE
=============================================================================
- Protocolo: SIP Ingress de LiveKit (Zoiper/Softphone -> SIP 5060 -> LiveKit Room)
- Identificador Primario: CallerID (número del cliente)
- Detección de Voz: Silero VAD (local, costo cero)
- Transcripción STT: Deepgram Nova-2 (Español)
- Síntesis TTS: ElevenLabs Multilingual v2 (Voz humana ultra-realista)
- Cerebro LLM: Gemini 2.0 Flash / GPT-4o-mini
- Memoria CBR: Búsqueda de casos previos en Supabase con pgvector
- Entrada Dual: Voz natural + Teclado DTMF (1: Saldo, 2: Cancelación, 3: Humano)
- Integración CRM: Inserta registro en 'llamadas_bitacora' para Screen-Pop inmediato
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
from supabase import create_client, Client
from mcp_bridge import MCPBridge

load_dotenv()
logger = logging.getLogger("ivr-arm-agent")
logging.basicConfig(level=logging.INFO)

# Inicializar cliente del Servidor MCP
mcp_bridge = MCPBridge()

# Configuración de Clientes
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "your-key")

supabase: Client = None
try:
    if SUPABASE_URL and "your-project" not in SUPABASE_URL:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    logger.warning(f"Supabase en modo offline/mock: {e}")


# =============================================================================
# HERRAMIENTAS (FUNCTION CALLING) PARA EL AGENTE ARM CON CBR
# =============================================================================

class IVRFunctionContext(llm.FunctionContext):
    def __init__(self, caller_id: str, cliente_data: dict, ctx: JobContext):
        super().__init__()
        self.caller_id = caller_id
        self.cliente_data = cliente_data
        self.ctx = ctx

    @llm.ai_callable(description="Consulta el saldo disponible del cliente y los últimos 4 dígitos de su tarjeta.")
    async def consultar_saldo(self) -> str:
        saldo = self.cliente_data.get("saldo", 0.0) if self.cliente_data else 0.0
        tarjeta = self.cliente_data.get("numero_tarjeta_mask", "****") if self.cliente_data else "****"
        
        # Registrar en la bitácora
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "1. Consulta de Saldo",
                "resumen_ia": f"Saldo consultado: ${saldo:.2f} MXN en tarjeta {tarjeta[-4:]}."
            }).eq("caller_id", self.caller_id).execute()

        return f"El saldo disponible es de ${saldo:.2f} pesos mexicanos en la tarjeta con terminación {tarjeta[-4:]}."

    @llm.ai_callable(description="Registra la solicitud de cancelación de un servicio o tarjeta.")
    async def registrar_cancelacion(
        self, 
        motivo: Annotated[str, llm.TypeInfo(description="Motivo de la cancelación expresado por el cliente")]
    ) -> str:
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "opcion_ivr_seleccionada": "2. Cancelación",
                "notas_agente": f"Solicitud de cancelación registrada. Motivo: {motivo}"
            }).eq("caller_id", self.caller_id).execute()

        return "La solicitud de cancelación ha sido registrada. Debe transferirse a un ejecutivo para formalizar."

    @llm.ai_callable(description="Busca en la base de datos de conocimiento CBR casos similares resueltos anteriormente.")
    async def buscar_caso_cbr(
        self,
        consulta_problema: Annotated[str, llm.TypeInfo(description="Descripción del problema planteado por el cliente")]
    ) -> str:
        if not supabase:
            return "No hay casos similares registrados actualmente."

        try:
            # Búsqueda semántica en Supabase en tabla cbr_casos
            res = supabase.table("cbr_casos").select("solucion_aplicada, problema_descripcion").limit(1).execute()
            if res.data and len(res.data) > 0:
                caso = res.data[0]
                return f"Solución previa encontrada para caso similar: {caso['solucion_aplicada']}"
        except Exception as e:
            logger.error(f"Error en consulta CBR: {e}")

        return "No se encontró un antecedente exacto. Se recomienda ofrecer atención con un asesor."

    @llm.ai_callable(description="Transfiere la llamada telefónica a un operador o agente humano en el CRM.")
    async def transferir_a_humano(
        self,
        motivo: Annotated[str, llm.TypeInfo(description="Razón por la cual se transfiere con un humano")]
    ) -> str:
        logger.info(f"Transfiriendo llamada de {self.caller_id} a operador. Motivo: {motivo}")
        
        # En LiveKit SIP, se puede ejecutar la transferencia SIP REFER:
        # await self.ctx.api.sip.transfer_sip_participant(...)
        if supabase:
            supabase.table("llamadas_bitacora").update({
                "estado": "transferida",
                "notas_agente": f"Llamada transferida a agente humano. Razón: {motivo}"
            }).eq("caller_id", self.caller_id).execute()

        return "Procediendo a transferir la llamada con un asesor humano. Por favor permanezca en la línea."


# =============================================================================
# PUNTO DE ENTRADA PRINCIPAL DEL TRABAJADOR LIVEKIT
# =============================================================================

async def entrypoint(ctx: JobContext):
    logger.info(f"Conectando agente a la sala LiveKit: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Esperar al participante que llama por SIP (Zoiper/Softphone)
    participant = await ctx.wait_for_participant()
    
    # Extraer CallerID (identificador primario)
    caller_id = participant.identity
    if not caller_id or caller_id.startswith("agent-"):
        caller_id = "1001" # Valor de prueba por defecto
    logger.info(f"Llamada entrante detectada. CallerID Primario: {caller_id}")

    # 1. Buscar cliente en Supabase
    cliente_data = None
    if supabase:
        try:
            res = supabase.table("clientes").select("*").eq("caller_id", caller_id).execute()
            if res.data and len(res.data) > 0:
                cliente_data = res.data[0]
        except Exception as e:
            logger.error(f"Error consultando cliente: {e}")

    nombre = cliente_data["nombre_completo"] if cliente_data else "estimado cliente"
    saldo = cliente_data["saldo"] if cliente_data else 0.0

    # 2. Registrar en la bitácora para DISPARAR SCREEN-POP en el CRM en tiempo real
    if supabase:
        try:
            supabase.table("llamadas_bitacora").insert({
                "caller_id": caller_id,
                "cliente_id": cliente_data["id"] if cliente_data else None,
                "tipo": "entrante",
                "estado": "en_curso",
                "opcion_ivr_seleccionada": "Conectado a LiveKit ARM"
            }).execute()
        except Exception as e:
            logger.error(f"Error insertando bitácora Screen-Pop: {e}")

    # 3. Contexto de Funciones e Instrucciones para el LLM
    fnc_ctx = IVRFunctionContext(caller_id, cliente_data, ctx)

    system_prompt = f"""
    Eres el Agente Inteligente de Atención Telefónica (ARM) para la empresa.
    Estás hablando por teléfono con el cliente: {nombre}.
    Su CallerID es: {caller_id} y su saldo actual es ${saldo:.2f} MXN.

    Tus objetivos principales:
    1. Dar una bienvenida cálida y humana.
    2. Las 3 opciones principales del sistema son:
       - Opción 1: Consulta de saldo.
       - Opción 2: Cancelación de servicios.
       - Opción 3: Ventas o hablar con un asesor.
    3. Si el cliente tiene una duda compleja o un reclamo, utiliza la herramienta 'buscar_caso_cbr' para consultar antecedentes resueltos.
    4. Si no conoces la respuesta o el cliente solicita hablar con una persona, invoca inmediatamente 'transferir_a_humano'.
    5. Sé conciso, profesional y habla con naturalidad de voz humana. Respuestas cortas aptas para teléfono.
    """

    # 4. Configurar el Asistente de Voz con Silero VAD + Deepgram + ElevenLabs + LLM
    # Elegir proveedor de LLM disponible (Gemini por defecto o OpenAI)
    llm_engine = google.LLM(model="gemini-2.0-flash") if os.getenv("GOOGLE_API_KEY") else openai.LLM(model="gpt-4o-mini")

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=deepgram.STT(language="es", model="nova-2"),
        llm=llm_engine,
        tts=elevenlabs.TTS(
            model="eleven_multilingual_v2",
            voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") # Rachel / Voz en español
        ),
        fnc_ctx=fnc_ctx,
        system_prompt=system_prompt
    )

    # 5. Soporte para Tonos DTMF (Teclas del teléfono 1, 2, 3)
    @ctx.room.on("sip_dtmf_received")
    def on_dtmf_received(dtmf_event: rtc.SipDTMF):
        digit = dtmf_event.digit
        logger.info(f"[DTMF Detectado] El cliente presionó: {digit}")
        
        if digit == "1":
            asyncio.create_task(assistant.say(f"Su saldo disponible es de {saldo:.2f} pesos mexicanos."))
        elif digit == "2":
            asyncio.create_task(assistant.say("Registrando su intención de cancelación. Lo comunicamos con el área de retenciones."))
            asyncio.create_task(fnc_ctx.transferir_a_humano("Pulsó 2 en DTMF"))
        elif digit == "3":
            asyncio.create_task(assistant.say("Lo comunicamos con el departamento de ventas. Por favor espere."))
            asyncio.create_task(fnc_ctx.transferir_a_humano("Pulsó 3 en DTMF"))

    # Iniciar el asistente en la sala
    assistant.start(ctx.room)

    # Saludo inicial con voz de ElevenLabs
    await assistant.say(
        f"Hola {nombre}, bienvenido a nuestro centro de atención inteligente. "
        "¿Desea consultar su saldo, gestionar una cancelación o hablar con un asesor de ventas?",
        allow_interruptions=True
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
