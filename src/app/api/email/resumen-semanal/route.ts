import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendResumenSemanal } from '@/lib/resend'
import { normalizarTipo, nombreTipo } from '@/lib/tipo-catalogo'

// Emoji decorativo por tipo ERRIM (no es nomenclatura: el nombre viene de tipo_catalogo).
const EMOJI_TIPO: Record<string, string> = {
  energetico: '🦅', magnetico: '🦚', relacional: '🕊️', reflexivo: '🦉', ambiguo: '🔄',
}

export async function POST(req: NextRequest) {
  // Acepta { asesor } para envío individual, o sin body para envío masivo
  const body = await req.json().catch(() => ({}))
  const sb = supabaseAdmin()

  const desde7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const semana  = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' })
    .formatRange(new Date(desde7d), new Date())

  const [{ data: creds }, { data: tmpl }] = await Promise.all([
    sb.from('asesor_credentials').select('asesor, email').eq('activo', true),
    sb.from('email_templates').select('asunto, cuerpo_html').eq('tipo', 'resumen_semanal').eq('activo', true).maybeSingle(),
  ])

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

    // Label del perfil vía tipo_catalogo (corrige S→"Magnético"); emoji por tipo ERRIM.
    const tipoPerfil = await normalizarTipo(sb, perfil?.perfil_base)
    const nombrePerfil = tipoPerfil ? await nombreTipo(sb, tipoPerfil) : null
    const etiquetaPerfil = nombrePerfil && tipoPerfil
      ? `${EMOJI_TIPO[tipoPerfil] ?? ''} ${nombrePerfil}`.trim()
      : null

    const { error } = await sendResumenSemanal({
      to:          cred.email,
      asesor:      cred.asesor,
      semana,
      mensajes:    (msgs as any)?.length ?? 0,
      senales:     (senales as any)?.length ?? 0,
      perfil:      etiquetaPerfil,
      asunto:      tmpl?.asunto      ?? undefined,
      cuerpo_html: tmpl?.cuerpo_html ?? undefined,
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
