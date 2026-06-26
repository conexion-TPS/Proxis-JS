import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyEquipoToken } from '../auth/route'
import { asesorEnSubarbol } from '@/lib/equipoSubarbol'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// I2 / AD-5 — Informe del supervisor, secciones 3-6 (LECTURA PURA, sin IA nueva).
// service_role + JWT de equipo + asesorEnSubarbol (cadena de mando: el supervisor solo
// ve asesores de su subárbol). NO se exponen dimensiones confidenciales (resiliencia=f4,
// equilibrio_adaptativo): no son visibles para el supervisor. Todo es recomendación del
// sistema (no auto-atribución) y narrativa/recomendación (nunca el cálculo — Coca-Cola).

// Triggers que son alerta interna al admin: no se muestran como "acompañamiento".
const SOLO_ADMIN = new Set(['hipotesis_acumuladas', 'sin_mensajes_recientes'])

// UI-15 — saneo de redacción: referirse por NOMBRE DE PILA, sin "el asesor [Nombre]"
// ni masculino por defecto (hay asesoras mujeres). No reescribe pronombres él/ella (eso
// se controla en los prompts de generación), pero sí elimina el sustantivo "el/la asesor(a)".
function sanitizar(texto: string | null | undefined, nombre: string): string | null {
  if (!texto) return texto ?? null
  const pila = nombre.split(' ')[0] || nombre
  return texto
    .replace(/\b(?:[Ee]l|[Ll]a)\s+asesor(?:a)?\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+)/g, '$1') // "El asesor Bart" → "Bart" (nombre con mayúscula inicial)
    .replace(/\bdel\s+asesor(?:a)?\b/gi, `de ${pila}`)
    .replace(/\bal\s+asesor(?:a)?\b/gi, `a ${pila}`)
    .replace(/\b(?:el|la)\s+asesor(?:a)?\b/gi, pila)                              // "el asesor" suelto → nombre
    .replace(/[ \t]{2,}/g, ' ')
}

function inicioMesActualISO(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00Z`
}

export async function GET(req: NextRequest) {
  const session = verifyEquipoToken(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const asesor = req.nextUrl.searchParams.get('asesor')
  if (!asesor) return NextResponse.json({ error: 'asesor requerido' }, { status: 400 })

  const sb = supabaseAdmin()
  if (!await asesorEnSubarbol(sb, session, asesor))
    return NextResponse.json({ error: 'No autorizado para este asesor' }, { status: 403 })

  const [perfilRes, hipRes, msgRes] = await Promise.all([
    // Solo dimensiones NO confidenciales + narrativas ya generadas.
    sb.from('asesor_perfil')
      .select('perfil_dominante, resumen_ia, nivel_riesgo, nivel_riesgo_nota, relato_evolucion, identidad_vendedora, relacion_prospeccion, modelos_mentales, contexto_situacional, relacion_feedback')
      .eq('asesor', asesor).maybeSingle(),
    // Plan del mes: SOLO hipótesis APROBADAS (validada/editada). Las pendientes no se
    // muestran al supervisor hasta aprobarse (UI-15 #7).
    sb.from('deductions_log')
      .select('hipotesis, accion_descripcion, accion_tipo, dimension_afectada, estado, created_at')
      .eq('asesor', asesor).in('estado', ['validada', 'editada'])
      .order('created_at', { ascending: false }).limit(6),
    // Acompañamiento: mensajes del MES EN CURSO (no histórico completo) (UI-15 #8).
    sb.from('message_log')
      .select('trigger_id, body, created_at')
      .eq('asesor', asesor).gte('created_at', inicioMesActualISO())
      .order('created_at', { ascending: false }).limit(8),
  ])

  const p = perfilRes.data ?? null
  const hip = (hipRes.data ?? []).filter(h => (h.accion_descripcion ?? h.hipotesis))
  const msgs = (msgRes.data ?? []).filter(m => !SOLO_ADMIN.has(m.trigger_id ?? '')).slice(0, 4)

  return NextResponse.json({
    // Sección 3 — cruce perfil × desempeño (las narrativas; el cuadrante/tendencia los
    // tiene ya el front en la sección 2).
    seccion3: p ? {
      perfil_dominante:     p.perfil_dominante ?? null,
      identidad_vendedora:  sanitizar(p.identidad_vendedora, asesor),
      relacion_prospeccion: sanitizar(p.relacion_prospeccion, asesor),
      modelos_mentales:     sanitizar(p.modelos_mentales, asesor),
      contexto_situacional: sanitizar(p.contexto_situacional, asesor),
    } : null,
    // Sección 4 — diagnóstico (ya generado por el sistema de análisis).
    seccion4: p ? {
      resumen_ia:        sanitizar(p.resumen_ia, asesor),
      nivel_riesgo:      p.nivel_riesgo ?? null,
      nivel_riesgo_nota: sanitizar(p.nivel_riesgo_nota, asesor),
      relacion_feedback: sanitizar(p.relacion_feedback, asesor),
    } : null,
    // Sección 5 — plan de acción (acciones recomendadas por el sistema).
    seccion5: hip.map(h => ({
      accion:    sanitizar(h.accion_descripcion ?? h.hipotesis, asesor),
      dimension: h.dimension_afectada ?? null,
      estado:    h.estado ?? null,
      fecha:     h.created_at,
    })),
    // Sección 6 — acompañamiento de Sailor (mensajes recientes + arco de evolución).
    seccion6: {
      relato_evolucion: sanitizar(p?.relato_evolucion, asesor),
      mensajes: msgs.map(m => ({ trigger_id: m.trigger_id, cuerpo: sanitizar(m.body, asesor), fecha: m.created_at })),
    },
  })
}
