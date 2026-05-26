-- Fase 2.4 — Capa gerencia de supervisores

CREATE TABLE IF NOT EXISTS supervisores (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text NOT NULL UNIQUE,
  email      text,
  activo     bool DEFAULT true NOT NULL,
  notas      text,
  created_at timestamptz DEFAULT now()
);

-- Poblar desde los valores que ya existen en metas.supervisor
INSERT INTO supervisores (nombre)
SELECT DISTINCT supervisor FROM metas
WHERE supervisor IS NOT NULL AND supervisor <> ''
ON CONFLICT (nombre) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_supervisores_activo ON supervisores (activo) WHERE activo = true;
