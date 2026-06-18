-- Fase 2.2 — Ampliar asesor_perfil con campos del sistema avanzado

ALTER TABLE asesor_perfil
  ADD COLUMN IF NOT EXISTS assertividad_score    float,        -- eje X Merrill-Reid (1-4)
  ADD COLUMN IF NOT EXISTS sociabilidad_score    float,        -- eje Y Merrill-Reid (1-4)
  ADD COLUMN IF NOT EXISTS perfil_dominante      text          -- 'E'|'S'|'R'|'A' calculado
    CHECK (perfil_dominante IN ('E','S','R','A') OR perfil_dominante IS NULL),
  ADD COLUMN IF NOT EXISTS backup_style_doc      text,         -- descripción del estilo backup
  ADD COLUMN IF NOT EXISTS cuello_botella_etapa  text          -- etapa del ciclo de 7 pasos donde se atora
    CHECK (cuello_botella_etapa IN (
      'prospeccion','pre_contacto','acercamiento','presentacion',
      'objeciones','cierre','seguimiento'
    ) OR cuello_botella_etapa IS NULL),
  ADD COLUMN IF NOT EXISTS variables_situacionales jsonb,      -- {ruido, tiempo, relacion_equipo, ...}
  ADD COLUMN IF NOT EXISTS progresion_integrador  int DEFAULT 0 -- 0-100, hacia el modo integrador
    CHECK (progresion_integrador BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS confianza_perfil       int DEFAULT 0 -- confianza global del perfil 0-100
    CHECK (confianza_perfil BETWEEN 0 AND 100);
