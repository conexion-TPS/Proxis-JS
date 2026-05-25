import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendResumenSemanal } from '@/lib/resend'

export async function POST(req: NextRequest) {
  // Acepta { asesor } para envío individual, o sin body para envío masivo
  const body = await req.json().catch(() => ({}))
  const sb = supabaseAdmin()

  const desde7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const semana  = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' })
    .formatRange(new Date(desde7d), new Date())

  const { data: creds } = await sb
    .from('asesor_credentials')
    .select('asesor, email')
    .eq('activo', true)

  const asesores = body.asesor
    ? (creds ?? []).filter(c => c.asesor === body.asesor)
    : (creds ?? [])

  const resultados: any[] = []

  for (const cred of asesores) {
    if (!cred.email) { resultados.push({ asesor: cred.asesor, status: 'sin_email' }); continue }

    const [{ data: msgs }, { data: senales }, { data: perfil }] = await Promise.all([
      sb.from('sailor_messages')
        .select('id', { count: 'exact', head: true })
        .eq('asesor', cred.asesor)
        .eq('origen', 'coach_ia')
        .gte('created_at', desde7d),
      sb.from('behavioral_signals')
        .select('id', { count: 'exact', head: true })
        .eq('asesor', cred.asesor)
        .gte('created_at', desde7d),
      sb.from('tps_perfiles')
        .select('perfil_base')
        .eq('asesor', cred.asesor)
        .maybeSingle(),
    ])

    const PERFIL_NOMBRE: Record<string, string> = {
      E: '🦅 Energético', S: '🦚 Sociable', R: '🕊️ Relacional', A: '🦉 Reflexivo', AMB: '🔄 Ambivertido',
    }

    const { error } = await sendResumenSemanal({
      to:       cred.email,
      asesor:   cred.asesor,
      semana,
      mensajes: (msgs as any)?.length ?? 0,
      senales:  (senales as any)?.length ?? 0,
      perfil:   perfil?.perfil_base ? PERFIL_NOMBRE[perfil.perfil_base] : null,
    })

    resultados.push({
      asesor: cred.asesor,
      status: error ? 'error' : 'sent',
      to:     cred.email,
      ...(error ? { error: String(error) } : {}),
    })
  }

  return NextResponse.json({ ok: true, total: resultados.length, resultados })
}
