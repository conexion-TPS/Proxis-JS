-- ════════════════════════════════════════════════════════════════════════
-- metas_contactos_mes — agrega la columna que falta para guardar el embudo
-- proyectado (Decisión TPS, camino II). Proyecto: proxis_dev (mkqgbmwm).
-- Pegar en el SQL Editor.
--
-- Por qué: el simulador exhibe los contactos MENSUALES (totContactos de calcEmbudo).
-- metas ya tiene meta_contactos_semana (semanal, alimenta el avance de productividad),
-- meta_prospectos_mes y meta_ventas_mes, pero NO una columna para los contactos del mes.
-- Esta columna nueva alimenta la tarjeta 🏁 de Mi Informe sin reconstrucciones aproximadas.
--
-- Mapeo al guardar (idéntico Zurich/Consorcio):
--   meta_contactos_semana ← ceil(totContactos / 4)   [ya existe]
--   meta_contactos_mes    ← totContactos             [ESTA columna, nueva]
--   meta_prospectos_mes   ← totProspectos            [ya existe]
--   meta_ventas_mes       ← ventas / nPolizas        [ya existe]
--   meta_ingresos         ← total                    [ya existe]
--
-- Verificado (solo lectura, 2026-06-14): meta_contactos_mes NO existe (PostgREST 42703);
-- las 4 columnas hermanas SÍ existen. Nullable (filas legacy quedan en NULL hasta el próximo guardado).
-- ════════════════════════════════════════════════════════════════════════

alter table metas
  add column if not exists meta_contactos_mes int;

-- (post-check) debe listar la columna nueva:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'metas' and column_name = 'meta_contactos_mes';
