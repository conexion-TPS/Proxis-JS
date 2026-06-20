// proxis-informes — Edge Function
// Cron sugerido: 0 12 * * 1  (lunes 12:00 UTC = 09:00 Chile UTC-3, tras proxis-monitor)
// Genera un informe semanal por nodo y lo envía a cada gerente/supervisor con
// roll-up jerárquico: cada destinatario ve su nodo + todos los nodos descendientes.
//
// Métricas de la semana en curso (lunes→domingo): asesores activos/total,
// mensajes del coach enviados (desglose por trigger), feedback +/- y asesores en riesgo.
//
// Invocación con { "dry_run": true } devuelve los informes compuestos SIN enviar email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_KEY') ?? ''

const sb = createClient(SB_URL, SB_KEY)

/* ── Cargos que reciben informe (cada uno ve su subárbol) ───── */
const CARGOS_INFORME = ['supervisor', 'gerente_zonal', 'gerente_regional', 'admin']
const CARGO_LABEL: Record<string, string> = {
  supervisor:       'Supervisor',
  gerente_zonal:    'Gerente Zonal',
  gerente_regional: 'Gerente Regional',
  admin:            'Administrador',
}
const TRIGGER_LABEL: Record<string, string> = {
  'semana-sin-reporte-alerta':    'Recordatorio de reporte',
  'bajo-meta-miercoles':          'Aliento a media semana',
  'paralisis-sostenida':          'Acompañamiento en racha difícil',
  'meta-superada':                'Felicitación por la meta',
  'primer-lunes-mes':             'Arranque de mes',
  'riesgo_elevado':               'Señal de alerta al líder',
  'perfil-incompleto-24h':        'Recordatorio de evaluación',
  'perfil-incompleto-48h':        'Evaluación pendiente (al líder)',
  'hipotesis-accion':             'Sugerencia para el asesor',
  'hipotesis-escalar-supervisor': 'Algo para tu mano',
}
// Triggers que son alerta interna al ADMIN — no se cuentan en el informe del gerente.
const SOLO_ADMIN_INFORME = new Set(['hipotesis_acumuladas', 'sin_mensajes_recientes'])

/* ── Fechas: lunes de la semana en curso (UTC-3) ───────────── */
function rangoSemana(): { lunesStr: string; desdeISO: string; hastaISO: string } {
  // "Hoy" en horario Chile (UTC-3)
  const ahora = new Date(Date.now() - 3 * 3600_000)
  const dow   = ahora.getUTCDay()
  const lunes = new Date(ahora)
  lunes.setUTCDate(ahora.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  lunes.setUTCHours(0, 0, 0, 0)
  const finSemana = new Date(lunes)
  finSemana.setUTCDate(lunes.getUTCDate() + 7)
  // Reconvertir a instantes UTC reales (sumar las 3h que restamos)
  const desde = new Date(lunes.getTime() + 3 * 3600_000)
  const hasta = new Date(finSemana.getTime() + 3 * 3600_000)
  return {
    lunesStr: lunes.toISOString().split('T')[0],
    desdeISO: desde.toISOString(),
    hastaISO: hasta.toISOString(),
  }
}

/* ── Subárbol: ids del nodo + todos sus descendientes ──────── */
function subarbol(nodoId: string, hijosPorPadre: Map<string, string[]>): Set<string> {
  const out = new Set<string>([nodoId])
  const cola = [nodoId]
  while (cola.length) {
    const actual = cola.shift()!
    for (const hijo of hijosPorPadre.get(actual) ?? []) {
      if (!out.has(hijo)) { out.add(hijo); cola.push(hijo) }
    }
  }
  return out
}

/* ── Email vía Resend ──────────────────────────────────────── */
async function sendEmail(to: string, asunto: string, cuerpo: string, remitente: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `${remitente} <proxis@theprecisionselling.com>`,
      to,
      subject: asunto,
      text:    cuerpo,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(`Resend: ${err.message || res.status}`)
  }
}

/* ── Handler ───────────────────────────────────────────────── */
Deno.serve(async (req: Request) => {
  try {
    const body    = await req.json().catch(() => ({}))
    const dryRun  = body?.dry_run === true
    const { lunesStr, desdeISO, hastaISO } = rangoSemana()

    // Remitente configurable
    const { data: configArr } = await sb.from('config').select('value').eq('key', 'remitente').limit(1)
    const remitente = configArr?.[0]?.value || 'Sailor Mentor (Proxis)'

    // Datos base
    const [nodosRes, asesoresRes, gerentesRes, perfilesRes, reportesRes, msgsRes, tpsRes] = await Promise.all([
      sb.from('org_nodos').select('id, nombre, parent_id'),
      sb.from('asesor_credentials').select('asesor, org_nodo_id, activo').eq('activo', true),
      sb.from('org_usuarios').select('nombre, email, cargo, org_nodo_id').eq('activo', true).in('cargo', CARGOS_INFORME),
      sb.from('asesor_perfil').select('asesor, nivel_riesgo'),
      sb.from('reportes').select('asesor, semana_inicio').eq('semana_inicio', lunesStr),
      sb.from('message_log').select('id, asesor, trigger_id').gte('created_at', desdeISO).lt('created_at', hastaISO),
      sb.from('tps_perfiles').select('asesor, perfil_base'),
    ])

    const nodos     = nodosRes.data    ?? []
    const asesores  = asesoresRes.data  ?? []
    const gerentes  = gerentesRes.data  ?? []
    const perfiles  = perfilesRes.data  ?? []
    const reportes  = reportesRes.data  ?? []
    const mensajes  = msgsRes.data      ?? []
    // Asesores con perfil TPS completado (perfil_base ya calculado)
    const tpsCompletoSet = new Set((tpsRes.data ?? []).filter((t: { perfil_base: string | null }) => t.perfil_base).map((t: { asesor: string }) => t.asesor))

    // Feedback de la semana, ligado al asesor vía message_log
    const msgIds = mensajes.map((m: { id: string }) => m.id)
    let feedbacks: { message_id: string; score: number }[] = []
    if (msgIds.length) {
      const { data: fb } = await sb.from('feedback').select('message_id, score').in('message_id', msgIds)
      feedbacks = fb ?? []
    }
    const msgAsesorById = new Map(mensajes.map((m: { id: string; asesor: string }) => [m.id, m.asesor]))

    // Índices
    const hijosPorPadre = new Map<string, string[]>()
    for (const n of nodos) {
      if (!n.parent_id) continue
      const arr = hijosPorPadre.get(n.parent_id) ?? []
      arr.push(n.id); hijosPorPadre.set(n.parent_id, arr)
    }
    const nombreNodo  = new Map(nodos.map((n: { id: string; nombre: string }) => [n.id, n.nombre]))
    const riesgoPorAsesor = new Map(perfiles.map((p: { asesor: string; nivel_riesgo: string | null }) => [p.asesor, p.nivel_riesgo]))
    const activosSet  = new Set(reportes.map((r: { asesor: string }) => r.asesor))

    // Etapa 3 — partición directo/agregado para nivel_riesgo: el NOMBRE del asesor en
    // riesgo va SOLO a su supervisor DIRECTO; hacia arriba (gerencias) va un conteo anónimo.
    // "Directo" = el destinatario sentado en el nodo del asesor. Si ese nodo no tiene
    // ningún destinatario, se sube por ancestros hasta el primer nodo que sí tenga uno
    // (matiz 1: un asesor sin supervisor inmediato no queda invisible). incompletosTps NO
    // se toca (matiz 2: "no completó el test" es operativo, no psicometría).
    const nodosConDestinatario = new Set(
      gerentes.filter((u: { org_nodo_id: string | null }) => u.org_nodo_id)
              .map((u: { org_nodo_id: string }) => u.org_nodo_id),
    )
    const parentPorNodo = new Map(nodos.map((n: { id: string; parent_id: string | null }) => [n.id, n.parent_id]))
    function nodoDirecto(nodoId: string | null): string | null {
      let cur = nodoId
      const visto = new Set<string>()
      while (cur && !visto.has(cur)) {
        if (nodosConDestinatario.has(cur)) return cur
        visto.add(cur)
        cur = parentPorNodo.get(cur) ?? null
      }
      return null
    }
    const directoNodePorAsesor = new Map(
      asesores.map((a: { asesor: string; org_nodo_id: string }) => [a.asesor, nodoDirecto(a.org_nodo_id)]),
    )

    const informes: { destinatario: string; email: string; asunto: string; cuerpo: string }[] = []

    for (const g of gerentes) {
      if (!g.email || !g.org_nodo_id) continue
      const idsSubarbol = subarbol(g.org_nodo_id, hijosPorPadre)
      const misAsesores = asesores.filter((a: { org_nodo_id: string }) => idsSubarbol.has(a.org_nodo_id))
      if (!misAsesores.length) continue  // nada que reportar

      const nombresAsesores = new Set(misAsesores.map((a: { asesor: string }) => a.asesor))
      const totalAsesores   = misAsesores.length
      const activos         = misAsesores.filter((a: { asesor: string }) => activosSet.has(a.asesor)).length

      // Mensajes de mis asesores esta semana (excluyendo las alertas internas al admin)
      const misMsgs = mensajes.filter((m: { asesor: string; trigger_id: string }) =>
        nombresAsesores.has(m.asesor) && !SOLO_ADMIN_INFORME.has(m.trigger_id))
      const porTrigger: Record<string, number> = {}
      for (const m of misMsgs) porTrigger[m.trigger_id] = (porTrigger[m.trigger_id] ?? 0) + 1

      // Feedback de mis asesores
      let pos = 0, neg = 0
      for (const f of feedbacks) {
        const asesorMsg = msgAsesorById.get(f.message_id)
        if (asesorMsg && nombresAsesores.has(asesorMsg)) {
          if (f.score > 0) pos++; else if (f.score < 0) neg++
        }
      }

      // En riesgo — NOMBRE solo de los asesores cuyo supervisor directo es este destinatario
      const directosDeG = misAsesores.filter(
        (a: { asesor: string }) => directoNodePorAsesor.get(a.asesor) === g.org_nodo_id,
      )
      const enRiesgo = directosDeG
        .filter((a: { asesor: string }) => ['en_riesgo', 'critico'].includes(riesgoPorAsesor.get(a.asesor) ?? ''))
        .map((a: { asesor: string }) => `${a.asesor}${riesgoPorAsesor.get(a.asesor) === 'critico' ? ' (urgente)' : ''}`)
      // Agregado ANÓNIMO hacia arriba: en riesgo del subárbol cuyo directo es otro (nivel inferior)
      const enRiesgoIndirecto = misAsesores.filter(
        (a: { asesor: string }) =>
          directoNodePorAsesor.get(a.asesor) !== g.org_nodo_id &&
          ['en_riesgo', 'critico'].includes(riesgoPorAsesor.get(a.asesor) ?? ''),
      ).length

      // Sin perfil TPS / participación inconsistente (no han completado la evaluación)
      const incompletosTps = misAsesores
        .filter((a: { asesor: string }) => !tpsCompletoSet.has(a.asesor))
        .map((a: { asesor: string }) => a.asesor)

      // Desglose por nodo del subárbol (solo nodos con asesores)
      const lineasNodo: string[] = []
      for (const nid of idsSubarbol) {
        const enNodo = misAsesores.filter((a: { org_nodo_id: string }) => a.org_nodo_id === nid)
        if (!enNodo.length) continue
        const act = enNodo.filter((a: { asesor: string }) => activosSet.has(a.asesor)).length
        const msgsNodo = mensajes.filter((m: { asesor: string }) =>
          enNodo.some((a: { asesor: string }) => a.asesor === m.asesor)).length
        lineasNodo.push(`  · ${nombreNodo.get(nid) ?? nid}: ${act}/${enNodo.length} activos, ${msgsNodo} mensajes`)
      }

      const triggerLines = Object.entries(porTrigger).length
        ? Object.entries(porTrigger).map(([t, n]) => `   - ${TRIGGER_LABEL[t] ?? t}: ${n}`).join('\n')
        : '   (sin mensajes esta semana)'

      const cargoTxt = CARGO_LABEL[g.cargo] ?? g.cargo
      // Riesgo: nombres para directos; conteo anónimo para los de niveles inferiores.
      const lineaRiesgo = enRiesgo.length
        ? `⚠️ Necesitan tu atención (${enRiesgo.length}): ${enRiesgo.join(', ')}`
        : '✅ Nadie de tu equipo directo pidiendo atención especial'
      const lineaRiesgoAgregado = enRiesgoIndirecto
        ? `\n📊 En equipos a cargo: ${enRiesgoIndirecto} en seguimiento por su supervisor directo`
        : ''
      const cuerpo =
`Hola ${g.nombre?.split(' ')[0] ?? g.nombre},

Te dejo el pulso de tu equipo esta semana (del ${lunesStr}).
Tu mirada: ${cargoTxt} · ${nombreNodo.get(g.org_nodo_id) ?? ''} y equipos a cargo

👥 Asesores: ${activos}/${totalAsesores} activos esta semana
✉️ Acompañamientos de Sailor Mentor: ${misMsgs.length}
${triggerLines}
👍 Valoraciones: ${pos} positivas · ${neg} negativas
${lineaRiesgo}${lineaRiesgoAgregado}
${incompletosTps.length ? `📋 Perfil TPS sin completar (${incompletosTps.length}/${totalAsesores}): ${incompletosTps.join(', ')}` : '✅ Todos con perfil TPS completo'}

Detalle por equipo:
${lineasNodo.join('\n')}

———
— Sailor Mentor
Confidencial, solo para ti como ${cargoTxt}.`

      const asunto = `Sailor Mentor · el pulso de tu equipo (semana del ${lunesStr})`
      informes.push({ destinatario: g.nombre, email: g.email, asunto, cuerpo })
    }

    // Envío (o dry-run)
    const resultados: { destinatario: string; email: string; status: string; error?: string }[] = []
    for (const inf of informes) {
      if (dryRun || !RESEND_KEY) {
        resultados.push({ destinatario: inf.destinatario, email: inf.email, status: dryRun ? 'dry_run' : 'sin_resend' })
        continue
      }
      try {
        await sendEmail(inf.email, inf.asunto, inf.cuerpo, remitente)
        resultados.push({ destinatario: inf.destinatario, email: inf.email, status: 'sent' })
      } catch (e) {
        resultados.push({ destinatario: inf.destinatario, email: inf.email, status: 'error', error: (e as Error).message })
      }
    }

    return new Response(JSON.stringify({
      ok: true, semana: lunesStr, dry_run: dryRun,
      total_informes: informes.length, resultados,
      // En dry-run, devolver los cuerpos para previsualizar
      ...(dryRun ? { preview: informes } : {}),
    }, null, 2), { headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error('[proxis-informes] FATAL:', e)
    await sb.from('error_log').insert({
      componente: 'proxis-informes', severidad: 'error',
      mensaje: (e as Error)?.message ?? String(e),
      detalles: { stack: (e as Error)?.stack ?? '', timestamp: new Date().toISOString() },
    }).then(undefined, () => {})
    return new Response(JSON.stringify({ ok: false, error: (e as Error)?.message ?? 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
