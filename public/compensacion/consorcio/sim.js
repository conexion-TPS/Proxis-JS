/* ═══════════════════════════════════════════════════════════════════════
   CONSORCIO — MÓDULO UI DEL SIMULADOR (tenant 'consorcio')
   Calca el patrón de compania-z (perfil.js + renta.js) SIN tocar su código.
   Toda la lógica numérica viene de window.MotorConsorcio.computeConsorcio.
   Reglas duras: NO toca CSS, NO reescribe DOM fuera de sus slots, NO omite
   slots (los que no aplican se ocultan con display:none, no se eliminan).
   Llena los slots fijos de #sim-right con setEl(), igual que renta.js.
═══════════════════════════════════════════════════════════════════════ */
'use strict'
;(function (root) {

  // Estado propio de Consorcio. NO usa el simState de Zurich.
  const csState = {
    asesor: '',
    pcts: { ref1: 40, ref2: 40, ref3: 0, ref4: 0, dig: 10, frio: 10 },
  };

  // Helpers locales (mismo patrón que simRender() en renta.js).
  const $      = id => document.getElementById(id);
  const setEl  = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const numv   = (id, d) => { const el = $(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? (d || 0) : v; };
  const fmtCLP = n => (typeof fmt === 'function') ? fmt(n) : ('$' + Math.round(n || 0).toLocaleString('es-CL'));
  const UF     = () => (typeof UF_VAL !== 'undefined' ? UF_VAL : 39500);
  const metodos = () => (root.SIM_METODOS || (root.NucleoEmbudo && root.NucleoEmbudo.SIM_METODOS) || []);

  // Tarjeta "Contactos necesarios" — misma estructura/estilo que renta.js de Zurich,
  // alimentada con el totC que devuelve el embudo del núcleo.
  function contactsCard(totC) {
    return `<div style="display:flex;justify-content:center;margin-top:14px;margin-bottom:4px">
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
            <div style="font-family:var(--mono);font-size:42px;font-weight:800;line-height:1;color:#3a4f00;letter-spacing:-0.03em">${totC || 0}</div>
            <div style="font-size:10px;color:var(--g600);margin-top:4px;letter-spacing:.03em;font-weight:500">por mes</div>
          </div>
          <div style="background:white;border:1.5px solid var(--lime-dk);border-radius:var(--r);padding:8px 14px;text-align:center;min-width:122px;box-shadow:0 1px 2px rgba(168,204,26,.08)">
            <div style="font-family:var(--mono);font-size:30px;font-weight:600;line-height:1;color:var(--g900);letter-spacing:-0.03em">${Math.ceil((totC || 0) / 4)}</div>
            <div style="font-size:10px;color:var(--g600);margin-top:4px;letter-spacing:.03em;font-weight:500">esta semana</div>
          </div>
        </div>
        <div title="Activar plan" style="position:absolute;bottom:-14px;right:-14px;width:56px;height:56px;border-radius:50%;background:var(--lime);border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 6px 16px rgba(168,204,26,.36),0 1px 3px rgba(0,0,0,.08);line-height:1;cursor:pointer">🚀</div>
      </div>
    </div>`;
  }

  /* ═══════════════ RENDER ═══════════════
     Lee #sim-left → llama al motor → distribuye en los slots fijos de #sim-right. */
  function renderConsorcio() {
    if (!root.MotorConsorcio) return;
    const uf = UF();

    // ── 1) Leer inputs del #sim-left ──
    const antiguedad = Math.round(numv('cs-ant', 1));
    const cartera    = numv('cs-cartera', 0);            // % cartera vigente
    const meta       = numv('cs-meta', 0);
    const cnsVida    = numv('cs-cns', 0);
    const nPolizas   = Math.max(0, Math.round(numv('cs-polizas', 0)));
    const promTrim   = numv('cs-promtrim', 0);
    const multiproducto = [
      { prod: 'PVX_B_CP',       n: Math.round(numv('cs-mp-cp', 0)) },   // Cuentas Plus (fijo CLP × n)
      { prod: 'PVX_B_CM',       n: Math.round(numv('cs-mp-cm', 0)) },   // Cuentas Más  (fijo CLP × n)
      { prod: 'PVX_B_CO',       montoUF: numv('cs-mp-co', 0) },         // Consumo      (tasa UF)
      { prod: 'PVX_B_HI',       montoUF: numv('cs-mp-hi', 0) },         // Hipotecario  (tasa UF)
      { prod: 'PVX_G_AU_anual', montoUF: numv('cs-mp-aua', 0) },        // Auto anual   (tasa UF)
      { prod: 'PVX_G_HO',       montoUF: numv('cs-mp-ho', 0) },         // Hogar        (tasa UF)
    ];
    const inversiones = [
      { prod: 'PVX_I05', montoUF: numv('cs-inv-gold', 0) },            // Gold
      { prod: 'PVX_I01', montoUF: numv('cs-inv-exp', 0) },             // APV Experto
      { prod: 'PVX_I06', montoUF: numv('cs-inv-ffmm', 0) },            // FFMM Serie P
    ];
    const saludUfaMensual = numv('cs-salud-ufa', 0) / 12;

    // Históricos en default 0 (ejecutivos nuevos) — no aparecen aún en #sim-left.
    const scn = {
      antiguedad, carteraVigente: cartera, cnsVida, promTrimCns: promTrim,
      multiproducto, inversiones, saludUfaMensual, saludVigencia: 0,
      recaudPolizas: [], cnsAjustadosTrim: 0, aumSaldos: {},
    };

    // ── 2) Motor (única fuente de verdad numérica) ──
    const R = root.MotorConsorcio.computeConsorcio(scn, uf);
    const c = R.comps;
    const money = o => (o.clp || 0) + (o.uf || 0) * uf;          // un componente → CLP

    const bonos = [
      { k: 'Comisión Vida',        det: `CNS ajustados ${Math.round(c.comVida.cnsAjustados).toLocaleString('es-CL')}`,            m: money(c.comVida) },
      { k: 'Bono Excelencia',      det: R.factorRet >= 7 ? `Factor ${R.factorRet} · trimestre ajustado` : 'Requiere factor ≥ 7', m: money(c.bonoExc) },
      { k: 'Comisión Inversiones', det: `${c.comInv.uf.toFixed(2)} UF`,                                                           m: money(c.comInv) },
      { k: 'Bono Multiproducto',   det: `Amplificador ${c.bonoMulti.amplificador.toFixed(1)}×`,                                   m: money(c.bonoMulti) },
      { k: 'Bono Salud',           det: c.bonoSalud.uf > 0 ? `${c.bonoSalud.uf.toFixed(2)} UF` : 'Sin producción salud',          m: money(c.bonoSalud) },
      { k: 'Bono Recaudación',     det: c.bonoRecaud.clp > 0 ? `Ponderadas ${c.bonoRecaud.ponderadas}` : 'Sin cartera histórica', m: money(c.bonoRecaud) },
      { k: 'Bono AUM',             det: c.bonoAUM.uf > 0 ? `${c.bonoAUM.uf.toFixed(2)} UF` : 'Sin saldos AUM',                     m: money(c.bonoAUM) },
    ];
    const ingresoVariable = bonos.reduce((a, b) => a + b.m, 0);
    const total           = R.ingresoTotal;
    const baseGratif      = total - Math.round(ingresoVariable);    // base + gratificación (la base la fija el motor)
    const asesor          = csState.asesor || (($('cs-asesor') && $('cs-asesor').value) || 'Asesor');

    // ── 3) Distribuir en los slots fijos de #sim-right ──

    // 3a) #metric-row — Factor de Persistencia · CNS Vida ajustados · Ingreso Bruto
    setEl('metric-row', `
      <div class="smc"><div class="smc-lbl">Factor de Persistencia</div><div class="smc-val">${R.factorRet}</div><div class="smc-sub">Cartera ${cartera}% · ${antiguedad} mes${antiguedad === 1 ? '' : 'es'}</div></div>
      <div class="smc"><div class="smc-lbl">CNS Vida ajustados</div><div class="smc-val">${Math.round(c.comVida.cnsAjustados).toLocaleString('es-CL')}</div><div class="smc-sub">CNS ${cnsVida.toLocaleString('es-CL')} × factor ${R.factorRet}</div></div>
      <div class="smc ${total >= meta ? 'ok' : 'ng'} ok"><div class="smc-lbl">* Ingreso Bruto Aproximado</div><div class="smc-val">${fmtCLP(total)}</div><div class="smc-sub">UF: ${fmtCLP(uf)} · Variable: ${fmtCLP(ingresoVariable)}</div></div>
    `);

    // 3b) #alert-box — estado de meta + botón Guardar (reusa la función global de la plataforma)
    const diff = total - meta;
    const alertHtml = Math.abs(diff) < 30000
      ? `<div class="ib gn" style="text-align:center"><strong>Meta prácticamente alcanzada.</strong> Ingreso: ${fmtCLP(total)} · Asesor: ${asesor}</div>`
      : diff >= 0
        ? `<div class="ib gn" style="text-align:center"><strong>Meta alcanzable.</strong> Ingreso: ${fmtCLP(total)} · Excedente: ${fmtCLP(diff)}</div>`
        : `<div class="ib rd" style="text-align:center"><strong>Meta no alcanzada.</strong> Ingreso: ${fmtCLP(total)} · Brecha: ${fmtCLP(Math.abs(diff))}.</div>`;
    setEl('alert-box', alertHtml + `<div style="margin-top:10px;display:flex;justify-content:center">
      <button class="btn btn-success" onclick="guardarMetasEnTracker()">💾 Guardar metas de ${asesor} en Tracker</button>
    </div>`);
    root._simMeta = { asesor, meta_ventas_mes: nPolizas, meta_ingresos: Math.round(total) };

    // 3c) #funnel-content — embudo del núcleo, ventas = nº pólizas de vida, % de Consorcio
    const fr = (typeof root.simRenderFunnel === 'function') ? root.simRenderFunnel(nPolizas, csState.pcts) : { totC: 0, totP: 0 };
    const totC = (fr && fr.totC) || 0;

    // 3d) #metric-contacts — misma tarjeta lima, con el totC de Consorcio
    setEl('metric-contacts', contactsCard(totC));

    // 3e) #consolidado-tbody — 7 bonos → subtotal Ingreso Variable → Base+Gratif → Total
    const consolRows = bonos.map(b =>
      `<tr><td>${b.k}</td><td>${b.det}</td><td><strong>${fmtCLP(b.m)}</strong></td></tr>`
    ).join('')
      + `<tr style="background:var(--g50,#f7f7f5)"><td><strong>Ingreso Variable</strong></td><td>Suma de los 7 componentes</td><td><strong>${fmtCLP(ingresoVariable)}</strong></td></tr>`
      + `<tr><td>Base + Gratificación</td><td>Fijo mensual</td><td><strong>${fmtCLP(baseGratif)}</strong></td></tr>`
      + `<tr style="background:var(--teal-lt,#E1F5EE)"><td colspan="2"><strong>INGRESO BRUTO MENSUAL ESTIMADO</strong></td><td><strong style="color:var(--teal,#0F6E56);font-size:14px">${fmtCLP(total)}</strong></td></tr>`;
    setEl('consolidado-tbody', consolRows);

    // 3f) #disclaimer-txt — slot compartido, lo llenamos (no se omite)
    setEl('disclaimer-txt', `* Esta simulación es una <strong>referencia de gestión</strong>, no una liquidación exacta. Estima la producción y el número de contactos necesarios para alcanzar una meta de ingresos. El resultado real depende de la producción CNS, la persistencia de cartera y la antigüedad. UF = $${Math.round(uf).toLocaleString('es-CL')}.`);
  }

  /* ═══════════════ PANEL #sim-left ═══════════════ */
  function csChPct(id, delta) {
    const tot = Object.values(csState.pcts).reduce((a, b) => a + b, 0);
    let nuevo = Math.max(0, Math.min(100, (csState.pcts[id] || 0) + delta));
    if (delta > 0 && tot + delta > 100) nuevo = (csState.pcts[id] || 0) + (100 - tot);
    nuevo = Math.round(nuevo / 5) * 5;
    csState.pcts[id] = nuevo;
    const n = $('cspct-' + id); if (n) n.textContent = nuevo + '%';
    renderConsorcio();
  }

  function csBuildMetodos() {
    const g = $('cs-metodos-grid'); if (!g) return; g.innerHTML = '';
    metodos().forEach(m => {
      const pct = csState.pcts[m.id] || 0;
      const row = document.createElement('div');
      row.className = 'metodo-row' + (pct > 0 ? ' active' : '') + (m.esNodo ? '' : ' metodo-sin');
      row.innerHTML = `
        <div class="metodo-top">
          <div class="metodo-info">
            <div class="metodo-name">${m.nombre} <span class="metodo-tasa">${m.tasa}</span></div>
            <div class="metodo-sub">${m.desc}</div>
          </div>
          <div class="mpct-wrap"><button onclick="csChPct('${m.id}',-5)">−</button><div class="mpct-num" id="cspct-${m.id}">${pct}%</div><button onclick="csChPct('${m.id}',5)">+</button></div>
        </div>`;
      g.appendChild(row);
    });
  }

  const numInput = (id, val, max, unit) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <input type="number" id="${id}" step="0.1" min="0" max="${max}" value="${val}"
        style="width:100px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center" placeholder="${unit}">
      <span style="font-size:11px;color:var(--g400)">${unit}</span>
    </div>`;

  function initConsorcio() {
    const left = $('sim-left'); if (!left) return;

    // Slots que el modelo Consorcio no usa → ocultar (NO eliminar), por el invariante.
    ['card-mix', 'card-tramos'].forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });

    left.innerHTML = `
      <div class="stitle">Selección de asesor</div>
      <div class="fg"><div class="flbl">Asesor a simular</div><input type="text" class="fsel" id="cs-asesor" value="${csState.asesor || ''}" placeholder="Nombre del asesor" style="width:100%"></div>
      <div class="fg"><div class="flbl">Antigüedad del asesor <span id="cs-lbl-ant">1 mes</span></div><input type="range" id="cs-ant" min="1" max="120" step="1" value="1"></div>
      <div class="fg"><div class="flbl">% Cartera vigente <span id="cs-lbl-cartera">90%</span></div><input type="range" id="cs-cartera" min="0" max="100" step="1" value="90"></div>
      <div class="fg"><div class="flbl">Meta de ingreso mensual <span id="cs-lbl-meta">${fmtCLP(1500000)}</span></div><input type="range" id="cs-meta" min="500000" max="8000000" step="50000" value="1500000"></div>

      <div class="stitle">Venta Vida</div>
      <div class="fg"><div class="flbl">CNS Vida del mes</div>${numInput('cs-cns', 0, 999999, 'CNS')}</div>
      <div class="fg"><div class="flbl">Nº de pólizas de vida <span style="font-size:10px;font-weight:400;color:var(--g400)">· alimenta el embudo</span></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <input type="number" id="cs-polizas" step="1" min="0" max="200" value="0"
            style="width:100px;padding:5px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center" placeholder="pólizas">
          <span style="font-size:11px;color:var(--g400)">pólizas/mes</span>
        </div></div>
      <div class="fg"><div class="flbl">Promedio trimestral CNS <span style="font-size:10px;font-weight:400;color:var(--g400)">· Bono Excelencia</span></div>${numInput('cs-promtrim', 0, 999999, 'CNS')}</div>

      <div class="stitle">Multiproducto</div>
      <div class="fg"><div class="flbl">Cuentas Plus (Nº)</div>${numInput('cs-mp-cp', 0, 999, 'Nº')}</div>
      <div class="fg"><div class="flbl">Cuentas Más (Nº)</div>${numInput('cs-mp-cm', 0, 999, 'Nº')}</div>
      <div class="fg"><div class="flbl">Auto anual (UF)</div>${numInput('cs-mp-aua', 0, 99999, 'UF')}</div>
      <div class="fg"><div class="flbl">Hogar (UF)</div>${numInput('cs-mp-ho', 0, 99999, 'UF')}</div>
      <div class="fg"><div class="flbl">Consumo (UF)</div>${numInput('cs-mp-co', 0, 99999, 'UF')}</div>
      <div class="fg"><div class="flbl">Hipotecario (UF)</div>${numInput('cs-mp-hi', 0, 99999, 'UF')}</div>

      <div class="stitle">Inversiones (UF)</div>
      <div class="fg"><div class="flbl">Gold</div>${numInput('cs-inv-gold', 0, 99999, 'UF')}</div>
      <div class="fg"><div class="flbl">APV Experto</div>${numInput('cs-inv-exp', 0, 99999, 'UF')}</div>
      <div class="fg"><div class="flbl">FFMM Serie P</div>${numInput('cs-inv-ffmm', 0, 99999, 'UF')}</div>

      <div class="stitle">Salud</div>
      <div class="fg"><div class="flbl">UFA anual</div>${numInput('cs-salud-ufa', 0, 99999, 'UFA')}</div>

      <div class="stitle">Prospectos Referidos por Contactos / Nodos Referidores</div>
      <div class="ib am" style="font-size:11px"><strong>Define el % de prospectos por método</strong> (pasos de 5%). Meta: ≥80% Contactos/Nodos Referidores.</div>
      <div id="cs-metodos-grid"></div>`;

    // Asesor
    const an = $('cs-asesor'); if (an) an.addEventListener('input', e => { csState.asesor = e.target.value; renderConsorcio(); });

    // Sliders con etiqueta
    [['cs-ant', 'cs-lbl-ant', v => (+v) + ' mes' + (+v === 1 ? '' : 'es')],
     ['cs-cartera', 'cs-lbl-cartera', v => (+v) + '%'],
     ['cs-meta', 'cs-lbl-meta', v => fmtCLP(+v)],
    ].forEach(([id, lbl, fn]) => { const el = $(id); if (el) el.addEventListener('input', e => { const l = $(lbl); if (l) l.textContent = fn(e.target.value); renderConsorcio(); }); });

    // Inputs numéricos → re-render
    ['cs-cns', 'cs-polizas', 'cs-promtrim', 'cs-mp-cp', 'cs-mp-cm', 'cs-mp-aua', 'cs-mp-ho', 'cs-mp-co', 'cs-mp-hi',
     'cs-inv-gold', 'cs-inv-exp', 'cs-inv-ffmm', 'cs-salud-ufa']
      .forEach(id => { const el = $(id); if (el) el.addEventListener('input', renderConsorcio); });

    csBuildMetodos();
    renderConsorcio();
  }

  // Exponer (consumido por el dispatcher de la plataforma y los onclick inline).
  if (root) {
    root.initConsorcio   = initConsorcio;
    root.renderConsorcio = renderConsorcio;
    root.csChPct         = csChPct;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
