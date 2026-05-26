-- Fase 3.1: RAG — pgvector + embedding column + similarity search function

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_base_conductual
  ADD COLUMN IF NOT EXISTS embedding    vector(768),
  ADD COLUMN IF NOT EXISTS embedded_at  timestamptz;

-- HNSW index (no minimum-row requirement unlike ivfflat)
CREATE INDEX IF NOT EXISTS idx_kb_conductual_embedding
  ON knowledge_base_conductual USING hnsw (embedding vector_cosine_ops);

-- RPC function called from Next.js for similarity search
CREATE OR REPLACE FUNCTION match_kb_conductual(
  query_embedding  vector(768),
  match_limit      int     DEFAULT 4,
  filter_perfil    text    DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  perfil            text,
  categoria         text,
  etapa_ciclo       text,
  contenido         text,
  regla_inferencia  text,
  accion_correctiva text,
  similarity        float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, perfil, categoria, etapa_ciclo, contenido,
    regla_inferencia, accion_correctiva,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_base_conductual
  WHERE embedding IS NOT NULL
    AND (filter_perfil IS NULL OR perfil = filter_perfil OR perfil IS NULL)
  ORDER BY embedding <=> query_embedding
  LIMIT match_limit;
$$;
