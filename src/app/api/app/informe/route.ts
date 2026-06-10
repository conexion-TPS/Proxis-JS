import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'
import { buildInforme } from '@/lib/informe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * GET /api/app/informe?mes=YYYY-MM
 * "Mi Informe" — lee de proxis_dev por persona_id (NO por nombre, NO Viña).
 * El cálculo vive en src/lib/informe.ts (buildInforme), compartido con /api/app/individual (T3a).
 */

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })

  const mes = new URL(req.url).searchParams.get('mes') || mesActual()
  const identidad = { nombre: id.nombre, institucion: id.institucion_nombre, via: id.via, tipo: id.tipo }
  const result = await buildInforme(supabaseAdmin(), id.persona_id, mes, identidad)
  return NextResponse.json(result)
}
