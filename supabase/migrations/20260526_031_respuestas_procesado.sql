-- Fase 3.3: track signal generation per cuestionario response
ALTER TABLE respuestas_cuestionario
  ADD COLUMN IF NOT EXISTS procesado bool DEFAULT false NOT NULL;
