-- ════════════════════════════════════════════════════════════════════════
-- metas_consorcio_backfill — enlaza las 6 filas legacy de metas de Consorcio
-- (persona_id NULL, keyed por nombre) a su persona_id + institucion_id.
-- Proyecto: proxis_dev (mkqgbmwm). Pegar en el SQL Editor.
--
-- Por qué: esas filas se crearon por nombre (sin persona_id/institucion_id). El lote de
-- metas escribe/lee por persona_id; sin este backfill, el upsert onConflict='persona_id'
-- intentaría INSERT y chocaría con el UNIQUE de metas.asesor. Tras el backfill, el upsert
-- UPDATEa la fila existente.
--
-- Dry-run verificado (2026-06-13, solo lectura): 6/6 match EXACTO y ÚNICO contra
-- persona (tipo='asesor') de la institución Consorcio; 0 coincidencias en otras instituciones.
-- Debe afectar EXACTAMENTE 6 filas. ORDEN: pegar ESTE backfill ANTES del índice único.
-- ════════════════════════════════════════════════════════════════════════

-- (opcional, pre-check) ver las filas objetivo antes:
--   select asesor, persona_id, institucion_id from metas where persona_id is null;

update metas m
set persona_id    = p.id,
    institucion_id = p.institucion_id
from persona p
where m.persona_id is null
  and p.institucion_id = 'c05f3883-827d-4ab8-a0b8-4dba6424fcac'  -- Consorcio (proxis_dev)
  and p.tipo = 'asesor'
  and p.nombre = m.asesor;

-- (post-check) debe devolver 0 filas (ya no quedan metas de Consorcio sin persona_id):
--   select asesor from metas
--     where persona_id is null
--       and asesor in (select nombre from persona
--                      where institucion_id = 'c05f3883-827d-4ab8-a0b8-4dba6424fcac' and tipo='asesor');
