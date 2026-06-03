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

  // Métodos de prospección (genéricos). FUENTE ÚNICA (copia fiel y completa de
  // la antigua compania-z/datos.js — incluye desc/color/bg que usa el render).
  const SIM_METODOS = [
    // Con contacto/nodo activo — 3 niveles de patrocinio
    {id:'ref1',nombre:'Contacto/Nodo — nombre dado',desc:'El contacto/nodo da un nombre y teléfono. El asesor llega con referencia pero sin presentación activa.',tasa:'25-30%',cPV:5,reunRate:0.40,cierreRate:0.40,nPorNodo:5,color:'#1D9E75',bg:'#E1F5EE',esNodo:true,
     cadena:[{n:1,l:'contacto/\nnodo'},{n:5,l:'nombres\ndados'},{n:2,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}]},
    {id:'ref2',nombre:'Contacto/Nodo — presentado con patrocinio',desc:'El nodo hace una introducción activa. El prospecto espera el contacto del asesor. Mayor credibilidad.',tasa:'40-50%',cPV:2.5,reunRate:0.60,cierreRate:0.67,nPorNodo:5,color:'#0F6E56',bg:'#E1F5EE',esNodo:true,
     cadena:[{n:1,l:'contacto/\nnodo'},{n:5,l:'referidos\navisados'},{n:3,l:'con\nreunión'},{n:2,l:'cierres\nest.',hi:true}]},
    {id:'ref3',nombre:'Contacto/Nodo — transferencia en vivo',desc:'El nodo presenta en persona, llamada o videollamada en ese momento. Máxima credibilidad.',tasa:'55-70%',cPV:1.5,reunRate:0.50,cierreRate:1.0,nPorNodo:2,color:'#5DCAA5',bg:'#E1F5EE',esNodo:true,
     cadena:[{n:1,l:'contacto/\nnodo'},{n:2,l:'presentes\nen vivo'},{n:1,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}]},
    {id:'ref4',nombre:'Referidos tras cierre o entrega de póliza',desc:'Pre-calificados por clientes actuales tras el cierre, transferidos en vivo.',tasa:'20-25%',cPV:5,reunRate:0.50,cierreRate:0.22,nPorNodo:5,color:'#a8cc1a',bg:'#f5ffcc',esNodo:true,esPostCierre:true,
     cadena:[{n:1,l:'cliente\ntras cierre'},{n:5,l:'prospectos\nentregados'},{n:2,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:true}]},
    // Sin contacto/nodo
    {id:'dig',nombre:'Leads digitales de alta intención',desc:'Leads online (formularios, calculadoras, ads). Ya mostraron interés previo.',tasa:'10-15%',cPV:7,color:'#378ADD',bg:'#E6F1FB',esNodo:false,
     cadena:[{n:'—',l:'sin\nnodo'},{n:7,l:'leads\nrecibidos'},{n:4,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:'blue'}]},
    {id:'frio',nombre:'Prospección en frío',desc:'Contacto masivo sin pre-calificación. Alto volumen, baja conversión.',tasa:'2-4%',cPV:40,color:'#BA7517',bg:'#FAEEDA',esNodo:false,
     cadena:[{n:'—',l:'sin\nnodo'},{n:40,l:'contactos\nfríos'},{n:10,l:'con\nreunión'},{n:1,l:'cierre\nest.',hi:'amber'}]},
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
