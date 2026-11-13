FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

# Instalar Asterisk 20 y módulos PJSIP, Opus y herramientas básicas
RUN apt-get update && apt-get install -y --no-install-recommends \
    asterisk \
    asterisk-opus \
    asterisk-core-sounds-es \
    asterisk-core-sounds-es-wav \
    curl \
    iproute2 \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copiar configuraciones limpias
COPY pjsip.conf /etc/asterisk/pjsip.conf
COPY extensions.conf /etc/asterisk/extensions.conf
COPY http.conf /etc/asterisk/http.conf
COPY rtp.conf /etc/asterisk/rtp.conf

# Permisos
RUN chown -R asterisk:asterisk /etc/asterisk /var/spool/asterisk /var/log/asterisk /var/lib/asterisk

EXPOSE 5060/udp 5060/tcp 8088/tcp 10000-10100/udp

USER asterisk

CMD ["asterisk", "-f", "-vvvddd"]
