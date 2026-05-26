-- Fase 1.2 — Informe de supervisor como señal
-- Agrega 'supervisor' como fuente válida en behavioral_signals

ALTER TABLE behavioral_signals
  DROP CONSTRAINT IF EXISTS behavioral_signals_fuente_check;

ALTER TABLE behavioral_signals
  ADD CONSTRAINT behavioral_signals_fuente_check
    CHECK (fuente IN ('plataforma','email','sailor','cuestionario','manual','supervisor'));
