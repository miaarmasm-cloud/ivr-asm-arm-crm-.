# Contenedores Docker del Proyecto IVR / ARM & CRM

Esta carpeta centraliza los Dockerfiles de empaquetado para todos los componentes:

## Archivos:
* `Dockerfile.frontend`: Empaqueta el CRM en Next.js 14 en modo standalone ultraligero (<120MB).
* `Dockerfile.livekit-agent`: Empaqueta el Agente de Voz con ElevenLabs, Silero VAD, Deepgram y CBR.
* `Dockerfile.mcp-server`: Empaqueta el Servidor MCP para conexión nativa con Supabase.
* `docker-compose.yml`: Orquestador para levantar todos los servicios juntos.

## Comandos de Construcción:
Desde la raíz del proyecto (`C:\Users\ecybe\OneDrive\Documentos\Ivr Arm Crm Arm`):

```bash
# Construir imagen del CRM Frontend
docker build -f Docker/Dockerfile.frontend -t arm-crm-frontend:latest .

# Construir imagen del Servidor MCP
docker build -f Docker/Dockerfile.mcp-server -t mcp-supabase-server:latest .

# Levantar todos los contenedores juntos
docker compose -f Docker/docker-compose.yml up -d
```
