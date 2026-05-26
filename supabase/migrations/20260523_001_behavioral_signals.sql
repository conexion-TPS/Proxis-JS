-- Fase 2.1 — Señales de comportamiento
-- Captura pasiva de comportamientos observables del asesor

CREATE TABLE IF NOT EXISTS behavioral_signals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor           text NOT NULL,
  fuente           text NOT NULL CHECK (fuente IN ('plataforma','email','sailor','cuestionario','manual')),
  tipo             text NOT NULL,          -- ej: 'reaccion_feedback','respuesta_chat','patron_reporte'
  valor            text,                   -- contenido de la señal (texto, número, emoji)
  dimension_target text,                   -- dimensión de perfil a la que apunta
  perfil_hint      text CHECK (perfil_hint IN ('E','S','R','A','I') OR perfil_hint IS NULL),
  confianza_hint   int CHECK (confianza_hint BETWEEN 0 AND 100),
  procesada        bool DEFAULT false,
  contexto         jsonb,                  -- metadatos adicionales (trigger_id, semana, etc.)
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_asesor ON behavioral_signals (asesor);
CREATE INDEX IF NOT EXISTS idx_signals_procesada ON behavioral_signals (procesada) WHERE procesada = false;
CREATE INDEX IF NOT EXISTS idx_signals_fuente ON behavioral_signals (fuente);
