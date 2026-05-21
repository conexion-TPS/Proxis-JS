/* ═══════════════════════════════════════════════════════
   COMPAÑÍA Z — BLOQUE 3: CÁLCULO DE RENTA
   Mix de productos, primas, GI, cálculo de AE/bonos (simCalcZ)
   y renderizado completo de resultados (simRender, simRenderFunnel)
   ESTE ES EL ARCHIVO QUE UNA IA PUEDE AUTO-GENERAR
   para una nueva compañía a partir de su manual de compensaciones
   Dependencia: datos.js → perfil.js → nodos.js cargados antes
═══════════════════════════════════════════════════════ */
function buildSimMix(){
  const g=document.getElementById('sim-mix-grid');if(!g)return;g.innerHTML='';
  SIM_PRODS.forEach(p=>{
    const row=document.createElement('div');row.className='mix-row';
    const badge=p.id==='APV'?'<span class="pill pill-gn" style="margin-left:3px;font-size:10px">campaña 100%</span>':'';
    row.innerHTML=`<div><div class="mix-name">${p.n}${badge}</div><div class="mix-sub">Factor AE: ${(p.z*100).toFixed(0)}%</div></div>
    <div class="mix-qty"><button onclick="simChQty('${p.id}',-1)">−</button><div class="mix-qty-n" id="sqty-${p.id}">${simState.qty[p.id]}</div><button onclick="simChQty('${p.id}',1)">+</button></div>`;
    g.appendChild(row);
  });
}
function simChQty(id,delta){
  simState.qty[id]=Math.max(0,Math.min(20,simState.qty[id]+delta));
  const el=document.getElementById(`sqty-${id}`);if(el)el.textContent=simState.qty[id];
  simUpdPrimaVis();simRender();
}
function buildSimPrimas(){
  const w=document.getElementById('sim-prima-inputs');if(!w)return;w.innerHTML='';
  SIM_PRODS.forEach(p=>{
    const d=document.createElement('div');d.className='fg';d.id=`spg-${p.id}`;d.style.display=simState.qty[p.id]>0?'block':'none';
    d.innerHTML=`<div class="flbl">${p.n}
      <span style="font-size:10px;color:var(--g400)">PPA = prima × 12</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <input type="number" id="ssl-prima-${p.id}" step="0.1" min="0" max="9999"
        value="${simState.prima[p.id]}"
        style="width:90px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center"
        placeholder="UF">
      <span style="font-size:11px;color:var(--g400)">UF/mes</span>
      <span style="font-size:11px;color:var(--blue);font-family:var(--mono)" id="slbl-ppa-${p.id}">
        PPA: ${(simState.prima[p.id]*12).toFixed(1)} UF
      </span>
    </div>`;
    w.appendChild(d);
    document.getElementById(`ssl-prima-${p.id}`).addEventListener('input',e=>{
      const v=parseFloat(e.target.value)||0;
      simState.prima[p.id]=v;
      const lp=document.getElementById(`slbl-ppa-${p.id}`);
      if(lp)lp.textContent=`PPA: ${(v*12).toFixed(1)} UF`;
      simRender();
    });
  });
}
function simUpdPrimaVis(){SIM_PRODS.forEach(p=>{const g=document.getElementById(`spg-${p.id}`);if(g)g.style.display=simState.qty[p.id]>0?'block':'none'})}

function simBuildGI(){
  const g=document.getElementById('sim-gi-grid');if(!g)return;g.innerHTML='';
  SIM_PRODS_GI.forEach(p=>{
    const active=simState.qtyGI[p.id]>0;
    const row=document.createElement('div');row.className='mix-row'+(active?' active':'');row.id='sim-gi-row-'+p.id;
    row.innerHTML=`<div><div class="mix-name">${p.n}</div><div class="mix-sub">AE: <strong>${(p.z*100).toFixed(0)}%</strong></div></div>
    <div class="mix-qty"><button onclick="simChQtyGI('${p.id}',-1)">−</button><div class="mix-qty-n" id="sqtygi-${p.id}">${simState.qtyGI[p.id]}</div><button onclick="simChQtyGI('${p.id}',1)">+</button></div>`;
    g.appendChild(row);
  });
}
function simChQtyGI(id,d){
  simState.qtyGI[id]=Math.max(0,Math.min(20,simState.qtyGI[id]+d));
  const el=document.getElementById('sqtygi-'+id);if(el)el.textContent=simState.qtyGI[id];
  const row=document.getElementById('sim-gi-row-'+id);if(row)row.className='mix-row'+(simState.qtyGI[id]>0?' active':'');
  simBuildPrimasGI();simRender();
}
function simBuildPrimasGI(){
  const w=document.getElementById('sim-gi-primas');if(!w)return;w.innerHTML='';
  SIM_PRODS_GI.filter(p=>simState.qtyGI[p.id]>0).forEach(p=>{
    const d=document.createElement('div');d.className='fg';
    d.innerHTML=`<div class="flbl">${p.n}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <input type="number" id="ssl-pgi-${p.id}" step="0.1" min="0" max="999"
        value="${simState.primaGI[p.id]}"
        style="width:90px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center"
        placeholder="UF">
      <span style="font-size:11px;color:var(--g400)">UF/mes</span>
      <span style="font-size:11px;color:var(--blue);font-family:var(--mono)" id="slbl-pgi-${p.id}">
        PPA: ${(simState.primaGI[p.id]*12).toFixed(1)} UF
      </span>
    </div>`;
    w.appendChild(d);
    document.getElementById('ssl-pgi-'+p.id).addEventListener('input',e=>{
      const v=parseFloat(e.target.value)||0;
      simState.primaGI[p.id]=v;
      const l=document.getElementById('slbl-pgi-'+p.id);
      if(l)l.textContent=`PPA: ${(v*12).toFixed(1)} UF`;
      simRender();
    });
  });
}

function simCalcZ(campana){
  const ss=simState;
  let zVI=0,zGIBruto=0,comVenta=0,incMant=0,ventas=0;
  const det=[],detGI=[];

  // ── Pólizas Vida VI ──
  SIM_PRODS.forEach(p=>{
    const qty=ss.qty[p.id];if(!qty)return;
    const cp=campana?CAMP_PRODS[p.id]:null;
    const prima=ss.prima[p.id];
    // Factor AE: campaña o base
    // Si campaña APV y KPI no cumplido → usar factor base (50%)
    const kpiSaludChk=document.getElementById('kpi-salud')?.checked||ss.qty['SS']>0;
    const tieneVidaMix=SIM_PRODS.some(q=>ss.qty[q.id]>0);
    const tieneGIMix=SIM_PRODS_GI.some(q=>ss.qtyGI[q.id]>0);
    const kpiCumpleCalc=kpiSaludChk&&tieneVidaMix&&tieneGIMix;
    const usarCamp=cp&&(p.id!=='APV'||kpiCumpleCalc);
    let zF=usarCamp?cp.z:p.z, nota=usarCamp?`campaña ${(zF*100).toFixed(0)}%`:(p.id==='APV'&&campana&&!kpiCumpleCalc?'APV 50% (KPI ✗)':'');
    // PPA en UF
    let ppaUF=prima*12; // prima already stored in UF
    if(usarCamp&&cp?.capUF)ppaUF=Math.min(ppaUF,cp.capUF*qty);
    let zT=ppaUF*zF;
    if(usarCamp&&cp?.tope)zT=Math.min(zT,cp.tope*qty);
    zVI+=zT;ventas+=qty;
    // Comisión venta mes 1
    let cV=0;
    const primaCLP=prima*UF_VAL; // convert UF back to CLP for commission calc
    if(p.cUF){cV=p.cUF*UF_VAL*qty;}
    else if(p.c){cV=primaCLP*p.c*qty;if(p.cTopeUF)cV=Math.min(cV,p.cTopeUF*UF_VAL*qty);}
    comVenta+=cV;
    // Incentivo mantención (según antigüedad del asesor)
    let incT=0,incTasa=null,incTopeUF=null;
    if(ss.ant>=2){
      if(ss.ant<=12&&p.incM12){incTasa=p.incM12;incTopeUF=p.incM12TopeUF;}
      else if(ss.ant<=24&&p.incM24){incTasa=p.incM24;incTopeUF=p.incM24TopeUF;}
      else if(ss.ant>24&&p.incM120){incTasa=p.incM120;}
      if(incTasa){incT=primaCLP*incTasa*qty;if(incTopeUF)incT=Math.min(incT,incTopeUF*UF_VAL*qty);}
    }
    incMant+=incT;
    det.push({p,qty,ppaUF,zTotal:zT,comVenta:cV,incMant:incT,nota});
  });

  // Columna endoso según pólizas nueva venta del período
  const endosoCol=ventas>=3?0:ventas===2?1:2;
  const endosoLbl=endosoCol===0?'≥3 pol.':endosoCol===1?'2 pol.':'0-1 pol.';

  // ── APV AE Flexible Traspaso cartera (PPA = 10% monto, factor ENDOSO_Z) ──
  if(ss.apvFlexEx>0){
    const zFactor=ENDOSO_Z['APVF'][endosoCol];
    const ppaF=ss.apvFlexEx*0.10;
    const zF=ppaF*zFactor;
    zVI+=zF;
    det.push({p:{id:'APVFLEX_EX',n:'APV AE Flexible Traspaso Cartera'},qty:1,ppaUF:ppaF,zTotal:zF,comVenta:0,incMant:0,nota:`PPA ${(zFactor*100).toFixed(1)}% (${endosoLbl})`});
  }
  // ── APV aporte extraordinario (PPA = 10% monto, factor ENDOSO_Z) ──
  if(ss.apvEx>0){
    const ppaEq=ss.apvEx*0.10;
    const zFactor=ENDOSO_Z['APV'][endosoCol];
    const z=ppaEq*zFactor;
    zVI+=z;
    det.push({p:{id:'APVEX',n:'APV Aporte Extra'},qty:1,ppaUF:ppaEq,zTotal:z,comVenta:0,incMant:0,nota:`aporte ${(zFactor*100).toFixed(0)}% (${endosoLbl})`});
  }
  // ── Renta Preferente Prima Única (PPA = 10% monto, factor ENDOSO_Z) ──
  if(ss.rpMonto>0){
    const zFactor=ENDOSO_Z['RP'][endosoCol];
    const ppaRP=ss.rpMonto*0.10;
    const z=ppaRP*zFactor;
    zVI+=z;
    det.push({p:{id:'RPUNI',n:'Futura Renta'},qty:1,ppaUF:ppaRP,zTotal:z,comVenta:0,incMant:0,nota:`${(zFactor*100).toFixed(0)}% (${endosoLbl})`});
  }

  // ── Pólizas Generales GI ──
  SIM_PRODS_GI.forEach(p=>{
    const qty=ss.qtyGI[p.id];if(!qty)return;
    const ppaUF=ss.primaGI[p.id]*12; // GI prima in UF
    const z=ppaUF*p.z;
    zGIBruto+=z;
    detGI.push({p,qty,ppaUF,zTotal:z});
  });
  // Tope GI: 25% AE VI (liberado en campaña)
  const topeGI=campana?Infinity:zVI*0.25;
  const zGI=Math.min(zGIBruto,topeGI);
  const zTotal=zVI+zGI;

  // ── Bonos opcionales ──
  let bonoApe=0,bonoCv=0,grati=0;
  if(ss.bonos.top20ape)bonoApe=(TOP20_APE_UF[ss.rankApe-1]||0)*UF_VAL;
  if(ss.bonos.top20cv) bonoCv =(TOP20_CV_UF[ss.rankCv-1]||0)*UF_VAL;
  // Gratificación legal: solo aplica según antigüedad (no se incluye en simulador general)

  return{zVI,zGIBruto,zGI,zGITopado:zGIBruto>topeGI,zTotal,det,detGI,
         comVenta,incMant,ventas,bonoApe,bonoCv,grati};
}

function simCalcBonoUF(z,ant,campana){
  const tope_t5=TOPE_T5(ant,campana);
  const cumpleT5=Object.values(simState.t5).some(v=>v)&&(simState.persist/100)>=0.85;
  let uf=0;const det=[];
  for(const t of SIM_TRAMOS){
    if(t.min>=200){
      // Tramo 5: requiere T5 habilitado + tope por antigüedad
      if(z<=200||!cumpleT5){det.push({...t,ap:0,uf:0,motivo:z<=200?'AE≤200':!cumpleT5?'sin req.':''});continue;}
      const exceso=z-200;
      const ap=tope_t5===null?exceso:Math.min(exceso,tope_t5);
      const u=ap*t.pct;det.push({...t,ap,uf:u,capped:tope_t5!==null&&exceso>tope_t5});uf+=u;
      continue;
    }
    if(z<=t.min){det.push({...t,ap:0,uf:0});continue;}
    const ap=Math.min(z,t.max)-t.min;if(ap<=0){det.push({...t,ap:0,uf:0});continue;}
    const u=ap*t.pct;det.push({...t,ap,uf:u});uf+=u;
  }
  return{uf,det,t5Hab:cumpleT5,tope_t5};
}

function simRender(){
  const ss=simState;
  const campana=document.getElementById('campana-toggle')?.checked??true;
  const ant=ss.ant,pR=ss.persist/100,pM=PMIN(ant),fp=FP(pR,pM,ant);
  const {zVI,zGIBruto,zGI,zGITopado,zTotal,det,detGI,comVenta,incMant,ventas,bonoApe,bonoCv,grati}=simCalcZ(campana);
  const {uf:bUF,det:trDet,t5Hab,tope_t5}=simCalcBonoUF(zTotal,ant,campana);
  const bonoNeto=bUF*fp*UF_VAL;
  const total=SUELDO_BASE+bonoNeto+comVenta+incMant+bonoApe+bonoCv;
  const zB=zTotal; // alias for backward compat

  const setEl=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html};
  const setText=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt};

  // persist info
  const pPct=Math.round(pR/pM*100);
  const pLbl=fp===0?'0% — sin bono':fp===.5?'50%':fp===.65?'65%':fp===.9?'90%':fp===1?'100%':'120%';
  setEl('persist-info',`Mínima exigida (mes ${ant}): <strong>${Math.round(pM*100)}%</strong> · Cumplimiento: <strong>${pPct}%</strong> → <strong>${pLbl} del bono</strong>`);
  setEl('campana-info',campana?`Campaña 2026: APV al <strong>100%</strong>. Tope T5: <strong>${tope_t5===null?'sin tope':tope_t5+' AE'}</strong>. GI: tope liberado.`:`Contrato base: Tope T5 <strong>${tope_t5===null?'sin tope':tope_t5+' AE'}</strong> (mes ${ant}). GI: tope 25% AE VI.`);
  const giLbl=document.getElementById('gi-tope-lbl');if(giLbl)giLbl.textContent=campana?'tope GI liberado':'tope 25% AE VI';
  const tieneVida=SIM_PRODS.some(p=>ss.qty[p.id]>0);
  const tieneGI=SIM_PRODS_GI.some(p=>ss.qtyGI[p.id]>0);
  const kpiVida=document.getElementById('kpi-vida');
  const kpiGI=document.getElementById('kpi-gi');
  if(kpiVida&&tieneVida){kpiVida.checked=true;const kpiVidaLbl=document.getElementById('kpi-vida-lbl');if(kpiVidaLbl)kpiVidaLbl.style.opacity='1';}
  if(kpiGI&&tieneGI){kpiGI.checked=true;const kpiGiLbl=document.getElementById('kpi-gi-lbl');if(kpiGiLbl)kpiGiLbl.style.opacity='1';}
  const tieneSalud=ss.qty['SS']>0;
  const kpiSaludEl=document.getElementById('kpi-salud');
  if(kpiSaludEl&&tieneSalud){kpiSaludEl.checked=true;const kpiSaludLbl=document.getElementById('kpi-salud-lbl');if(kpiSaludLbl)kpiSaludLbl.style.opacity='1';}
  // KPI campaña APV alert
  const kpiSalud=document.getElementById('kpi-salud')?.checked;
  const kpiCumple=campana&&ss.qty['APV']>0?
    (tieneVida&&tieneGI&&kpiSalud):true;
  const kpiAlert=document.getElementById('kpi-alert');
  if(kpiAlert){
    if(campana&&ss.qty['APV']>0&&!kpiCumple){
      const falta=[];
      if(!tieneVida)falta.push('Vida');
      if(!tieneGI)falta.push('Generales');
      if(!kpiSalud)falta.push('Salud XS');
      kpiAlert.innerHTML=`<div style="background:#FCEBEB;border-left:3px solid #A32D2D;color:#791F1F;padding:7px 10px;border-radius:6px;line-height:1.4">⚠ <strong>APV al 50%</strong> por incumplimiento KPI: falta <strong>${falta.join(', ')}</strong>.</div>`;
    } else if(campana&&ss.qty['APV']>0&&kpiCumple){
      kpiAlert.innerHTML=`<div style="background:#E1F5EE;border-left:3px solid #0F6E56;color:#085041;padding:7px 10px;border-radius:6px">✓ <strong>KPI completo</strong> — APV se paga al 100%</div>`;
    } else {
      kpiAlert.innerHTML='';
    }
  }

  // pct warn
  setEl('sim-pct-warn',simTotPct()!==100?`<div class="ib rd" style="font-size:11px">Total porcentajes: ${simTotPct()}%. Debe sumar 100%.</div>`:'');

  // alert
  const diff=total-ss.meta;
  const mc=total>=ss.meta?'ok':'ng';
  // Calculate meta contactos from funnel
  const metaContactos=Math.max(1,Math.round(
    SIM_METODOS.filter(m=>m.esNodo).reduce((a,m)=>{const pct=(ss.pcts[m.id]||0)/100;return a+(pct>0?Math.ceil(ventas*pct):0)},0)/4
  ));
  const metaProspectos=Math.max(1,Math.round(
    SIM_METODOS.reduce((a,m)=>{const pct=(ss.pcts[m.id]||0)/100;if(pct===0)return a;
      const prosp=m.esNodo?Math.round(ventas*pct*(m.cadena?m.cadena[1].n:5)):Math.round(ventas*pct*m.cPV);
      return a+prosp;},0)
  ));
  const alertHtml = Math.abs(diff)<30000
    ?`<div class="ib gn" style="text-align:center"><strong>Meta prácticamente alcanzada.</strong> Ingreso: ${fmt(total)} · Asesor: ${ss.asesor}</div>`
    :diff>=0?`<div class="ib gn" style="text-align:center"><strong>Meta alcanzable.</strong> Ingreso: ${fmt(total)} · Excedente: ${fmt(diff)}</div>`
    :`<div class="ib rd" style="text-align:center"><strong>Meta no alcanzada.</strong> Ingreso: ${fmt(total)} · Brecha: ${fmt(Math.abs(diff))}.</div>`;
  setEl('alert-box', alertHtml + `<div style="margin-top:10px;display:flex;justify-content:center">
    <button class="btn btn-success" onclick="guardarMetasEnTracker()">💾 Guardar metas de ${ss.asesor} en Tracker</button>
  </div>`);
  // Store for save function
  window._simMeta = {asesor:ss.asesor, meta_contactos_semana:metaContactos, meta_prospectos_mes:metaProspectos, meta_ventas_mes:ventas, meta_ingresos:Math.round(total)};

  // btn asesor & print name
  setText('btn-asesor',ss.asesor);

  // metric cards
  const t5st=zTotal>200?(t5Hab?'<span style="color:var(--teal);font-size:10px">✓ T5</span>':'<span style="color:var(--red);font-size:10px">✗ T5</span>'):'';
  setEl('metric-row',`
    <div class="smc" style="text-align:center"><div class="smc-lbl">Sueldo base</div><div class="smc-val">${fmt(SUELDO_BASE)}</div><div class="smc-sub">Mín. legal $539.000</div></div>
    <div class="smc" style="text-align:center"><div class="smc-lbl">Bono producción AE</div><div class="smc-val">${fmt(bonoNeto)}</div><div class="smc-sub">${zTotal.toFixed(1)}AE → ${fmtUF(bUF)} × ${Math.round(fp*100)}% ${t5st}</div></div>
    <div class="smc ${mc} smc-ingreso" style="text-align:center"><div class="smc-lbl">* Ingreso Bruto Aproximado Total</div><div class="smc-val">${fmt(total)}</div><div class="smc-sub">UF: ${fmt(UF_VAL)} · AE VI+GI: ${zTotal.toFixed(1)}</div></div>
`);
  
  // mix table title
  const mct=document.getElementById('mix-card-title');
  if(mct)mct.textContent=campana?'Desglose del mix — Campaña Complemento Producción Emitida (reemplaza contrato)':'Desglose del mix de productos — Contrato original';
  // mix table
  const mb=document.getElementById('mix-tbody');
  if(mb){mb.innerHTML=det.length===0?'<tr><td colspan="7" style="text-align:center;color:var(--g400);padding:12px">Agrega pólizas al mix.</td></tr>'
    :det.map(d=>{const nb=d.nota?`<span class="pill ${d.nota.includes('campaña')?'pill-gn':'pill-am'}">${d.nota}</span>`:'';
    return`<tr><td>${d.p.n}</td><td>${d.qty}</td><td>${(d.zTotal&&d.ppaUF?d.zTotal/d.ppaUF*100:0).toFixed(0)}%</td><td>${d.ppaUF.toFixed(2)}</td><td>${d.zTotal.toFixed(1)}</td><td>${nb}</td></tr>`}).join('');}
  setEl('mix-tfoot',`<tr><td>Total VI</td><td>${ventas}</td><td>—</td><td>—</td><td>${zVI.toFixed(1)} AE</td><td></td></tr>
    <tr><td colspan="4" style="font-size:11px;color:var(--g400)">+ AE GI: ${zGI.toFixed(1)} ${zGITopado?'(topado)':''} → AE Total: <strong>${zTotal.toFixed(1)}</strong></td><td colspan="3"></td></tr>`);
  // campaign comparison table
  const campWrap=document.getElementById('mix-camp-wrap');
  if(campWrap) campWrap.style.display=campana?'block':'none';
  if(campana){
    const campRows=SIM_PRODS.filter(p=>simState.qty[p.id]>0).map(p=>{
      const qty=simState.qty[p.id],cp=CAMP_PRODS[p.id];
      const ppaUF=simState.prima[p.id]*12; // prima stored in UF, PPA = prima × 12
      const tZ=cp?.tope?`${cp.tope} AE/pól.`:'Sin tope';
      const nota=cp?.capUF?`Solo sobre UF${cp.capUF}`:'';
      const zF=cp?cp.z:p.z;
      const baseUF=cp?.capUF?Math.min(ppaUF,cp.capUF*qty):ppaUF;
      const zCamp=Math.min(baseUF*zF,(cp?.tope||9999)*qty);
      return`<tr><td>${p.n}</td><td>${qty}</td><td>${(zF*100).toFixed(0)}%</td><td>${ppaUF.toFixed(2)}</td><td>${zCamp.toFixed(1)}</td><td>${tZ}</td><td>${nota?`<span class="pill pill-am">${nota}</span>`:''}</td></tr>`;
    }).join('');
    const ctb=document.getElementById('mix-camp-tbody');
    if(ctb)ctb.innerHTML=campRows||'<tr><td colspan="7" style="color:var(--g400);padding:10px">Sin pólizas en el mix.</td></tr>';
  }

  // tramos
  const tb=document.getElementById('tramos-tbody');
  if(tb)tb.innerHTML=trDet.map(t=>{const a=t.ap>0;return`<tr><td${a?'':' style="color:var(--g400)"'}>${t.lbl}</td><td${a?'':' style="color:var(--g400)"'}>${a?t.ap.toFixed(1):'—'}</td><td${a?'':' style="color:var(--g400)"'}>${Math.round(t.pct*100)}%</td><td${a?'':' style="color:var(--g400)"'}>${a?t.uf.toFixed(2):'—'}</td><td${a?'':' style="color:var(--g400)"'}>${a?fmt(t.uf*UF_VAL):'—'}</td></tr>`}).join('');
  setEl('tramos-tfoot',`<tr><td colspan="3">Bono bruto</td><td>${bUF.toFixed(2)} UF</td><td>${fmt(bUF*UF_VAL)}</td></tr><tr><td colspan="3">× Persistencia (${Math.round(fp*100)}%)</td><td>${(bUF*fp).toFixed(2)} UF</td><td><strong>${fmt(bonoNeto)}</strong></td></tr>`);
  // Consolidado ingreso
  const gi_lbl=zGITopado?`GI ${zGIBruto.toFixed(1)} → topado 25% = ${zGI.toFixed(1)}`:`GI: ${zGI.toFixed(1)}`;
  const consolRows=[
    `<tr><td>Sueldo base</td><td>Fijo mensual</td><td><strong>${fmt(SUELDO_BASE)}</strong></td></tr>`,
    `<tr><td>Bono producción AE</td><td>${zVI.toFixed(1)} VI + ${zGI.toFixed(1)} GI = ${zTotal.toFixed(1)} AE</td><td><strong>${fmt(bonoNeto)}</strong></td></tr>`,
    bonoApe>0?`<tr><td>Bono Top 20 APE</td><td>Ranking #${ss.rankApe}</td><td><strong>${fmt(bonoApe)}</strong></td></tr>`:'',
    bonoCv>0?`<tr><td>Bono Top 20 Crecim.</td><td>Ranking #${ss.rankCv}</td><td><strong>${fmt(bonoCv)}</strong></td></tr>`:'',
    // gratificación legal removida del simulador general
    `<tr style="background:var(--teal-lt,#E1F5EE)"><td colspan="2"><strong>INGRESO BRUTO MENSUAL ESTIMADO</strong></td><td><strong style="color:var(--teal,#0F6E56);font-size:14px">${fmt(total)}</strong></td></tr>`
  ].join('');
  setEl('consolidado-tbody',consolRows);
  setEl('disclaimer-txt',`* Esta simulación es una <strong>referencia de gestión</strong>, no una liquidación exacta. Su propósito es estimar el número de contactos y volumen de producción necesarios para alcanzar una meta de ingresos. El resultado real dependerá del mix definitivo de productos, primas cobradas y persistencia mensual. UF = $${Math.round(UF_VAL).toLocaleString('es-CL')} · Sueldo mínimo $539.000 (Ley 21.751) · Tope T5: ${tope_t5===null?'sin tope':tope_t5+' AE'} (mes ${ant}).`);

  // funnel
  simRenderFunnel(ventas);
setEl('metric-contacts',`<div style="display:flex;justify-content:center;margin-top:14px;margin-bottom:4px">
    <div style="position:relative;display:inline-flex;flex-direction:column;background:#fcffe0;border:1.5px solid var(--lime-dk);border-radius:var(--rl);padding:14px 18px;box-shadow:0 0 0 3px rgba(203,241,53,0.22),0 1px 2px rgba(0,0,0,0.04);min-width:340px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
          <circle cx="12" cy="12" r="9" stroke="#4a6600" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="5" stroke="#4a6600" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="1.5" fill="#4a6600"/>
        </svg>
        <div style="font-size:10.5px;font-weight:700;color:#4a6600;letter-spacing:.09em;text-transform:uppercase;line-height:1.2">Contactos necesarios para tu meta</div>
      </div>
      <div style="display:flex;gap:10px">
        <div style="background:white;border:2px solid var(--lime-dk);border-radius:var(--r);padding:8px 14px;text-align:center;min-width:122px;box-shadow:0 1px 2px rgba(168,204,26,.08)">
          <div style="font-family:var(--mono);font-size:42px;font-weight:800;line-height:1;color:#3a4f00;letter-spacing:-0.03em">${simState.totC||0}</div>
          <div style="font-size:10px;color:var(--g600);margin-top:4px;letter-spacing:.03em;font-weight:500">por mes</div>
        </div>
        <div style="background:white;border:1.5px solid var(--lime-dk);border-radius:var(--r);padding:8px 14px;text-align:center;min-width:122px;box-shadow:0 1px 2px rgba(168,204,26,.08)">
          <div style="font-family:var(--mono);font-size:30px;font-weight:600;line-height:1;color:var(--g900);letter-spacing:-0.03em">${Math.ceil((simState.totC||0)/4)}</div>
          <div style="font-size:10px;color:var(--g600);margin-top:4px;letter-spacing:.03em;font-weight:500">esta semana</div>
        </div>
      </div>
      <div title="Activar plan" style="position:absolute;bottom:-14px;right:-14px;width:56px;height:56px;border-radius:50%;background:var(--lime);border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 6px 16px rgba(168,204,26,.36),0 1px 3px rgba(0,0,0,.08);line-height:1;cursor:pointer">🚀</div>
    </div>
  </div>`);
}

function simRenderFunnel(ventas){
  const fc=document.getElementById('funnel-content');if(!fc)return;
  const tot=simTotPct();
  if(tot===0||ventas===0){fc.innerHTML='<div class="ib am">Asigna porcentajes a al menos un método y define el mix de productos.</div>';return}
  const activos=SIM_METODOS.map(m=>{
    const pct=(simState.pcts[m.id]||0)/100;if(pct===0)return null;
    const vM=ventas*pct;
    const prospectos=m.esNodo?Math.ceil(vM)*5:Math.round(vM*m.cPV);
    const contactos=m.esNodo?Math.ceil(vM):0;
    return{...m,pct,vM,contactos,prospectos};
  }).filter(Boolean);
  const totC=activos.filter(m=>m.esNodo).reduce((a,m)=>a+m.contactos,0);
  simState.totC=totC;
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
}

