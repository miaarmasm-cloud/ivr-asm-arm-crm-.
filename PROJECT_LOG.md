# 📋 Registro Histórico del Proyecto (ARM Voice & CRM Core)

Este documento sirve como bitácora central para el seguimiento de la arquitectura, configuración de servicios, decisiones técnicas y versiones del sistema.

---

## 📌 Metadatos del Proyecto
* **Nombre Oficial**: `arm-voice-crm` (o `ivr-arm-crm`)
* **Propósito**: Ecosistema de telefonía SIP con IVR en Python que evoluciona a un ARM (Autonomous Relationship Management) integrado a un CRM con WebRTC, Screen-Pop y memoria CBR.
* **Modelo de Infraestructura**: Nube desacoplada con Docker / Kubernetes y microservicios REST.

---

## 🏗️ Arquitectura Oficial y Definitiva

### 1. Central Telefónica (PBX): Asterisk 20 LTS
* **Pila SIP**: PJSIP puro en puerto `5060/UDP` y `5060/TCP`.
* **Codecs Soportados**: G.729, G.711 (alaw/ulaw), Opus, H.264 para videollamada.
* **Sin IAX, sin PRI, sin R2**: Solo protocolos VoIP modernos sobre SIP y RTP.
* **Desacople de LiveKit**: LiveKit **ya NO se utiliza ni como PBX ni como IVR**. Toda la señalización y conmutación corre directamente en Asterisk 20.

### 2. Motor del IVR: Python (AGI + FastAPI)
* **Lenguaje**: Python 3.10+
* **Mecanismos de Ejecución**:
  * **Scripts AGI Nativos en Asterisk** (`/var/lib/asterisk/agi-bin/`):
    * `identificar_llamante_rest.py`: Identifica por CallerID si es cliente existente o nuevo lead y genera menú dinámico con Barge-in.
    * `consultar_saldo_rest.py`: Valida el estatus de tarjeta (1 Activa / 2 Cancelada). Si es 2, **deniega el saldo** y transfiere a ejecutivo. Si es 1, entrega el saldo disponible.
    * `cancelar_tarjeta_rest.py`: Valida estatus, actualiza a 2 (Cancelada), genera folio `CAN-XXXXXX`, inserta auditoría y transfiere a retenciones.
    * `agente_citas_gemini.py`: Agente autónomo para citas médicas con memoria CBR.
  * **Middleware Orquestador** (`middleware/main.py`):
    * Servidor FastAPI para integración REST entre telefonía, Upstash Redis y Supabase.
* **Síntesis de Voz Humana**: ElevenLabs Multilingual v2 con fallback local Edge-TTS / espeak-ng.

### 3. Base de Datos: Supabase vía REST API Pura
* **Conexión**: HTTP/HTTPS con PostgREST (GET, POST, PATCH), usando `apikey` y `Authorization: Bearer`.
* **Sin Stored Procedures (SP) obsoletos ni XML**: Toda la comunicación es JSON estándar.
* **Tablas Principales**:
  * `clientes`: Perfil integral, caller_id, saldo, `estatus_tarjeta` (1: Activa, 2: Cancelada/Bloqueada).
  * `tarjetas_cancelaciones_log`: Bitácora histórica de cancelaciones y reactivaciones con folios, motivo y canal.
  * `llamadas_bitacora`: Registro de eventos para disparar el Screen-Pop en tiempo real.
  * `pedidos_calendario`: Calendario de pedidos y entregas.
  * `cbr_casos`: Repositorio de casos con embeddings vectoriales pgvector.

### 4. CRM: Next.js 14 Web (ARM & Screen-Pop)
* **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
* **Conexión al IVR y Base de Datos**: REST API (`/api/saldo`, `/api/cancelacion`, `/api/calls/originate`).
* **Control de Tarjeta**: Switch interactivo en `CustomerProfile.tsx` para marcar (1) o desmarcar (2) el estatus de la tarjeta, actualizando Supabase en vivo y auditando el cambio.
* **WebRTC Dialer**: Marcador SIP WebRTC conectado a Asterisk 20 para llamadas entrantes y salientes (Click-to-Call).

---

## 📅 Historial de Versiones

* **v2.0.0 (2026-11-14)**:
  * **Desacople Total de LiveKit**: Eliminado de roles de PBX e IVR.
  * **Asterisk 20 como PBX único**: Dialplan y PJSIP puro.
  * **IVR en Python REST**: Scripts AGI y Middleware comunicándose con Supabase y CRM 100% vía REST API.
  * **Regla de Negocio de Estatus de Tarjeta**: Implementación de `estatus_tarjeta` (1 Activa / 2 Cancelada), bloqueo estricto de saldo para estatus 2, script `cancelar_tarjeta_rest.py` y switch de marcado/desmarcado en el CRM.
* **v1.0.0 (2026-11-13)**: 
  * Stack inicial exploratorio, esquema de base de datos Supabase, y prototipo de CRM Next.js con Screen-Pop.

* **2026-11-15 (Homologación de Campañas, DIDs Virtuales y PJSIP Asterisk 20 LTS):**
  * **Segmentación de Campañas con DIDs Virtuales:**
    * Campaña 1 (Finanzas y Saldo): DID Virtual `1000` (Opción 1 IVR) -> Extensiones `1001-1004`.
    * Campaña 2 (Retención y Cancelaciones ARM): DID Virtual `2000` (Opción 2 IVR) -> Extensiones `2001-2004`.
    * Campaña 3 (Ventas y Contratos): DID Virtual `3000` (Opción 3 IVR) -> Extensiones `3001-3004`.
    * Campaña 4 (Doctores y Telemedicina IA): DID Virtual `4000` (Opción 4 IVR) -> Extensiones `4001-4005`.
    * Cabecera Fija IVR y PSTN: `8000`.
  * **PJSIP Homologado y Modular:**
    * `asterisk/pjsip.conf` estructurado en 4 bloques de campaña con Session Timers RFC 4028 (`timers=yes`), RTP Timers anti-zombi (`rtp_timeout=30`, `rtp_timeout_hold=120`).
    * Directiva `#tryinclude /etc/asterisk/pjsip_custom.conf` para extensiones dinámicas.
  * **Persistencia en Supabase & Seguridad Softphones:**
    * Tabla `public.extensiones` creada para credenciales SIP Digest (`password`), vinculación relacional con `campanas`, control de estado `activo` e historial inmutable de titulares (`historial_nombres`).
  * **Gestión en Tiempo Real vía AMI:**
    * Endpoint `/api/extensions` para sincronización atómica y auto-recarga en memoria (`dialplan reload` y `pjsip reload`) sin reiniciar contenedores ni interrumpir llamadas.
    * Interfaz visual en `CampaignsManager.tsx` con campos de contraseña SIP, botón de copiado para softphone y alta/baja de extensiones.
