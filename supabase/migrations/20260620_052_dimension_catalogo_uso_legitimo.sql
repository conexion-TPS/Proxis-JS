-- Etapa 3 §5.6(a) — Uso legítimo por dimensión sensible.
-- Hace MACHINE-READABLE el propósito que hoy solo vive en prosa (columna `nota`):
-- enumera para qué se permite usar cada dimensión sensible {autoconocimiento,
-- modular_coaching, medir_progreso}. Solo aplica a dimensiones sensible=true;
-- las no-sensibles quedan en NULL (no aplica). Idempotente; NO ejecuta nada irreversible.

-- 1) Columna: lista de usos legítimos. text[] + CHECK de contención (cada elemento ∈ los 3).
--    text[] con `<@` (is contained by) es lo más limpio aquí: el operador valida que TODO
--    elemento del array esté en el conjunto permitido, sin crear un tipo enum aparte
--    (CREATE TYPE no es IF NOT EXISTS). NULL y '{}' pasan el CHECK.
ALTER TABLE dimension_catalogo
  ADD COLUMN IF NOT EXISTS uso_legitimo text[];

-- 2) CHECK: todo elemento de uso_legitimo ∈ {autoconocimiento, modular_coaching, medir_progreso}.
--    Guardado por nombre de constraint para que la migración sea re-ejecutable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dimension_catalogo_uso_legitimo_chk'
  ) THEN
    ALTER TABLE dimension_catalogo
      ADD CONSTRAINT dimension_catalogo_uso_legitimo_chk
      CHECK (uso_legitimo <@ ARRAY['autoconocimiento','modular_coaching','medir_progreso']::text[]);
  END IF;
END $$;

-- 3) Poblar las 3 dimensiones SENSIBLES (UPDATE idempotente por id_dimension).
--    resiliencia y su instrumento fuente tps_c_f4 → los 3 usos.
UPDATE dimension_catalogo
  SET uso_legitimo = ARRAY['autoconocimiento','modular_coaching','medir_progreso']::text[]
  WHERE id_dimension IN ('resiliencia', 'tps_c_f4');

--    tps_d8 (necesidad de aprobación) → autoconocimiento + modular_coaching (sin medir_progreso).
UPDATE dimension_catalogo
  SET uso_legitimo = ARRAY['autoconocimiento','modular_coaching']::text[]
  WHERE id_dimension = 'tps_d8';

-- 4) Las dimensiones NO sensibles quedan en NULL (no aplica). No se tocan.
