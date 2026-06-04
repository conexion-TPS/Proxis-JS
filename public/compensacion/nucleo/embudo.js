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

  /* ── Render del embudo (movido desde compania-z: nodos.js + renta.js, verbatim).
     Genérico → vive en el núcleo. Usa globals de la plataforma (simState, simRender)
     que existen en runtime al invocarse (tras cargar datos.js/renta.js). Se exponen
     en window para que compania-z y los onclick inline los encuentren por nombre. ── */
  function buildSimMetodos(){
    const g=document.getElementById('sim-metodos-grid');if(!g)return;g.innerHTML='';
    // Group labels
    const nodoIds=['ref1','ref2','ref3','ref4'];
    let addedNodoHdr=false, addedPostCierreHdr=false, addedSinHdr=false;
    SIM_METODOS.forEach(m=>{
      if(m.esNodo&&!m.esPostCierre&&!addedNodoHdr){
        const hdr=document.createElement('div');
        hdr.className='metodo-group-lbl';hdr.textContent='Con contacto / nodo activo';
        g.appendChild(hdr);addedNodoHdr=true;
      }
      if(m.esNodo&&m.esPostCierre&&!addedPostCierreHdr){
        const hdr=document.createElement('div');
        hdr.className='metodo-group-lbl';hdr.style.color='#a8cc1a';hdr.textContent='Referidos tras cierre o entrega de póliza';
        g.appendChild(hdr);addedPostCierreHdr=true;
      }
      if(!m.esNodo&&!addedSinHdr){
        const hdr=document.createElement('div');
        hdr.className='metodo-group-lbl metodo-group-sin';hdr.textContent='Sin contacto / nodo';
        g.appendChild(hdr);addedSinHdr=true;
      }
      const pct=simState.pcts[m.id]||0;
      const row=document.createElement('div');
      row.className='metodo-row'+(pct>0?' active':'')+(m.esNodo?'':' metodo-sin');
      // Build cadena HTML
      const cadena=m.cadena||[];
      const cadenaHTML=cadena.map((s,i)=>{
        const hiCls=s.hi===true?'step-hi':s.hi==='blue'?'step-hi-blue':s.hi==='amber'?'step-hi-amber':'';
        return (i>0?'<span class="step-arr">→</span>':'')+
          `<div class="step-box ${hiCls}"><div class="step-n">${s.n}</div><div class="step-l">${s.l.replace(/\n/g,'<br>')}</div></div>`;
      }).join('');
      const footnote=m.esNodo?'<div class="cadena-note">* Valores aproximados según efectividad del asesor.</div>':'';
      row.innerHTML=`
        <div class="metodo-top">
          <div class="metodo-info">
            <div class="metodo-name">${m.nombre} <span class="metodo-tasa">${m.tasa}</span></div>
            <div class="metodo-sub">${m.desc}</div>
          </div>
          <div class="mpct-wrap"><button onclick="simChPct('${m.id}',-5)">−</button><div class="mpct-num" id="spct-${m.id}">${pct}%</div><button onclick="simChPct('${m.id}',5)">+</button></div>
        </div>
        <div class="cadena-wrap">
          <div class="cadena-row">${cadenaHTML}</div>
          ${footnote}
        </div>`;
      g.appendChild(row);
    });
  }
  function simChPct(id,delta){
    const tot=Object.values(simState.pcts).reduce((a,b)=>a+b,0);
    let nuevo=Math.max(0,Math.min(100,simState.pcts[id]+delta));
    if(delta>0&&tot+delta>100)nuevo=simState.pcts[id]+(100-tot);
    nuevo=Math.round(nuevo/5)*5;
    simState.pcts[id]=nuevo;buildSimMetodos();simRender();
  }
  function simTotPct(){return Object.values(simState.pcts).reduce((a,b)=>a+b,0)}

  function simRenderFunnel(ventas, pctsArg){
    // pctsArg permite pasar los % de cualquier empresa (Consorcio) SIN tocar simState (Zurich).
    // Si no se pasa, usa simState.pcts (comportamiento original de Zurich, idéntico).
    const P = pctsArg || (typeof simState!=='undefined' && simState ? simState.pcts : {});
    const fc=document.getElementById('funnel-content');if(!fc)return {totC:0,totP:0};
    const tot=Object.values(P).reduce((a,b)=>a+(+b||0),0);
    if(tot===0||ventas===0){fc.innerHTML='<div class="ib am">Asigna porcentajes a al menos un método y define el mix de productos.</div>';return {totC:0,totP:0}}
    const activos=SIM_METODOS.map(m=>{
      const pct=(P[m.id]||0)/100;if(pct===0)return null;
      const vM=ventas*pct;
      const prospectos=m.esNodo?Math.ceil(vM)*5:Math.round(vM*m.cPV);
      const contactos=m.esNodo?Math.ceil(vM):0;
      return{...m,pct,vM,contactos,prospectos};
    }).filter(Boolean);
    const totC=activos.filter(m=>m.esNodo).reduce((a,m)=>a+m.contactos,0);
    if(typeof simState!=='undefined' && simState) simState.totC=totC;
    const totP=activos.reduce((a,m)=>a+m.prospectos,0);
    const cSem=totC>0?Math.ceil(totC/4):0;
    const maxP=Math.max(totP,1);

    // Funnel steps — Opción B: dos grupos separados
    const totP_nodo=activos.filter(m=>m.esNodo).reduce((a,m)=>a+m.prospectos,0);
    const totP_frio=totP-totP_nodo;
    const sep=(lbl,cls)=>`<div style="display:flex;align-items:center;gap:8px;margin:10px 0 6px;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:${cls==='nodo'?'#0F6E56':'var(--g400)'}">`+
      `<span style="flex:1;border-top:0.5px solid ${cls==='nodo'?'#5DCAA5':'var(--g200)'}"></span>`+
      `<span>${lbl}</span>`+
      `<span style="flex:1;border-top:0.5px solid ${cls==='nodo'?'#5DCAA5':'var(--g200)'}"></span></div>`;
    const fstep=(lbl,val,cls,eq,small)=>`<div class="fstep"${small?' style="opacity:.7"':''}>` +
      `<div class="fstep-lbl"${small?' style="font-size:11px"':''}>${lbl}</div>` +
      `<div class="fbar-wrap"><div class="fbar ${cls}" style="width:${Math.round((val/maxP)*100)}%;${small?'background:#E8E7E2;color:#5F5E5A;font-size:11px':''}">${val}</div></div>` +
      `<div class="fnum"${small?' style="font-size:13px;color:var(--g400)"':''}>${val}</div>` +
      `<div class="feq"${small?' style="font-size:10px"':''}>${eq}</div></div>`;
    let html=sep('con contacto / nodo activo','nodo');
    if(totC>0)html+=fstep('Contactos/Nodos',totC,'bar-c',`${cSem} contacto${cSem===1?'':'s'} por semana`,false);
    html+=fstep('Prospectos',totP_nodo,'bar-p','5 por contacto',false);
    html+=sep('sin contacto / nodo','cold');
    if(totP_frio>0)html+=fstep('Digital + frío',totP_frio,'bar-p',`prospectos adicionales`,true);
    html+=`<div style="margin-top:10px;padding-top:8px;border-top:.5px solid var(--g200);font-size:11px;color:var(--g400)">` +
      `Total prospectos del período: <strong style="color:var(--g900)">${totP}</strong> · Ver desglose completo en <em>Origen estimado de prospectos</em></div>`;

    // Gráfico origen de prospectos con separación nodo/sin nodo
    const nodoActivos=activos.filter(m=>m.esNodo);
    const sinNodoActivos=activos.filter(m=>!m.esNodo);
    if(activos.length>0){
      html+='<div class="orig-chart"><div class="orig-title">Origen estimado de prospectos</div>';
      if(nodoActivos.length>0){
        html+='<div class="orig-group-lbl orig-nodo">Con contacto / nodo activo</div>';
        nodoActivos.forEach(m=>{
          const pct=totP>0?Math.round(m.prospectos/totP*100):0;
          const w=totP>0?Math.round(m.prospectos/totP*100):0;
          html+=`<div class="orig-row"><div class="orig-lbl">${m.nombre.replace('Contacto/Nodo — ','')}</div>
            <div class="orig-bar-wrap"><div class="orig-bar" style="width:${Math.max(w,2)}%;background:${m.color}">
              ${m.prospectos>0?`<span class="orig-val">${m.prospectos}</span>`:''}</div>
              <span class="orig-pct">${pct}%</span></div></div>`;
        });
      }
      if(sinNodoActivos.length>0){
        html+='<div class="orig-group-lbl orig-sin">Sin contacto / nodo</div>';
        sinNodoActivos.forEach(m=>{
          const pct=totP>0?Math.round(m.prospectos/totP*100):0;
          const w=totP>0?Math.round(m.prospectos/totP*100):0;
          html+=`<div class="orig-row"><div class="orig-lbl">${m.nombre}</div>
            <div class="orig-bar-wrap"><div class="orig-bar" style="width:${Math.max(w,2)}%;background:${m.color}">
              ${m.prospectos>0?`<span class="orig-val">${m.prospectos}</span>`:''}</div>
              <span class="orig-pct">${pct}%</span></div></div>`;
        });
      }
      html+=`<div class="orig-total">Total: <strong>${totP}</strong> prospectos estimados</div></div>`;
    }
    fc.innerHTML=html;
    return {totC, totP};
  }

  const api = { SIM_METODOS, calcEmbudo, buildSimMetodos, simChPct, simTotPct, simRenderFunnel }

  // Node (tests / golden master) — solo se usa calcEmbudo; el render no se invoca.
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  // Navegador: expone el núcleo + globals que hoy usan compania-z y los onclick inline.
  if (root) {
    root.NucleoEmbudo = api
    if (typeof root.SIM_METODOS === 'undefined') root.SIM_METODOS = SIM_METODOS
    root.buildSimMetodos  = buildSimMetodos
    root.simChPct         = simChPct
    root.simTotPct        = simTotPct
    root.simRenderFunnel  = simRenderFunnel
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this))
