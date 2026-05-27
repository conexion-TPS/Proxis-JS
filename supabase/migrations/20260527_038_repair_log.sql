-- Registro de reparaciones automáticas ejecutadas por proxis-cerebro
-- Idempotente

CREATE TABLE IF NOT EXISTS repair_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_alerta text        NOT NULL,   -- tipo del check que disparó la reparación
  accion      text        NOT NULL,   -- qué se hizo
  exito       boolean     NOT NULL,
  detalle     text,                   -- resultado o mensaje de error
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_log_created    ON repair_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_log_tipo       ON repair_log (tipo_alerta, created_at DESC);
