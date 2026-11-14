# 📋 Registro Histórico del Proyecto (ARM Voice & CRM Core)

Este documento sirve como bitácora central e independiente para el seguimiento del desarrollo, configuración de servicios, decisiones arquitectónicas y versiones del sistema.

---

## 📌 Metadatos del Proyecto
* **Nombre Oficial del Repositorio Sugerido**: `arm-voice-crm` (o `ivr-arm-crm`)
* **Propósito**: Ecosistema integral de telefonía SIP con IVR inteligente que evoluciona a un ARM (Autonomous Relationship Management) integrado a un CRM con WebRTC, Screen-Pop y memoria CBR.
* **Modelo de Infraestructura**: Nube desacoplada con Kubernetes (K8s) y microservicios Docker.

---

## 🏗️ Registro de Arquitectura Implementada

### 1. Núcleo de Telefonía e Inteligencia (LiveKit Stack)
* **Motor de Medios**: LiveKit Server (WebRTC en tiempo real).
* **Pasarela Telefónica**: LiveKit SIP Gateway (`hostNetwork: true` para eliminar problemas de NAT).
* **Puertos de Red**:
  * `5060/UDP` y `5060/TCP`: Señalización SIP para softphones (Zoiper/MicroSIP) y troncales PSTN.
  * `10000-10100/UDP`: Rango de audio RTP de baja latencia.
  * `7880/TCP` y `7881/TCP`: API y WebSockets para el CRM del navegador.
* **Agente de IA (Python 3.12)**:
  * VAD: Silero VAD (local, costo $0).
  * STT: Deepgram Nova-2 (Español, latencia <150ms).
  * TTS: ElevenLabs Multilingual v2 (Voz humana ultra-realista).
  * LLM: Google Gemini 2.0 Flash / OpenAI GPT-4o-mini.
  * DTMF: Captura de teclas en paralelo a la voz (1: Saldo, 2: Cancelación, 3: Ventas).
  * Transferencia: Método `transfer_sip_participant` hacia extensión humana.

### 2. Base de Datos & Memoria CBR (Supabase)
* **Motor**: PostgreSQL con extensiones `vector` y `supabase_realtime`.
* **Identificador Primario**: `caller_id` (número telefónico normalizado).
* **Tablas Creadas**:
  * `clientes`: Perfil integral, saldo, tarjeta enmascarada, compras previas, agente asignado.
  * `llamadas_bitacora`: Historial de llamadas, resúmenes de IA, notas de agente (detonador de Screen-Pop).
  * `pedidos_calendario`: Calendario de entregas y control de notificaciones al cliente.
  * `cbr_casos`: Repositorio de problemas y soluciones pasadas con embeddings vectoriales.

### 3. Frontend & CRM ARM (Next.js 14)
* **Tecnología**: React 18, Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
* **Módulos**:
  * *Customer Profile*: Vista completa de datos y botón de guardar cambios.
  * *Call Bitácora*: Registro interactivo con notas del operador.
  * *Order Calendar*: Línea de tiempo de entregas y notificación al cliente.
  * *WebRTC Dialer*: Marcador telefónico integrado con teclado DTMF y botón Outbound.
  * *Visual IVR Flow*: Diseñador de flujos visual estilo Avaya con 7 nodos y minimapa.
  * *Screen-Pop Modal*: Detección y apertura automática de fichas de cliente al entrar llamadas.

---

## 🔑 Checklist de Credenciales y Servicios Gratuitos
- [ ] **Supabase**: URL y Service Role Key configuradas en el entorno.
- [ ] **Deepgram**: API Key con crédito gratuito de $200 USD.
- [ ] **ElevenLabs**: API Key con cuota gratuita mensual de 10,000 caracteres.
- [ ] **Google AI Studio**: API Key de Gemini 2.0 Flash (hasta 15 RPM gratis).
- [ ] **GitHub**: Repositorio remoto conectado para CI/CD con GitHub Actions.

---

## 📅 Historial de Versiones
* **v1.0.0 (2026-11-13)**: 
  * Creación del stack inicial, dialplan desacoplado, esquema de base de datos Supabase, agente LiveKit con ElevenLabs y DTMF, y CRM Next.js con Screen-Pop y diseñador visual.
