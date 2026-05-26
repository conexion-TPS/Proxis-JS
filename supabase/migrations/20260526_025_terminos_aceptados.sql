-- Fase 1.6 — Política de privacidad y términos de uso
-- Registra el timestamp exacto en que el asesor aceptó los términos en la app.
-- NULL = nunca aceptó → se le muestra la pantalla de aceptación al primer login.

ALTER TABLE asesor_credentials ADD COLUMN IF NOT EXISTS terminos_aceptados_at timestamptz;
