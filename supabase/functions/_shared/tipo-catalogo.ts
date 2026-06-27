// supabase/functions/_shared/tipo-catalogo.ts
// Fase 0 (T1 rename IP→ERRIM) — puente tolerant-read para edges Deno.
// Espejo del helper Node (src/lib/tipo-catalogo.ts); misma semántica.
//
// Cualquier valor de perfil puede llegar como LETRA (codigo_origen) o como
// id_tipo ERRIM. normalizarTipo() lo lleva a id_tipo ERRIM vía tipo_catalogo;
// nombreTipo() resuelve el nombre ERRIM. Caché en memoria por isolate con TTL
// 60 s (invalidación por tiempo; invalidarCatalogo() para tests).
//
// codigoOrigenAIdTipo() se conserva por compatibilidad con analyzer/researcher
// (que aún lo llaman con letras); ahora delega al caché (mismo resultado).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TTL_MS = 60_000

export const SENTINEL_PERFIL = new Set<string>(['', 'pendiente', 'canary', 'provisional'])

type Catalogo = {
  idTipos: Set<string>
  porCodigo: Map<string, string>
  nombres: Map<string, string>
  fetchedAt: number
}

let cache: Catalogo | null = null

const emptyCatalogo = (): Catalogo => ({
  idTipos: new Set(), porCodigo: new Map(), nombres: new Map(), fetchedAt: 0,
})

async function getCatalogo(sb: SupabaseClient): Promise<Catalogo> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache
  try {
    const { data, error } = await sb
      .from('tipo_catalogo')
      .select('id_tipo, codigo_origen, nombre_errim')
    if (error || !data) return cache ?? emptyCatalogo()
    const idTipos = new Set<string>()
    const porCodigo = new Map<string, string>()
    const nombres = new Map<string, string>()
    for (const r of data) {
      idTipos.add(r.id_tipo)
      if (r.codigo_origen) porCodigo.set(r.codigo_origen, r.id_tipo)
      if (r.nombre_errim) nombres.set(r.id_tipo, r.nombre_errim)
    }
    cache = { idTipos, porCodigo, nombres, fetchedAt: Date.now() }
    return cache
  } catch (_) {
    return cache ?? emptyCatalogo()
  }
}

// Normaliza un valor de perfil a id_tipo ERRIM.
//   null/''/sentinel → null | id_tipo conocido → sí mismo |
//   codigo_origen → id_tipo | desconocido → 'general'
export async function normalizarTipo(
  sb: SupabaseClient,
  valor: string | null | undefined,
): Promise<string | null> {
  if (!valor || SENTINEL_PERFIL.has(valor.toLowerCase())) return null
  const c = await getCatalogo(sb)
  if (c.idTipos.has(valor)) return valor
  return c.porCodigo.get(valor) ?? 'general'
}

export async function nombreTipo(
  sb: SupabaseClient,
  idTipo: string | null | undefined,
): Promise<string | null> {
  if (!idTipo) return null
  const c = await getCatalogo(sb)
  return c.nombres.get(idTipo) ?? idTipo
}

export function esPerfilComputado(valor: string | null | undefined): boolean {
  return !!valor && !SENTINEL_PERFIL.has(valor.toLowerCase())
}

export function invalidarCatalogo(): void {
  cache = null
}

// Histórico: traduce codigo_origen → id_tipo (fallback 'general').
// Conservado para analyzer/researcher; ahora cacheado.
export async function codigoOrigenAIdTipo(sb: SupabaseClient, codigo: string | null): Promise<string> {
  if (!codigo || SENTINEL_PERFIL.has(codigo.toLowerCase())) return 'general'
  const c = await getCatalogo(sb)
  return c.porCodigo.get(codigo) ?? 'general'
}
