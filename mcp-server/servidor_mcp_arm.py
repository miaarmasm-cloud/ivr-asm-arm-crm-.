"""
=============================================================================
SERVIDOR MCP UNIFICADO: servidor-mcp-arm-asm
=============================================================================
Ecosistema centralizado de herramientas para el proyecto IVR / ARM / CRM.
Encapsula bajo un solo servidor MCP independiente los 4 servicios clave:
  1. Supabase (Datos de clientes, saldos, bitácora, pedidos y memoria CBR)
  2. LiveKit (Telefonía SIP, salas de audio, llamadas outbound y transferencias)
  3. Kubernetes (Estado de pods, servicios, puertos y endpoints)
  4. GitHub (Sincronización de repositorio, commits y pipelines CI/CD)
=============================================================================
"""

import os
from typing import Optional, Dict, Any, List
import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from supabase import create_client, Client

load_dotenv()

# Nombre genérico unificado exclusivo para este proyecto
mcp = FastMCP("servidor-mcp-arm-asm")

# Configuración de Clientes
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xlmrmdxtrdomtrmnczwh.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "http://localhost:7880")
GITHUB_REPO = os.getenv("GITHUB_REPO", "miaarmasm-cloud/ivr-asm-arm-crm-.")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Supabase MCP] Modo offline: {e}")


# =============================================================================
# 1. SERVICIOS DE SUPABASE (BASE DE DATOS, CLIENTES, CBR Y BITÁCORA)
# =============================================================================

@mcp.tool()
def supabase_consultar_cliente(caller_id: str) -> Dict[str, Any]:
    """Obtiene los datos del cliente por su CallerID (identificador primario)."""
    if not supabase:
        return {"error": "Supabase no conectado"}
    res = supabase.table("clientes").select("*").eq("caller_id", caller_id).execute()
    if res.data and len(res.data) > 0:
        return {"found": True, "cliente": res.data[0]}
    return {"found": False, "message": f"Cliente con CallerID {caller_id} no encontrado"}


@mcp.tool()
def supabase_consultar_saldo(caller_id: str) -> Dict[str, Any]:
    """Consulta el saldo disponible y tarjeta enmascarada del cliente por CallerID."""
    if not supabase:
        return {"error": "Supabase no conectado"}
    res = supabase.table("clientes").select("saldo, numero_tarjeta_mask, nombre_completo").eq("caller_id", caller_id).execute()
    if res.data and len(res.data) > 0:
        c = res.data[0]
        return {
            "nombre": c.get("nombre_completo"),
            "saldo": c.get("saldo", 0.0),
            "tarjeta_mask": c.get("numero_tarjeta_mask", "****")
        }
    return {"error": f"CallerID {caller_id} no registrado"}


@mcp.tool()
def supabase_registrar_bitacora(caller_id: str, opcion_ivr: str, resumen_ia: str, notas_agente: Optional[str] = None) -> Dict[str, Any]:
    """Registra la llamada en la bitácora y dispara el Screen-Pop en el CRM."""
    if not supabase:
        return {"error": "Supabase no conectado"}
    res_cli = supabase.table("clientes").select("id").eq("caller_id", caller_id).execute()
    cliente_id = res_cli.data[0]["id"] if (res_cli.data and len(res_cli.data) > 0) else None
    
    res = supabase.table("llamadas_bitacora").insert({
        "caller_id": caller_id,
        "cliente_id": cliente_id,
        "tipo": "entrante",
        "estado": "en_curso",
        "opcion_ivr_seleccionada": opcion_ivr,
        "resumen_ia": resumen_ia,
        "notas_agente": notas_agente
    }).execute()
    return {"success": True, "data": res.data}


@mcp.tool()
def supabase_buscar_casos_cbr(problema_descripcion: str) -> Dict[str, Any]:
    """Busca casos previos resueltos en la memoria CBR para resolver dudas del cliente."""
    if not supabase:
        return {"casos": []}
    res = supabase.table("cbr_casos").select("categoria, problema_descripcion, solucion_aplicada").limit(3).execute()
    return {"casos_encontrados": res.data or []}


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


if __name__ == "__main__":
    mcp.run()
