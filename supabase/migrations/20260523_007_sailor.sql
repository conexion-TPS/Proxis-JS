-- Fase 2.1 — Tablas para Sailor App (mensajería + push)

CREATE TABLE IF NOT EXISTS sailor_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor       text NOT NULL,
  role         text CHECK (role IN ('coach','asesor')) NOT NULL,
  body         text NOT NULL,
  trigger_id   text,                        -- si fue disparado por un trigger
  leido        bool DEFAULT false,
  metadata     jsonb,                       -- datos adicionales (pregunta de captura, etc.)
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor     text NOT NULL UNIQUE,
  token      text NOT NULL,                -- Expo push token
  platform   text CHECK (platform IN ('ios','android')),
  active     bool DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sailor_asesor ON sailor_messages (asesor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sailor_leido ON sailor_messages (asesor, leido) WHERE leido = false;
