/* cuestionario-player.js
   Modal de cuestionarios para /plataforma.
   Maneja onboarding (primera vez) y micro-cuestionarios periódicos.
   Cargado después de signal-capture.js.
*/

;(function () {
  'use strict'

  const SB_URL  = window.__SB_URL  || ''   // inyectado por plataforma-core.js o .env
  const SB_ANON = window.__SB_ANON || ''

  /* ── Supabase REST helper mínimo ────────────────────────────── */
  async function sbGet(tabla, qs) {
    const r = await fetch(`${SB_URL}/rest/v1/${tabla}?${qs}`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` }
    })
    if (!r.ok) return []
    return r.json()
  }

  async function sbGetOne(tabla, qs) {
    const arr = await sbGet(tabla, qs)
    return arr[0] ?? null
  }

  /* ── Verificar si el asesor necesita onboarding ────────────── */
  async function necesitaOnboarding(asesor) {
    const perfil = await sbGetOne('asesor_perfil', `asesor=eq.${encodeURIComponent(asesor)}&select=assertividad_score`)
    return perfil === null || perfil.assertividad_score === null
  }

  /* ── Cargar cuestionarios activos del tipo dado ─────────────── */
  async function cargarCuestionario(tipo) {
    const cues = await sbGet('cuestionarios', `tipo=eq.${tipo}&activo=eq.true&limit=1`)
    if (!cues.length) return null
    const c = cues[0]
    const preguntas = await sbGet('preguntas', `cuestionario_id=eq.${c.id}&order=orden.asc`)
    return { ...c, preguntas }
  }

  /* ── Cargar micro-cuestionario (1-3 preguntas aleatorias) ───── */
  async function cargarMicro(asesor) {
    // Elegir dimensión con menos señales para este asesor
    const senales = await sbGet('behavioral_signals',
      `asesor=eq.${encodeURIComponent(asesor)}&select=dimension_target&limit=200`)
    const countByDim = {}
    for (const s of senales) {
      const d = s.dimension_target || 'otro'
      countByDim[d] = (countByDim[d] || 0) + 1
    }
    const DIMS = ['identidad_vendedora','relacion_prospeccion','modelos_mentales',
                  'relacion_feedback','perfil_conductual_notas','contexto_situacional']
    // Ordenar por menor cobertura
    const sorted = DIMS.sort((a, b) => (countByDim[a] || 0) - (countByDim[b] || 0))
    const targetDim = sorted[0]

    // Buscar preguntas para esa dimensión en cuestionarios activos
    const cues = await sbGet('cuestionarios', 'activo=eq.true&select=id,nombre')
    if (!cues.length) return null

    const cueIds = cues.map(c => c.id).join(',')
    const pregs = await sbGet('preguntas',
      `cuestionario_id=in.(${cueIds})&dimension_target=eq.${encodeURIComponent(targetDim)}&limit=3`)

    if (!pregs.length) {
      // Fallback: preguntas de cualquier dimensión
      const todas = await sbGet('preguntas', `cuestionario_id=in.(${cueIds})&limit=5`)
      if (!todas.length) return null
      const idx = Math.floor(Math.random() * todas.length)
      return { id: 'micro', nombre: 'Pregunta rápida', tipo: 'micro', preguntas: [todas[idx]] }
    }

    const n = Math.min(pregs.length, 1 + Math.floor(Math.random() * 2)) // 1-2 preguntas
    return { id: 'micro', nombre: 'Momento de reflexión', tipo: 'micro', preguntas: pregs.slice(0, n) }
  }

  /* ── Enviar respuestas al servidor ─────────────────────────── */
  async function enviarRespuestas(asesor, cuestionarioId, preguntasRespondidas) {
    try {
      const r = await fetch('/api/cuestionario/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asesor,
          cuestionario_id: cuestionarioId,
          respuestas: preguntasRespondidas,
        })
      })
      return r.ok ? r.json() : null
    } catch { return null }
  }

  /* ── Render modal ───────────────────────────────────────────── */
  function mostrarModal(cuestionario, asesor, onComplete) {
    const { preguntas, nombre, tipo } = cuestionario
    let currentIdx = 0
    const respuestas = []

    // Overlay
    const overlay = document.createElement('div')
    overlay.id = 'cues-overlay'
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(11,10,9,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999', padding: '20px', backdropFilter: 'blur(4px)',
    })

    // Card
    const card = document.createElement('div')
    Object.assign(card.style, {
      background: '#fff', borderRadius: '18px', padding: '36px',
      width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
      boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
      fontFamily: 'Plus Jakarta Sans, ui-sans-serif, sans-serif',
    })

    function render() {
      const p   = preguntas[currentIdx]
      const tot = preguntas.length
      const pct = ((currentIdx) / tot) * 100

      card.innerHTML = `
        <div style="margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a8885;margin-bottom:8px">
            ${tipo === 'onboarding' ? 'Conocemos tu estilo' : nombre}
          </div>
          <div style="height:4px;background:#f0ede8;border-radius:2px;margin-bottom:20px">
            <div style="height:4px;background:#cbf135;border-radius:2px;width:${pct}%;transition:width .4s"></div>
          </div>
          <div style="font-size:15px;font-weight:600;color:#0b0a09;line-height:1.55;margin-bottom:24px">
            ${p.texto}
          </div>
          <div id="opciones" style="display:flex;flex-direction:column;gap:10px">
            ${renderOpciones(p)}
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
          <span style="font-size:11px;color:#8a8885">${currentIdx + 1} de ${tot}</span>
          <div style="display:flex;gap:8px">
            ${tipo !== 'onboarding' ? `<button id="btn-omitir" style="${btnStyle('#fff','#0b0a09','#e8e6e3')}">Omitir</button>` : ''}
            <button id="btn-sig" disabled style="${btnStyle('#cbf135','#0b0a09')}">
              ${currentIdx === tot - 1 ? 'Finalizar' : 'Siguiente →'}
            </button>
          </div>
        </div>
      `

      // Bind opciones
      const opcs = card.querySelectorAll('.opc')
      let selVal = null
      opcs.forEach(btn => {
        btn.addEventListener('click', () => {
          opcs.forEach(b => {
            b.style.borderColor = '#e8e6e3'
            b.style.background  = '#fff'
          })
          btn.style.borderColor = '#0b0a09'
          btn.style.background  = '#f5f3ef'
          selVal = btn.dataset.val
          card.querySelector('#btn-sig').disabled = false
          card.querySelector('#btn-sig').style.opacity = '1'
        })
      })

      // Siguiente
      card.querySelector('#btn-sig').addEventListener('click', async () => {
        if (!selVal && card.querySelector('input,textarea')) {
          const inp = card.querySelector('input,textarea')
          selVal = inp.value.trim()
        }
        if (!selVal) return

        respuestas.push({
          pregunta_id:      p.id,
          respuesta:        selVal,
          dimension_target: p.dimension_target ?? null,
          perfil_hint:      p.perfil_hint ?? null,
          eje:              p.eje ?? null,
          confianza_hint:   p.confianza_hint ?? 55,
        })

        if (currentIdx < tot - 1) {
          currentIdx++; selVal = null; render()
        } else {
          // Finalizar
          overlay.remove()
          const result = await enviarRespuestas(asesor, cuestionario.id, respuestas)
          if (onComplete) onComplete(result)
        }
      })

      // Omitir
      const btnOmitir = card.querySelector('#btn-omitir')
      if (btnOmitir) {
        btnOmitir.addEventListener('click', () => {
          overlay.remove()
          if (onComplete) onComplete(null)
        })
      }

      // Input libre
      const inp = card.querySelector('textarea, input[type=text]')
      if (inp) {
        inp.addEventListener('input', () => {
          card.querySelector('#btn-sig').disabled = !inp.value.trim()
          card.querySelector('#btn-sig').style.opacity = inp.value.trim() ? '1' : '0.5'
        })
      }
    }

    overlay.appendChild(card)
    document.body.appendChild(overlay)
    render()
  }

  function renderOpciones(p) {
    if (p.tipo_respuesta === 'escala_4') {
      const labels = p.opciones?.labels ?? ['Muy en desacuerdo', 'En desacuerdo', 'De acuerdo', 'Muy de acuerdo']
      return labels.map((l, i) => `
        <button class="opc" data-val="${i + 1}" style="${opcStyle()}">
          <span style="font-size:11px;font-weight:700;color:#8a8885;min-width:18px">${i + 1}</span>
          <span style="font-size:13px;color:#0b0a09">${l}</span>
        </button>
      `).join('')
    }
    if (p.tipo_respuesta === 'si_no') {
      return ['Sí', 'No'].map(v => `
        <button class="opc" data-val="${v}" style="${opcStyle()}">${v}</button>
      `).join('')
    }
    if (p.tipo_respuesta === 'alternativas' && p.opciones?.items) {
      return p.opciones.items.map(item => `
        <button class="opc" data-val="${item.valor ?? item}" style="${opcStyle()}">
          <span style="font-size:13px;color:#0b0a09">${item.label ?? item}</span>
        </button>
      `).join('')
    }
    // Abierta
    return `<textarea placeholder="Escribe tu respuesta…" style="width:100%;padding:12px;border:1px solid #e8e6e3;border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;min-height:80px;outline:none"></textarea>`
  }

  function opcStyle() {
    return 'display:flex;align-items:center;gap:10px;padding:12px 16px;border:1px solid #e8e6e3;border-radius:10px;cursor:pointer;background:#fff;text-align:left;font-family:inherit;transition:all .15s;width:100%'
  }

  function btnStyle(bg, color, borderColor) {
    const bc = borderColor ?? bg
    return `padding:10px 20px;border-radius:8px;border:1px solid ${bc};background:${bg};color:${color};font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;opacity:.5`
  }

  /* ── API pública ────────────────────────────────────────────── */

  async function iniciar(asesor) {
    if (!asesor) return

    // Guardar las credenciales SB si las conocemos del contexto global
    if (!window.__SB_URL && window.SB) {
      // plataforma-core.js expone SB object — extraer URL del fetch
    }

    // 1. Onboarding prioritario
    if (await necesitaOnboarding(asesor)) {
      const cues = await cargarCuestionario('onboarding')
      if (cues && cues.preguntas?.length) {
        mostrarModal(cues, asesor, (result) => {
          if (result?.scores?.perfil) {
            const perfilNombres = { E: 'Energético', S: 'Sociable', R: 'Relacional', A: 'Reflexivo' }
            mostrarToastPerfil(perfilNombres[result.scores.perfil] ?? result.scores.perfil)
          }
        })
        return
      }
    }

    // 2. Micro-cuestionario si decidirCaptura lo determina
    if (typeof window.decidirCaptura === 'function' && window.decidirCaptura('ver_resultados')) {
      const micro = await cargarMicro(asesor)
      if (micro && micro.preguntas?.length) {
        mostrarModal(micro, asesor, () => {})
      }
    }
  }

  function mostrarToastPerfil(perfil) {
    const t = document.createElement('div')
    Object.assign(t.style, {
      position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
      background: '#0b0a09', color: '#cbf135',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: '13px', fontWeight: '600',
      padding: '12px 24px', borderRadius: '30px', zIndex: '9998',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    })
    t.textContent = `Tu perfil inicial: ${perfil} ✦`
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 5000)
  }

  // Exponer globalmente
  window.CuestionarioPlayer = { iniciar, mostrarModal, cargarMicro }

  // Auto-iniciar cuando el asesor se identifique
  // Hook: el sistema de login llama a G.usuario — esperamos el evento de login
  document.addEventListener('proxis:login', (e) => {
    const asesor = e.detail?.asesor || (window.G && window.G.usuario)
    if (asesor) setTimeout(() => iniciar(asesor), 1500)
  })

  console.debug('[cuestionario-player] listo')
})()
