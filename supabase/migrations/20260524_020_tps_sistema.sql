-- TPS Sistema: tablas base + tps_perfiles
-- Aplicar en: Supabase SQL Editor
-- Idempotente: usa IF NOT EXISTS en todo

-- =============================================
-- 1. TABLAS BASE (sistema de cuestionarios)
-- =============================================

CREATE TABLE IF NOT EXISTS cuestionarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  tipo        text,
  descripcion text,
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preguntas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id  uuid NOT NULL REFERENCES cuestionarios(id) ON DELETE CASCADE,
  orden            integer NOT NULL DEFAULT 1,
  texto            text NOT NULL,
  tipo_respuesta   text,   -- escala_4 | escala_5 | alternativas | si_no | abierta
  dimension_target text,
  perfil_hint      text,
  opciones         jsonb,  -- polos semánticos, opciones SJT, flag negativo C
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS respuestas_cuestionario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor           text NOT NULL,
  cuestionario_id  uuid,
  pregunta_id      uuid,
  respuesta        text,
  contexto         jsonb,
  created_at       timestamptz DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS preguntas_cuestionario_idx ON preguntas(cuestionario_id);
CREATE INDEX IF NOT EXISTS respuestas_asesor_idx ON respuestas_cuestionario(asesor);

-- =============================================
-- 2. TABLA DE PERFILES TPS COMPLETOS
-- =============================================

CREATE TABLE IF NOT EXISTS tps_perfiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor                   text NOT NULL,
  version_instrumento      text NOT NULL DEFAULT '1.0',
  perfil_base              text NOT NULL,         -- E | S | R | A | AMB
  confianza_diagnostico    text NOT NULL,         -- Alta | Media | Baja
  puntaje_a                numeric(4,2) NOT NULL, -- eje Iniciativa (1.0–4.0)
  puntaje_b                numeric(4,2) NOT NULL, -- eje Calidez (1.0–4.0)
  rasgos_comerciales       jsonb NOT NULL DEFAULT '{}', -- {f1..f5} scores 5–25
  backup_style_activo      boolean DEFAULT false,
  deseabilidad_social      boolean DEFAULT false,
  etapa_bloqueo_cronica    text,
  notas_coaching           jsonb DEFAULT '[]',
  historial_alertas        jsonb DEFAULT '[]',
  historial_intervenciones jsonb DEFAULT '[]',
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  version_perfil           integer DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS tps_perfiles_asesor_idx ON tps_perfiles(asesor);

-- =============================================
-- 3. RLS Y PERMISOS (anon puede leer/responder)
-- =============================================

ALTER TABLE cuestionarios        DISABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas            DISABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_cuestionario DISABLE ROW LEVEL SECURITY;
ALTER TABLE tps_perfiles         DISABLE ROW LEVEL SECURITY;

GRANT SELECT          ON cuestionarios           TO anon;
GRANT SELECT          ON preguntas               TO anon;
GRANT SELECT, INSERT  ON respuestas_cuestionario TO anon;
GRANT SELECT, INSERT, UPDATE ON tps_perfiles     TO anon;
