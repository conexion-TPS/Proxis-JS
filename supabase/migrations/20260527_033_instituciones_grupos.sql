-- Fase gestión usuarios: instituciones, grupos y FK en asesor_credentials
-- Idempotente

CREATE TABLE IF NOT EXISTS instituciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'empresa',  -- empresa | individual
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grupos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  institucion_id uuid REFERENCES instituciones(id),
  activo         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE asesor_credentials
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES grupos(id);

-- Institución y grupo por defecto para auto-inscripción individual
INSERT INTO instituciones (id, nombre, tipo, activo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Individual', 'individual', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO grupos (id, nombre, institucion_id, activo)
VALUES ('00000000-0000-0000-0000-000000000002', 'Asesores Individuales',
        '00000000-0000-0000-0000-000000000001', true)
ON CONFLICT (id) DO NOTHING;
