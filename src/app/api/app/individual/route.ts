import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'
import { buildInforme } from '@/lib/informe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * GET /api/app/individual?persona_id=&mes=YYYY-MM
 * Tracker supervisor — "Desempeño individual": el informe de un asesor del equipo.
 * Gate de supervisor (403 si tipo='asesor'). Seguridad: el persona_id objetivo debe
 * pertenecer a la institución del supervisor (no puede ver asesores de otra institución).
 * Reutiliza buildInforme (mismo cálculo que /api/app/informe). Devuelve { roster, informe }.
 */

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })
  // Gate de supervisor (calco del legacy: vista de equipo solo para mando). persona.tipo: 'asesor' | 'mando'.
  if (id.tipo === 'asesor') return NextResponse.json({ error: 'Solo supervisores' }, { status: 403 })

  const sb = supabaseAdmin()

  // Roster = asesores de la institución del supervisor (NO Viña; modelo persona/proxis_dev).
  const { data: rosterRows } = await sb
    .from('persona')
    .select('id, nombre')
    .eq('institucion_id', id.institucion_id)
    .eq('tipo', 'asesor')
    .eq('activo', true)
    .order('nombre', { ascending: true })
  const roster = (rosterRows ?? []).map((r) => ({ persona_id: r.id as string, nombre: r.nombre as string }))

  const url = new URL(req.url)
  const mes = url.searchParams.get('mes') || mesActual()
  const pid = url.searchParams.get('persona_id') || roster[0]?.persona_id

  if (!pid) return NextResponse.json({ roster, informe: null })

  // Seguridad: el asesor objetivo debe estar en el roster (= misma institución + tipo asesor).
  const target = roster.find((r) => r.persona_id === pid)
  if (!target) return NextResponse.json({ error: 'Asesor fuera de tu institución' }, { status: 403 })

  const identidad = { nombre: target.nombre, institucion: id.institucion_nombre, via: 'individual', tipo: 'asesor' }
  const informe = await buildInforme(sb, pid, mes, identidad)
  return NextResponse.json({ roster, informe })
}
