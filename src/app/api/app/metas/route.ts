import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, isIdentityError } from '@/lib/identity'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * POST /api/app/metas — guarda la META de un asesor desde el simulador (lote v3-A, camino II).
 * Body: { persona_id, meta_ingresos, meta_prospectos_mes, meta_ventas_mes,
 *         meta_contactos_semana, meta_contactos_mes }. Persiste el embudo PROYECTADO
 *   meta_ingresos         ← total (ingreso bruto aprox del simulador)
 *   meta_prospectos_mes   ← totProspectos
 *   meta_ventas_mes       ← ventas (Zurich) / nPolizas (Consorcio)
 *   meta_contactos_semana ← ceil(totContactos / 4)   [alimenta el avance de productividad]
 *   meta_contactos_mes    ← totContactos             [alimenta la tarjeta 🏁 de Mi Informe]
 *
 * Validación: meta_ingresos entero > 0; los otros 4 enteros >= 0. Gate de supervisor
 * (403 si tipo='asesor'). Anti cross-tenant: el persona_id objetivo debe ser asesor activo
 * de la institucion_id del TOKEN (nunca del cliente); si no → 403. Upsert por persona_id
 * (índice único metas_persona_id_uniq). NO toca perfil_conductual ni onboarding_seen.
 *
 * Nota datos (Consorcio): las 6 filas legacy de metas (persona_id NULL, keyed por nombre) ya
 * fueron enlazadas por backfill (2026-06-13) → el upsert UPDATEa la fila y no choca con el
 * UNIQUE de metas.asesor. Demo/Imrbrasil ya tenía persona_id.
 */
export async function POST(req: NextRequest) {
  const id = await resolveIdentity(req)
  if (isIdentityError(id)) return NextResponse.json({ error: id.error }, { status: id.status })
  if (id.tipo === 'asesor') return NextResponse.json({ error: 'Solo supervisores' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const persona_id = body?.persona_id
  const meta_ingresos = body?.meta_ingresos
  const meta_prospectos_mes = body?.meta_prospectos_mes
  const meta_ventas_mes = body?.meta_ventas_mes
  const meta_contactos_semana = body?.meta_contactos_semana
  const meta_contactos_mes = body?.meta_contactos_mes

  if (!persona_id || typeof persona_id !== 'string') {
    return NextResponse.json({ error: 'persona_id requerido' }, { status: 400 })
  }
  if (!Number.isInteger(meta_ingresos) || meta_ingresos <= 0) {
    return NextResponse.json({ error: 'meta_ingresos debe ser un entero positivo' }, { status: 400 })
  }
  // El resto del embudo proyectado: enteros no negativos.
  const noNeg: Record<string, unknown> = { meta_prospectos_mes, meta_ventas_mes, meta_contactos_semana, meta_contactos_mes }
  for (const [campo, valor] of Object.entries(noNeg)) {
    if (!Number.isInteger(valor) || (valor as number) < 0) {
      return NextResponse.json({ error: `${campo} debe ser un entero >= 0` }, { status: 400 })
    }
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

  // Upsert por persona_id: los 5 campos del embudo proyectado + metadatos de fila.
  const { error } = await sb.from('metas').upsert(
    {
      persona_id,
      institucion_id: id.institucion_id,
      asesor: target.nombre,
      meta_ingresos,
      meta_prospectos_mes,
      meta_ventas_mes,
      meta_contactos_semana,
      meta_contactos_mes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'persona_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, persona_id, meta_ingresos, meta_prospectos_mes, meta_ventas_mes, meta_contactos_semana, meta_contactos_mes })
}
