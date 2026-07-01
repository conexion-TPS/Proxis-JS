import { supabaseAdmin } from '@/lib/supabase'
import { sendLegalEmail } from '@/lib/resend'

type Modulo = 'A' | 'B' | 'C' | 'D'
const MODULOS: Modulo[] = ['A', 'B', 'C', 'D']

function moduloDe(dim: string | null | undefined): Modulo | null {
  if (dim === 'tps_a') return 'A'
  if (dim === 'tps_b') return 'B'
  if (dim === 'tps_d') return 'D'
  if (dim && dim.startsWith('tps_c_')) return 'C'
  return null
}

function nivelObjetivo(dias: number): number {
  if (dias >= 16) return 4
  if (dias >= 12) return 3
  if (dias >= 8)  return 2
  if (dias >= 4)  return 1
  return 0
}

const SUBJECTS_ASESOR = [
  '',
  'Recuerda completar tu evaluación TPS',
  'Tu evaluación TPS sigue pendiente',
  'Importante: tu evaluación TPS aún no está completa',
  'Urgente: completa tu evaluación TPS',
]

const INTROS_ASESOR = [
  '',
  'Te recordamos que tienes una evaluación conductual TPS pendiente en Proxis.',
  'Aún tienes una evaluación TPS pendiente. Tu perfil conductual no puede calcularse hasta que la completes.',
  'Han pasado varios días y tu evaluación TPS sigue sin completarse. Tu supervisor ha sido informado.',
  'Tu evaluación TPS lleva mucho tiempo pendiente. Te pedimos que la completes a la brevedad.',
]

function buildEmailAsesor(asesor: string, nivel: number): { subject: string; bodyHtml: string } {
  const primerNombre = asesor.split(' ')[0]
  return {
    subject: SUBJECTS_ASESOR[nivel],
    bodyHtml: `<p>Hola ${primerNombre},</p>
<p>${INTROS_ASESOR[nivel]}</p>
<p>La evaluación toma entre 12 y 18 minutos y consta de 4 módulos: Iniciativa, Relacional, Rasgos Comerciales y Juicio Situacional.</p>
<p style="margin:24px 0">
  <a href="https://sailor-front-ten.vercel.app/cuestionario-nuevo"
     style="background:#cbf135;color:#0b0a09;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:800">
    Ir a mi evaluación →
  </a>
</p>
<p style="color:#8a8885;font-size:12px">Si ya la completaste en las últimas horas, ignora este mensaje.</p>`,
  }
}

function buildEmailSupervisor(asesor: string, nivel: number): { subject: string; bodyHtml: string } {
  return {
    subject: `Tu asesor ${asesor} tiene la evaluación TPS pendiente`,
    bodyHtml: `<p>Hola,</p>
<p>Tu asesor <strong>${asesor}</strong> aún no ha completado la evaluación conductual TPS en Proxis (aviso nivel ${nivel} de 4).</p>
<p>Sin la evaluación completa no es posible calcular su perfil conductual ni personalizar su plan de desarrollo.</p>
<p style="color:#8a8885;font-size:12px">Este es un aviso automático. No es necesario responder a este correo.</p>`,
  }
}

export async function procesarRecordatorios(): Promise<{
  procesados: number
  enviados: { asesor: string; nivel: number }[]
  sin_supervisor: string[]
}> {
  const sb = supabaseAdmin()

  // Totales por módulo del instrumento activo — se computa UNA vez para todo el batch
  const totales: Record<Modulo, number> = { A: 0, B: 0, C: 0, D: 0 }
  const { data: cues } = await sb.from('cuestionarios').select('id')
    .eq('nombre', 'Instrumento TPS v1.0').eq('activo', true).maybeSingle()
  if (cues?.id) {
    const { data: preguntas } = await sb.from('preguntas')
      .select('dimension_target').eq('cuestionario_id', cues.id)
    for (const p of preguntas ?? []) {
      const m = moduloDe(p.dimension_target)
      if (m) totales[m]++
    }
  }

  // Asesores activos con términos aceptados (candidatos a recordatorio)
  const { data: creds } = await sb.from('asesor_credentials')
    .select('asesor, email, terminos_aceptados_at')
    .eq('activo', true)
    .not('terminos_aceptados_at', 'is', null)

  if (!creds?.length) return { procesados: 0, enviados: [], sin_supervisor: [] }

  const lista = creds.map(c => c.asesor)

  // Progreso y estado de notificación — queries en lote, no por asesor
  const [{ data: todoProgreso }, { data: notifs }] = await Promise.all([
    sb.from('progreso_cuestionario').select('asesor, modulo').in('asesor', lista),
    sb.from('notif_cuestionario').select('asesor, recordatorio_nivel').in('asesor', lista),
  ])

  // Índices en memoria
  const progresoMap = new Map<string, Record<Modulo, number>>()
  for (const r of todoProgreso ?? []) {
    const m = r.modulo as Modulo
    if (!MODULOS.includes(m)) continue
    if (!progresoMap.has(r.asesor)) progresoMap.set(r.asesor, { A: 0, B: 0, C: 0, D: 0 })
    progresoMap.get(r.asesor)![m]++
  }
  const notifMap = new Map((notifs ?? []).map(n => [n.asesor, n.recordatorio_nivel ?? 0]))

  const enviados: { asesor: string; nivel: number }[] = []
  const sin_supervisor: string[] = []
  const now = new Date().toISOString()

  for (const cred of creds) {
    if (!cred.email || !cred.terminos_aceptados_at) continue

    // Saltar si todos los módulos están completos
    const resp = progresoMap.get(cred.asesor) ?? { A: 0, B: 0, C: 0, D: 0 }
    const todosCompletos = MODULOS.every(m => totales[m] > 0 && resp[m] >= totales[m])
    if (todosCompletos) continue

    const dias = Math.floor((Date.now() - new Date(cred.terminos_aceptados_at).getTime()) / 86_400_000)
    const objetivo = nivelObjetivo(dias)
    if (objetivo === 0) continue  // menos de 4 días: no enviar todavía

    const enviado = notifMap.get(cred.asesor) ?? 0
    if (objetivo <= enviado) continue  // ya está al nivel o superior

    const nuevoNivel = enviado + 1  // avanza UN escalón por corrida

    // Email al asesor
    const { subject, bodyHtml } = buildEmailAsesor(cred.asesor, nuevoNivel)
    await sendLegalEmail({ to: cred.email, subject, bodyHtml }).catch(() => {})

    // Email espejo al supervisor (2 pasos: metas.supervisor → org_usuarios.email)
    let supervisorResuelto = false
    try {
      const { data: meta } = await sb.from('metas')
        .select('supervisor').eq('asesor', cred.asesor).maybeSingle()
      if (meta?.supervisor) {
        const { data: supUser } = await sb.from('org_usuarios')
          .select('email').eq('nombre', meta.supervisor).maybeSingle()
        if (supUser?.email) {
          const { subject: sSubj, bodyHtml: sBody } = buildEmailSupervisor(cred.asesor, nuevoNivel)
          await sendLegalEmail({ to: supUser.email as string, subject: sSubj, bodyHtml: sBody }).catch(() => {})
          supervisorResuelto = true
        }
      }
    } catch { /* best-effort: si falla la resolución del supervisor, continúa */ }

    if (!supervisorResuelto) sin_supervisor.push(cred.asesor)

    // Escribir SOLO en notif_cuestionario (única tabla de escritura de esta capa)
    await sb.from('notif_cuestionario').upsert({
      asesor:                cred.asesor,
      recordatorio_nivel:    nuevoNivel,
      recordatorio_last_at:  now,
      updated_at:            now,
    }, { onConflict: 'asesor' })

    enviados.push({ asesor: cred.asesor, nivel: nuevoNivel })
  }

  return { procesados: creds.length, enviados, sin_supervisor }
}
