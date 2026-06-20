// supabase/functions/_shared/interpretacion-asesor.ts
// Etapa 3 §5.4 — Capa de interpretación crudo→puerta para el ASESOR.
// El asesor NUNCA ve su dato sensible crudo (número/estrella) ni como sentencia: recibe
// una lectura interpretada, en condicional, como "puerta" entrenable. Se usa SOLO en el
// camino del asesor (proxis-monitor). En el del supervisor, proyeccion-segura ELIMINA el
// campo. Asimetría sostenida: supervisor elimina, asesor interpreta.

// Cortes de resiliencia (f4 = suma de 5 ítems escala_5, rango 5-25). Parametrizables.
// ⚠️ PROVISIONAL — Categoría B, NO validado. Recalibrar con datos reales.
const BANDAS_RESILIENCIA: Record<'bajo' | 'medio' | 'alto', [number, number]> = {
  bajo:  [5, 11],
  medio: [12, 18],
  alto:  [19, 25],
}

export function bandaResiliencia(suma: number): 'bajo' | 'medio' | 'alto' {
  if (suma <= BANDAS_RESILIENCIA.bajo[1])  return 'bajo'
  if (suma <= BANDAS_RESILIENCIA.medio[1]) return 'medio'
  return 'alto'
}

// Frases-puerta EXACTAS aprobadas por TPS. En condicional, sin número, sin sentencia.
const PUERTA_RESILIENCIA: Record<'bajo' | 'medio' | 'alto', string> = {
  bajo:  "Es posible que el rechazo te pese más de lo que quisieras, y que después de un 'no' te cueste recuperar el impulso. Si es así, vale decir que es de las cosas más comunes en este oficio —le pasa a la mayoría en algún momento— y, sobre todo, es de las más entrenables. Hay formas concretas de aprender a sostenerte mejor en esos momentos, y se pueden trabajar paso a paso.",
  medio: "Pareciera que tu forma de sostenerte ante el rechazo es irregular: habría días en que un 'no' te resbala y otros en que te cuesta más remontar. Es un punto intermedio muy frecuente, y la buena noticia es que desde aquí se gana consistencia con relativa facilidad —se trata de afianzar lo que ya haces bien en tus mejores días para que esté disponible también en los difíciles.",
  alto:  "Da la impresión de que sostener el ánimo ante el rechazo podría ser uno de tus recursos: pareciera que un 'no' no te frena demasiado y que retomas con cierta soltura. Si te reconoces ahí, conviene cuidarlo y seguir cultivándolo —ninguna fortaleza se mantiene sola, y vale la pena seguir alimentándola para que te acompañe en las rachas más exigentes.",
}

const PUERTA_D8 =
  "Es posible que, bajo presión, te importe bastante la aprobación de los demás, y que te cueste sostener tu posición cuando sientes que podrías desagradar. Si te suena, es algo muy humano y nada fijo: se puede trabajar para que tu seguridad dependa un poco menos de la reacción del otro, sin perder lo que te hace cercano y atento a la gente."

// Recibe el row de tps_perfiles. Devuelve texto interpretado (puerta) listo para
// anteponer al prompt del asesor. NUNCA incluye número crudo, estrellas ni sentencia.
// deseabilidad_social NO se interpreta (es validez del test; no va al asesor como dato).
export function interpretarSensibleParaAsesor(tpsRow: Record<string, unknown> | null): string {
  if (!tpsRow) return ''
  const partes: string[] = []

  const rasgos = tpsRow.rasgos_comerciales as Record<string, unknown> | null | undefined
  const f4 = rasgos && typeof rasgos === 'object' ? Number((rasgos as Record<string, unknown>).f4) : NaN
  if (!Number.isNaN(f4)) {
    partes.push(PUERTA_RESILIENCIA[bandaResiliencia(f4)])
  }

  if (tpsRow.backup_style_activo === true) {
    partes.push(PUERTA_D8)
  }

  if (partes.length === 0) return ''
  // Marca de guía para el LLM: ya está en lenguaje de puerta; no agregar números ni diagnóstico.
  return '[LECTURA INTERPRETADA PARA EL ASESOR — ya en lenguaje de puerta entrenable; NO agregues números, estrellas ni etiquetas]\n' + partes.join('\n\n')
}
