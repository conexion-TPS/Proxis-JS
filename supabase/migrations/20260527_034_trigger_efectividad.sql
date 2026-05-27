-- Métricas de efectividad por trigger — acumulado de reacciones
-- Idempotente

CREATE TABLE IF NOT EXISTS trigger_efectividad (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id          text NOT NULL REFERENCES trigger_config(trigger_id) ON DELETE CASCADE,
  periodo             text NOT NULL,                    -- YYYY-WW (semana ISO)
  mensajes_enviados   integer NOT NULL DEFAULT 0,
  reacciones_positivas integer NOT NULL DEFAULT 0,
  reacciones_negativas integer NOT NULL DEFAULT 0,
  tasa_positiva       numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN (reacciones_positivas + reacciones_negativas) > 0
    THEN ROUND(reacciones_positivas::numeric / (reacciones_positivas + reacciones_negativas) * 100, 2)
    ELSE NULL END
  ) STORED,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_id, periodo)
);

-- Columna en message_log para guardar qué señal de reacción lo evaluó
ALTER TABLE message_log ADD COLUMN IF NOT EXISTS evaluado boolean NOT NULL DEFAULT false;

-- Índice para búsqueda rápida de mensajes recientes por asesor
CREATE INDEX IF NOT EXISTS idx_message_log_asesor_created
  ON message_log (asesor, created_at DESC);

-- RPC para incremento atómico de mensajes enviados
CREATE OR REPLACE FUNCTION incrementar_mensajes_enviados(
  p_trigger_id text,
  p_periodo    text
) RETURNS void LANGUAGE sql AS $$
  INSERT INTO trigger_efectividad (trigger_id, periodo, mensajes_enviados, reacciones_positivas, reacciones_negativas, updated_at)
  VALUES (p_trigger_id, p_periodo, 1, 0, 0, now())
  ON CONFLICT (trigger_id, periodo) DO UPDATE
    SET mensajes_enviados = trigger_efectividad.mensajes_enviados + 1,
        updated_at        = now();
$$;

-- RPC para incremento atómico de efectividad
CREATE OR REPLACE FUNCTION incrementar_efectividad(
  p_trigger_id text,
  p_periodo    text,
  p_positivas  integer DEFAULT 0,
  p_negativas  integer DEFAULT 0
) RETURNS void LANGUAGE sql AS $$
  INSERT INTO trigger_efectividad (trigger_id, periodo, mensajes_enviados, reacciones_positivas, reacciones_negativas, updated_at)
  VALUES (p_trigger_id, p_periodo, 0, p_positivas, p_negativas, now())
  ON CONFLICT (trigger_id, periodo) DO UPDATE
    SET reacciones_positivas = trigger_efectividad.reacciones_positivas + EXCLUDED.reacciones_positivas,
        reacciones_negativas = trigger_efectividad.reacciones_negativas + EXCLUDED.reacciones_negativas,
        updated_at           = now();
$$;
