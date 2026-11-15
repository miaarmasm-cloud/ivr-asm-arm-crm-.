-- =========================================================================
-- ESQUEMA COMPLETO SUPABASE / POSTGRESQL PARA IVR + CRM ARM
-- =========================================================================

-- Habilitar extensión para búsqueda semántica vectorial (CBR)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. TABLA: CLIENTES
-- El caller_id (número telefónico normalizado ej: +525512345678) es el índice principal de búsqueda
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id VARCHAR(25) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    empresa VARCHAR(120),
    direccion TEXT,
    numero_tarjeta_mask VARCHAR(25), -- Ejemplo: '**** **** **** 4242'
    saldo NUMERIC(12, 2) DEFAULT 0.00,
    estatus_tarjeta SMALLINT DEFAULT 1 CHECK (estatus_tarjeta IN (1, 2)), -- 1: Activa, 2: Cancelada/Bloqueada
    email VARCHAR(120),
    telefonos_adicionales JSONB DEFAULT '[]'::jsonb, -- Array de strings con otros números
    fecha_nacimiento DATE,
    agente_asignado VARCHAR(100) DEFAULT 'No asignado',
    compras_previas JSONB DEFAULT '[]'::jsonb, -- Array de compras históricas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_caller_id ON clientes(caller_id);

-- 2. TABLA: BITÁCORA DE LLAMADAS (HISTÓRICO Y SCREEN-POP)
CREATE TABLE IF NOT EXISTS llamadas_bitacora (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id VARCHAR(25) NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    tipo VARCHAR(15) CHECK (tipo IN ('entrante', 'saliente')) DEFAULT 'entrante',
    estado VARCHAR(20) CHECK (estado IN ('en_curso', 'finalizada', 'perdida', 'transferida')) DEFAULT 'en_curso',
    duracion_segundos INT DEFAULT 0,
    opcion_ivr_seleccionada VARCHAR(80), -- '1. Consulta de Saldo', '2. Cancelación', '3. Ventas'
    transcripcion_texto TEXT,
    resumen_ia TEXT,
    notas_agente TEXT,
    grabacion_url TEXT,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_caller_id ON llamadas_bitacora(caller_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON llamadas_bitacora(fecha_hora DESC);

-- 3. TABLA: CALENDARIO DE PEDIDOS Y ENTREGAS
CREATE TABLE IF NOT EXISTS pedidos_calendario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    folio_pedido VARCHAR(50) NOT NULL,
    descripcion_compra TEXT NOT NULL,
    monto_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_estimada_entrega DATE NOT NULL,
    estado_entrega VARCHAR(30) DEFAULT 'En preparación' 
        CHECK (estado_entrega IN ('En preparación', 'En ruta', 'Entregado', 'Reprogramado', 'Cancelado')),
    notificado_al_cliente BOOLEAN DEFAULT FALSE,
    notas_entrega TEXT
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos_calendario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_entrega ON pedidos_calendario(fecha_estimada_entrega);

-- 4. TABLA: CASOS CBR (CASE-BASED REASONING PARA EL AGENTE ARM DE IA)
CREATE TABLE IF NOT EXISTS cbr_casos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(50) NOT NULL, -- 'saldo', 'cancelacion', 'entrega', 'soporte'
    problema_descripcion TEXT NOT NULL,
    solucion_aplicada TEXT NOT NULL,
    resolucion_exitosa BOOLEAN DEFAULT TRUE,
    veces_utilizado INT DEFAULT 1,
    embedding vector(1536), -- Vector para similitud de coseno
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA: AUDITORÍA DE CANCELACIONES Y REACTIVACIONES DE TARJETA
CREATE TABLE IF NOT EXISTS tarjetas_cancelaciones_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    folio_cancelacion VARCHAR(50) NOT NULL,
    caller_id VARCHAR(25) NOT NULL,
    numero_tarjeta_mask VARCHAR(25) NOT NULL,
    estatus_anterior SMALLINT NOT NULL,
    estatus_nuevo SMALLINT NOT NULL, -- 1: Activa, 2: Cancelada
    motivo TEXT DEFAULT 'Cambio de estatus',
    canal VARCHAR(30) DEFAULT 'CRM_AGENTE', -- 'IVR_OPCION_2', 'CRM_AGENTE'
    saldo_al_momento NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancelaciones_cliente ON tarjetas_cancelaciones_log(cliente_id);

-- =========================================================================
-- DATOS SEMILLA (SEED DATA) PARA PRUEBAS INMEDIATAS CON SOFTPHONE
-- =========================================================================

-- Cliente 1: Softphone de prueba (ejemplo número interno 1001 o móvil)
INSERT INTO clientes (
    caller_id, 
    nombre_completo, 
    empresa, 
    direccion, 
    numero_tarjeta_mask, 
    saldo, 
    email, 
    telefonos_adicionales, 
    fecha_nacimiento, 
    agente_asignado,
    compras_previas
) VALUES (
    '1001', 
    'Carlos Mendoza Ortiz', 
    'Logística & Distribución S.A.', 
    'Av. Reforma 222, Piso 14, Cuauhtémoc, CDMX', 
    '**** **** **** 8821', 
    14850.50, 
    'carlos.mendoza@empresa.com', 
    '["+525598765432", "+525544332211"]'::jsonb, 
    '1985-06-15', 
    'Agente Demo 1',
    '[
        {"item": "Licencia Enterprise ARM", "fecha": "2026-01-10", "total": 12000.00},
        {"item": "Módulo de Telefonía SIP WebRTC", "fecha": "2026-02-14", "total": 2850.50}
    ]'::jsonb
) ON CONFLICT (caller_id) DO NOTHING;

-- Pedidos para Carlos Mendoza
INSERT INTO pedidos_calendario (
    cliente_id, 
    folio_pedido, 
    descripcion_compra, 
    monto_total, 
    fecha_estimada_entrega, 
    estado_entrega, 
    notas_entrega
) 
SELECT 
    id, 
    'PED-2026-904', 
    'Equipo Gateway SIP Gateway 8 Canales + Auriculares Noise-Cancelling', 
    6400.00, 
    CURRENT_DATE + INTERVAL '2 days', 
    'En ruta', 
    'Entregar en horario de oficina de 9:00 a 17:00 hrs con vigilancia'
FROM clientes WHERE caller_id = '1001'
ON CONFLICT DO NOTHING;

-- Bitácora previa de llamadas para Carlos Mendoza
INSERT INTO llamadas_bitacora (
    caller_id, 
    cliente_id, 
    tipo, 
    estado, 
    duracion_segundos, 
    opcion_ivr_seleccionada, 
    resumen_ia, 
    notas_agente
)
SELECT 
    '1001', 
    id, 
    'entrante', 
    'finalizada', 
    184, 
    '1. Consulta de Saldo', 
    'El cliente consultó su saldo mediante el IVR y solicitó confirmación de la fecha de entrega del pedido PED-2026-904.', 
    'Cliente prioritario. Se le informó que el pedido llega en 48 horas.'
FROM clientes WHERE caller_id = '1001'
ON CONFLICT DO NOTHING;

-- Habilitar suscripción en tiempo real (Supabase Realtime) para la tabla de bitácora
ALTER PUBLICATION supabase_realtime ADD TABLE llamadas_bitacora;
