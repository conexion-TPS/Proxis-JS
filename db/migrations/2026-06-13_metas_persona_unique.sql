-- ════════════════════════════════════════════════════════════════════════
-- metas_persona_unique — índice ÚNICO en metas(persona_id).
-- Habilita el upsert `onConflict='persona_id'` del lote de metas (POST /api/app/metas).
-- Proyecto: proxis_dev (mkqgbmwm). Pegar en el SQL Editor.
--
-- Verificado (solo lectura, 2026-06-13): 0 duplicados de persona_id en metas.
-- Las 6 filas legacy de Consorcio tienen persona_id NULL → NO violan este índice
-- (Postgres trata los NULL como distintos). NOTA: el upsert por persona_id NO
-- actualizará esas filas legacy (su persona_id es NULL); ver migración de BACKFILL
-- aparte (pendiente de aprobación de TPS) para enlazarlas por persona_id+institucion_id.
-- ════════════════════════════════════════════════════════════════════════

create unique index if not exists metas_persona_id_uniq on metas (persona_id);
