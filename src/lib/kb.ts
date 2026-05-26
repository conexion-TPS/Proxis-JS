import { supabaseAdmin } from '@/lib/supabase'
import { embedText } from '@/lib/gemini'

type KBMatch = {
  id: string
  perfil: string | null
  categoria: string | null
  etapa_ciclo: string | null
  contenido: string
  regla_inferencia: string | null
  accion_correctiva: string | null
  similarity: number
}

export async function searchKB(
  query: string,
  limit = 4,
  perfil?: string | null,
): Promise<KBMatch[]> {
  const embedding = await embedText(query)
  if (!embedding.length) return []

  const { data, error } = await supabaseAdmin().rpc('match_kb_conductual', {
    query_embedding: `[${embedding.join(',')}]`,
    match_limit:     limit,
    filter_perfil:   perfil ?? null,
  })

  if (error) { console.error('[searchKB]', error.message); return [] }
  return (data as KBMatch[]) ?? []
}
