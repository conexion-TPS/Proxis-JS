-- Credenciales de autenticación para Sailor App
-- Separado de la plataforma web (que usa USUARIOS hardcodeado en JS)
-- Permite login con email + password y cambio de contraseña

CREATE TABLE IF NOT EXISTS asesor_credentials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor       text NOT NULL UNIQUE,   -- nombre completo, ej: "Diego Pérez"
  email        text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  rol          text NOT NULL DEFAULT 'asesor', -- 'asesor' | 'supervisor'
  activo       bool NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_asesor_credentials_email  ON asesor_credentials(email);
CREATE INDEX idx_asesor_credentials_asesor ON asesor_credentials(asesor);
