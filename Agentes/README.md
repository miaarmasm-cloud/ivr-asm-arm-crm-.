# Directorio de Agentes y Prompts Especializados

Este directorio centraliza los **prompts maestros, especificaciones técnicas, roles e históricos de cambios (changelogs)** de los diferentes agentes que componen el ecosistema **IVR ARM CRM**.

Cada archivo representa un agente modular independiente con sus propias responsabilidades, reglas de negocio y bitácora de actualizaciones.

---

## Índice de Agentes

| Agente | Archivo de Especificación | Área de Especialidad | Estado |
| :--- | :--- | :--- | :--- |
| **Front CRM/ARM UI/UX** | [`FRONT_CRM_ARM_UI_UX.md`](./FRONT_CRM_ARM_UI_UX.md) | Frontend Next.js 14, React, TypeScript, Tailwind CSS, Semáforos de Disponibilidad, Chat IA dinámico y WebRTC. | 🟢 Activo |
| *IVR Asterisk PBX Core* | *(Próximo a incorporar)* | Dialplan Asterisk 20, extensiones PJSIP, AGI Python, enrutamiento DTMF y puertos 5060/RTP. | ⏳ Planificado |
| *Gemini IA & Memoria CBR* | *(Próximo a incorporar)* | Lógica conversacional clínica, análisis de síntomas, desvío a humanos y autoentrenamiento CBR. | ⏳ Planificado |
| *Supabase Cloud DB & MCP* | *(Próximo a incorporar)* | Esquemas SQL, migraciones, sincronización WebSockets y servidor MCP para calendarios. | ⏳ Planificado |
| *LiveKit & WebRTC Streaming* | *(Próximo a incorporar)* | Audio streaming de baja latencia, SIP Gateway e integración de agentes de voz. | ⏳ Planificado |

---

## Estructura Estándar de cada Agente (`*.md`)
1. **Identidad y Misión:** Propósito claro y principios rectores.
2. **Prompt Maestro:** Instrucciones del sistema (*System Prompt*) listas para invocar al agente.
3. **Mapa de Componentes / Archivos:** Inventario de código bajo la tutela del agente.
4. **Reglas de Negocio y Estándares Técnicos:** Directrices de diseño, comunicación y formato.
5. **Histórico de Versiones (Changelog):** Registro cronológico de cambios, mejoras y correcciones.
6. **Backlog / Próximas Mejoras:** Tareas pendientes y roadmap de evolución.
