-- Fase 2.1 — Vacíos de conocimiento detectados por el motor IA

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       text,                          -- 'ciclo_7pasos'|'sales_dna'|'perfil_conductual'|etc.
  descripcion     text NOT NULL,
  perfil_afectado text CHECK (perfil_afectado IN ('E','S','R','A','I','General') OR perfil_afectado IS NULL),
  asesor_afectado text,                          -- NULL = gap general, no específico de un asesor
  prioridad       int DEFAULT 3 CHECK (prioridad BETWEEN 1 AND 5),
  estado          text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_investigacion','cubierto')),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gaps_estado ON knowledge_gaps (estado);
CREATE INDEX IF NOT EXISTS idx_gaps_prioridad ON knowledge_gaps (prioridad DESC);
