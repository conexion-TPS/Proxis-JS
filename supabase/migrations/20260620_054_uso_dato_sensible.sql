-- Etapa 3 §5.6(b) — Log de uso del dato sensible (f4/d8): UNA fila por cada lectura.
-- Proyecto: proxis_dev (mkqgbmwm). Idempotente.
--
-- Granularidad: una fila por (asesor, dimension, salida, actor) por cada lectura del
-- dato sensible en los consumidores confirmados por grep (proxis-monitor / -observacion /
-- -analyzer). consentimiento_estado refleja el estado de la fila ORIGEN en tps_perfiles
-- (mig 053): permite separar uso real de captura qa_interno en la auditoría.
--
-- RLS admin_only: mismo patrón que las tablas admin_only post-incidente (§5.3). El panel
--   /admin entra como rol 'authenticated' vía GoTrue con el claim app_metadata.cargo='admin';
--   la policy admin_only lee ese claim. Las edge functions escriben con service_role (bypassa
--   RLS). NO se usan REVOKE/GRANT manuales ni el patrón legacy (DISABLE RLS + GRANT anon).

CREATE TABLE IF NOT EXISTS uso_dato_sensible (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor                text        NOT NULL,
  dimension             text        NOT NULL,            -- 'f4' | 'd8'
  salida                text        NOT NULL,            -- qué consumió el dato: banda_resiliencia, frase_puerta, proyeccion_supervisor, prompt_llm_sin_filtrar…
  finalidad             text,                            -- por qué se leyó (coaching_asesor, proyeccion_supervisor, analisis_conductual…)
  actor                 text        NOT NULL,            -- endpoint/función que leyó (proxis-monitor, proxis-observacion, proxis-analyzer)
  consentimiento_estado text,                            -- estado de la fila origen en tps_perfiles: consentido | no_consentido | qa_interno | NULL (legacy/sin perfil)
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uso_dato_sensible_dimension_chk CHECK (dimension IN ('f4', 'd8'))
);

CREATE INDEX IF NOT EXISTS idx_uso_dato_sensible_asesor  ON uso_dato_sensible (asesor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uso_dato_sensible_created ON uso_dato_sensible (created_at DESC);

-- RLS admin_only (claim app_metadata.cargo='admin'; service_role bypassa RLS).
ALTER TABLE uso_dato_sensible ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_only ON uso_dato_sensible;
CREATE POLICY admin_only ON uso_dato_sensible
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'cargo') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'cargo') = 'admin');
