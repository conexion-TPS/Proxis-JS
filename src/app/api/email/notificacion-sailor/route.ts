import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendNotificacionSailor } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { asesor, contenido } = await req.json().catch(() => ({}))
  if (!asesor || !contenido) {
    return NextResponse.json({ error: 'asesor y contenido requeridos' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const { data: cred } = await sb
    .from('asesor_credentials')
    .select('email')
    .eq('asesor', asesor)
    .maybeSingle()

  if (!cred?.email) {
    return NextResponse.json({ error: 'Sin email registrado para este asesor' }, { status: 404 })
  }

  const { error } = await sendNotificacionSailor({
    to:      cred.email,
    asesor,
    preview: contenido,
  })

  if (error) {
    console.error('[email/notificacion-sailor]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, to: cred.email })
}
