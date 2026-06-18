-- Reconciliación 2a — Columnas ERRIM en asesor_perfil
-- Destino de los puentes del scorer (tps-evaluar):
--   resiliencia           ← rasgos f4 (Estabilidad bajo Presión)  "suma/base/n_items"
--   equilibrio_adaptativo ← tps_c_adapt (C06 + AD01-07)           "suma/base/n_items"
-- Cierra brecha repo↔base: las columnas YA existen en mkqgbmwm. Idempotente.

ALTER TABLE asesor_perfil ADD COLUMN IF NOT EXISTS resiliencia           text;
ALTER TABLE asesor_perfil ADD COLUMN IF NOT EXISTS equilibrio_adaptativo text;
