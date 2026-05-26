-- Fase 2.3 — Histórico de perfil + relato IA de evolución

-- ── asesor_perfil_historial: snapshot por ciclo de análisis ──────────────────
CREATE TABLE IF NOT EXISTS asesor_perfil_historial (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  asesor                  text        NOT NULL,
  snapshot_at             timestamptz NOT NULL DEFAULT now(),
  progresion_integrador   int,
  confianza_perfil        int,
  nivel_riesgo            text CHECK (nivel_riesgo IN ('activo','en_riesgo','critico') OR nivel_riesgo IS NULL),
  hipotesis_count         int         DEFAULT 0,
  senales_procesadas      int         DEFAULT 0,
  identidad_vendedora     text,
  relacion_prospeccion    text,
  modelos_mentales        text,
  relacion_feedback       text,
  perfil_conductual_notas text,
  contexto_situacional    text,
  resumen_ia              text
);

CREATE INDEX IF NOT EXISTS idx_perfil_historial_asesor_at
  ON asesor_perfil_historial (asesor, snapshot_at DESC);

-- ── asesor_perfil: relato de evolución generado por Gemini ───────────────────
ALTER TABLE asesor_perfil
  ADD COLUMN IF NOT EXISTS relato_evolucion    text,
  ADD COLUMN IF NOT EXISTS relato_evolucion_at timestamptz;
