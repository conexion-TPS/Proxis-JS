-- Reconciliación Etapa 1 — CHECK de behavioral_signals.fuente incluye 'monitor'
-- proxis-monitor inserta fuente='monitor' (señal riesgo_burnout_mensajes); el
-- CHECK previo no lo admitía. Cierra brecha repo↔base. Idempotente.

ALTER TABLE behavioral_signals
  DROP CONSTRAINT IF EXISTS behavioral_signals_fuente_check;

ALTER TABLE behavioral_signals
  ADD CONSTRAINT behavioral_signals_fuente_check
    CHECK (fuente IN ('plataforma','email','sailor','cuestionario','manual','supervisor','monitor'));
