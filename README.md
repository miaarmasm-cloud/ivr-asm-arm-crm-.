# Ecosistema IVR + ARM + CRM con Telefonía SIP, Asterisk 20 y Next.js

Este repositorio contiene la arquitectura completa, desacoplada y lista para la nube de un sistema **IVR con evolución a ARM (Agent Relationship Management)** integrado a un **CRM con telefonía WebRTC SIP** y soporte de **Screen-Pop en tiempo real**.

---

## 📁 Estructura del Proyecto

```
.
├── database/
│   └── schema.sql             # Esquema completo de Supabase (PostgreSQL + pgvector + Realtime)
├── asterisk/
│   ├── pjsip.conf             # Configuración moderna PJSIP (Softphones, WebRTC, Troncal SIP)
│   ├── extensions.conf        # Dialplan dinámico agnóstico (delega al Middleware)
│   ├── http.conf              # Servidor HTTP/WebSocket de Asterisk para WebRTC
│   ├── rtp.conf               # Rango de puertos de audio RTP acotado
│   ├── Dockerfile             # Imagen Docker de Asterisk 20 LTS
│   └── k8s-asterisk.yaml      # Manifiesto Kubernetes sin problemas de NAT (hostNetwork)
├── middleware/
│   ├── main.py                # Orquestador del IVR (FastAPI + Supabase + Upstash)
│   ├── requirements.txt       # Dependencias Python
│   ├── Dockerfile             # Contenedor para despliegue en Railway
│   └── .env.example           # Variables de entorno
└── crm-nextjs/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx       # Panel principal del CRM con CallerID primario
    │   │   └── api/outbound/  # API para originar llamadas salientes
    │   ├── components/
    │   │   ├── CustomerProfile.tsx # Vista y edición completa del cliente
    │   │   ├── CallBitacora.tsx    # Historial de llamadas y anotaciones
    │   │   ├── OrderCalendar.tsx   # Calendario de pedidos y notificaciones
    │   │   ├── WebRTCDialer.tsx    # Dialer de llamada saliente (SIP WebRTC)
    │   │   └── ScreenPopModal.tsx  # Modal de llamada entrante automática
    │   └── lib/
    │       ├── types.ts       # Tipos TypeScript
    │       └── supabaseClient.ts # Conexión a Supabase
    └── package.json
```

---

## 🚀 Paso a Paso para Desplegar

### 1. Base de Datos (Supabase)
1. Entra a [Supabase](https://supabase.com) y crea un proyecto nuevo gratuito.
2. Ve al **SQL Editor** y pega todo el contenido de `database/schema.sql`.
3. Haz clic en **Run**:
   - Creará las tablas: `clientes`, `llamadas_bitacora`, `pedidos_calendario` y `cbr_casos`.
   - Insertará el cliente de pruebas con **CallerID: 1001** (Carlos Mendoza Ortiz).
   - Habilitará la extensión `vector` para el ARM y la publicación `supabase_realtime` para el Screen-Pop.

### 2. Despliegue de Asterisk 20 (Kubernetes o Docker en la Nube)
* **¿Por qué no hay problemas de NAT?**:
  En el manifiesto `asterisk/k8s-asterisk.yaml` se utiliza `hostNetwork: true`. Esto hace que el contenedor de Asterisk use directamente la interfaz de red pública de la máquina o nodo, eliminando los errores de "un solo sentido de audio" (*one-way audio*) provocados por la doble NAT de Kubernetes.
* Para probar con softphone (ej. **Zoiper** o **MicroSIP**):
  - Registra el softphone apuntando a la IP pública del PBX en el puerto `5060/UDP`.
  - Usuario: `1001`
  - Contraseña: `PruebaPass1001!`

### 3. Middleware del IVR (Railway / Docker)
1. Despliega la carpeta `middleware/` en Railway o cualquier servicio Docker.
2. Configura las variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `UPSTASH_REDIS_URL` (Opcional para caché ultra-rápida de sesiones)
3. Al recibir una llamada, el middleware atiende el menú con entrada dual (**DTMF teclado o Voz**):
   - **Opción 1**: Consulta de saldo.
   - **Opción 2**: Cancelación.
   - **Opción 3**: Ventas / Transferencia al CRM.

### 4. CRM Web en Next.js
1. Entra en `crm-nextjs/` y ejecuta:
   ```bash
   npm run dev
   ```
2. Abre `http://localhost:3000` en tu navegador.
3. Funcionalidades integradas:
   - **CallerID Primario**: Búsqueda y enlace automático por número de cliente.
   - **Screen-Pop Interactivo**: Haz clic en el botón *"Simular Screen-Pop (1001)"* en la barra superior para ver cómo se abre automáticamente la ficha del cliente y su saldo al entrar una llamada.
   - **Bitácora**: Visualiza resúmenes de IA y redacta notas de las llamadas.
   - **Calendario de Pedidos**: Revisa la fecha de entrega y envía notificaciones de estado.
   - **WebRTC Outbound Dialer**: Botón de llamada saliente con teclado DTMF listo para enlazar hacia la troncal PSTN.
