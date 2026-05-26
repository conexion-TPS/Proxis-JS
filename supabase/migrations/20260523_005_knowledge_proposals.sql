-- Fase 2.1 — Propuestas de conocimiento adquirido autónomamente por la IA
-- El motor propone; el coach valida antes de incorporar

CREATE TABLE IF NOT EXISTS knowledge_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id       uuid REFERENCES knowledge_gaps(id) ON DELETE SET NULL,
  metodo       text CHECK (metodo IN ('deduccion_interna','busqueda_externa')),
  fuente       text,                                    -- URL, doc interno, deducción propia
  contenido    text NOT NULL,
  razonamiento text,                                    -- por qué el sistema cree que cubre el gap
  confianza    int CHECK (confianza BETWEEN 0 AND 100),
  estado       text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aprobada','rechazada')),
  correccion   text,                                    -- edición del coach antes de aprobar
  reviewed_by  text,
  created_at   timestamptz DEFAULT now(),
  reviewed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_proposals_estado ON knowledge_proposals (estado);
CREATE INDEX IF NOT EXISTS idx_proposals_gap ON knowledge_proposals (gap_id);
