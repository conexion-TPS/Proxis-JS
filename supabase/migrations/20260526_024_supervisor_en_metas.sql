-- Fase 1.3 — Estructura árbol básica
-- Agrega campo supervisor a metas para vincular cada asesor con su supervisor.
-- NULL = asesor independiente sin supervisor asignado.

ALTER TABLE metas ADD COLUMN IF NOT EXISTS supervisor text;

CREATE INDEX IF NOT EXISTS idx_metas_supervisor ON metas (supervisor);
