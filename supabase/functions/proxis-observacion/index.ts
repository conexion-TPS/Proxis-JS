// proxis-observacion — Genera una observación enmarcada para que el SUPERVISOR
// aporte una lectura de primera mano sobre un asesor. Toma el perfil actual
// (del cuestionario TPS) y la hipótesis de menor confianza, y los convierte en
// UNA pregunta conductual/situacional con opciones que el supervisor confirma.
// Las respuestas entran como behavioral_signals(fuente='supervisor') → el
// analyzer las cruza con autoreporte + desempeño → afina la hipótesis.
// No es invocada por cron; la llama el portal de equipo bajo demanda.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { callAIJson } from '../_shared/ai-client.ts'
import { getAsesoresAutorizados, esAutorizado } from '../_shared/tenant.ts'
import { proyectarPerfilParaSupervisor, construirFiltroDimensionParaSupervisor } from '../_shared/proyeccion-segura.ts'
import { logUsoSensible, type UsoSensibleEvento } from '../_shared/log-uso-sensible.ts'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const sb = createClient(SB_URL, SB_KEY)

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  try {
    const { asesor } = await req.json().catch(() => ({}))
    if (!asesor) return json({ error: 'asesor requerido' }, 400)

    // Gate por institución (lista blanca, fail-closed). Espejo del guard de proxis-accion.
    const autz = await getAsesoresAutorizados(sb)
    if (!esAutorizado(asesor, autz)) return json({ ok: false, skipped: 'institucion_no_autorizada', asesor })

    // Freno: una observación a la vez por asesor + cooldown. Evita que el portal
    // pida lo mismo en cada expansión y se acumulen señales sin procesar.
    const COOLDOWN_DIAS = 3
    const { data: prevObs } = await sb
      .from('behavioral_signals')
      .select('created_at, procesada')
      .eq('asesor', asesor).eq('fuente', 'supervisor').eq('tipo', 'observacion_supervisor')
      .order('created_at', { ascending: false })
      .limit(1)
    const ultima = prevObs?.[0]
    if (ultima) {
      // Si la última aún no se procesó, no pedimos otra (no apilar)
      if (!ultima.procesada) return json({ ok: true, item: null, motivo: 'pendiente_sin_procesar' })
      // Si ya se procesó pero es reciente, respetar el cooldown
      const dias = (Date.now() - new Date(ultima.created_at).getTime()) / 86400_000
      if (dias < COOLDOWN_DIAS) return json({ ok: true, item: null, motivo: 'cooldown' })
    }

    // Perfil actual (sembrado por el cuestionario TPS / afinado por el analyzer)
    const { data: perfilArr } = await sb.from('asesor_perfil').select('*').eq('asesor', asesor).limit(1)
    const perfil = perfilArr?.[0] ?? null

    // Hipótesis activas, la de MENOR confianza primero (es la que más necesita evidencia).
    // Sin .limit aquí: la ventana de 5 se aplica DESPUÉS del filtro (ver abajo).
    const { data: hips } = await sb
      .from('deductions_log')
      .select('id, dimension_afectada, hipotesis, confianza, estado')
      .eq('asesor', asesor)
      .in('estado', ['pendiente', 'validada', 'editada'])
      .order('confianza', { ascending: true })

    // Etapa 3 — ruta 3: FILTRAR las dimensiones SENSIBLES (resiliencia/f4, backup/d8) PRIMERO
    // y recién DESPUÉS quedarse con las 5 de menor confianza del pool ya filtrado. Así la
    // ventana de candidatas nunca se "gasta" en hipótesis sensibles que luego se descartan
    // (no se pierde una neutra elegible que estuviera fuera de las 5 crudas).
    // Fail-closed vía dimension_catalogo (incluye alias de columna como backup_style_doc→tps_d8).
    const esElegible = await construirFiltroDimensionParaSupervisor(sb)
    const hipsElegibles = (hips ?? [])
      .filter((h) => esElegible(h.dimension_afectada))
      .slice(0, 5)

    const objetivo = hipsElegibles[0] ?? null

    // Sin perfil ni hipótesis no hay base sobre la cual preguntar
    if (!perfil && !objetivo) return json({ ok: true, item: null, motivo: 'sin_base' })

    // Etapa 3: proyectar el perfil quitando campos sensibles ANTES de volcarlo al prompt del supervisor.
    const perfilSeguro = perfil ? await proyectarPerfilParaSupervisor(sb, perfil) : null

    // Etapa 3 §5.6(b) — log de uso: la proyección lee del crudo asesor_perfil la columna
    // sensible resiliencia=f4 para eliminarla. consentimiento_estado lo resuelve el logger
    // desde tps_perfiles por asesor. d8 (backup_style_doc) ELIMINADO (Paso 2): ya no se registra.
    if (perfil && perfil.resiliencia !== null && perfil.resiliencia !== undefined) {
      const usos: UsoSensibleEvento[] = [
        { asesor, dimension: 'f4', salida: 'proyeccion_supervisor', finalidad: 'proyeccion_supervisor', actor: 'proxis-observacion' },
      ]
      await logUsoSensible(sb, usos)
    }
    const perfilTexto = perfilSeguro
      ? Object.entries(perfilSeguro)
          .filter(([k]) => !['id', 'asesor', 'created_at', 'updated_at', 'resumen_ia'].includes(k))
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n')
      : '(sin perfil previo)'

    const hipTexto = objetivo
      ? `Hipótesis a poner a prueba (dimensión: ${objetivo.dimension_afectada ?? '?'}, confianza actual: ${objetivo.confianza ?? '?'}%):\n"${objetivo.hipotesis}"`
      : '(aún no hay hipótesis formal; usa el perfil para elegir la dimensión más incierta)'

    const prompt = `Eres "Sailor Mentor". Le pides a un SUPERVISOR una observación de primera mano sobre uno de sus asesores, para AFINAR (nunca concluir) tu lectura de cómo trabaja. El supervisor lo ve a diario: es una fuente valiosa que cruzarás con el autoreporte del asesor y su desempeño. Hablas en primera persona, como mentor que pide ayuda a un colega.

## Asesor: ${asesor}

## Perfil actual (provisional)
${perfilTexto}

## ${hipTexto}

## Tu tarea
Formula UNA sola observación que el supervisor pueda reconocer de haber visto. Reglas estrictas:
- Conductual y SITUACIONAL: parte de un momento concreto del trabajo ("Cuando una venta se traba…", "Al hacer prospección en frío…", "Cuando recibe una objeción…").
- Lenguaje natural y observable. PROHIBIDO usar jerga psicológica, nombres de perfiles, letras (E/S/R/A) o términos técnicos en el texto visible.
- Español latinoamericano neutro. NO uses voseo ("vos/tenés/hacés"); usa "tú/usted" estándar.
- Da 3 opciones de comportamiento, mutuamente distintas y todas plausibles (ninguna obviamente "correcta"). Cada opción mapea internamente a un perfil Merrill-Reid: E (Energético/Driver, empuja y cierra rápido), S (Sociable/Expressive, entusiasma y conecta), R (Relacional/Amiable, paciente y cuida el vínculo), A (Reflexivo/Analytical, datos y cautela).
- NO incluyas una opción tipo "no lo he visto" (la interfaz la agrega aparte).
- Es una lectura PROVISIONAL y revisable, no un veredicto.

## Formato de salida (SOLO JSON, sin texto extra)
{
  "dimension": "${objetivo?.dimension_afectada ?? 'contexto_situacional'}",
  "stem": "la pregunta/observación situacional, una sola frase",
  "basis": "1 frase en primera persona (yo, Sailor Mentor) explicando por qué te lo pregunto (sin jerga, sin nombrar perfiles)",
  "opciones": [
    { "texto": "comportamiento observable A", "perfil_hint": "E" },
    { "texto": "comportamiento observable B", "perfil_hint": "R" },
    { "texto": "comportamiento observable C", "perfil_hint": "A" }
  ]
}`

    let item: { dimension?: string; stem?: string; basis?: string; opciones?: { texto: string; perfil_hint: string }[] } | null
    try {
      item = await callAIJson(prompt, {
        maxTokens:   2048,
        temperature: 0.5,
        componente:  'proxis-observacion',
      })
    } catch { item = null }

    if (!item?.stem || !Array.isArray(item.opciones) || item.opciones.length === 0)
      return json({ ok: true, item: null, motivo: 'sin_item' })

    return json({
      ok: true,
      item: {
        dimension:    item.dimension ?? objetivo?.dimension_afectada ?? 'contexto_situacional',
        stem:         item.stem,
        basis:        item.basis ?? null,
        opciones:     item.opciones.slice(0, 4),
        deduction_id: objetivo?.id ?? null,
      },
    })
  } catch (e) {
    // Generar una observación es NO crítico: si la IA no está disponible (p.ej. 429
    // transitorio al abrir el portal), no es un "error de runtime" — se registra como
    // warning y se devuelve "sin observación" con 200, sin ensuciar la tarjeta de errores.
    const msg = e instanceof Error ? e.message : String(e)
    try {
      await sb.from('error_log').insert({ componente: 'proxis-observacion', severidad: 'warning', mensaje: msg })
    } catch (_) { /* best-effort */ }
    return json({ ok: true, item: null, motivo: 'ia_no_disponible' })
  }
})
