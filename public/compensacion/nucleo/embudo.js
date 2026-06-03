/* ═══════════════════════════════════════════════════════════════════════
   NÚCLEO — EMBUDO DE PRORRATEO (genérico, compartido por TODAS las empresas)
   Fase 2 de MODULO_COMPENSACION_PLAN.md.

   Traduce VENTAS proyectadas → CONTACTOS y PROSPECTOS necesarios, por las
   proporciones de prospección. Esto NO es del módulo de compensación: es
   genérico (mismas tasas de industria Granum/LIMRA/MDRT) y vive en el núcleo.

   `calcEmbudo` es PURO (sin DOM): corre igual en navegador y en Node, para
   poder verificarlo contra el golden master. Las funciones de render/DOM se
   moverán aquí en el paso 2b (cableado), copiando las actuales tal cual.

   Compatibilidad: en navegador expone window.NucleoEmbudo y los globals que
   hoy usa compania-z (SIM_METODOS). En Node exporta el API para tests.
═══════════════════════════════════════════════════════════════════════ */
'use strict'
;(function (root) {

  // Métodos de prospección (genéricos). Copia canónica desde compania-z/datos.js.
  const SIM_METODOS = [
    { id:'ref1', nombre:'Contacto/Nodo — nombre dado', tasa:'25-30%', cPV:5,   esNodo:true,
      cadena:[{n:1,l:'contacto/\nnodo'},{n:5,l:'nombres\ndados'},{n:2,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}] },
    { id:'ref2', nombre:'Contacto/Nodo — presentado con patrocinio', tasa:'40-50%', cPV:2.5, esNodo:true,
      cadena:[{n:1,l:'contacto/\nnodo'},{n:5,l:'referidos\navisados'},{n:3,l:'con\nreunión'},{n:2,l:'cierres\nest.',hi:true}] },
    { id:'ref3', nombre:'Contacto/Nodo — transferencia en vivo', tasa:'55-70%', cPV:1.5, esNodo:true,
      cadena:[{n:1,l:'contacto/\nnodo'},{n:2,l:'presentes\nen vivo'},{n:1,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}] },
    { id:'ref4', nombre:'Referidos tras cierre o entrega de póliza', tasa:'20-25%', cPV:5, esNodo:true, esPostCierre:true,
      cadena:[{n:1,l:'cliente\ntras cierre'},{n:5,l:'prospectos\nentregados'},{n:2,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}] },
    { id:'dig',  nombre:'Leads digitales de alta intención', tasa:'10-15%', cPV:7,  esNodo:false,
      cadena:[{n:'—',l:'sin\nnodo'},{n:7,l:'leads\nrecibidos'},{n:4,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:'blue'}] },
    { id:'frio', nombre:'Prospección en frío', tasa:'2-4%', cPV:40, esNodo:false,
      cadena:[{n:'—',l:'sin\nnodo'},{n:40,l:'contactos\nfríos'},{n:10,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:'amber'}] },
  ]

  /* Cálculo PURO del embudo. Réplica EXACTA de la lógica actual de Zurich
     (renta.js:257-265 metas + simRenderFunnel:363-372 totales). No toca DOM. */
  function calcEmbudo(pcts, ventas) {
    pcts = pcts || {}
    const metaContactos = Math.max(1, Math.round(
      SIM_METODOS.filter(m => m.esNodo).reduce((a, m) => {
        const pct = (pcts[m.id] || 0) / 100
        return a + (pct > 0 ? Math.ceil(ventas * pct) : 0)
      }, 0) / 4
    ))
    const metaProspectos = Math.max(1, Math.round(
      SIM_METODOS.reduce((a, m) => {
        const pct = (pcts[m.id] || 0) / 100
        if (pct === 0) return a
        const prosp = m.esNodo
          ? Math.round(ventas * pct * (m.cadena ? m.cadena[1].n : 5))
          : Math.round(ventas * pct * m.cPV)
        return a + prosp
      }, 0)
    ))
    const activos = SIM_METODOS.map(m => {
      const pct = (pcts[m.id] || 0) / 100
      if (pct === 0) return null
      const vM = ventas * pct
      return {
        id: m.id, esNodo: m.esNodo,
        contactos: m.esNodo ? Math.ceil(vM) : 0,
        prospectos: m.esNodo ? Math.ceil(vM) * 5 : Math.round(vM * m.cPV),
      }
    }).filter(Boolean)
    const totContactos  = activos.filter(m => m.esNodo).reduce((a, m) => a + m.contactos, 0)
    const totProspectos = activos.reduce((a, m) => a + m.prospectos, 0)
    return { metaContactos, metaProspectos, totContactos, totProspectos, activos }
  }

  const api = { SIM_METODOS, calcEmbudo }

  // Node (tests / golden master)
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  // Navegador: expone el núcleo + el global SIM_METODOS que hoy usa compania-z
  if (root) { root.NucleoEmbudo = api; if (typeof root.SIM_METODOS === 'undefined') root.SIM_METODOS = SIM_METODOS }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this))
