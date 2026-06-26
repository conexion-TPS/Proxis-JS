-- F7 — Reclasificar equilibrio_adaptativo como SENSIBLE (🔒) en dimension_catalogo.
-- Propuesta para TPS (la corre TPS sobre proxis_dev mkqgbmwmvypcjzlxidsm). Idempotente.
--
-- Por qué: hasta hoy dimension_catalogo marca equilibrio_adaptativo como sensible=false, así que
--   proyectarPerfilParaSupervisor NO lo quita del perfil → su texto entra al prompt del analyzer
--   y de ahí al resumen_ia que ve el supervisor (fuga 🔒). Corrección A lo amuralla: este UPDATE
--   + el cambio en proyeccion-segura.ts (CAMPO_PERFIL) + sacarlo de las dims válidas del analyzer.
--
-- Efecto (runtime, sin redeploy por el catálogo): getSensibles() pasa a incluir
--   'equilibrio_adaptativo'; construirFiltroDimensionParaSupervisor() deja de considerarlo
--   elegible para el supervisor. El cambio de CÓDIGO en proyeccion-segura.ts SÍ requiere redeploy
--   de proxis-analyzer y proxis-observacion.
--
-- Nota: NO se toca el instrumento 'tps_c_adapt' (la captura cruda no se gatea por catálogo; el
--   gate de tps-evaluar es una lista aparte). Solo se cierra la dimensión de pipeline.

UPDATE dimension_catalogo
   SET sensible = true
 WHERE id_dimension = 'equilibrio_adaptativo'
   AND sensible IS DISTINCT FROM true;

-- Verificación (debe devolver sensible=true):
-- SELECT id_dimension, sensible FROM dimension_catalogo WHERE id_dimension = 'equilibrio_adaptativo';
