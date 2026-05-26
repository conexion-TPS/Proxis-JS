-- Fase 2.1 — Sistema de cuestionarios y captura psicométrica

CREATE TABLE IF NOT EXISTS cuestionarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  tipo        text CHECK (tipo IN ('psicometrico','micro','contextual','onboarding','programado')),
  descripcion text,
  activo      bool DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preguntas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id  uuid REFERENCES cuestionarios(id) ON DELETE CASCADE,
  orden            int NOT NULL DEFAULT 0,
  texto            text NOT NULL,
  tipo_respuesta   text CHECK (tipo_respuesta IN ('escala_4','abierta','alternativas','si_no')),
  opciones         jsonb,           -- para tipo='alternativas': [{texto, perfil_hint, score_assert, score_social}]
  dimension_target text,            -- dimensión de asesor_perfil que mide
  perfil_hint      text CHECK (perfil_hint IN ('E','S','R','A','I') OR perfil_hint IS NULL),
  peso             float DEFAULT 1, -- peso relativo de esta pregunta en el score final
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS respuestas_cuestionario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor          text NOT NULL,
  cuestionario_id uuid REFERENCES cuestionarios(id),
  pregunta_id     uuid REFERENCES preguntas(id),
  respuesta       text,            -- valor crudo de la respuesta
  score_valor     float,           -- valor numérico calculado
  contexto        text,            -- contexto situacional en que se capturó
  fuente          text DEFAULT 'plataforma',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_cuestionario ON preguntas (cuestionario_id, orden);
CREATE INDEX IF NOT EXISTS idx_respuestas_asesor ON respuestas_cuestionario (asesor);
CREATE INDEX IF NOT EXISTS idx_respuestas_cuestionario ON respuestas_cuestionario (cuestionario_id);
