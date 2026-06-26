-- F6 — Análisis de resiliencia (f4), canal CERRADO solo-Admin.
-- Propuesta para TPS (la corre TPS sobre proxis_dev mkqgbmwmvypcjzlxidsm). Idempotente.
--
-- Por qué una tabla aparte y NO una columna en asesor_perfil:
--   proxis-analyzer hace `select('*')` sobre asesor_perfil y proyectarPerfilParaSupervisor
--   solo elimina columnas del mapa fijo CAMPO_PERFIL. Una columna nueva se colaría al prompt
--   del analyzer (y de ahí a hipótesis visibles al supervisor) salvo editar la edge function.
--   Una tabla separada que el analyzer/informe NUNCA leen mantiene el canal cerrado sin deploy.
--
-- Acceso: SOLO el route server-side /api/admin/resiliencia (service_role, gated cargo=admin).
--   RLS habilitada SIN políticas permisivas → anon/authenticated quedan denegados; service_role
--   (la usa el route) bypassa RLS. Nadie más lee esta tabla.

CREATE TABLE IF NOT EXISTS public.asesor_resiliencia (
  asesor         text PRIMARY KEY,
  analisis       text,                       -- texto IA cualitativo (canal cerrado)
  score_snapshot text,                       -- "suma/base/n_items" usado como insumo (trazabilidad)
  generado_por   text,                       -- actor/origen de la generación
  generado_at    timestamptz NOT NULL DEFAULT now()
);

-- Fail-closed: RLS encendida sin policies = solo service_role accede.
ALTER TABLE public.asesor_resiliencia ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.asesor_resiliencia IS
  'F6 — análisis IA de resiliencia (f4) 🔒. Canal cerrado solo-Admin. NUNCA visible al supervisor: no entra a asesor_perfil.resumen_ia, ni al select de equipo/informe, ni al prompt del analyzer.';
