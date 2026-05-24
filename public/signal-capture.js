/* signal-capture.js — Captura atmosférica de señales conductuales
   Cargado DESPUÉS de plataforma-core.js. Monkey-patches funciones clave.
   Filosofía: captura inmanente, no mecánica. Probabilista, no invasiva.
*/

;(function () {
  'use strict'

  /* ── Probabilidades de captura por evento ─────────────────── */
  const PROB = {
    login:         0.10,
    reporte_submit: 0.30,
    outlier_metrica: 0.70,
    ver_resultados:  0.20,
    ingreso_cargado: 0.25,
  }

  /* ── decidirCaptura — inmanencia ───────────────────────────── */
  function decidirCaptura(evento) {
    const p = PROB[evento] ?? 0.15
    return Math.random() < p
  }

  /* ── captureSignal — envía al endpoint ────────────────────── */
  async function captureSignal(payload) {
    try {
      await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      // captura silenciosa — nunca interrumpe al asesor
      console.debug('[signal-capture] silenced error:', e)
    }
  }

  /* ── Extraer métricas del contexto actual ──────────────────── */
  function getContextMetrics() {
    try {
      const G = window.G || {}
      const asesor = G.usuario || null
      if (!asesor) return null

      // Leer variables disponibles del contexto de la plataforma
      const ctx = window._lastCtx || null
      return {
        asesor,
        semanas_sin_reporte:  ctx?.semanas_sin_reporte ?? null,
        pc_promedio:          ctx?.pc_promedio ?? null,
        persistencia_actual:  ctx?.persistencia_actual ?? null,
        z_proyectados:        ctx?.z_proyectados ?? null,
        nodos_activos:        ctx?.nodos_activos ?? null,
        ingreso_mes_actual:   ctx?.ingreso_mes_actual ?? null,
      }
    } catch { return null }
  }

  /* ── Infererir hints de perfil desde comportamiento ──────── */
  function inferirPerfilHint(tipo, datos) {
    // Heurísticas rápidas basadas en el comportamiento observado
    if (tipo === 'reporte_enviado') {
      const contactos = datos?.contactos_count ?? 0
      const prospectos = datos?.prospectos_count ?? 0
      if (contactos >= 5 && prospectos >= 3) return { hint: 'E', conf: 55 }
      if (prospectos === 0 && contactos >= 3) return { hint: 'R', conf: 45 }
    }
    if (tipo === 'login_frecuente') return { hint: 'S', conf: 35 }
    if (tipo === 'ingreso_manual_alto') return { hint: 'E', conf: 50 }
    return { hint: null, conf: null }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* HOOK 1: doLogin — captura señal de acceso                  */
  /* ─────────────────────────────────────────────────────────── */
  const _origDoLogin = window.doLogin
  if (typeof _origDoLogin === 'function') {
    window.doLogin = async function () {
      await _origDoLogin.apply(this, arguments)
      // Captura asíncrona post-login
      setTimeout(async () => {
        const G = window.G || {}
        if (!G.usuario) return

        // Dispatch login event para CuestionarioPlayer
        document.dispatchEvent(new CustomEvent('proxis:login', { detail: { asesor: G.usuario } }))

        if (!decidirCaptura('login')) return
        await captureSignal({
          asesor: G.usuario,
          fuente: 'plataforma',
          tipo:   'acceso_sistema',
          valor:  new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          dimension_target: 'contexto_situacional',
        })
      }, 1000)
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* HOOK 2: guardarBorrador — captura señal de reporte enviado */
  /* ─────────────────────────────────────────────────────────── */
  const _origGuardar = window.guardarBorrador
  if (typeof _origGuardar === 'function') {
    window.guardarBorrador = async function (rid) {
      // Leer datos del form ANTES de ejecutar (pueden cambiar tras submit)
      let contactosCount = 0
      let prospectosCount = 0
      try {
        const filas = document.querySelectorAll('#reporte-form .fila-contacto, .tracker-row')
        contactosCount = filas.length
        filas.forEach(f => {
          const inp = f.querySelector('input[name="prospectos"], .inp-prospectos')
          if (inp) prospectosCount += parseInt(inp.value || '0')
        })
      } catch { /* no-op */ }

      await _origGuardar.apply(this, [rid])

      // Captura post-submit
      setTimeout(async () => {
        const G = window.G || {}
        if (!G.usuario) return
        if (!decidirCaptura('reporte_submit')) return

        const { hint, conf } = inferirPerfilHint('reporte_enviado', {
          contactos_count: contactosCount,
          prospectos_count: prospectosCount,
        })

        await captureSignal({
          asesor:           G.usuario,
          fuente:           'plataforma',
          tipo:             'reporte_semanal_enviado',
          valor:            `contactos=${contactosCount} prospectos=${prospectosCount}`,
          dimension_target: 'relacion_prospeccion',
          perfil_hint:      hint,
          confianza_hint:   conf,
        })

        // Detectar outliers conductuales
        if (prospectosCount === 0 && contactosCount >= 2) {
          if (decidirCaptura('outlier_metrica')) {
            await captureSignal({
              asesor:           G.usuario,
              fuente:           'plataforma',
              tipo:             'patron_contactos_sin_prospectos',
              valor:            `contactos=${contactosCount} semanas_consecutivas=?`,
              dimension_target: 'modelos_mentales',
              perfil_hint:      'R',
              confianza_hint:   40,
            })
          }
        }

        if (contactosCount >= 6) {
          if (decidirCaptura('outlier_metrica')) {
            await captureSignal({
              asesor:           G.usuario,
              fuente:           'plataforma',
              tipo:             'volumen_contactos_alto',
              valor:            String(contactosCount),
              dimension_target: 'identidad_vendedora',
              perfil_hint:      'E',
              confianza_hint:   60,
            })
          }
        }
      }, 2000)
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* HOOK 3: guardarIngreso — captura señal de ingreso registrado */
  /* ─────────────────────────────────────────────────────────── */
  const _origIngreso = window.guardarIngreso
  if (typeof _origIngreso === 'function') {
    window.guardarIngreso = async function (asesor) {
      await _origIngreso.apply(this, [asesor])
      setTimeout(async () => {
        if (!decidirCaptura('ingreso_cargado')) return
        const inp = document.getElementById(`ing-${asesor}`)
        const val = parseInt(inp?.value || '0')
        if (!val) return

        const { hint, conf } = inferirPerfilHint('ingreso_manual_alto', { valor: val })
        await captureSignal({
          asesor:           asesor,
          fuente:           'plataforma',
          tipo:             'ingreso_mensual_registrado',
          valor:            String(val),
          dimension_target: 'identidad_vendedora',
          perfil_hint:      hint,
          confianza_hint:   conf,
        })
      }, 1500)
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* HOOK 4: Ver resultados del mes — captura pasiva            */
  /* ─────────────────────────────────────────────────────────── */
  // Observar cuando el asesor navega a la sección de resultados
  function observeResultados() {
    const target = document.getElementById('tab-resultados') ||
                   document.querySelector('[data-tab="resultados"]') ||
                   document.querySelector('.tab-resultados')
    if (!target) return

    target.addEventListener('click', async () => {
      const G = window.G || {}
      if (!G.usuario) return
      if (!decidirCaptura('ver_resultados')) return

      await captureSignal({
        asesor:           G.usuario,
        fuente:           'plataforma',
        tipo:             'visita_resultados_mes',
        valor:            new Date().toISOString().slice(0, 7),
        dimension_target: 'relacion_feedback',
      })
    }, { once: false })
  }

  // Exponer globalmente para debugging
  window.captureSignal   = captureSignal
  window.decidirCaptura  = decidirCaptura

  // Inicializar después de que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(observeResultados, 2000)
    })
  } else {
    setTimeout(observeResultados, 2000)
  }

  console.debug('[signal-capture] hooks instalados')
})()
