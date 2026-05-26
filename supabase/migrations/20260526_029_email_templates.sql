-- Fase 2.5 — Plantillas de email editables

CREATE TABLE IF NOT EXISTS email_templates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo        text NOT NULL CHECK (tipo IN ('notificacion_sailor','resumen_semanal')),
  version     int  NOT NULL DEFAULT 1,
  asunto      text NOT NULL,
  cuerpo_html text NOT NULL,
  activo      bool NOT NULL DEFAULT false,
  notas       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_tipo_version
  ON email_templates (tipo, version);

CREATE INDEX IF NOT EXISTS idx_email_templates_tipo_activo
  ON email_templates (tipo) WHERE activo = true;

-- Los templates iniciales se insertan vía seed (ver script de deploy).
