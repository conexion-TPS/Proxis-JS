-- ============================================================================
-- F1 — Estructura geográfica del árbol organizativo (Continente → País → Empresa)
-- Proyecto: proxis_dev (mkqgbmwmvypcjzlxidsm). NO Viña. Lo ejecuta TPS tras revisión.
-- Diseño B (aprobado): tabla org_geo separada + instituciones.geo_id.
--   · Aditivo: NO toca el límite de tenant (la empresa/institucion_id sigue siendo la raíz
--     del pipeline/roster/equipo). Geo es metadato POR ENCIMA de la empresa.
--   · Idempotente: re-ejecutable sin duplicar (guards NOT EXISTS; IF NOT EXISTS).
-- ============================================================================

-- 1) Geografía organizativa (continente / país) — árbol propio por parent_id.
CREATE TABLE IF NOT EXISTS org_geo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo               text NOT NULL CHECK (tipo IN ('continente','pais')),
  nombre             text NOT NULL,
  parent_id          uuid REFERENCES org_geo(id),   -- país → continente · continente → NULL
  activo             boolean NOT NULL DEFAULT true,
  -- Responsable PREVISTO: a nivel país/continente NO hay portal; recibe un reporte
  -- consolidado generado desde admin. Columnas nullable, se completan más adelante.
  responsable_nombre text,
  responsable_email  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_geo_parent_idx ON org_geo(parent_id);

-- Regla de árbol (validada también en la app): un país DEBE colgar de un continente;
-- un continente NO tiene padre. Se deja como CHECK suave para no romper inserciones parciales.
-- (Si se quiere endurecer luego: trigger que valide tipo(parent) según tipo(hijo).)

-- 2) La empresa cuelga de su país.
ALTER TABLE instituciones
  ADD COLUMN IF NOT EXISTS geo_id uuid REFERENCES org_geo(id);
CREATE INDEX IF NOT EXISTS instituciones_geo_idx ON instituciones(geo_id);

-- 3) Siembra inicial: 2 continentes + Chile bajo Sudamérica.
--    NO se cuelgan empresas todavía (Imrbrasil es de prueba).
INSERT INTO org_geo (tipo, nombre, parent_id)
SELECT 'continente', 'Norteamérica', NULL
WHERE NOT EXISTS (SELECT 1 FROM org_geo WHERE tipo='continente' AND nombre='Norteamérica');

INSERT INTO org_geo (tipo, nombre, parent_id)
SELECT 'continente', 'Sudamérica', NULL
WHERE NOT EXISTS (SELECT 1 FROM org_geo WHERE tipo='continente' AND nombre='Sudamérica');

INSERT INTO org_geo (tipo, nombre, parent_id)
SELECT 'pais', 'Chile', g.id
FROM org_geo g
WHERE g.tipo='continente' AND g.nombre='Sudamérica'
  AND NOT EXISTS (SELECT 1 FROM org_geo WHERE tipo='pais' AND nombre='Chile');

-- ── VERIFICACIÓN (correr después; debe devolver 3 filas: 2 continentes + Chile) ──
-- SELECT g.tipo, g.nombre, p.nombre AS padre
--   FROM org_geo g LEFT JOIN org_geo p ON p.id = g.parent_id
--  ORDER BY g.tipo DESC, g.nombre;

-- ── REVERSIÓN (si hiciera falta deshacer F1) ──
-- ALTER TABLE instituciones DROP COLUMN IF EXISTS geo_id;
-- DROP TABLE IF EXISTS org_geo;
