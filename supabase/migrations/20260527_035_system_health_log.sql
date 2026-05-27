-- Registro diario de salud del sistema generado por proxis-cerebro
-- Idempotente

CREATE TABLE IF NOT EXISTS system_health_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at    timestamptz NOT NULL DEFAULT now(),
  estado_global text NOT NULL DEFAULT 'saludable',  -- saludable | degradado | critico
  alertas       jsonb NOT NULL DEFAULT '[]',
  metricas      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_health_log_checked_at
  ON system_health_log (checked_at DESC);
