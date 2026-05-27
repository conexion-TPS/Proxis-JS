-- Observabilidad del sistema: errores de runtime + estado de deployments
-- Idempotente

-- ── error_log: errores de runtime en edge functions y API routes ─────────────
CREATE TABLE IF NOT EXISTS error_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  componente text        NOT NULL,  -- proxis-monitor | proxis-analyzer | proxis-cerebro | proxis-researcher | api-route
  severidad  text        NOT NULL DEFAULT 'error',  -- error | warning
  mensaje    text        NOT NULL,
  detalles   jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_created    ON error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_componente ON error_log (componente, created_at DESC);

-- ── deployment_log: estado de builds/deployments (Vercel webhook) ─────────────
CREATE TABLE IF NOT EXISTS deployment_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma text        NOT NULL DEFAULT 'vercel',  -- vercel | supabase
  estado     text        NOT NULL,   -- succeeded | error | canceled | building
  url        text,
  rama       text,
  commit_sha text,
  mensaje    text,
  detalles   jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployment_log_created ON deployment_log (created_at DESC);
