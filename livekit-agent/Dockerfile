FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias del sistema para audio y compilación
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-descargar el modelo Silero VAD para que el contenedor inicie al instante
RUN python -c "from livekit.plugins import silero; silero.VAD.load()"

COPY . .

CMD ["python", "agent.py", "start"]
