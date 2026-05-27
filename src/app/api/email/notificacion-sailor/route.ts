import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendNotificacionSailor } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { asesor, contenido } = await req.json().catch(() => ({}))
  if (!asesor || !contenido) {
    return NextResponse.json({ error: 'asesor y contenido requeridos' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const [credRes, tmplRes] = await Promise.all([
    sb.from('asesor_credentials').select('email').eq('asesor', asesor).maybeSingle(),
    sb.from('email_templates').select('asunto, cuerpo_html').eq('tipo', 'notificacion_sailor').eq('activo', true).maybeSingle(),
  ])

  if (!credRes.data?.email) {
    return NextResponse.json({ error: 'Sin email registrado para este asesor' }, { status: 404 })
  }

  const { error } = await sendNotificacionSailor({
    to:          credRes.data.email,
    asesor,
    preview:     contenido,
    asunto:      tmplRes.data?.asunto      ?? undefined,
    cuerpo_html: tmplRes.data?.cuerpo_html ?? undefined,
  })

  if (error) {
    console.error('[email/notificacion-sailor]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, to: credRes.data.email })
}
