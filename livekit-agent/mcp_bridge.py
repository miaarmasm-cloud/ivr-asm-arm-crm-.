"""
=============================================================================
PUENTE MCP PARA EL AGENTE LIVEKIT (MODEL CONTEXT PROTOCOL)
=============================================================================
Permite que el Agente de Voz de LiveKit consuma las herramientas del servidor
MCP de Supabase de forma nativa y desacoplada mediante llamadas HTTP / JSON-RPC.
=============================================================================
"""

import os
import httpx
import logging

logger = logging.getLogger("livekit-mcp-bridge")

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8000")

class MCPBridge:
    def __init__(self, base_url: str = MCP_SERVER_URL):
        self.base_url = base_url.rstrip("/")

    async def get_customer(self, caller_id: str) -> dict:
        """Invoca la herramienta MCP get_customer_by_caller_id"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    f"{self.base_url}/tools/get_customer_by_caller_id",
                    json={"caller_id": caller_id}
                )
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.warning(f"MCP get_customer fallback: {e}")
        return {"found": False}

    async def get_balance(self, caller_id: str) -> dict:
        """Invoca la herramienta MCP get_balance"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    f"{self.base_url}/tools/get_balance",
                    json={"caller_id": caller_id}
                )
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.warning(f"MCP get_balance fallback: {e}")
        return {"saldo": 0.0, "tarjeta_mask": "****"}

    async def log_call(self, caller_id: str, opcion_ivr: str, resumen_ia: str, notas: str = "") -> bool:
        """Invoca la herramienta MCP log_call_bitacora"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    f"{self.base_url}/tools/log_call_bitacora",
                    json={
                        "caller_id": caller_id,
                        "opcion_ivr": opcion_ivr,
                        "resumen_ia": resumen_ia,
                        "notas_agente": notas
                    }
                )
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"MCP log_call fallback: {e}")
        return False

    async def search_cbr(self, consulta: str) -> list:
        """Invoca la herramienta MCP search_cbr_cases"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    f"{self.base_url}/tools/search_cbr_cases",
                    json={"consulta": consulta}
                )
                if res.status_code == 200:
                    data = res.json()
                    return data.get("casos_encontrados", [])
        except Exception as e:
            logger.warning(f"MCP search_cbr fallback: {e}")
        return []
