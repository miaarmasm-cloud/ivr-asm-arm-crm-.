# Servidor MCP para Supabase (Model Context Protocol)

Este servidor expone las funciones de la base de datos Supabase como herramientas nativas MCP (JSON-RPC) para agentes de Inteligencia Artificial (Antigravity, LiveKit Agents, Claude Desktop, Cursor).

## Herramientas Expuestas:
1. `get_customer_by_caller_id`: Consulta los datos de un cliente por teléfono.
2. `get_balance`: Consulta saldo y tarjeta asociada.
3. `log_call_bitacora`: Inserta registros en la bitácora para detonar Screen-Pop.
4. `search_cbr_cases`: Búsqueda de casos resueltos (Case-Based Reasoning).
5. `get_order_deliveries`: Consulta de pedidos en el calendario.

## Ejecución Local:
```bash
cd mcp-server
pip install -r requirements.txt
python server.py
```
