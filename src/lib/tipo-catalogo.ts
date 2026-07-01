// src/lib/tipo-catalogo.ts
// Fase 0 (T1 rename IP→ERRIM) — puente tolerant-read para rutas Next.
// Cualquier valor de perfil puede llegar como LETRA (codigo_origen histórico
// E/S/R/A/I/AMB), como id_tipo ERRIM (energetico/reflexivo/relacional/magnetico/
// ambiguo) o como sentinel (pendiente/canary/provisional). normalizarTipo() lo
// lleva a id_tipo ERRIM consultando tipo_catalogo; nombreTipo() resuelve el
// nombre ERRIM. Así un lector tolera ambas formas durante la migración
// expand–contract y deja de hand-codear el mapa letra→nombre (bug S→"Sociable").
//
// Caché: 1 snapshot de tipo_catalogo por instancia cálida, TTL 60 s. Si TPS da
// de alta un tipo, en ≤60 s cada instancia refresca (no hay caché viciado
// permanente). invalidarCatalogo() para tests. Serverless: cold start pierde la
// caché y re-fetcha (aceptable; el catálogo cambia rara vez).

import type { SupabaseClient } from '@supabase/supabase-js'

const TTL_MS = 60_000

// Valores que NO son un perfil computado (placeholders de siembra / provisional).
// Comparación case-insensitive (la BD guarda 'pendiente'; defensa ante 'Pendiente').
export const SENTINEL_PERFIL = new Set(['', 'pendiente', 'canary', 'provisional'])

// Mapa síncrono id_tipo→nombre_errim para contextos sin async (client components, etc.).
// Fuente de verdad de nombres vigentes; coincide con tipo_catalogo en BD.
export const NOMBRE_TIPO_SYNC: Record<string, string> = {
  energetico:  'Energético',
  magnetico:   'Magnético',
  relacional:  'Relacional',
  reflexivo:   'Reflexivo',
  ambiguo:     'Equilibrio Adaptativo',
  integrador:  'Integrador',
}

type Catalogo = {
  idTipos: Set<string>                  // {energetico, reflexivo, relacional, magnetico, integrador, ambiguo}
  porCodigo: Map<string, string>        // codigo_origen → id_tipo (E→energetico, S→magnetico, …)
  nombres: Map<string, string>          // id_tipo → nombre_errim
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
    if (error || !data) return cache ?? emptyCatalogo() // degrada a lo último conocido o vacío; nunca lanza
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
//   null/''/sentinel → null (no hay perfil que etiquetar)
//   id_tipo conocido  → sí mismo
//   codigo_origen     → id_tipo mapeado
//   desconocido       → 'general' (fallback histórico)
export async function normalizarTipo(
  sb: SupabaseClient,
  valor: string | null | undefined,
): Promise<string | null> {
  if (!valor || SENTINEL_PERFIL.has(valor.toLowerCase())) return null
  const c = await getCatalogo(sb)
  if (c.idTipos.has(valor)) return valor
  return c.porCodigo.get(valor) ?? 'general'
}

// id_tipo → nombre_errim (catálogo). Desconocido → passthrough del id.
export async function nombreTipo(
  sb: SupabaseClient,
  idTipo: string | null | undefined,
): Promise<string | null> {
  if (!idTipo) return null
  const c = await getCatalogo(sb)
  return c.nombres.get(idTipo) ?? idTipo
}

// ¿Es un perfil computado (no sentinel/null)? Tolerante a letra o id_tipo:
// sólo excluye sentinels y null. Para checks de "completado" sin asumir la forma.
export function esPerfilComputado(valor: string | null | undefined): boolean {
  return !!valor && !SENTINEL_PERFIL.has(valor.toLowerCase())
}

// Para tests / forzar refresco fuera del TTL.
export function invalidarCatalogo(): void {
  cache = null
}
