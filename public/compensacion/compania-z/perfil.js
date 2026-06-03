/* ═══════════════════════════════════════════════════════
   COMPAÑÍA Z — BLOQUE 1: PERFIL DEL ASESOR
   buildSimulador(): selector de asesor, antigüedad, persistencia,
   meta de ingresos, bonos y parámetros de APV/RP
   Dependencia: datos.js cargado antes
═══════════════════════════════════════════════════════ */
/* ══ SIMULADOR ══ */
function buildSimulador(){
  const left=document.getElementById('sim-left');
  if(!left)return;
  left.innerHTML=`
    <div class="stitle">Selección de asesor</div>
    <div class="fg"><div class="flbl">Asesor a simular</div><select class="fsel" id="asesor-sel"></select></div>
    <div class="fg"><div class="flbl">Antigüedad del asesor <span id="lbl-ant">3 meses</span></div><input type="range" id="sl-ant" min="1" max="120" step="1" value="3"></div>
    <div class="fg"><div class="flbl">Meta de ingreso mensual <span id="lbl-meta">${fmt(2000000)}</span></div><input type="range" id="sl-meta" min="500000" max="8000000" step="50000" value="2000000"></div>
    <div class="fg"><div class="flbl">Persistencia real estimada <span id="lbl-persist">92%</span></div><input type="range" id="sl-persist" min="0" max="120" step="1" value="92"></div>
    <div id="persist-info" class="ib bl" style="font-size:11px"></div>
    <div class="stitle">Modo de contrato</div>
    <div class="toggle-row"><div class="toggle-lbl"><strong>Activar campaña 2026</strong><br><span style="font-size:11px;color:var(--g400)">APV 100% AE · topes ampliados</span></div>
    <label class="toggle-sw"><input type="checkbox" id="campana-toggle" checked><span class="toggle-sl"></span></label></div>
    <div id="campana-info" class="ib bl" style="font-size:11px"></div>
    <div class="stitle">Mix de productos mensual</div>
    <div class="ib am" style="font-size:11px"><strong>Número de pólizas por tipo en un mes típico.</strong></div>
    <div id="sim-mix-grid"></div>
    <div class="stitle">Prima mensual promedio por producto (Vida)</div>
    <div id="sim-prima-inputs"></div>
    <div class="stitle">Mix Generales (GI)</div>
    <div style="font-size:11px;color:var(--g400);margin-bottom:8px">Auto: 50% AE · Hogar: 100% AE. Se suman con tope del 25% del AE Vida.</div>
    <div id="sim-gi-grid"></div>
    <div id="sim-gi-primas"></div>
    <div class="stitle">Aportes y traspasos (AE cartera)</div>
    <div class="fg"><div class="flbl">APV — Aporte extraordinario (UF) <span style="font-size:10px;font-weight:400;color:var(--g400)">· PPA: 10% · AE: 50% (o 100% campaña)</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <input type="number" id="sl-apvex" step="0.1" min="0" max="99999" value="0"
        style="width:100px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center" placeholder="UF">
      <span style="font-size:11px;color:var(--g400)">UF · <span id="lbl-apvex-uf" style="font-family:var(--mono);color:var(--amber)">PPA: 0 UF · 0 AE</span></span>
    </div></div>
    <div class="fg"><div class="flbl">APV AE Flexible — Traspaso cartera (UF) <span style="font-size:10px;font-weight:400;color:var(--g400)">· PPA: 10% del monto · AE: 25%</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <input type="number" id="sl-apvflexex" step="0.1" min="0" max="99999" value="0"
        style="width:100px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center" placeholder="UF">
      <span style="font-size:11px;color:var(--g400)">UF · <span id="lbl-apvflexex" style="font-family:var(--mono);color:var(--amber)">PPA: 0 UF · 0 AE</span></span>
    </div></div>
    <div class="fg"><div class="flbl">Renta Preferente — Aporte extraordinario (UF) <span style="font-size:10px;font-weight:400;color:var(--g400)">· AE: 5% del monto</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <input type="number" id="sl-rp" step="0.1" min="0" max="99999" value="0"
        style="width:100px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center" placeholder="UF">
      <span style="font-size:11px;color:var(--g400)">UF · <span id="lbl-rp" style="font-family:var(--mono);color:var(--amber)">0 AE</span></span>
    </div></div>
    <div class="stitle" style="color:#BA7517">KPI Campaña APV 100% <span style="font-size:10px;font-weight:400;color:var(--g400)">— requiere los 3</span></div>
    <div style="background:#FAEEDA;border:1.5px solid #BA7517;border-radius:var(--r);padding:10px 12px;margin-bottom:8px">
      <div style="font-size:11px;color:#633806;margin-bottom:8px;line-height:1.4">Para pago al <strong>100%</strong>: debe cumplir <strong>los 3 KPI</strong>. Si falla uno → APV se paga al <strong>50%</strong> (contrato base).</div>
      <label style="display:flex;align-items:center;gap:7px;font-size:11px;margin-bottom:6px;cursor:pointer;padding:5px;border-radius:6px;background:white" id="kpi-vida-lbl">
        <input type="checkbox" id="kpi-vida" style="accent-color:#BA7517;width:14px;height:14px">
        <div><div style="font-weight:500">Póliza Vida</div><div style="font-size:10px;color:var(--g400)">Vida Empresarial, Vida Mujer, Seguro Temporal u otro producto Vida</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:7px;font-size:11px;margin-bottom:6px;cursor:pointer;padding:5px;border-radius:6px;background:white" id="kpi-gi-lbl">
        <input type="checkbox" id="kpi-gi" style="accent-color:#BA7517;width:14px;height:14px">
        <div><div style="font-weight:500">Póliza Generales</div><div style="font-size:10px;color:var(--g400)">Auto, Hogar u otro producto GI</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;padding:5px;border-radius:6px;background:white" id="kpi-salud-lbl">
        <input type="checkbox" id="kpi-salud" style="accent-color:#BA7517;width:14px;height:14px">
        <div><div style="font-weight:500">Póliza Salud XS</div><div style="font-size:10px;color:var(--g400)">Protección Light / Oncológico</div></div>
      </label>
    </div>
    <div id="kpi-alert" style="font-size:11px;margin-bottom:10px"></div>

    <div class="stitle" style="color:#5B36AB">Tramo 5 — Requisitos (AE &gt; 200)</div>
    <div style="background:white;border:1.5px solid #5B36AB;border-radius:var(--r);padding:10px 12px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;color:#5B36AB;margin-bottom:6px">Cumple al menos 1 de 5 + persistencia ≥ 85%</div>
      <label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer"><input type="checkbox" id="t5-r1" style="accent-color:#5B36AB"> Prima Básica ≥ UF 55</label>
      <label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer"><input type="checkbox" id="t5-r2" style="accent-color:#5B36AB"> Capital fallecimiento ≥ UF 6.000</label>
      <label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer"><input type="checkbox" id="t5-r3" style="accent-color:#5B36AB"> APE emitido ≥ UF 300</label>
      <label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer"><input type="checkbox" id="t5-r4" style="accent-color:#5B36AB"> 4 pólizas vida (o 3)</label>
      <label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer"><input type="checkbox" id="t5-r5" style="accent-color:#5B36AB"> 3 pólizas vida + 3 generales</label>
    </div>
    <div class="stitle">Bonos adicionales</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      <div style="background:white;border:1px solid var(--g200);border-radius:var(--r);padding:8px 10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:12px;font-weight:500">🏅 Bono Top 20 APE</div><div style="font-size:10px;color:var(--g400)">Premio UF 1-23 según ranking</div></div>
          <input type="checkbox" id="ck-top20ape" style="width:16px;height:16px;cursor:pointer">
        </div>
        <div id="top20ape-dd" style="display:none;margin-top:8px">
          <div class="flbl">Posición: <span id="lbl-rank-ape">#10 — 4 UF</span></div>
          <input type="range" id="sl-rank-ape" min="1" max="20" value="10">
        </div>
      </div>
      <div style="background:white;border:1px solid var(--g200);border-radius:var(--r);padding:8px 10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:12px;font-weight:500">📈 Bono Top 20 Crecim.</div><div style="font-size:10px;color:var(--g400)">Premio UF 1-11 según ranking</div></div>
          <input type="checkbox" id="ck-top20cv" style="width:16px;height:16px;cursor:pointer">
        </div>
        <div id="top20cv-dd" style="display:none;margin-top:8px">
          <div class="flbl">Posición: <span id="lbl-rank-cv">#10 — 2 UF</span></div>
          <input type="range" id="sl-rank-cv" min="1" max="20" value="10">
        </div>
      </div>
      <div style="background:white;border:1px solid var(--g200);border-radius:var(--r);padding:8px 10px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:12px;font-weight:500">💼 Gratificación legal</div><div style="font-size:10px;color:var(--g400)">Art. 50 CT · 25% IMM mensual</div></div>
        <input type="checkbox" id="ck-grati" checked style="width:16px;height:16px;cursor:pointer">
      </div>
    </div>
    <div class="stitle">Prospectos Referidos por Contactos / Nodos Referidores</div>
    <div class="ib am" style="font-size:11px"><strong>Define el % de prospectos por método</strong> (pasos de 5%). Meta: ≥80% Contactos/Nodos Referidores.</div>
    <div id="sim-metodos-grid"></div>
    <div id="sim-pct-warn"></div>`;

  // Asesor select
  const asel=document.getElementById('asesor-sel');
  ASESORES.forEach((a,i)=>{const o=document.createElement('option');o.value=a;o.textContent=a;if(i===0)o.selected=true;asel.appendChild(o)});
  asel.addEventListener('change',e=>{simState.asesor=e.target.value;const ba=document.getElementById('btn-asesor');if(ba)ba.textContent=simState.asesor;simRender()});

  // Sliders base
  [['sl-meta','lbl-meta',v=>{simState.meta=+v;return fmt(+v)}],
   ['sl-ant','lbl-ant',v=>{simState.ant=+v;simBuildGI();simBuildPrimasGI();return +v+' mes'+(+v===1?'':'es')}],
   ['sl-persist','lbl-persist',v=>{simState.persist=+v;return +v+'%'}],
   ['sl-rp','lbl-rp',v=>{const ufV=parseFloat(v)||0;simState.rpMonto=ufV;return `${(ufV*0.05).toFixed(2)} AE`}],
   ['sl-apvex','lbl-apvex-uf',v=>{const ufV=parseFloat(v)||0;simState.apvEx=ufV;const ppa=(ufV*0.10).toFixed(2);const z=(parseFloat(ppa)*0.5).toFixed(2);return `PPA: ${ppa} UF · ${z} AE`}],
   ['sl-apvflexex','lbl-apvflexex',v=>{const ufV=parseFloat(v)||0;simState.apvFlexEx=ufV;const ppa=(ufV*0.10);return `PPA: ${ppa.toFixed(2)} UF · ${(ppa*0.25).toFixed(2)} AE`}],
  ].forEach(([id,lbl,fn])=>{const el=document.getElementById(id);if(el)el.addEventListener('input',e=>{const l=document.getElementById(lbl);if(l)l.textContent=fn(e.target.value);simRender()})});
  document.getElementById('campana-toggle').addEventListener('change',simRender);

  // T5 checkboxes
  ['r1','r2','r3','r4','r5'].forEach(k=>{
    const cb=document.getElementById('t5-'+k);
    if(cb)cb.addEventListener('change',e=>{simState.t5[k]=e.target.checked;simRender()});
  });
  // KPI campaña checkboxes
  ['kpi-vida','kpi-gi','kpi-salud'].forEach(id=>{
    const cb=document.getElementById(id);
    if(cb)cb.addEventListener('change',()=>simRender());
  });

  // Bonos opcionales
  ['top20ape','top20cv','grati'].forEach(b=>{
    const cb=document.getElementById('ck-'+b);
    if(cb){cb.checked=simState.bonos[b];cb.addEventListener('change',e=>{simState.bonos[b]=e.target.checked;const dd=document.getElementById(b+'-dd');if(dd)dd.style.display=e.target.checked?'block':'none';simRender()});}
  });
  const sra=document.getElementById('sl-rank-ape');
  if(sra)sra.addEventListener('input',e=>{simState.rankApe=+e.target.value;document.getElementById('lbl-rank-ape').textContent='#'+e.target.value+' — '+TOP20_APE_UF[+e.target.value-1]+' UF';simRender()});
  const src=document.getElementById('sl-rank-cv');
  if(src)src.addEventListener('input',e=>{simState.rankCv=+e.target.value;document.getElementById('lbl-rank-cv').textContent='#'+e.target.value+' — '+TOP20_CV_UF[+e.target.value-1]+' UF';simRender()});

  buildSimMetodos();buildSimMix();buildSimPrimas();simBuildGI();simBuildPrimasGI();simRender();
}

