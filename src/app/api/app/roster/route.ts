import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * GET /api/app/roster — lista liviana de asesores del equipo del supervisor.
 * Devuelve { roster: [{ persona_id, nombre }] } de persona.tipo='asesor' activos de la
 * institucion_id del TOKEN (resolveIdentity), NUNCA de un parámetro del cliente.
 * Gate de supervisor (403 si tipo='asesor'). Sirve para poblar los dropdowns de asesor
 * del simulador (Zurich y Consorcio) con persona_id — fuente del guardado de metas.
 * Mismo patrón que el roster de /api/app/individual.
 */
export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })
  if (id.tipo === 'asesor') return NextResponse.json({ error: 'Solo supervisores' }, { status: 403 })

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('persona')
    .select('id, nombre')
    .eq('institucion_id', id.institucion_id)
    .eq('tipo', 'asesor')
    .eq('activo', true)
    .order('nombre', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const roster = (data ?? []).map((r) => ({ persona_id: r.id as string, nombre: r.nombre as string }))
  return NextResponse.json({ roster })
}
