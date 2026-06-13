import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * POST /api/app/metas — guarda la META DE INGRESO de un asesor (lote plomería de metas v1).
 * Body: { persona_id, meta_ingresos }. SOLO se persiste meta_ingresos (la tarjeta
 * contactos/prospectos se calcula del embudo — v3; NO se guarda aquí).
 *
 * Gate de supervisor (403 si tipo='asesor'). Anti cross-tenant: el persona_id objetivo
 * debe ser asesor activo de la institucion_id del TOKEN (nunca del cliente); si no → 403.
 * Upsert por persona_id (índice único metas_persona_id_uniq). NO toca meta_contactos_semana
 * / meta_prospectos_mes / meta_ventas_mes ni perfil_conductual.
 *
 * ⚠️ DEPENDENCIA DE DATOS (Consorcio): las filas legacy de metas con persona_id NULL (asesores
 * de Consorcio, keyed por nombre) NO se enlazan por persona_id → el upsert intentaría INSERT y
 * chocaría con el UNIQUE de metas.asesor. Requiere BACKFILL previo (set persona_id+institucion_id
 * en esas filas) — pendiente de aprobación de TPS. Demo/Imrbrasil ya tiene persona_id → upsert OK.
 */
export async function POST(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })
  if (id.tipo === 'asesor') return NextResponse.json({ error: 'Solo supervisores' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const persona_id = body?.persona_id
  const meta_ingresos = body?.meta_ingresos
  if (!persona_id || typeof persona_id !== 'string') {
    return NextResponse.json({ error: 'persona_id requerido' }, { status: 400 })
  }
  if (!Number.isInteger(meta_ingresos) || meta_ingresos <= 0) {
    return NextResponse.json({ error: 'meta_ingresos debe ser un entero positivo' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  // Anti cross-tenant: el asesor objetivo debe pertenecer al roster (institución del token).
  const { data: target } = await sb
    .from('persona')
    .select('id, nombre')
    .eq('id', persona_id)
    .eq('institucion_id', id.institucion_id)
    .eq('tipo', 'asesor')
    .eq('activo', true)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'Asesor fuera de tu institución' }, { status: 403 })

  // Upsert por persona_id (set solo meta_ingresos + metadatos de fila; nunca las otras metas).
  const { error } = await sb.from('metas').upsert(
    {
      persona_id,
      institucion_id: id.institucion_id,
      asesor: target.nombre,
      meta_ingresos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'persona_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, persona_id, meta_ingresos })
}
