import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase'

/*
 * Resolución de identidad consolidada — CIMIENTO de la Fase B.
 *
 * Traduce la sesión actual (el JWT que emite /api/vina/login, login real de Consorcio)
 * a la identidad del modelo consolidado en proxis_dev: { persona_id, institucion_id }.
 *
 * Reglas (acordadas en el plan de portado):
 *  - PRIMARIO: por email  (Consorcio tiene email en `persona`; índice único secundario).
 *  - FALLBACK: por nombre + institución (Zurich, hasta migrar su login a BD).
 *  - >1 coincidencia ⇒ 409 (red anti-homónimos: NO se adivina; es justo lo que el
 *    modelo persona_id vino a proteger).
 *
 * Lee SOLO de proxis_dev (service-role). No toca Viña ni el legacy.
 */

// Mismo secreto que /api/vina/login (reutilizamos su token; no reinventamos login).
const SECRET = process.env.VINA_JWT_SECRET ?? process.env.SAILOR_JWT_SECRET ?? 'proxis-vina-secret'

// Mapa tenant legacy (columna `empresa` del token) → nombre de institución en proxis_dev.
// Solo se usa en el fallback por nombre (cuando el token no trae email, p.ej. Zurich futuro).
const EMPRESA_A_INSTITUCION: Record<string, string> = { vina: 'Consorcio', zurich: 'Zurich' }

type Sesion = { asesor?: string; email?: string; empresa?: string; rol?: string }

export type Identity = {
  persona_id: string
  institucion_id: string
  institucion_nombre: string | null
  nombre: string
  tipo: string
  via: 'email' | 'nombre+institucion'
}
export type IdentityError = { error: string; status: 401 | 404 | 409 }

export function isIdentityError(x: Identity | IdentityError): x is IdentityError {
  return 'status' in x
}

type PersonaRow = { id: string; nombre: string; email: string | null; tipo: string; institucion_id: string }
type SB = ReturnType<typeof supabaseAdmin>

const norm = (s: string) => s.normalize('NFC').trim().toLowerCase()

export async function resolveIdentity(req: NextRequest): Promise<Identity | IdentityError> {
  // 1) Verificar la sesión (mismo JWT que emite /api/vina/login)
  const authz = req.headers.get('authorization') ?? ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!token) return { error: 'Falta token de sesión', status: 401 }

  let sesion: Sesion
  try { sesion = jwt.verify(token, SECRET) as Sesion }
  catch { return { error: 'Sesión inválida o expirada', status: 401 } }

  const sb = supabaseAdmin() // proxis_dev (service-role)

  // 2) PRIMARIO: por email
  if (sesion.email && sesion.email.trim()) {
    const objetivo = norm(sesion.email)
    const { data, error } = await sb
      .from('persona')
      .select('id, nombre, email, tipo, institucion_id')
      .eq('activo', true)
      .ilike('email', sesion.email.trim()) // case-insensitive; se valida exacto abajo
    if (error) return { error: `Error resolviendo identidad: ${error.message}`, status: 404 }
    const matches = (data ?? []).filter((p) => p.email && norm(p.email) === objetivo)
    const dec = decidir(matches as PersonaRow[], `email ${sesion.email}`)
    if ('status' in dec) return dec
    return finalize(sb, dec, 'email')
  }

  // 3) FALLBACK: por nombre + institución
  const nombre = sesion.asesor?.trim()
  const instNombre = sesion.empresa ? EMPRESA_A_INSTITUCION[sesion.empresa] : undefined
  if (nombre && instNombre) {
    const { data: inst } = await sb
      .from('instituciones').select('id').ilike('nombre', instNombre).limit(1).maybeSingle()
    if (!inst) return { error: `Institución '${instNombre}' no encontrada`, status: 404 }
    const objetivo = norm(nombre)
    const { data, error } = await sb
      .from('persona')
      .select('id, nombre, email, tipo, institucion_id')
      .eq('activo', true)
      .eq('institucion_id', inst.id)
      .ilike('nombre', nombre)
    if (error) return { error: `Error resolviendo identidad: ${error.message}`, status: 404 }
    const matches = (data ?? []).filter((p) => norm(p.nombre) === objetivo)
    const dec = decidir(matches as PersonaRow[], `nombre '${nombre}' @ ${instNombre}`)
    if ('status' in dec) return dec
    return finalize(sb, dec, 'nombre+institucion')
  }

  return { error: 'La sesión no trae email ni (nombre+empresa) para resolver identidad', status: 401 }
}

function decidir(matches: PersonaRow[], ctx: string): PersonaRow | IdentityError {
  if (matches.length === 0) return { error: `Persona no encontrada (${ctx})`, status: 404 }
  if (matches.length > 1)
    return { error: `Identidad ambigua: ${matches.length} personas coinciden (${ctx}). No se resuelve por seguridad.`, status: 409 }
  return matches[0]
}

async function finalize(sb: SB, p: PersonaRow, via: Identity['via']): Promise<Identity> {
  const { data: inst } = await sb.from('instituciones').select('nombre').eq('id', p.institucion_id).maybeSingle()
  return {
    persona_id: p.id,
    institucion_id: p.institucion_id,
    institucion_nombre: (inst?.nombre as string | undefined) ?? null,
    nombre: p.nombre,
    tipo: p.tipo,
    via,
  }
}
