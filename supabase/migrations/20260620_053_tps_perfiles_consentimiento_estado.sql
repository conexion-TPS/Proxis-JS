-- Etapa 3 §5.5 — Estado de consentimiento de captura del dato sensible (f4/d8) en tps_perfiles.
-- Enum de 3 valores (NUNCA booleano): lo fija /api/cuestionario/tps-evaluar al capturar.
--   'consentido'    → el asesor consintió; se persiste el crudo sensible.
--   'no_consentido' → bloqueo por defecto; el crudo sensible (f4/d8) NO se persiste.
--   'qa_interno'    → captura para pruebas internas, permitida y marcada como tal.
-- NULL = filas legacy previas al gate (el CHECK admite NULL). Idempotente.

ALTER TABLE tps_perfiles
  ADD COLUMN IF NOT EXISTS consentimiento_estado text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tps_perfiles_consentimiento_estado_chk'
  ) THEN
    ALTER TABLE tps_perfiles
      ADD CONSTRAINT tps_perfiles_consentimiento_estado_chk
      CHECK (consentimiento_estado IN ('consentido', 'no_consentido', 'qa_interno'));
  END IF;
END $$;
