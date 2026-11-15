-- =========================================================================
-- MIGRACIÓN 20261113000001: ESTATUS DE TARJETA (1 ACTIVA, 2 CANCELADA) Y LOG
-- =========================================================================

-- 1. Agregar columna estatus_tarjeta (1 = Activa, 2 = Cancelada/Bloqueada)
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS estatus_tarjeta SMALLINT DEFAULT 1 
CHECK (estatus_tarjeta IN (1, 2));

UPDATE clientes SET estatus_tarjeta = 1 WHERE estatus_tarjeta IS NULL;

-- 2. Índice optimizado para búsqueda rápida en el IVR
CREATE INDEX IF NOT EXISTS idx_clientes_estatus_tarjeta ON clientes(caller_id, estatus_tarjeta);

-- 3. Tabla de auditoría histórica para cancelaciones y reactivaciones
CREATE TABLE IF NOT EXISTS tarjetas_cancelaciones_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    folio_cancelacion VARCHAR(50) NOT NULL,
    caller_id VARCHAR(25) NOT NULL,
    numero_tarjeta_mask VARCHAR(25) NOT NULL,
    estatus_anterior SMALLINT NOT NULL,
    estatus_nuevo SMALLINT NOT NULL,
    motivo TEXT DEFAULT 'Cambio de estatus',
    canal VARCHAR(30) DEFAULT 'CRM_AGENTE', -- 'IVR_OPCION_2', 'CRM_AGENTE'
    saldo_al_momento NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancelaciones_cliente ON tarjetas_cancelaciones_log(cliente_id);
