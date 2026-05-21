/* ═══════════════════════════════════════════════════════
   COMPAÑÍA Z — BLOQUE 2: MÉTODOS DE CONTACTO / NODOS
   buildSimMetodos(): ~7 tarjetas de métodos de prospección
   con porcentajes ajustables y cadenas de conversión
   Dependencia: datos.js cargado antes
═══════════════════════════════════════════════════════ */
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

