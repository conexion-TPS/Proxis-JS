-- Fase 2.1 — Hipótesis generadas por el motor IA

CREATE TABLE IF NOT EXISTS deductions_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor         text NOT NULL,
  dimension      text,                          -- dimensión del perfil que toca
  hipotesis      text NOT NULL,                 -- texto de la hipótesis
  confianza      int CHECK (confianza BETWEEN 0 AND 100),
  senales_usadas uuid[],                        -- IDs de behavioral_signals que la fundamentan
  estado         text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','validada','rechazada','editada')),
  correccion     text,                          -- si el coach edita la hipótesis
  reviewed_by    text,
  created_at     timestamptz DEFAULT now(),
  reviewed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deductions_asesor ON deductions_log (asesor);
CREATE INDEX IF NOT EXISTS idx_deductions_estado ON deductions_log (estado);
CREATE INDEX IF NOT EXISTS idx_deductions_confianza ON deductions_log (confianza DESC);
