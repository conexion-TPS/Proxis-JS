import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callGemini } from '@/lib/gemini'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { REGLAS_MENTOR, tonoBlock } from '@/lib/mentor'

export async function OPTIONS(req: Request) { return handleOptions(req) }

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { asesor, contenido, mensaje_id } = body
  if (!asesor || !contenido?.trim()) {
    return NextResponse.json({ error: 'asesor y contenido requeridos' }, { status: 400 })
  }

  const sb = supabaseAdmin()

  // 1. Insertar respuesta del asesor
  await sb.from('sailor_messages').insert({
    asesor,
    origen:    'asesora',
    tipo:      'asesora_reply',
    contenido: contenido.trim(),
    leido:     true,
  })

  // 2. Señal conductual desde la respuesta
  await sb.from('behavioral_signals').insert({
    asesor,
    fuente:           'sailor',
    tipo:             'respuesta_chat',
    valor:            contenido.trim().slice(0, 200),
    dimension_target: 'relacion_feedback',
    confianza_hint:   70,
    procesada:        false,
  })

  // 3. Cargar contexto del asesor para generar respuesta IA
  const [
    { data: perfil },
    { data: perfilCond },
    { data: reporte },
    { data: mensajeOriginal },
  ] = await Promise.all([
    sb.from('asesor_perfil').select('perfil_dominante, resumen_perfil').eq('asesor', asesor).maybeSingle(),
    sb.from('tps_perfiles').select('perfil_base, puntaje_a, puntaje_b').eq('asesor', asesor).maybeSingle(),
    sb.from('reportes').select('*').eq('asesor', asesor).order('semana_inicio', { ascending: false }).limit(1).maybeSingle(),
    mensaje_id
      ? sb.from('sailor_messages').select('contenido, tipo').eq('id', mensaje_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const perfilNombre = (() => {
    const base = perfilCond?.perfil_base ?? perfil?.perfil_dominante
    const map: Record<string, string> = { E: 'Energético', S: 'Sociable', R: 'Relacional', A: 'Reflexivo' }
    return base ? (map[base] ?? base) : null
  })()

  // Últimas 6 señales para contexto
  const { data: senales } = await sb
    .from('behavioral_signals')
    .select('tipo, valor, dimension_target, created_at')
    .eq('asesor', asesor)
    .order('created_at', { ascending: false })
    .limit(6)

  // 4. Construir prompt de chat
  const contextoBloque = [
    perfilNombre   ? `Perfil del asesor: ${perfilNombre}` : null,
    perfil?.resumen_perfil ? `\nPerfil conductual: ${perfil.resumen_perfil}` : null,
    reporte        ? `\nÚltimo reporte — contactos: ${(reporte.contactos || []).length}, semana: ${reporte.semana_inicio}` : null,
    senales?.length ? `\nSeñales recientes: ${senales.map((s: any) => `${s.tipo}=${s.valor}`).slice(0, 4).join(', ')}` : null,
  ].filter(Boolean).join('')

  const mensajeCoachTexto = mensajeOriginal?.contenido
    ? `\nEl asesor respondió a este mensaje tuyo:\n"${mensajeOriginal.contenido.slice(0, 400)}"\n`
    : ''

  const prompt = `${REGLAS_MENTOR}${tonoBlock()}
Respondes en una app de mensajería: breve (2-4 oraciones), conversacional, sin listas ni bullet points. No uses markdown.

${contextoBloque}
${mensajeCoachTexto}
El asesor acaba de escribirte:
"${contenido.trim()}"

Responde directo y con contenido concreto sobre lo que dijo: aporta algo útil de inmediato, sin abrir con muletillas ni validaciones genéricas. Si es relevante, cierra con UNA sola pregunta que lo ayude a avanzar.`

  let respuestaIA: string
  try {
    respuestaIA = await callGemini(prompt, { maxTokens: 400, temperature: 0.75 })
  } catch {
    respuestaIA = 'Gracias por compartirlo. Lo tengo en cuenta para tu próximo mensaje.'
  }

  // 5. Insertar respuesta del coach IA
  const { data: nuevaRespuesta } = await sb
    .from('sailor_messages')
    .insert({
      asesor,
      origen:    'coach_ia',
      tipo:      'mensaje',
      contenido: respuestaIA.trim(),
      leido:     false,
    })
    .select()
    .single()

  return NextResponse.json(
    { ok: true, respuesta: nuevaRespuesta },
    { headers: corsHeaders(req.headers.get('origin')) }
  )
}
