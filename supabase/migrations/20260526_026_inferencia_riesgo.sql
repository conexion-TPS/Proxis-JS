-- Fase 2.1 + 2.2 — Motor de inferencia manual y clasificación de riesgo
-- También corrige mismatches entre el schema original y el código real.

-- ── deductions_log: columnas que el código usa pero el schema no tenía ──────
ALTER TABLE deductions_log
  ADD COLUMN IF NOT EXISTS dimension_afectada  text,
  ADD COLUMN IF NOT EXISTS valor_sugerido      text,
  ADD COLUMN IF NOT EXISTS evidencia           text,
  -- Fase 2.1: acción propuesta por la IA (requiere aprobación humana)
  ADD COLUMN IF NOT EXISTS accion_tipo         text
    CHECK (accion_tipo IN ('trigger','ajuste_dimension','escalar_supervisor','ninguna') OR accion_tipo IS NULL),
  ADD COLUMN IF NOT EXISTS accion_descripcion  text,
  ADD COLUMN IF NOT EXISTS accion_ejecutada    bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS accion_ejecutada_at timestamptz;

-- ── knowledge_gaps: columnas que el código usa pero el schema no tenía ──────
ALTER TABLE knowledge_gaps
  ADD COLUMN IF NOT EXISTS asesor    text,
  ADD COLUMN IF NOT EXISTS dimension text;

-- knowledge_gaps.estado: agrega 'detectado' (el analyzer lo usa así)
ALTER TABLE knowledge_gaps
  DROP CONSTRAINT IF EXISTS knowledge_gaps_estado_check;
ALTER TABLE knowledge_gaps
  ADD CONSTRAINT knowledge_gaps_estado_check
    CHECK (estado IN ('pendiente','detectado','en_investigacion','cubierto'));

-- ── knowledge_base_conductual: título para búsqueda y display ────────────────
ALTER TABLE knowledge_base_conductual
  ADD COLUMN IF NOT EXISTS titulo text;

-- ── knowledge_proposals: columnas que el UI y el researcher usan ─────────────
ALTER TABLE knowledge_proposals
  ADD COLUMN IF NOT EXISTS asesor            text,
  ADD COLUMN IF NOT EXISTS titulo            text,
  ADD COLUMN IF NOT EXISTS perfil            text,
  ADD COLUMN IF NOT EXISTS categoria         text,
  ADD COLUMN IF NOT EXISTS etapa_ciclo       text,
  ADD COLUMN IF NOT EXISTS completitud       int,
  ADD COLUMN IF NOT EXISTS regla_inferencia  text,
  ADD COLUMN IF NOT EXISTS accion_correctiva text,
  ADD COLUMN IF NOT EXISTS justificacion     text;

-- ── asesor_perfil: nivel de riesgo (Fase 2.2) ────────────────────────────────
ALTER TABLE asesor_perfil
  ADD COLUMN IF NOT EXISTS nivel_riesgo      text
    CHECK (nivel_riesgo IN ('activo','en_riesgo','critico') OR nivel_riesgo IS NULL),
  ADD COLUMN IF NOT EXISTS nivel_riesgo_at   timestamptz,
  ADD COLUMN IF NOT EXISTS nivel_riesgo_nota text;

CREATE INDEX IF NOT EXISTS idx_asesor_perfil_riesgo ON asesor_perfil (nivel_riesgo)
  WHERE nivel_riesgo IS NOT NULL;
