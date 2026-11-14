"""
=============================================================================
SERVIDOR MCP (MODEL CONTEXT PROTOCOL) PARA SUPABASE & IVR/ARM
=============================================================================
Este servidor implementa el protocolo abierto MCP (JSON-RPC) para que cualquier
agente de IA (Antigravity, Claude, LiveKit Agent, etc.) pueda interactuar de 
forma nativa, estandarizada y segura con la base de datos Supabase.
=============================================================================
"""

import os
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from supabase import create_client, Client

load_dotenv()

# Inicializar servidor MCP
mcp = FastMCP("Supabase-ARM-Server")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Error] Conexión a Supabase fallida: {e}")


@mcp.tool()
def get_customer_by_caller_id(caller_id: str) -> Dict[str, Any]:
    """
    Obtiene los datos completos de un cliente (nombre, empresa, saldo, tarjeta) 
    utilizando su CallerID (número telefónico) como identificador primario.
    """
    if not supabase:
        return {"error": "Supabase no está configurado aún en el servidor MCP"}

    res = supabase.table("clientes").select("*").eq("caller_id", caller_id).execute()
    if res.data and len(res.data) > 0:
        return {"found": True, "cliente": res.data[0]}
    return {"found": False, "message": f"No se encontró ningún cliente con CallerID {caller_id}"}


@mcp.tool()
def get_balance(caller_id: str) -> Dict[str, Any]:
    """
    Consulta rápida del saldo disponible y terminación de tarjeta de un cliente por CallerID.
    """
    if not supabase:
        return {"error": "Supabase offline"}

    res = supabase.table("clientes").select("saldo, numero_tarjeta_mask, nombre_completo").eq("caller_id", caller_id).execute()
    if res.data and len(res.data) > 0:
        c = res.data[0]
        return {
            "nombre": c.get("nombre_completo"),
            "saldo": c.get("saldo", 0.0),
            "tarjeta_mask": c.get("numero_tarjeta_mask", "****")
        }
    return {"error": f"Cliente con CallerID {caller_id} no encontrado"}


@mcp.tool()
def log_call_bitacora(caller_id: str, opcion_ivr: str, resumen_ia: str, notas_agente: Optional[str] = None) -> Dict[str, Any]:
    """
    Registra una interacción en la bitácora de llamadas para historial y Screen-Pop.
    """
    if not supabase:
        return {"error": "Supabase offline"}

    # Obtener ID de cliente
    res_cli = supabase.table("clientes").select("id").eq("caller_id", caller_id).execute()
    cliente_id = res_cli.data[0]["id"] if (res_cli.data and len(res_cli.data) > 0) else None

    insert_data = {
        "caller_id": caller_id,
        "cliente_id": cliente_id,
        "tipo": "entrante",
        "estado": "en_curso",
        "opcion_ivr_seleccionada": opcion_ivr,
        "resumen_ia": resumen_ia,
        "notas_agente": notas_agente
    }
    res = supabase.table("llamadas_bitacora").insert(insert_data).execute()
    return {"success": True, "record": res.data}


@mcp.tool()
def search_cbr_cases(consulta: str) -> Dict[str, Any]:
    """
    Busca en la memoria CBR (Case-Based Reasoning) casos similares resueltos anteriormente.
    """
    if not supabase:
        return {"error": "Supabase offline"}

    # En producción utiliza el operador de similitud de coseno con embeddings
    res = supabase.table("cbr_casos").select("categoria, problema_descripcion, solucion_aplicada").limit(3).execute()
    return {"casos_encontrados": res.data or []}


@mcp.tool()
def get_order_deliveries(caller_id: str) -> Dict[str, Any]:
    """
    Obtiene el calendario de entregas de pedidos programados para un cliente.
    """
    if not supabase:
        return {"error": "Supabase offline"}

    res_cli = supabase.table("clientes").select("id").eq("caller_id", caller_id).execute()
    if not res_cli.data:
        return {"pedidos": []}

    cliente_id = res_cli.data[0]["id"]
    pedidos = supabase.table("pedidos_calendario").select("*").eq("cliente_id", cliente_id).execute()
    return {"pedidos": pedidos.data or []}


if __name__ == "__main__":
    mcp.run()
