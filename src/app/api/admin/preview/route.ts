import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callGemini } from '@/lib/gemini'
import { searchKB } from '@/lib/kb'

function getMesActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function compileTemplate(tpl: string, ctx: Record<string, unknown>): string {
  const perfil = ctx.perfil_conductual && typeof ctx.perfil_conductual === 'object'
    ? Object.entries(ctx.perfil_conductual as Record<string, number>)
        .sort((a, b) => b[1] - a[1])[0][0]
    : 'S'
  return tpl
    .replace(/\{\{nombre\}\}/g,            String(ctx.nombre            ?? ''))
    .replace(/\{\{perfil\}\}/g,            perfil)
    .replace(/\{\{zPuntos\}\}/g,           String(ctx.z_proyectados     ?? ''))
    .replace(/\{\{meta\}\}/g,              String(ctx.meta_prospectos_mes ?? ''))
    .replace(/\{\{metaContactos\}\}/g,     String(ctx.meta_contactos_semana ?? ''))
    .replace(/\{\{semanasSinReporte\}\}/g, String(ctx.semanas_sin_reporte ?? ''))
    .replace(/\{\{pcPromedio\}\}/g,        String(ctx.pc_promedio       ?? ''))
    .replace(/\{\{ingresoMes\}\}/g,        String(ctx.ingreso_mes_actual ?? ''))
    .replace(/\{\{nodosActivos\}\}/g,      String(ctx.nodos_activos     ?? ''))
    .replace(/\{\{persistencia\}\}/g,      String(ctx.persistencia_actual ?? ''))
    .replace(/\{\{mes\}\}/g,              String(ctx.mes_actual        ?? ''))
}

async function buildContext(asesor: string) {
  const mes = getMesActual()
  const [y, m] = mes.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`

  const [metaRes, reportesRes, ingresoRes, perfilRes] = await Promise.all([
    supabaseAdmin().from('metas').select('*').eq('asesor', asesor),
    supabaseAdmin().from('reportes').select('*')
      .eq('asesor', asesor)
      .gte('semana_inicio', `${mes}-01`)
      .lt('semana_inicio', `${next}-01`)
      .order('semana_inicio', { ascending: false }),
    supabaseAdmin().from('ingresos').select('*').eq('asesor', asesor).eq('mes', mes),
    supabaseAdmin().from('asesor_perfil').select('resumen_ia').eq('asesor', asesor).limit(1),
  ])

  const meta     = metaRes.data?.[0]     ?? {}
  const reportes = (reportesRes.data     ?? []).slice(0, 4)
  const ingreso  = ingresoRes.data?.[0]  ?? {}

  const metaSem = (meta as Record<string,unknown>).meta_contactos_semana as number ?? 3
  let semanas = reportes.length ? 0 : 4
  if (reportes.length) {
    const hoy = new Date(); const dow = hoy.getDay()
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1))
    const ultimo = new Date((reportes[0] as Record<string,unknown>).semana_inicio as string)
    semanas = Math.max(0, Math.floor((lunes.getTime() - ultimo.getTime()) / (7 * 86400_000)))
  }

  return {
    nombre:                  asesor,
    meta_contactos_semana:   metaSem,
    meta_prospectos_mes:     (meta as Record<string,unknown>).meta_prospectos_mes  ?? 15,
    meta_ingresos:           (meta as Record<string,unknown>).meta_ingresos        ?? 2000000,
    perfil_conductual:       (meta as Record<string,unknown>).perfil_conductual    ?? null,
    semanas_sin_reporte:     semanas,
    nodos_activos:           0,
    ingreso_mes_actual:      (ingreso as Record<string,unknown>).ingreso_real      ?? 0,
    mes_actual:              mes,
    pc_promedio:             0,
    z_proyectados:           0,
    persistencia_actual:     0,
    perfil_resumen:          perfilRes.data?.[0]?.resumen_ia ?? null,
  }
}

export async function POST(req: NextRequest) {
  try {
    // dryRun=true → sólo compilar variables, sin llamar a Gemini
    const { asesor, triggerId, bodyOverride, dryRun } = await req.json()
    if (!asesor || !triggerId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

    let promptBody = bodyOverride as string | undefined
    if (!promptBody) {
      const { data } = await supabaseAdmin().from('prompts')
        .select('body').eq('trigger_id', triggerId).eq('activo', true).limit(1)
      promptBody = data?.[0]?.body
      if (!promptBody) return NextResponse.json({ error: 'No hay prompt activo para este trigger' }, { status: 404 })
    }

    const ctx       = await buildContext(asesor)
    const compilado = compileTemplate(promptBody, ctx)

    // Modo compilar: devuelve el prompt con variables rellenas, sin Gemini
    if (dryRun) {
      return NextResponse.json({ compiled: compilado, ctx })
    }

    // Modo generar: RAG + Gemini
    const perfil = ctx.perfil_conductual && typeof ctx.perfil_conductual === 'object'
      ? Object.entries(ctx.perfil_conductual as Record<string, number>).sort((a, b) => b[1] - a[1])[0]?.[0]
      : null
    const kbMatches = await searchKB(compilado, 4, perfil).catch(() => [])

    const kbBlock = kbMatches.length
      ? '[CONOCIMIENTO RELEVANTE]\n' +
        kbMatches
          .filter(m => m.similarity > 0.5)
          .map(m => {
            const parts = [m.contenido]
            if (m.regla_inferencia)  parts.push(`Regla: ${m.regla_inferencia}`)
            if (m.accion_correctiva) parts.push(`Acción: ${m.accion_correctiva}`)
            return parts.join('\n')
          })
          .join('\n---\n') + '\n\n'
      : ''

    const perfilBlock = ctx.perfil_resumen ? `[PERFIL DEL ASESOR]\n${ctx.perfil_resumen}\n\n` : ''
    const message = await callGemini(perfilBlock + kbBlock + compilado)

    return NextResponse.json({ message, kbChunks: kbMatches.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
