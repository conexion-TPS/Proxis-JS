// supabase/functions/_shared/tipo-catalogo.ts
// Traduce el codigo_origen histórico (letra Merrill-Reid E/S/R/A/I) al id_tipo
// ERRIM (energetico/reflexivo/relacional/magnetico/integrador) consultando la
// tabla tipo_catalogo. Query directa, sin cache. Fallback a 'general'.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function codigoOrigenAIdTipo(sb: SupabaseClient, codigo: string | null): Promise<string> {
  if (!codigo) return 'general'
  const { data } = await sb
    .from('tipo_catalogo')
    .select('id_tipo')
    .eq('codigo_origen', codigo)
    .limit(1)
  return data?.[0]?.id_tipo ?? 'general'
}
