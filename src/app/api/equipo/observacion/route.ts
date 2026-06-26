import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'
import { asesorEnSubarbol } from '@/lib/equipoSubarbol'

// Mapea la frecuencia declarada por el supervisor a un nivel de confianza (0-100)
const FREQ_CONFIANZA: Record<string, number> = { una_vez: 30, a_veces: 60, casi_siempre: 85 }

// GET — pide a la edge function una observación enmarcada para `asesor`
export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const asesor = req.nextUrl.searchParams.get('asesor')
  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  // Etapa 3 — autorización horizontal: el asesor debe estar en el subárbol del token.
  const sbAuth = supabaseAdmin()
  if (!await asesorEnSubarbol(sbAuth, session, asesor))
    return NextResponse.json({ error: 'No autorizado para este asesor' }, { status: 403 })

  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/proxis-observacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ asesor }),
    })
    const j = await r.json().catch(() => ({}))
    const item = j.item ?? null
    // I3 — no volver a sugerir una lectura que el supervisor ya descartó ("No lo he visto").
    if (item?.deduction_id) {
      const { count } = await sbAuth.from('behavioral_signals')
        .select('id', { count: 'exact', head: true })
        .eq('asesor', asesor).eq('tipo', 'lectura_descartada').eq('valor', item.deduction_id)
      if ((count ?? 0) > 0) return NextResponse.json({ item: null })
    }
    return NextResponse.json({ item })
  } catch {
    return NextResponse.json({ item: null })
  }
}

// POST — guarda la lectura del supervisor como señal conductual (fuente='supervisor')
export async function POST(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { asesor, dimension, opcion_texto, perfil_hint, frecuencia, deduction_id, stem, descartar } =
    await req.json().catch(() => ({}))
  if (!asesor)
    return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  // Etapa 3 — autorización horizontal: el asesor debe estar en el subárbol del token.
  if (!await asesorEnSubarbol(sb, session, asesor))
    return NextResponse.json({ error: 'No autorizado para este asesor' }, { status: 403 })

  // I3 — "No lo he visto": persiste el descarte de la lectura sugerida (deduction_id) como
  // señal conductual. Así no se vuelve a preguntar (lo filtra el GET) y el motor lo ve.
  if (descartar) {
    if (!deduction_id) return NextResponse.json({ ok: true, skipped: 'sin deduction_id' })
    const { error } = await sb.from('behavioral_signals').insert({
      asesor,
      fuente:           'supervisor',
      tipo:             'lectura_descartada',
      valor:            deduction_id,
      dimension_target: dimension ?? null,
      procesada:        false,
      contexto:         { deduction_id, stem: stem ?? null, supervisor: session.nombre },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, descartada: true })
  }

  if (!opcion_texto)
    return NextResponse.json({ error: 'opcion_texto requerido' }, { status: 400 })

  const hint = ['E', 'S', 'R', 'A', 'I'].includes(perfil_hint) ? perfil_hint : null

  const { error } = await sb.from('behavioral_signals').insert({
    asesor,
    fuente:           'supervisor',
    tipo:             'observacion_supervisor',
    valor:            opcion_texto,
    dimension_target: dimension ?? null,
    perfil_hint:      hint,
    confianza_hint:   FREQ_CONFIANZA[frecuencia] ?? 60,
    procesada:        false,
    contexto:         { deduction_id: deduction_id ?? null, stem: stem ?? null, supervisor: session.nombre, frecuencia: frecuencia ?? null },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
