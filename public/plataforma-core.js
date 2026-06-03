/* ═══════════════════════════════════════════════════════
   PROXIS CORE — config, login, app shell, tracker, informes
   Loads before: compensacion/compania-z/datos.js → perfil.js → nodos.js → renta.js
═══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN — REEMPLAZA CON TUS CREDENCIALES DE SUPABASE
══════════════════════════════════════════════════════════════ */
const SB_URL = 'https://uolmsxoudvkopscxbvij.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbG1zeG91ZHZrb3BzY3hidmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Mzc2NjcsImV4cCI6MjA5MjQxMzY2N30.as4hUh_FEE4Qsj9mv5hUljvVW-wfxysqfWy5a9qFFI8';

/* ══════════════════════════════════════════════════════════════
   USUARIOS
══════════════════════════════════════════════════════════════ */
const USUARIOS = {
  'Alejandra Espinoza':     { clave:'AlejEspinoz$$026$$', rol:'supervisor' },
  'Administrador':          { clave:'adminSGU2026',        rol:'supervisor' },
  'Diego Pérez':            { clave:'diegope2026$',        rol:'asesor' },
  'Nazaret Johannesen':     { clave:'nazaretjoha$2026',    rol:'asesor' },
  'Verónica Castillo':      { clave:'verocastil2026$',     rol:'asesor' },
  'Fernanda Grothusen':     { clave:'fernagroth$2026',     rol:'asesor' },
  'Sindy Martínez':         { clave:'SindyMar2026$$',      rol:'asesor' },
  'Francis Arancibia':      { clave:'Francis$2026$$',      rol:'asesor' },
  'Marcela Jara':           { clave:'MJara$$2026',         rol:'asesor' },
  'María Francisca Lorenz': { clave:'FrancBertoni$2026$',  rol:'asesor' },
  'Oriana Jorquera':        { clave:'Ori$Jorq2026',        rol:'asesor' },
  'Mauricio Gana':          { clave:'MauGana$2026$$',      rol:'asesor' },
};
const ASESORES = Object.entries(USUARIOS).filter(([,v])=>v.rol==='asesor').map(([k])=>k);
const VINCULOS  = ['Amigo/a','Familiar','Cliente','Conocido/a'];
const MESES_NOM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ══════════════════════════════════════════════════════════════
   SUPABASE CLIENT
══════════════════════════════════════════════════════════════ */
const SB = {
  h(extra={}) { return { apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, 'Content-Type':'application/json', ...extra }; },
  async get(table, qs='') {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, { headers: this.h() });
    if (!r.ok) {
      const err=await r.text();
      console.error(`SB.get ${table} error:`,err);
      throw new Error(err);
    }
    return r.json();
  },
  async post(table, data, prefer='return=representation') {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:'POST', headers: this.h({ Prefer: prefer }), body: JSON.stringify(data)
    });
    if (!r.ok) {
      const err=await r.text();
      console.error(`SB.post ${table} error:`,err);
      throw new Error(err);
    }
    return r.json();
  },
  async patch(table, data, qs) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, {
      method:'PATCH', headers: this.h({ Prefer:'return=representation' }), body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(table, qs) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, { method:'DELETE', headers: this.h() });
    if (!r.ok) throw new Error(await r.text());
  },
  async upsert(table, data, conflict) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
      method:'POST', headers: this.h({ Prefer:'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

/* ══════════════════════════════════════════════════════════════
   ESTADO
══════════════════════════════════════════════════════════════ */
let G = { usuario:null, rol:null, empresa:null, filaCount:0, chartCache:{}, charts:{} };

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmt  = n => '$' + Math.round(n||0).toLocaleString('es-CL');
const semaforo = pct => pct>=80?'ok':pct>=50?'warn':'bad';

function getMesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function getMesLabel(m) {
  const [y,mo] = m.split('-');
  return `${MESES_NOM[parseInt(mo)-1]} ${y}`;
}
function last6Meses() {
  const out=[], now=new Date();
  for(let i=0;i<6;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return out;
}
function getLunes() {
  // Lunes de la semana actual (si hoy es lunes, devuelve hoy)
  const now=new Date();
  const day=now.getDay();
  const diff=now.getDate()-day+(day===0?-6:1);
  const lunes=new Date(now.getFullYear(),now.getMonth(),diff);
  return lunes.toISOString().split('T')[0];
}
function getProximoLunesISO(){
  // Lunes de la PRÓXIMA semana (nunca hoy)
  const now=new Date();
  const day=now.getDay();
  const daysUntil=day===1?7:(8-day)%7||7;
  const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+daysUntil);
  return next.toISOString().split('T')[0];
}
function semanaYaExiste(reportes, fechaISO){
  return reportes.some(r=>r.semana_inicio===fechaISO);
}
// ── Calcula número de semana corrido desde la primera fecha del asesor ──
// Cuenta semanas calendario transcurridas, independiente de si el asesor abrió reporte o no.
function calcSemanaNum(fechaISO, primerFechaISO){
  if(!primerFechaISO) return 1;
  const ms = new Date(fechaISO) - new Date(primerFechaISO);
  return Math.round(ms / (7*24*3600*1000)) + 1;
}
function showMsg(id,txt,tipo='rd'){
  const el=document.getElementById(id);
  if(!el)return; el.textContent=txt; el.className=`msg ${tipo}`; el.style.display='block';
}
function hideMsg(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }
function destroyChart(id){ if(G.chartCache[id]){G.chartCache[id].destroy();delete G.chartCache[id];} }
function makeChart(id,config){
  destroyChart(id);
  const el=document.getElementById(id); if(!el)return;
  G.chartCache[id]=new Chart(el,config);
}

/* ══════════════════════════════════════════════════════════════
   LOGIN / LOGOUT
══════════════════════════════════════════════════════════════ */
function buildLoginSelect(){
  const sel=document.getElementById('ln');
  if(!sel||sel.tagName!=='SELECT') return;
  sel.innerHTML='<option value="">— Selecciona —</option>';
  Object.keys(USUARIOS).forEach(u=>{
    const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o);
  });
}
document.getElementById('lp').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

async function doLogin(){
  const n=document.getElementById('ln').value.trim(), p=document.getElementById('lp').value;
  hideMsg('lerr'); hideMsg('lload');
  if(!n){showMsg('lerr','Ingresa tu nombre o email.'); return;}
  if(!p){showMsg('lerr','Ingresa tu clave.'); return;}
  // Email => login por BD (Consorcio y empresas nuevas). Nombre => USUARIOS (Zurich).
  if(n.includes('@')){
    document.getElementById('lload').style.display='block';
    try{
      const r=await fetch('/api/vina/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:n,password:p})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){ hideMsg('lload'); showMsg('lerr',d.error||'Credenciales incorrectas.'); document.getElementById('lp').value=''; return; }
      G.usuario=d.asesor; G.rol='asesor'; G.empresa='vina';
      enterApp();
    }catch(e){ hideMsg('lload'); showMsg('lerr','No se pudo conectar.'); }
    return;
  }
  const u=USUARIOS[n];
  if(!u||u.clave!==p){showMsg('lerr','Credenciales incorrectas.'); document.getElementById('lp').value=''; return;}
  document.getElementById('lload').style.display='block';
  G.usuario=n; G.rol=u.rol; G.empresa='zurich';
  enterApp();
}
function enterApp(){
  setTimeout(()=>{
    document.getElementById('screen-login').style.display='none';
    document.getElementById('screen-app').style.display='block';
    buildApp();
    fetchUF();
  },400);
}
function doLogout(){
  localStorage.removeItem('proxis_user');
  G={usuario:null,rol:null,empresa:null,filaCount:0,chartCache:{},charts:{}};
  document.getElementById('screen-login').style.display='flex';
  document.getElementById('screen-app').style.display='none';
  document.getElementById('lp').value='';
  hideMsg('lerr'); hideMsg('lload');
}


async function fetchUF(){
  try{
    const [rUF,rSM]=await Promise.all([
      fetch('https://mindicador.cl/api/uf'),
      fetch('https://mindicador.cl/api/sueldo_minimo')
    ]);
    const dUF=await rUF.json();
    UF_VAL=dUF.serie[0].valor;
    try{const dSM=await rSM.json();SUELDO_BASE=dSM.serie[0].valor;}catch{}
    document.getElementById('uf-display').textContent='$'+Math.round(UF_VAL).toLocaleString('es-CL');
    simRender();
  }catch{
    document.getElementById('uf-display').textContent='$'+Math.round(UF_VAL).toLocaleString('es-CL')+' (ref.)';
    simRender();
  }
}

/* ══ BUILD APP ══ */
function buildApp(){
  document.getElementById('h-role').innerHTML=
    `${G.usuario} · <strong>${G.rol==='supervisor'?'Supervisora':'Asesor/a'}</strong>`;
  document.getElementById('print-name').textContent=
    `${G.usuario} — ${new Date().toLocaleDateString('es-CL')}`;

  // Module bar
  const mods = G.rol==='supervisor'
    ? [{id:'simulador',lbl:'📊 Simulador de Metas'},{id:'tracker',lbl:'📋 Tracker de Prospección'}]
    : [{id:'tracker',lbl:'📋 Mi actividad'}];
  document.getElementById('module-bar').innerHTML=
    mods.map((m,i)=>`<div class="mod-btn${i===0?' active':''}" onclick="switchModule('${m.id}')">${m.lbl}</div>`).join('');

  // Show first module
  document.querySelectorAll('.module').forEach(m=>m.classList.remove('active'));
  document.getElementById(`mod-${mods[0].id}`).classList.add('active');

  // Build tracker tabs
  buildTrackerTabs();

  // Build mes selects
  const meses=last6Meses();
  const mesOpts=meses.map((m,i)=>`<option value="${m}"${i===0?' selected':''}>${getMesLabel(m)}</option>`).join('');
  ['sel-mes-informe','sel-mes-equipo'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=mesOpts;});

  // Asesor equipo selects
  const ae=document.getElementById('sel-asesor-equipo');
  if(ae) ae.innerHTML=ASESORES.map((a,i)=>`<option value="${a}"${i===0?' selected':''}>${a}</option>`).join('');
  const ai=document.getElementById('sel-asesor-individual');
  if(ai) ai.innerHTML=ASESORES.map((a,i)=>`<option value="${a}"${i===0?' selected':''}>${a}</option>`).join('');
  // Also add mes selects for individual
  const mi=document.getElementById('sel-mes-individual');
  if(mi){const meses=last6Meses();mi.innerHTML=meses.map((m,k)=>`<option value="${m}"${k===0?' selected':''}>${getMesLabel(m)}</option>`).join('');}

  // Lbl mes actual
  const lm=document.getElementById('lbl-mes-actual');
  if(lm) lm.textContent=`Mes en curso: ${getMesLabel(getMesActual())}`;

  // Render first view
  if(G.rol==='supervisor'){
    buildSimulador();
    fetchUF();
    setTimeout(()=>renderEquipo(), 100);
  } else {
    fetchUF();
    renderInforme();
    // Pre-load nodos panel for asesor bitácora
    setTimeout(()=>renderNodosPanel(), 600);
  }
  // Clean up any old-format localStorage keys for this user
  try{
    // Remove keys with old normalization (had different format in previous versions)
    const oldKey1='ob_seen_'+G.usuario?.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    const oldKey2='ob_seen_'+G.usuario?.replace(/[^a-zA-Z0-9]/g,'_');
    const newKey='ob_seen_'+G.usuario?.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').replace(/__+/g,'_');
    // If old key was set, migrate to new key
    if(localStorage.getItem(oldKey1)==='1'||localStorage.getItem(oldKey2)==='1'){
      localStorage.setItem(newKey,'1');
    }
    // FIX: solo eliminar si la clave vieja es distinta a la nueva (evita borrar el flag recién migrado)
    if(oldKey1!==newKey) localStorage.removeItem(oldKey1);
    if(oldKey2!==newKey) localStorage.removeItem(oldKey2);
  }catch{}
  // Check onboarding after DOM settles
  setTimeout(()=>checkOnboarding(), 800);
}

function buildTrackerTabs(){
  const tabs = G.rol==='supervisor'
    ? [{id:'equipo',lbl:'Equipo completo'},{id:'individual',lbl:'Desempeño individual'},{id:'ingresos',lbl:'Ingresos mensuales'}]
    : [{id:'informe',lbl:'Mi informe'},{id:'reporte',lbl:'Bitácora Semanal'}];
  document.getElementById('tracker-tabs').innerHTML=
    tabs.map((t,i)=>`<div class="tab${i===0?' active':''}" onclick="switchTrackerTab('${t.id}')">${t.lbl}</div>`).join('');
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  // Activate correct first panel per role
  const firstPanel = G.rol==='supervisor' ? 'panel-equipo' : 'panel-informe';
  const el = document.getElementById(firstPanel);
  if(el) el.classList.add('active');
}

function switchModule(id){
  document.querySelectorAll('.mod-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')?.includes(`'${id}'`)));
  document.querySelectorAll('.module').forEach(m=>m.classList.remove('active'));
  document.getElementById(`mod-${id}`).classList.add('active');
  if(id==='tracker'){
    if(G.rol==='supervisor') renderEquipo();
    else renderInforme();
  }
}

function switchTrackerTab(id){
  document.querySelectorAll('#tracker-tabs .tab').forEach(t=>t.classList.toggle('active',t.getAttribute('onclick')?.includes(`'${id}'`)));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById(`panel-${id}`);
  if(panel){
    panel.classList.add('active');
    if(id==='informe')    renderInforme();
    if(id==='reporte')    { renderReporteLista(); renderNodosPanel(); }
    if(id==='equipo')     renderEquipo();
    if(id==='individual') renderIndividual();
    if(id==='ingresos')   renderIngresos();
  }
}


/* ══════════════════════════════════════════════════════════════
   DATA HELPERS
══════════════════════════════════════════════════════════════ */
async function getMeta(asesor){
  try{
    const data=await SB.get('metas',`asesor=eq.${encodeURIComponent(asesor)}`);
    return data[0]||{meta_contactos_semana:3,meta_prospectos_mes:15,meta_ventas_mes:5,meta_ingresos:2000000};
  }catch{ return {meta_contactos_semana:3,meta_prospectos_mes:15,meta_ventas_mes:5,meta_ingresos:2000000}; }
}

async function getReportesMes(asesor,mes){
  try{
    // Use year-month prefix filter to cover all days in month
    const [y,m]=mes.split('-');
    const nextM=parseInt(m)===12?`${parseInt(y)+1}-01`:`${y}-${String(parseInt(m)+1).padStart(2,'0')}`;
    const reportes=await SB.get('reportes',
      `asesor=eq.${encodeURIComponent(asesor)}&semana_inicio=gte.${mes}-01&semana_inicio=lt.${nextM}-01&order=semana_inicio.asc`);
    for(const r of reportes){
      r.contactos=await SB.get('contactos',`reporte_id=eq.${r.id}&order=created_at.asc`);
    }
    return reportes;
  }catch(e){ console.error('getReportesMes error:',e); return []; }
}

async function getIngreso(asesor,mes){
  try{
    const d=await SB.get('ingresos',`asesor=eq.${encodeURIComponent(asesor)}&mes=eq.${mes}`);
    return d[0]?.ingreso_real||0;
  }catch{ return 0; }
}

/* ══════════════════════════════════════════════════════════════
   CALCULAR INDICADORES
══════════════════════════════════════════════════════════════ */
function calcIndicadores(reportes, mes){
  const _SEM1=new Date('2026-03-30');
  function _semNumDesdefecha(fechaISO){
    return Math.round((new Date(fechaISO)-_SEM1)/(7*24*60*60*1000))+1;
  }
  // Generar todos los lunes cuya semana se solapa con el mes
  // (incluye el lunes anterior al día 1 si ese lunes cae en el mes previo)
  function getLunesDelMes(mesISO){
    if(!mesISO) return [];
    const [y,m]=mesISO.split('-').map(Number);
    const lunes=[];
    // Lunes de la semana que contiene el día 1 del mes
    const primerDia=new Date(y,m-1,1);
    const dow=primerDia.getDay(); // 0=Dom,1=Lun,...
    const daysBack=dow===0?6:dow-1;
    let d=new Date(y,m-1,1-daysBack);
    // Avanzar mientras el lunes esté antes del inicio del mes siguiente
    while(d<new Date(y,m,1)){
      lunes.push(d.toISOString().split('T')[0]);
      d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+7);
    }
    return lunes;
  }
  const mesISO=mes||reportes[0]?.semana_inicio?.slice(0,7);
  const repPorFecha={};
  reportes.forEach(r=>{ repPorFecha[r.semana_inicio]=r; });
  const hoy=new Date();
  const lunesDelMes=getLunesDelMes(mesISO);
  const lunesHoyISO=new Date().toISOString().split('T')[0].slice(0,10);
  // Filtrar: solo lunes ya pasados; excluir hoy si aún no tiene reporte
  const fuentesSemanas=lunesDelMes.length>0
    ? lunesDelMes.filter(f=>{
        const esPasado=new Date(f)<=hoy;
        const esHoySinReporte=f===lunesHoyISO&&!repPorFecha[f];
        return esPasado && !esHoySinReporte;
      }).map(fecha=>({esFantasma:!repPorFecha[fecha],reporte:repPorFecha[fecha]||null,fecha}))
    : reportes.map(r=>({esFantasma:false,reporte:r,fecha:r.semana_inicio}));
  const semanas=fuentesSemanas.map(({esFantasma,reporte,fecha})=>{
    if(esFantasma) return {id:null,semana:_semNumDesdefecha(fecha),fecha,confirmado:false,esFantasma:true,contactos:0,llamadas:0,reuniones:0,prospectos:0,potencial:0,prom:0,vinc:{}};
    const r=reporte;
    const cs=r.contactos||[];
    const contactos=cs.length,llamadas=cs.filter(c=>c.llamo).length;
    const reuniones=cs.filter(c=>c.reunion).length;
    const prospectos=cs.reduce((a,c)=>a+c.prospectos,0);
    const potencial=contactos*5;
    const prom=contactos?+(prospectos/contactos).toFixed(1):0;
    const vinc={};
    cs.forEach(c=>{ vinc[c.vinculo]=(vinc[c.vinculo]||0)+c.prospectos; });
    return {id:r.id,semana:_semNumDesdefecha(r.semana_inicio),fecha:r.semana_inicio,confirmado:r.confirmado,esFantasma:false,contactos,llamadas,reuniones,prospectos,potencial,prom,vinc};
  });
  const totC=semanas.reduce((a,s)=>a+s.contactos,0);
  const totR=semanas.reduce((a,s)=>a+s.reuniones,0);
  const totP=semanas.reduce((a,s)=>a+s.prospectos,0);
  const totPot=semanas.reduce((a,s)=>a+s.potencial,0);
  const promG=totC?+(totP/totC).toFixed(1):0;
  const tasaReu=totC?Math.round(totR/totC*100):0;
  const efic=totPot?Math.round(totP/totPot*100):0;
  const brecha=totPot-totP;
  const prospReu=totR?+(totP/totR).toFixed(1):0;
  const vincAcum={};
  semanas.forEach(s=>Object.entries(s.vinc).forEach(([v,n])=>{ vincAcum[v]=(vincAcum[v]||0)+n; }));
  const mejorV=Object.entries(vincAcum).sort((a,b)=>b[1]-a[1])[0];
  return {semanas,totC,totR,totP,totPot,promG,tasaReu,efic,brecha,prospReu,vincAcum,mejorV};
}

/* ══════════════════════════════════════════════════════════════
   INFORME DE AVANCE
══════════════════════════════════════════════════════════════ */
async function renderInforme(){
  const asesor=G.usuario;
  const mes=document.getElementById('sel-mes-informe')?.value||getMesActual();
  const cont=document.getElementById('informe-content');
  cont.innerHTML='<div class="ib bl">Cargando informe…</div>';

  const [meta,reportes,ingreso]=await Promise.all([getMeta(asesor),getReportesMes(asesor,mes),getIngreso(asesor,mes)]);

  if(!reportes.length){
    cont.innerHTML=`<div class="ib am"><strong>Sin reportes en ${getMesLabel(mes)}.</strong> ${G.rol==='asesor'?' Ve a la pestaña <strong>Reporte semanal</strong> para ingresar tu actividad de la semana.':' El asesor aún no tiene reportes registrados este mes.'}</div>`;
    return;
  }

  cont.innerHTML=renderInformeHTML(asesor,mes,meta,reportes,ingreso);
  renderInformeCharts(reportes,mes);
  // Load nodos async (non-blocking)
  // Load nodos after DOM settles
  setTimeout(()=>loadNodosEnInforme(asesor, reportes), 400);
}

function renderInformeHTML(asesor,mes,meta,reportes,ingreso){
  const {semanas,totC,totR,totP,totPot,promG,tasaReu,efic,brecha,prospReu,vincAcum,mejorV}=calcIndicadores(reportes,mes);
  const metaP=Math.max(meta.meta_prospectos_mes||15,5); // mínimo 5 para evitar % absurdos
  const avMes=Math.round(totP/metaP*100);
  const avC=Math.round(totC/(meta.meta_contactos_semana*semanas.length)*100);
  const avIng=ingreso&&meta.meta_ingresos?Math.round(ingreso/meta.meta_ingresos*100):null;

  return `
  <div class="card" id="informe-nodos-section" style="border:2px solid var(--teal);margin-bottom:16px">
    <div class="card-title" style="color:var(--teal)">✦ Nodos activos</div>
    <div id="informe-nodos-content"></div>
  </div>
  <div class="card">
    <div class="card-title">Resumen del mes — ${getMesLabel(mes)}</div>
    <div class="grid4" style="margin-bottom:12px">
      ${mc('Prospectos obtenidos <span onmouseenter="showTooltip(&#39;prospectos-obtenidos&#39;,event)" onmouseleave="hideTooltip()" style="cursor:help;color:var(--blue);font-style:normal"> <span class="ico-info">i</span></span>',totP,`Meta: ${meta.meta_prospectos_mes} · ${avMes}% cumplido`,avMes,'Total de prospectos que tus contactos te referenciaron este mes. Es el resultado central de toda la actividad de prospección.')}
      ${mc('Contactos realizados <span onmouseenter="showTooltip(&#39;contactos-realizados&#39;,event)" onmouseleave="hideTooltip()" style="cursor:help;color:var(--blue);font-style:normal"> <span class="ico-info">i</span></span>',totC,`Meta: ${meta.meta_contactos_semana*semanas.length} (${meta.meta_contactos_semana}/sem × ${semanas.length} sem)`,avC,'Número de nodos relacionales activados. Cada contacto es una persona que puede referirte entre 3 y 5 prospectos calificados.')}
      ${mc('Tasa de reunión',tasaReu+'%',`${totR} reuniones de ${totC} contactos · Meta: ≥60%`,Math.round(tasaReu/60*100),'Porcentaje de contactos que aceptaron reunirse. Mide tu capacidad de apertura y la confianza que genera tu acercamiento.')}
      ${mc('Eficiencia de Contactos <span onmouseenter="showTooltip(&#39;eficiencia-contactos&#39;,event)" onmouseleave="hideTooltip()" style="cursor:help;color:var(--blue);font-style:normal"> <span class="ico-info">i</span></span>',efic+'%',`Prospectos reales vs. potencial (${totPot})`,efic,'¿Cuánto del potencial máximo aprovechas? Si cada contacto diera 5 referidos, el potencial sería '+totPot+'. Meta: ≥80%.')}
    </div>
    <div class="grid4">
      ${mc('Prospectos / contacto',promG,`Meta: ≥ 4,5 prospectos`,Math.round(promG/4.5*100),'Indicador clave de efectividad. Si es bajo, trabajar el guión de solicitud, la confianza y la imagen personal ante el contacto.')}
      ${mc('Prospectos / reunión',prospReu,`${totR} reuniones · Meta: ≥ 4`,Math.round(prospReu/4*100),'Calidad de cada reunión. Al reunirte, deberías salir siempre con al menos 4 nombres de referidos calificados.')}
      ${mcBad('Brecha de prospectos',brecha,'Prospectos no obtenidos este mes','Cuántos prospectos se perdieron por no llegar a 5 referidos por contacto. Representa oportunidad no capitalizada.')}
      ${mejorV?mcOk('Vínculo más productivo',mejorV[0],`${mejorV[1]} prospectos generados`,'El tipo de relación que más referidos produce. Prioriza tu energía en estos vínculos.'):emptyMc('Vínculo','—','')}
    </div>
    ${avIng!==null?`<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--g200)">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:10px">CORRELACIÓN ACTIVIDAD → INGRESOS</p>
      <div class="grid2">
        ${mc('Ingresos del mes',fmt(ingreso),`Meta: ${fmt(meta.meta_ingresos)} · ${avIng}% cumplido`,avIng,'Ingresos totales del mes vs. tu meta del simulador. La meta de ingresos es consecuencia directa de la actividad de prospección.')}
        <div class="mc"><div class="mc-label">Ingreso promedio por prospecto</div>
          <div class="mc-value" style="font-size:18px">${totP?fmt(ingreso/totP):'—'}</div>
          <div class="mc-sub">${totP} prospectos → ${fmt(ingreso)}</div>
          <div class="mc-explain">Muestra cuánto vale en promedio cada prospecto generado. A mayor actividad consistente y mejor efectividad, mayor ingreso. Este indicador mejora con el tiempo.</div>
        </div>
      </div>
    </div>`:''}
  </div>

  <div class="card">
    <div class="card-title">Evolución semanal</div>
    <div style="overflow-x:auto;margin-bottom:16px">
      <table class="dt">
        <thead><tr><th>Semana</th><th>Contactos</th><th>Reuniones</th><th>Tasa reunión</th><th>Prospectos</th><th>Potencial</th><th>Prom./contacto</th><th>Estado</th></tr></thead>
        <tbody>
          ${semanas.map(s=>{
            const sinActividad = s.contactos===0;
            const esFantasma = s.esFantasma;
            const rowStyle = esFantasma
              ? 'background:var(--red-lt);opacity:.7;'
              : sinActividad ? 'background:var(--red-lt);' : '';
            return `<tr style="${rowStyle}">
            <td>Semana ${s.semana} <span style="font-size:11px;color:var(--g400)">(${s.fecha})</span></td>
            <td><strong>${s.contactos}</strong></td><td>${s.reuniones}</td>
            <td>${s.contactos?Math.round(s.reuniones/s.contactos*100):0}%</td>
            <td><strong>${s.prospectos}</strong></td>
            <td style="color:var(--g400)">${s.potencial}</td>
            <td>${sinActividad?'<span class="pill pill-rd">Sin actividad</span>':`<span class="pill ${s.prom>=4.5?'pill-gn':s.prom>=3?'pill-am':'pill-rd'}">${s.prom}</span>`}</td>
            <td>${esFantasma?'<span class="pill pill-rd">Sin reporte</span>':sinActividad?'<span class="pill pill-rd">Sin contactos</span>':'<span class="pill pill-bl">Guardado</span>'}</td>
          </tr>`;}).join('')}
        </tbody>
        <tfoot><tr style="font-weight:600;border-top:2px solid var(--g200)">
          <td>Total mes</td><td>${totC}</td><td>${totR}</td><td>${tasaReu}%</td>
          <td>${totP}</td><td style="color:var(--g400)">${totPot}</td>
          <td><span class="pill ${promG>=4.5?'pill-gn':promG>=3?'pill-am':'pill-rd'}">${promG}</span></td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>
    <div class="grid2">
      <div>
        <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:6px">EVOLUCIÓN DE ACTIVIDAD</p>
        <div class="chart-wrap"><canvas id="chart-act" role="img" aria-label="Gráfico de evolución de actividad semanal"></canvas></div>
      </div>
      <div>
        <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:6px">POTENCIAL vs. REAL ACUMULADO</p>
        <div class="chart-wrap"><canvas id="chart-pot" role="img" aria-label="Gráfico de potencial vs real acumulado"></canvas></div>
      </div>
    </div>
  </div>

  ${Object.keys(vincAcum).length?`<div class="card">
    <div class="card-title">Productividad por tipo de vínculo</div>
    <p style="font-size:12px;color:var(--g400);margin-bottom:12px;margin-left:12px">Prospectos generados según el tipo de relación con el contacto. Identifica dónde concentrar el esfuerzo.</p>
    <div class="grid4">
      ${VINCULOS.map(v=>`<div class="mc">
        <div class="mc-label">${v}</div>
        <div class="mc-value">${vincAcum[v]||0}</div>
        <div class="mc-sub">prospectos</div>
      </div>`).join('')}
    </div>
  </div>`:''}`;
}

function mc(lbl,val,sub,pct,explain){
  const s=semaforo(pct);
  return `<div class="mc ${s}"><div class="semaforo ${s}"></div><div class="mc-label">${lbl}</div><div class="mc-value">${val}</div><div class="mc-sub">${sub}</div><div class="mc-explain">${explain}</div></div>`;
}
function mcBad(lbl,val,sub,explain){
  return `<div class="mc bad"><div class="semaforo bad"></div><div class="mc-label">${lbl}</div><div class="mc-value">${val}</div><div class="mc-sub">${sub}</div><div class="mc-explain">${explain}</div></div>`;
}
function mcOk(lbl,val,sub,explain){
  return `<div class="mc ok"><div class="mc-label">${lbl}</div><div class="mc-value" style="font-size:18px">${val}</div><div class="mc-sub">${sub}</div><div class="mc-explain">${explain}</div></div>`;
}
function emptyMc(lbl,val,sub){
  return `<div class="mc"><div class="mc-label">${lbl}</div><div class="mc-value" style="font-size:18px">${val}</div><div class="mc-sub">${sub}</div></div>`;
}


/* ══ NODOS CHART + INTERPRETACIÓN ══ */
async function getNodosChartData(asesor, todosReportes){
  // Fetch activaciones and all contactos for this asesor
  const [allActs, allContactos] = await Promise.all([
    SB.get('activaciones_nodo',`asesor=eq.${encodeURIComponent(asesor)}&order=semana_inicio.asc&select=semana_inicio,nodo_id,prospectos`),
    SB.get('contactos',`asesor=eq.${encodeURIComponent(asesor)}&select=prospectos,reporte_id`)
  ]);

  // Group activaciones by month
  const byMes={};
  allActs.forEach(a=>{
    const mo=a.semana_inicio?.slice(0,7); if(!mo)return;
    if(!byMes[mo]) byMes[mo]={nodos:new Set(),prospNodos:0};
    byMes[mo].nodos.add(a.nodo_id);
    byMes[mo].prospNodos+=(a.prospectos||0);
  });

  // Group total prospectos by month (from contactos + reportes)
  const repByMonth={};
  if(todosReportes){
    todosReportes.forEach(r=>{
      const mo=r.semana_inicio?.slice(0,7); if(!mo)return;
      if(!repByMonth[mo]) repByMonth[mo]=0;
      (r.contactos||[]).forEach(c=>{ repByMonth[mo]+=(c.prospectos||0); });
    });
  }

  const meses=Object.keys(byMes).sort();
  let acum=0;
  const dAcum=[], dNuevos=[], dProspNodos=[], dProspTotal=[], dPct=[], labels=[];

  meses.forEach(mo=>{
    const nuevos=byMes[mo].nodos.size;
    acum+=nuevos;
    const prospNodos=byMes[mo].prospNodos;
    const prospTotal=repByMonth[mo]||0;
    const pct=prospTotal>0?Math.round(prospNodos/prospTotal*100):0;
    dAcum.push(acum);
    dNuevos.push(nuevos);
    dProspNodos.push(prospNodos);
    dProspTotal.push(prospTotal);
    dPct.push(pct);
    const[y,m]=mo.split('-');
    labels.push(MESES_NOM[parseInt(m)-1].slice(0,3)+' '+y.slice(2));
  });

  return {meses,labels,dAcum,dNuevos,dProspNodos,dProspTotal,dPct};
}

function interpretarNodos(dAcum,dNuevos,dProspNodos,dProspTotal,dPct,labels,esEquipo=false){
  if(!dAcum.length) return '';
  const ultimo=dAcum[dAcum.length-1];
  const ultNuevos=dNuevos[dNuevos.length-1];
  const ultPct=dPct[dPct.length-1];
  const ultProspNodos=dProspNodos[dProspNodos.length-1];
  const sujeto=esEquipo?'el equipo':'tus nodos';
  const msgs=[];

  // Meses planos recientes
  let planos=0;
  for(let i=dNuevos.length-1;i>=0;i--){ if(dNuevos[i]===0)planos++;else break; }
  if(planos>=2) msgs.push({color:'#BA7517',txt:`${esEquipo?'El equipo lleva':'Llevas'} ${planos} mes${planos>1?'es':''} sin nuevos nodos — es momento de reactivar contactos anteriores.`});
  else if(ultNuevos>=2) msgs.push({color:'#0F6E56',txt:`Mes destacado: ${ultNuevos} nodos nuevos en ${labels[labels.length-1]}. La red está creciendo activamente.`});
  else if(ultNuevos===1) msgs.push({color:'#0F6E56',txt:`Se agregó 1 nodo nuevo este mes. Ritmo constante de profundización.`});

  // % tendencia
  if(dPct.length>=2){
    const diff=ultPct-(dPct[dPct.length-2]||0);
    if(diff>=10) msgs.push({color:'#0F6E56',txt:`La proporción de prospectos de nodos subió ${diff}% este mes — la red está rindiendo más.`});
    else if(diff<=-10) msgs.push({color:'#BA7517',txt:`La proporción de prospectos de nodos bajó ${Math.abs(diff)}% — los nodos están menos activos.`});
  }

  // % absoluto
  if(ultPct>=40) msgs.push({color:'#0F6E56',txt:`Más del ${ultPct}% de ${esEquipo?'los':'tus'} prospectos ya vienen de la red de nodos — hábito consolidado.`});
  else if(ultPct>=20) msgs.push({color:'#185FA5',txt:`${ultPct}% de ${esEquipo?'los':'tus'} prospectos vienen de nodos. El objetivo es superar el 40%.`});
  else if(ultimo>0) msgs.push({color:'#BA7517',txt:`Solo el ${ultPct}% de ${esEquipo?'los':'tus'} prospectos vienen de nodos — la red aún no está rindiendo su potencial.`});

  if(!msgs.length) return '';
  return `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
    ${msgs.map(m=>`<div style="font-size:11px;line-height:1.5;padding:7px 10px;border-radius:var(--r);border-left:3px solid ${m.color};background:${m.color}18;color:var(--g700)">${m.txt}</div>`).join('')}
  </div>`;
}

function buildNodosChart(canvasId,labels,dAcum,dNuevos,dProspNodos,dPct,chartKey){
  if(G.charts[chartKey]){G.charts[chartKey].destroy();}
  const ctx=document.getElementById(canvasId);
  if(!ctx||!labels.length)return;
  G.charts[chartKey]=new Chart(ctx,{
    data:{labels,datasets:[
      {type:'bar',label:'Nuevos nodos',data:dNuevos,backgroundColor:dNuevos.map(v=>v===0?'rgba(242,91,91,.18)':'rgba(15,110,86,.3)'),borderColor:dNuevos.map(v=>v===0?'#F7C1C1':'#5DCAA5'),borderWidth:1,borderRadius:3,yAxisID:'y2',order:3},
      {type:'line',label:'Nodos acumulados',data:dAcum,borderColor:'#0F6E56',backgroundColor:'rgba(15,110,86,.08)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:dNuevos.map(v=>v===0?'#E24B4A':'#0F6E56'),pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5,yAxisID:'y',order:1},
      {type:'line',label:'Prospectos de nodos',data:dProspNodos,borderColor:'#185FA5',borderDash:[5,4],backgroundColor:'transparent',tension:.3,pointRadius:3,borderWidth:2,yAxisID:'y3',order:2},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          afterBody:(items)=>{
            const i=items[0]?.dataIndex;
            const pct=dPct[i]; const nn=dNuevos[i];
            const lines=[];
            if(pct!=null) lines.push(`% del total: ${pct}%`);
            if(nn===0) lines.push('⚠ Sin nodo nuevo este mes');
            return lines;
          }
        }}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:10}}},
        y:{position:'left',min:0,title:{display:true,text:'Acumulados',font:{size:10}},grid:{color:'rgba(0,0,0,.05)'},ticks:{stepSize:1,font:{size:10}}},
        y2:{position:'right',min:0,max:Math.max(...dNuevos)+1,title:{display:true,text:'Nuevos',font:{size:10}},grid:{display:false},ticks:{stepSize:1,font:{size:10}}},
        y3:{display:false},
      }
    }
  });
}

async function loadNodosEnInforme(asesor, reportesParam){
  const cont=document.getElementById('informe-nodos-content');
  if(!cont)return;
  // Use unique chart keys per asesor to avoid collisions between supervisor/asesor views
  const safeName=asesor.replace(/[^a-zA-Z0-9]/g,'_').slice(0,12);
  const chartId=`chart-nod-${safeName}`;
  const interpId=`nod-interp-${safeName}`;
  try{
    const nodos=await getNodos(asesor);
    if(!nodos.length){
      cont.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--g100);border-radius:var(--r)">
        <span style="font-size:20px">🌱</span>
        <p style="font-size:12px;color:var(--g700);line-height:1.5">Aún no hay nodos confirmados. Un contacto se convierte en <strong>nodo</strong> cuando refiere prospectos en más de una ocasión.</p>
      </div>`;
      return;
    }
    const totalActs=nodos.reduce((s,n)=>s+(n.activaciones||0),0);
    const totalProsp=nodos.reduce((s,n)=>s+(n.total_prospectos||0),0);
    const reportes=reportesParam||[];
    const {labels,dAcum,dNuevos,dProspNodos,dProspTotal,dPct}=await getNodosChartData(asesor,reportes);
    const ultPct=dPct[dPct.length-1]||0;
    cont.innerHTML=`<div class="grid4" style="margin-bottom:14px">
      <div class="mc ok"><div class="mc-label">Nodos activos</div><div class="mc-value">${nodos.length}</div><div class="mc-sub">contactos convertidos en nodo</div></div>
      <div class="mc"><div class="mc-label">Total activaciones</div><div class="mc-value">${totalActs}</div><div class="mc-sub">veces que han vuelto a referir</div></div>
      <div class="mc"><div class="mc-label">Prospectos de nodos</div><div class="mc-value">${totalProsp}</div><div class="mc-sub">total histórico acumulado</div></div>
      <div class="mc"><div class="mc-label">% del total este mes</div><div class="mc-value">${ultPct}%</div><div class="mc-sub">de prospectos vienen de nodos</div></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      ${nodos.map(n=>`<div style="background:var(--teal-lt);border:1px solid rgba(15,110,86,.3);border-radius:var(--r);padding:9px 12px;min-width:160px">
        <div style="font-size:12px;font-weight:600;color:var(--g900)">🌳 ${n.nombre}</div>
        <div style="font-size:11px;color:var(--teal);margin-top:2px">${n.activaciones} activaciones · ${n.total_prospectos||0} prosp.</div>
        <div style="font-size:10px;color:var(--g400)">Nodo desde ${n.fecha_conversion||'—'}</div>
      </div>`).join('')}
    </div>
    <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--g400);margin-bottom:6px">Evolución de nodos acumulados y prospectos generados</p>
    <div style="display:flex;gap:14px;margin-bottom:6px;font-size:11px;color:var(--g400)">
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:4px;background:#0F6E56;border-radius:2px;display:inline-block"></span>Nodos acumulados</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:0;border-top:2px dashed #185FA5;display:inline-block"></span>Prospectos de nodos</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(15,110,86,.3);border-radius:2px;display:inline-block"></span>Nuevos nodos</span>
    </div>
    <div style="position:relative;height:160px"><canvas id="${chartId}" role="img" aria-label="Evolución nodos"></canvas></div>
    <div id="${interpId}"></div>`;
    setTimeout(()=>{
      buildNodosChart(chartId,labels,dAcum,dNuevos,dProspNodos,dPct,'inf-nod-'+safeName);
      const interp=interpretarNodos(dAcum,dNuevos,dProspNodos,dProspTotal,dPct,labels,false);
      const el=document.getElementById(interpId);
      if(el)el.innerHTML=interp;
    },100);
  }catch(e){
    console.error('loadNodosEnInforme error:',e);
    cont.innerHTML=`<div class="ib rd" style="font-size:12px">Error al cargar nodos: ${e.message}</div>`;
  }
}

function renderInformeCharts(reportes,mes){
  const {semanas}=calcIndicadores(reportes,mes);
  const labels=semanas.map(s=>`Sem. ${s.semana}`);
  requestAnimationFrame(()=>{
    makeChart('chart-act',{
      type:'bar',
      data:{labels,datasets:[
        {label:'Contactos',data:semanas.map(s=>s.contactos),backgroundColor:'#B5D4F4'},
        {label:'Reuniones',data:semanas.map(s=>s.reuniones),backgroundColor:'#9FE1CB'},
        {label:'Prospectos',data:semanas.map(s=>s.prospectos),backgroundColor:'#003781'},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{autoSkip:false}}}}
    });
    let ap=0,ar=0; const dp=[],dr=[];
    semanas.forEach(s=>{ ap+=s.potencial; ar+=s.prospectos; dp.push(ap); dr.push(ar); });
    makeChart('chart-pot',{
      type:'line',
      data:{labels,datasets:[
        {label:'Potencial',data:dp,borderColor:'#9E9D97',backgroundColor:'transparent',borderDash:[5,5]},
        {label:'Real',data:dr,borderColor:'#003781',backgroundColor:'rgba(0,55,129,.1)',fill:true},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{autoSkip:false}}}}
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   REPORTE SEMANAL
══════════════════════════════════════════════════════════════ */
async function renderReporteLista(){
  const cont=document.getElementById('reporte-content');
  cont.innerHTML='<div class="ib bl">Cargando reportes…</div>';

  const mes=getMesActual();
  const [y,m]=mes.split('-');
  const mesPrev=parseInt(m)===1?`${parseInt(y)-1}-12`:`${y}-${String(parseInt(m)-1).padStart(2,'0')}`;
  const [rActual,rPrev]=await Promise.all([
    getReportesMes(G.usuario,mes),
    getReportesMes(G.usuario,mesPrev),
  ]);
  const reportes=[...rPrev,...rActual];

  // ── Generar semanas fantasma para los dos meses visibles ──────────────
  const _SEM1=new Date('2026-03-30');
  function semNum(f){return Math.round((new Date(f)-_SEM1)/(7*24*60*60*1000))+1;}
  function lunesDelMes(mesISO){
    const [yy,mm]=mesISO.split('-').map(Number);
    const dow=new Date(yy,mm-1,1).getDay();
    const back=dow===0?6:dow-1;
    const lunes=[];
    let d=new Date(yy,mm-1,1-back);
    while(d<new Date(yy,mm,1)){lunes.push(d.toISOString().split('T')[0]);d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+7);}
    return lunes;
  }
  const hoy=new Date();
  const lunesHoy=getLunes();
  const repPorFecha={};
  reportes.forEach(r=>{repPorFecha[r.semana_inicio]=r;});
  // Todos los lunes de ambos meses que ya pasaron (sin duplicados)
  const todasFechas=[...new Set([...lunesDelMes(mesPrev),...lunesDelMes(mes)])]
    .filter(f=>new Date(f)<=hoy && !(f===lunesHoy && !repPorFecha[f]))
    .sort((a,b)=>new Date(b)-new Date(a)); // más reciente primero

  if(!todasFechas.length && !reportes.length){
    cont.innerHTML='<div class="ib am"><strong>No tienes reportes registrados.</strong> Haz clic en "+ Nueva semana" para comenzar tu primer reporte.</div>';
    return;
  }

  cont.innerHTML=todasFechas.map(fecha=>{
    const r=repPorFecha[fecha];
    const esFantasma=!r;
    const cs=r?.contactos||[];
    const totC=cs.length,totR=cs.filter(c=>c.reunion).length,totP=cs.reduce((a,c)=>a+c.prospectos,0);
    const esEditable=fecha===lunesHoy && !esFantasma;
    const num=semNum(fecha);

    if(esFantasma){
      return `<div class="card" style="opacity:.65;border-left:3px solid var(--red)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:8px">
          <div>
            <div class="card-title" style="margin-bottom:0;color:var(--red)">Semana ${num} — ${fecha}</div>
            <p style="font-size:12px;color:var(--g400);margin-top:4px">Sin reporte — semana sin actividad registrada</p>
          </div>
          <span style="font-size:11px;color:var(--red);padding:5px 10px;border:0.5px solid var(--red);border-radius:var(--r);opacity:.8">⚠ Sin reporte</span>
        </div>
      </div>`;
    }

    const accionBtn=esEditable
      ?`<button class="btn btn-secondary" onclick="editarReporte('${r.id}')">Editar semana</button>`
      :`<span style="font-size:11px;color:var(--g400);padding:5px 10px;border:0.5px solid var(--g200);border-radius:var(--r)">🔒 Semana cerrada</span>`;
    return `<div class="card" style="${!esEditable?'opacity:.85':''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-title" style="margin-bottom:0">Semana ${num} — ${fecha}</div>
          <p style="font-size:12px;color:var(--g400);margin-top:4px">${totC} contactos · ${totR} reuniones · ${totP} prospectos</p>
        </div>
        ${accionBtn}
      </div>
      ${totC?`<table class="dt">
        <thead><tr><th>#</th><th>Nombre</th><th>Vínculo</th><th>Llamó</th><th>Reunión</th><th>Prospectos</th>${esEditable?'<th></th>':''}</tr></thead>
        <tbody>${cs.map((c,i)=>`<tr><td style="color:var(--g400)">${i+1}</td><td>${c.nombre}${c.tipo_contacto==='reactivacion'||c.tipo_contacto==='activacion_nodo'?' <span style="color:var(--teal);font-size:10px">✦</span>':''}</td>
          <td><span class="pill pill-bl">${c.vinculo}</span></td>
          <td>${c.llamo?'✓':'—'}</td><td>${c.reunion?'✓':'—'}</td>
          <td><strong>${c.prospectos}</strong></td>
          ${esEditable?`<td><button onclick="eliminarContacto('${c.id}','${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--g400);font-size:14px;padding:2px 4px" title="Eliminar contacto">🗑</button></td>`:''}</tr>`).join('')}</tbody>
      </table>`:'<p style="font-size:13px;color:var(--g400);padding:8px 0">Sin contactos registrados.</p>'}
    </div>`;
  }).join('');
}

async function abrirNuevaSemana(){
  const cont=document.getElementById('reporte-content');
  cont.innerHTML='<div class="ib bl">Verificando…</div>';
  await loadContactHistory(G.usuario);

  // ── MODO TEST: permite abrir semana cualquier día ──────────────────
  const MODO_TEST = false; // ← true solo para testing
  // ──────────────────────────────────────────────────────────────────

  // Calcular la fecha de la semana en curso (lunes actual)
  const lunesActual=getLunes();

  // Cargar TODOS los reportes históricos del asesor sin filtro de mes
  // Necesario para: (1) semana_num secuencial anual, (2) detectar duplicados correctamente
  const todosReportes=await SB.get('reportes',
    `asesor=eq.${encodeURIComponent(G.usuario)}&order=semana_inicio.asc&select=id,semana_inicio,semana_num`);

  // Validar: ¿ya existe un reporte para la semana en curso (lunes actual)?
  if(!MODO_TEST && semanaYaExiste(todosReportes,lunesActual)){
    cont.innerHTML=`<div class="ib am"><strong>Ya tienes un reporte abierto para esta semana</strong> (lunes ${lunesActual}).<br><br>
      Edita el reporte existente abajo. El próximo reporte nuevo lo podrás abrir el <strong>${getProximoLunes()}</strong>.</div>`;
    setTimeout(()=>renderReporteLista(),500);
    return;
  }

  // Validar que no exista ya para el próximo lunes
  const proxLunes=getProximoLunesISO();
  if(!MODO_TEST && semanaYaExiste(todosReportes,proxLunes)){
    cont.innerHTML=`<div class="ib am"><strong>Ya existe un reporte para la próxima semana.</strong> Solo puedes tener un reporte por semana.</div>`;
    setTimeout(()=>renderReporteLista(),500);
    return;
  }

  // En modo test, usar fecha del próximo lunes para no contaminar semanas reales
  const fechaReporte = MODO_TEST ? proxLunes : lunesActual;

  // semanaNum = basado en fecha calendario desde semana de inicio de plataforma
  // (evita saltos cuando un asesor no abre semana — las semanas se numeran en forma corrida)
  const PLATAFORMA_SEMANA1 = new Date('2026-03-30'); // Lunes de la Semana 1
  const fechaMs = new Date(fechaReporte);
  const semanaNum = Math.round((fechaMs - PLATAFORMA_SEMANA1) / (7 * 24 * 60 * 60 * 1000)) + 1;

  // Advertencia visible en modo test
  if(MODO_TEST){
    const warn=document.createElement('div');
    warn.className='ib am';
    warn.style.fontSize='11px';
    warn.innerHTML='⚠ <strong>Modo test activo</strong> — esta semana se crea con fecha del próximo lunes para no alterar registros reales.';
    cont.appendChild(warn);
  }

  try{
    const result=await SB.post('reportes',{asesor:G.usuario,empresa:(G.empresa||'zurich'),semana_inicio:fechaReporte,semana_num:semanaNum,confirmado:false});
    const rep=Array.isArray(result)?result[0]:result;
    if(!rep||!rep.id){ throw new Error('No se recibió ID del reporte. Verifica la conexión con Supabase.'); }
    mostrarFormulario(rep.id,semanaNum,fechaReporte,[]);
  }catch(e){
    cont.innerHTML=`<div class="ib rd"><strong>Error al crear el reporte:</strong> ${e.message}<br><br>Asegúrate de que el archivo está publicado en Netlify (no abierto como archivo local).</div>`;
    console.error('abrirNuevaSemana error:',e);
  }
}

async function editarReporte(rid){
  const [r]=await SB.get('reportes',`id=eq.${rid}`);
  const contactos=await SB.get('contactos',`reporte_id=eq.${rid}&order=created_at.asc`);
  // Recalcular número de semana desde fecha para que sea corrido (independiente del valor guardado)
  const semanaCorrecta = calcSemanaNum(r.semana_inicio, '2026-03-30');
  mostrarFormulario(rid,semanaCorrecta,r.semana_inicio,contactos);
}

function mostrarFormulario(rid,semana,fecha,contactosPrev){
  G.filaCount=0;
  const cont=document.getElementById('reporte-content');
  const iniciales=contactosPrev.length?contactosPrev:[{}];

  function html(){
    return `<div class="card">
      <div class="card-title">Semana ${semana} — ${fecha}</div>
      <div class="ib am"><strong>Ingresa tus contactos de esta semana.</strong> Meta: al menos 5 prospectos referidos por cada contacto.</div>
      <div style="overflow-x:auto">
        <table class="form-table">
          <thead><tr><th>#</th><th>Nombre del contacto</th><th>Vínculo</th><th>Estado</th><th>¿Llamó?</th><th>¿Reunión?</th><th>N° Prospectos</th><th></th></tr></thead>
          <tbody id="tbody-form"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="agregarFila()">+ Agregar contacto</button>
        <button class="btn btn-primary" onclick="guardarBorrador('${rid}')">💾 Guardar reporte</button>
  
      </div>
      <div class="msg rd" id="form-err"></div>
      <div class="msg gn" id="form-ok"></div>
    </div>`;
  }
  cont.innerHTML=html();
  iniciales.forEach(c=>agregarFila(c));
}

function filaHtml(num,c={}){
  const esReact=c.tipo_contacto==='reactivacion';
  const rowBg=esReact?"style='background:var(--teal-lt)'":'';
  const vincOpts=VINCULOS.map(v=>`<option${c.vinculo===v?' selected':''}>${v}</option>`).join('');
  return `<tr id="fr-${num}" ${rowBg}>
    <td style="color:var(--g400);font-family:var(--mono);font-size:12px">${num}</td>
    <td style="position:relative">
      <input type="text" id="fn-${num}" value="${c.nombre||''}" placeholder="Nombre completo" autocomplete="off"
        oninput="showSug(${num},this.value)" onblur="setTimeout(()=>{hideSug(${num});checkDuplicadoEnForm(${num});},200)">
      <div id="fn-warn-${num}" style="display:none;font-size:10px;color:#BA7517;padding:2px 0;line-height:1.3"></div>
      <div id="sug-${num}" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1.5px solid var(--blue);border-radius:var(--r);z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.12)"></div>
    </td>
    <td><select id="fv-${num}">${vincOpts}</select></td>
    <td style="text-align:center">
      <select id="ft-${num}" style="display:none">
        <option value="nuevo"${!esReact?' selected':''}>Nuevo</option>
        <option value="reactivacion"${esReact?' selected':''}>Reactivación ✦</option>
      </select>
      <span id="ft-lbl-${num}" style="font-size:11px;color:${esReact?'var(--teal)':'var(--g400)'}">${esReact?'✦ Reactivación':'Nuevo'}</span>
    </td>
    <td><button type="button" class="check-btn${c.llamo?' on':''}" id="fl-${num}" onclick="toggleChk('fl-${num}')">${c.llamo?'✓':'○'}</button></td>
    <td><button type="button" class="check-btn${c.reunion?' on':''}" id="fr2-${num}" onclick="toggleChk('fr2-${num}')">${c.reunion?'✓':'○'}</button></td>
    <td><input type="number" id="fp-${num}" min="0" max="20" value="${c.prospectos||0}"></td>
    <td><button type="button" class="del-btn" onclick="eliminarFila(${num})">×</button></td>
  </tr>`;
}
function showSug(num,query){
  const box=document.getElementById('sug-'+num); if(!box)return;
  const m=getContactSuggestions(G.usuario,query);
  if(!m.length){box.style.display='none';return;}
  box.innerHTML=m.map(c=>`<div onclick="selSug(${num},'${c.nombre.replace(/'/g,"\\'")}','${c.vinculo}')"
    style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--g100)"
    onmouseover="this.style.background='var(--blue-pale)'" onmouseout="this.style.background=''">
    ${c.nombre} <span style="font-size:11px;color:var(--g400)">(${c.vinculo})</span>
    <span style="font-size:10px;color:var(--teal);float:right">← Reactivar</span></div>`).join('');
  box.style.display='block';
}
function hideSug(num){const el=document.getElementById('sug-'+num);if(el)el.style.display='none';}
function selSug(num,nombre,vinculo){
  const fn=document.getElementById('fn-'+num); if(fn)fn.value=nombre;
  hideSug(num);
  const ft=document.getElementById('ft-'+num); if(ft) ft.value='reactivacion';
  const lbl=document.getElementById('ft-lbl-'+num); if(lbl){lbl.textContent='✦ Reactivación';lbl.style.color='var(--teal)';}
  updRowType(num);
  const fv=document.getElementById('fv-'+num);
  if(fv){for(let o of fv.options)if(o.value===vinculo){o.selected=true;break;}}
}
function updRowType(num){
  const ft=document.getElementById('ft-'+num);
  const tr=document.getElementById('fr-'+num);
  if(tr&&ft)tr.style.background=ft.value==='reactivacion'?'var(--teal-lt)':'';
}

function agregarFila(c={}){
  G.filaCount++;
  const tbody=document.getElementById('tbody-form'); if(!tbody)return;
  const tr=document.createElement('tr'); tr.id=`fr-${G.filaCount}`;
  tr.innerHTML=filaHtml(G.filaCount,c).replace(/^<tr[^>]*>|<\/tr>$/g,'');
  tbody.appendChild(tr);
}
function eliminarFila(num){ const el=document.getElementById(`fr-${num}`); if(el)el.remove(); }
function toggleChk(id){ const el=document.getElementById(id); if(!el)return; const on=el.classList.toggle('on'); el.textContent=on?'✓':'○'; }

function checkDuplicadoEnForm(num){
  const input=document.getElementById(`fn-${num}`);
  const warn=document.getElementById(`fn-warn-${num}`);
  if(!input||!warn) return;
  const nombre=input.value.trim();
  if(!nombre){warn.style.display='none';input.style.borderColor='';return;}
  const nNorm=normNombre(nombre);
  // Check all other rows in the form
  const allInputs=document.querySelectorAll('[id^="fn-"]');
  let dupeNombre=null;
  allInputs.forEach(inp=>{
    if(inp.id===`fn-${num}`) return;
    const otro=(inp.value||'').trim();
    if(!otro) return;
    const oNorm=normNombre(otro);
    // Match if: fuzzy similar OR one contains the other (e.g. "Hugo Luco" vs "Hugo Luco González")
    if(esSimilar(nombre,otro) || nNorm.startsWith(oNorm) || oNorm.startsWith(nNorm) ||
       nNorm.includes(oNorm) || oNorm.includes(nNorm)){
      dupeNombre=otro;
    }
  });
  if(dupeNombre){
    warn.style.display='block';
    warn.textContent=`⚠ Posible duplicado de "${dupeNombre}" — ¿es la misma persona?`;
    input.style.borderColor='#BA7517';
  } else {
    warn.style.display='none';
    input.style.borderColor='';
  }
}

function leerForm(){
  const tbody=document.getElementById('tbody-form'); if(!tbody)return[];
  const out=[];
  tbody.querySelectorAll('tr').forEach(tr=>{
    const num=tr.id.replace('fr-','');
    const nombre=document.getElementById(`fn-${num}`)?.value?.trim();
    if(!nombre)return;
    out.push({
      nombre,
      vinculo:       document.getElementById(`fv-${num}`)?.value||'Conocido/a',
      tipo_contacto: document.getElementById(`ft-${num}`)?.value||'nuevo',
      llamo:         document.getElementById(`fl-${num}`)?.classList.contains('on')||false,
      reunion:       document.getElementById(`fr2-${num}`)?.classList.contains('on')||false,
      prospectos:    parseInt(document.getElementById(`fp-${num}`)?.value||0)
    });
  });
  return out;
}

/* ══ DETECCIÓN DE HOMÓNIMOS Y CONVERSIÓN A NODO ══ */
let _homonimoCtx = null; // context for homonym resolution

function abrirModalNodo(nombre,numNodo){
  document.getElementById('nodo-cel-title').textContent=`¡${nombre} es tu Nodo ${numNodo}!`;
  document.getElementById('nodo-cel-body').textContent=`${nombre} ha vuelto a referirte prospectos. Has profundizado esta relación y ahora tienes un nodo activo más en tu red. ¡Sigue cultivando esta confianza!`;
  document.getElementById('modal-nodo').classList.add('open');
}
function cerrarModalNodo(){
  document.getElementById('modal-nodo').classList.remove('open');
  renderNodosPanel();
}

function abrirModalHomonimo(nombre,prevData,filaNum,cb){
  _homonimoCtx={filaNum,cb,prevData,nombre};
  const sim=Math.round(similitud(nombre,prevData.nombre)*100);
  document.getElementById('hom-title').textContent=`"${nombre}" es similar a un contacto anterior (${sim}% coincidencia)`;
  document.getElementById('hom-prev').innerHTML=
    `Contacto anterior encontrado: <strong>${prevData.nombre}</strong> · ${prevData.vinculo||'—'} · `+
    `${prevData.prospectos||0} prospectos previos`;
  document.getElementById('modal-homonimo').classList.add('open');
}
function homonimoEsMismo(){
  document.getElementById('modal-homonimo').classList.remove('open');
  if(_homonimoCtx?.cb) _homonimoCtx.cb('mismo');
}
function homonimoEsDistinto(){
  document.getElementById('modal-homonimo').classList.remove('open');
  if(_homonimoCtx){
    // Ask for identifier
    const id=prompt(`Agrega un identificador para distinguirlo:\n(ej. "${_homonimoCtx.nombre} (amigo de Carlos)")`);
    if(id){
      const fn=document.getElementById(`fn-${_homonimoCtx.filaNum}`);
      if(fn) fn.value=id;
    }
    if(_homonimoCtx.cb) _homonimoCtx.cb('distinto');
  }
}

async function checkYConvertirNodo(asesor,nombre,vinculo,prospectos,semanaInicio){
  try{
    const nombreNorm=normNombre(nombre);

    // 1. Check if already a confirmed nodo (fetch all, filter client-side)
    const todosNodos=await SB.get('nodos',`asesor=eq.${encodeURIComponent(asesor)}`);
    const existingNodo=todosNodos.find(n=>esMismoExacto(n.nombre,nombre)||esSimilar(n.nombre,nombre));
    if(existingNodo){
      // Check if activation for this week already exists
      const actExiste=await SB.get('activaciones_nodo',
        `nodo_id=eq.${existingNodo.id}&semana_inicio=eq.${semanaInicio}&limit=1`);
      if(actExiste.length===0){
        // No activation yet this week → create it
        await SB.patch('nodos',{
          activaciones:(existingNodo.activaciones||2)+1,
          total_prospectos:(existingNodo.total_prospectos||0)+(prospectos||0),
          ultima_activacion:semanaInicio
        },`id=eq.${existingNodo.id}`);
        await SB.post('activaciones_nodo',{
          nodo_id:existingNodo.id,asesor,semana_inicio:semanaInicio,prospectos:prospectos||0
        });
      } else {
        // Activation exists — update with new prospectos value (asesor edited the report)
        const prevProsp=actExiste[0].prospectos||0;
        const diff=(prospectos||0)-prevProsp;
        if(diff!==0){
          // Update activation record
          await SB.patch('activaciones_nodo',
            {prospectos:prospectos||0},
            `id=eq.${actExiste[0].id}`);
          // Update nodo total by the difference
          await SB.patch('nodos',{
            total_prospectos:Math.max(0,(existingNodo.total_prospectos||0)+diff),
            ultima_activacion:semanaInicio
          },`id=eq.${existingNodo.id}`);
        }
      }
      return {esNodo:true,esNuevo:false};
    }

    // 2. Fetch ALL contactos for this asesor and filter client-side with normNombre
    const [allContactos, currentReps] = await Promise.all([
      SB.get('contactos',`asesor=eq.${encodeURIComponent(asesor)}&select=reporte_id,prospectos,created_at,nombre`),
      SB.get('reportes',`asesor=eq.${encodeURIComponent(asesor)}&semana_inicio=eq.${semanaInicio}&select=id`)
    ]);
    const currentRepIds=new Set(currentReps.map(r=>r.id));

    // Find contacts with matching normalized name from OTHER weeks
    const prevOtherWeek=allContactos.filter(c=>
      esSimilar(c.nombre,nombre) && !currentRepIds.has(c.reporte_id)
    );

    if(prevOtherWeek.length>0){
      // Confirmed reactivation → convert to nodo!
      const numNodo=todosNodos.length+1;
      const result=await SB.post('nodos',{
        asesor,
        nombre,  // save with the canonical name from this entry
        vinculo:vinculo||'Conocido/a',
        fecha_primer_contacto:prevOtherWeek[0]?.created_at?.slice(0,10)||semanaInicio,
        fecha_conversion:semanaInicio,
        activaciones:2,
        total_prospectos:(prevOtherWeek[0]?.prospectos||0)+(prospectos||0),
        ultima_activacion:semanaInicio
      });
      const newNodo=Array.isArray(result)?result[0]:result;
      if(newNodo?.id){
        await SB.post('activaciones_nodo',{
          nodo_id:newNodo.id,asesor,semana_inicio:semanaInicio,prospectos:prospectos||0
        });
      }
      return {esNodo:true,esNuevo:true,numNodo,nombre};
    }
    return {esNodo:false};
  }catch(e){
    console.error('checkYConvertirNodo error:',e);
    return {esNodo:false};
  }
}

/* ══ NORMALIZACIÓN Y SIMILITUD DE NOMBRES ══ */
function normNombre(s){
  if(!s) return '';
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,'')
    .trim().replace(/\s+/g,' ');
}

// Levenshtein distance
function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

// Similarity score 0-1 between two normalized names
function similitud(a,b){
  a=normNombre(a); b=normNombre(b);
  if(!a||!b) return 0;
  if(a===b) return 1;
  const maxLen=Math.max(a.length,b.length);
  if(maxLen===0) return 1;
  // Full name similarity
  const fullSim=(maxLen-levenshtein(a,b))/maxLen;
  // Also compare first word (first name) separately for bonus
  const aParts=a.split(' '), bParts=b.split(' ');
  const fnSim=aParts[0]&&bParts[0]?(Math.max(aParts[0].length,bParts[0].length)-levenshtein(aParts[0],bParts[0]))/Math.max(aParts[0].length,bParts[0].length):0;
  // If first names match well, boost overall score
  return fnSim>0.8 ? Math.max(fullSim, fullSim*0.7+fnSim*0.3) : fullSim;
}

const SIMILITUD_THRESHOLD = 0.70; // 70% similarity triggers homonym check

function esSimilar(a,b){ return similitud(a,b) >= SIMILITUD_THRESHOLD; }
function esMismoExacto(a,b){ return normNombre(a)===normNombre(b); }
async function guardarBorrador(rid){
  const contactos=leerForm();
  if(!contactos.length){ showMsg('form-err','Ingresa al menos un contacto con nombre.'); return; }
  hideMsg('form-err'); hideMsg('form-ok');
  const btn=document.querySelector(`[onclick*="guardarBorrador"]`);
  if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }
  try{
    // Get reporte semana_inicio
    const [repData]=await SB.get('reportes',`id=eq.${rid}&select=semana_inicio`);
    const semanaInicio=repData?.semana_inicio||getLunes();

    // Detect homonyms before saving
    const historial=await SB.get('contactos',
      `asesor=eq.${encodeURIComponent(G.usuario)}&select=nombre,vinculo,prospectos,reporte_id,created_at&order=created_at.desc`);
    const currentReps=await SB.get('reportes',`asesor=eq.${encodeURIComponent(G.usuario)}&semana_inicio=eq.${semanaInicio}&select=id`);
    const currentRepIds=new Set(currentReps.map(r=>r.id));

    // Load confirmed nodos to skip modal for already-converted contacts
    const nodosConfirmados=await getNodos(G.usuario);

    for(const c of contactos){
      if(!c.nombre) continue;
      // Skip if already marked reactivacion or nodo activation
      if(c.tipo_contacto==='reactivacion'||c.tipo_contacto==='activacion_nodo') continue;
      // Skip if already a confirmed nodo — mark automatically, no modal needed
      const esNodoYa=nodosConfirmados.some(n=>esSimilar(n.nombre,c.nombre));
      if(esNodoYa){ c.tipo_contacto='reactivacion'; continue; }
      // Check if name exists in a DIFFERENT week
      const prevOther=historial.filter(h=>
        h.nombre && esSimilar(h.nombre,c.nombre) &&
        !currentRepIds.has(h.reporte_id)
      );
      if(prevOther.length>0){
        // Always ask — both exact and fuzzy matches — so the asesor is aware
        await new Promise(resolve=>{
          abrirModalHomonimo(c.nombre, prevOther[0], null, (decision)=>{
            if(decision==='mismo'){
              c.nombre=prevOther[0].nombre; // use canonical name from history
              c.tipo_contacto='reactivacion';
            }
            resolve();
          });
        });
      }
    }

    // ── DEDUPLICATE: remove repeated/similar names within this week's form ──
    const seenContactos=[];
    const contactosFinal=[];
    for(const c of contactos){
      if(!c.nombre) continue;
      const nNorm=normNombre(c.nombre);
      const esDupe=seenContactos.some(s=>{
        const sNorm=normNombre(s);
        return esSimilar(s,c.nombre) || nNorm.startsWith(sNorm) || sNorm.startsWith(nNorm) ||
               nNorm.includes(sNorm) || sNorm.includes(nNorm);
      });
      if(!esDupe){
        seenContactos.push(c.nombre);
        contactosFinal.push(c);
      }
    }

    // Save contacts (deduplicated)
    await SB.del('contactos',`reporte_id=eq.${rid}`);
    for(const c of contactosFinal){
      await SB.post('contactos',{...c,reporte_id:rid,asesor:G.usuario,empresa:(G.empresa||'zurich')});
    }

    // ── CLEANUP ORPHAN NODOS ──
    const nombresGuardados = new Set(contactosFinal.map(c=>normNombre(c.nombre)));
    const nodosEstaSemana = await SB.get('nodos',
      `asesor=eq.${encodeURIComponent(G.usuario)}&fecha_conversion=eq.${semanaInicio}`);
    for(const n of nodosEstaSemana){
      const sigueEnForm = [...nombresGuardados].some(nom=>esSimilar(nom, n.nombre) || normNombre(n.nombre)===nom);
      if(!sigueEnForm){
        // Delete activaciones first (FK), then the nodo
        await SB.del('activaciones_nodo',`nodo_id=eq.${n.id}`);
        await SB.del('nodos',`id=eq.${n.id}`);
      }
    }

    // Detect and create nodos for reactivations
    const nodosNuevos=[];
    for(const c of contactosFinal){
      if(c.tipo_contacto==='reactivacion'){
        const result=await checkYConvertirNodo(G.usuario,c.nombre,c.vinculo,c.prospectos,semanaInicio);
        if(result.esNodo && result.esNuevo) nodosNuevos.push(result);
      }
    }

    if(btn){ btn.disabled=false; btn.textContent='💾 Guardar reporte'; }

    // Celebrate new nodos
    if(nodosNuevos.length>0) abrirModalNodo(nodosNuevos[0].nombre, nodosNuevos[0].numNodo);

    await renderReporteLista();
    await renderNodosPanel();
    showProximoLunesBanner();
  }catch(e){
    if(btn){ btn.disabled=false; btn.textContent='💾 Guardar reporte'; }
    showMsg('form-err','Error al guardar: '+e.message);
    console.error('guardarBorrador error:',e);
  }
}



/* ══════════════════════════════════════════════════════════════
   METAS (supervisor)
══════════════════════════════════════════════════════════════ */
async function renderMetas(){
  const cont=document.getElementById('metas-content');
  cont.innerHTML='<div class="ib bl">Cargando metas…</div>';
  const metas={};
  for(const a of ASESORES) metas[a]=await getMeta(a);

  cont.innerHTML=`
  <div class="ib am"><strong>Define las metas de prospección para cada asesor.</strong> Estas metas se vinculan automáticamente con el informe de avance. Para mayor precisión, usa el Simulador de Metas primero.</div>
  <div class="card" style="overflow-x:auto">
    <table class="dt">
      <thead><tr><th>Asesor</th><th>Contactos/semana</th><th>Prospectos/mes</th><th>Ventas/mes</th><th>Meta ingresos $</th><th></th></tr></thead>
      <tbody>
        ${ASESORES.map(a=>`<tr>
          <td><strong>${a}</strong></td>
          <td><input type="number" class="inp-num" id="mc-${a}" value="${metas[a].meta_contactos_semana}" min="1" max="20"></td>
          <td><input type="number" class="inp-num" id="mp-${a}" value="${metas[a].meta_prospectos_mes}" min="1" max="100"></td>
          <td><input type="number" class="inp-num" id="mv-${a}" value="${metas[a].meta_ventas_mes}" min="1" max="30"></td>
          <td><input type="number" class="inp-num" style="width:130px" id="mi-${a}" value="${metas[a].meta_ingresos}" min="0" step="50000"></td>
          <td><button class="btn btn-primary" style="padding:7px 14px;font-size:12px" onclick="guardarMeta('${a}')">Guardar</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="msg gn" id="metas-ok"></div>
    <div class="msg rd" id="metas-err"></div>
  </div>`;
}

async function guardarMeta(asesor){
  const data={
    asesor,
    meta_contactos_semana:parseInt(document.getElementById(`mc-${asesor}`)?.value||3),
    meta_prospectos_mes:  parseInt(document.getElementById(`mp-${asesor}`)?.value||15),
    meta_ventas_mes:      parseInt(document.getElementById(`mv-${asesor}`)?.value||5),
    meta_ingresos:        parseInt(document.getElementById(`mi-${asesor}`)?.value||2000000),
    updated_at:new Date().toISOString()
  };
  try{
    await SB.upsert('metas',data,'asesor');
    showMsg('metas-ok',`✓ Meta de ${asesor} guardada.`,'gn');
    setTimeout(()=>hideMsg('metas-ok'),3000);
  }catch(e){ showMsg('metas-err','Error: '+e.message); }
}

/* ══════════════════════════════════════════════════════════════
   INGRESOS (supervisor)
══════════════════════════════════════════════════════════════ */
async function renderIngresos(){
  const cont=document.getElementById('ingresos-content');
  cont.innerHTML='<div class="ib bl">Cargando…</div>';
  const meses=last6Meses();
  const mesOpts=meses.map((m,i)=>`<option value="${m}"${i===0?' selected':''}>${getMesLabel(m)}</option>`).join('');
  const savedReset=localStorage?.getItem?.('gap_reset_periodo')||'semestral';

  cont.innerHTML=`
  <div class="ib bl"><strong>Agrega los ingresos reales mensuales de cada asesor.</strong> Este dato se vincula automáticamente con el informe de avance para mostrar la correlación actividad → ingresos.</div>



  <div class="card" style="overflow-x:auto">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <label style="font-size:13px;font-weight:500">Mes:</label>
      <select class="sel-std" id="sel-mes-ing" onchange="cargarFilasIngresos()">
        ${mesOpts}
      </select>
    </div>
    <table class="dt">
      <thead><tr><th>Asesor</th><th>Ingreso real del mes</th><th>Meta simulador</th><th>% Cumplimiento</th><th></th></tr></thead>
      <tbody id="tbody-ing"></tbody>
    </table>
    <div class="msg gn" id="ing-ok"></div>
    <div class="msg rd" id="ing-err"></div>
  </div>`;

  cargarFilasIngresos();
}

async function cargarFilasIngresos(){
  const mes=document.getElementById('sel-mes-ing')?.value||getMesActual();
  const tbody=document.getElementById('tbody-ing');
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="5" style="color:var(--g400);padding:14px">Cargando…</td></tr>';
  const rows=await Promise.all(ASESORES.map(async a=>{
    const [ing,meta]=await Promise.all([getIngreso(a,mes),getMeta(a)]);
    const pct=meta.meta_ingresos?Math.round(ing/meta.meta_ingresos*100):0;
    return {a,ing,meta,pct};
  }));
  tbody.innerHTML=rows.map(({a,ing,meta,pct})=>`<tr>
    <td><strong>${a}</strong></td>
    <td><input type="number" class="inp-num" style="width:140px" id="ing-${a}" value="${ing}" min="0" step="10000"></td>
    <td style="color:var(--g400)">${fmt(meta.meta_ingresos)}</td>
    <td><span class="pill ${pct>=80?'pill-gn':pct>=50?'pill-am':'pill-rd'}">${pct}%</span></td>
    <td><button class="btn btn-primary" style="padding:7px 14px;font-size:12px" onclick="guardarIngreso('${a}')">Guardar</button></td>
  </tr>`).join('');
}

function guardarResetGap(val){ try{ localStorage.setItem('gap_reset_periodo', val); }catch{} }

function toggleBitacoraGuia(){
  const g=document.getElementById('bitacora-guia');
  const b=document.getElementById('btn-guia');
  if(!g)return;
  const visible=g.style.display!=='none';
  g.style.display=visible?'none':'block';
  if(b) b.textContent=visible?'💡 ¿Cómo funciona?':'✕ Cerrar guía';
}

async function guardarIngreso(asesor){
  const mes=document.getElementById('sel-mes-ing')?.value||getMesActual();
  const val=parseInt(document.getElementById(`ing-${asesor}`)?.value||0);
  try{
    await SB.upsert('ingresos',{asesor,mes,ingreso_real:val},'asesor,mes');
    showMsg('ing-ok',`✓ Ingreso de ${asesor} guardado.`,'gn');
    setTimeout(()=>hideMsg('ing-ok'),3000);
  }catch(e){ showMsg('ing-err','Error: '+e.message); }
}

/* ══════════════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════════════ */
function abrirModal(titulo,cuerpo,cb){
  document.getElementById('modal-title').textContent=titulo;
  document.getElementById('modal-body').textContent=cuerpo;
  document.getElementById('modal-ok').onclick=cb;
  document.getElementById('modal').classList.add('open');
}
function cerrarModal(){ document.getElementById('modal').classList.remove('open'); }

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
async function guardarMetasEnTracker(){
  const m = window._simMeta;
  if(!m){alert('Primero configura la simulación.');return}
  if(m.meta_prospectos_mes<=1){
    alert('⚠ Configura los métodos de prospección antes de guardar.\nLos porcentajes del funnel están en 0%, lo que generaría una meta inválida.');
    return;
  }
  try{
    await SB.upsert('metas',{...m, updated_at:new Date().toISOString()},'asesor');
    const btn=document.querySelector('[onclick="guardarMetasEnTracker()"]');
    if(btn){btn.textContent='✓ Metas guardadas para '+m.asesor;btn.style.background='var(--teal)';btn.style.color='white';setTimeout(()=>{btn.textContent='💾 Guardar metas de '+m.asesor+' en Tracker';btn.style.background='';btn.style.color='';},3000)}
  }catch(e){alert('Error al guardar metas: '+e.message)}
}

// Contact history cache per asesor
let _contactHistory = {};

async function loadContactHistory(asesor){
  try{
    const data = await SB.get('contactos', `asesor=eq.${encodeURIComponent(asesor)}&select=nombre,vinculo&order=created_at.desc`);
    const seen = new Set();
    _contactHistory[asesor] = data.filter(c=>{
      const cn=normNombre(c.nombre);
      if(seen.has(cn)) return false;
      // Also check fuzzy duplicates
      for(const s of seen) if(levenshtein(cn,s)/Math.max(cn.length,s.length)<0.15) return false;
      seen.add(cn); return true;
    });
  }catch{ _contactHistory[asesor]=[]; }
}

function getContactSuggestions(asesor, query){
  const hist = _contactHistory[asesor]||[];
  if(!query||query.length<2) return [];
  const qn=normNombre(query);
  return hist.filter(c=>{
    const cn=normNombre(c.nombre);
    return cn.includes(qn) || qn.includes(cn) || esSimilar(c.nombre,query);
  }).sort((a,b)=>similitud(b.nombre,query)-similitud(a.nombre,query)).slice(0,6);
}

async function getNodos(asesor){
  // Load from nodos table
  try{
    const data=await SB.get('nodos',
      `asesor=eq.${encodeURIComponent(asesor)}&order=activaciones.desc`);
    return data;
  }catch(e){console.error('getNodos error:',e);return[];}
}
async function getActivacionesSemana(asesor,semanaInicio){
  try{
    const nods=await getNodos(asesor);
    if(!nods.length)return[];
    const nIds=nods.map(n=>n.id).join(',');
    const acts=await SB.get('activaciones_nodo',
      `asesor=eq.${encodeURIComponent(asesor)}&semana_inicio=eq.${semanaInicio}`);
    return acts.map(a=>({...a,nodo:nods.find(n=>n.id===a.nodo_id)}));
  }catch{return[];}
}
/* upsertNodo removed — logic merged into checkYConvertirNodo */


/* ══ PRÓXIMO LUNES ══ */
function getProximoLunes(){
  const now=new Date(),day=now.getDay();
  const daysUntil=day===1?7:(8-day)%7||7;
  const next=new Date(now);next.setDate(now.getDate()+daysUntil);
  // Format: "lunes 4 de mayo de 2026" (weekday included once)
  return next.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
function showProximoLunesBanner(){
  const b=document.getElementById('proximo-lunes-banner');
  if(!b)return;
  b.style.display='block';
  // Calculate next Monday (the upcoming report period)
  const proxFecha=getProximoLunes();
  b.innerHTML=`<div class="ib gn" style="margin-bottom:0">
    <strong>✓ Reporte guardado.</strong> Tu próximo reporte corresponde al <strong>${proxFecha}</strong>.
    Recuerda ingresar tus contactos de esa semana.
  </div>`;
  // Auto-hide after 15 seconds
  setTimeout(()=>{if(b)b.style.display='none';},15000);
}

/* ══ NODOS PANEL ══ */
async function renderNodosPanel(){
  const p=document.getElementById('nodos-panel');if(!p)return;
  const nodos=await getNodos(G.usuario);

  // Use the most recent report week for this asesor (not necessarily calendar Monday)
  // This handles test mode where the new week has a future date
  const mesActual=getMesActual();
  const reportesMes=await getReportesMes(G.usuario,mesActual).catch(()=>[]);
  const semanaRef = reportesMes.length>0
    ? reportesMes.sort((a,b)=>new Date(b.semana_inicio)-new Date(a.semana_inicio))[0].semana_inicio
    : getLunes();

  if(!nodos.length){
    p.style.display='block';
    p.innerHTML=`<div class="card" style="border:1.5px dashed var(--teal);background:white;padding:16px 18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:22px">🌱</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--teal)">Mis Nodos Activos</div>
          <div style="font-size:11px;color:var(--g400)">Aún no tienes nodos confirmados</div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--g700);line-height:1.6">Un contacto se convierte en <strong>nodo</strong> cuando vuelve a referirte prospectos por segunda vez. Es el indicador de profundización de tu red. Cuando ocurra, aparecerá aquí.</p>
    </div>`;
    return;
  }

  // Load activaciones of the most recent week (not calendar week)
  const actsEstaSemanea=await getActivacionesSemana(G.usuario,semanaRef);
  const nodosConAct=actsEstaSemanea.map(a=>a.nodo_id);

  p.style.display='block';
  p.innerHTML=`<div class="card" style="border:2px solid var(--teal)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div class="card-title" style="margin-bottom:0;color:var(--teal)">✦ Mis Nodos Activos — ${nodos.length} nodo${nodos.length>1?'s':''}</div>
      <span style="font-size:11px;color:var(--g400)">Semana: ${semanaRef}</span>
    </div>
    <p style="font-size:12px;color:var(--g700);margin-bottom:14px;line-height:1.5">
      Un <strong>nodo</strong> es un contacto que ha vuelto a referirte prospectos. Puedes registrar nuevas activaciones esta semana haciendo clic en <strong>"+ Activar esta semana"</strong>.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px" id="nodos-grid">
      ${nodos.map(n=>{
        const yaActivo=nodosConAct.includes(n.id);
        const actEsta=actsEstaSemanea.find(a=>a.nodo_id===n.id);
        return `<div id="nodo-card-${n.id}" style="background:${yaActivo?'var(--teal-lt)':'white'};border-radius:var(--r);padding:12px 14px;border:1.5px solid ${yaActivo?'var(--teal)':'rgba(15,110,86,.2)'};transition:all .3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:16px">${yaActivo?'🌳':'🌿'}</span>
              <div style="font-size:13px;font-weight:600;color:var(--g900)">${n.nombre}</div>
            </div>
            <button onclick="eliminarNodo('${n.id}','${n.nombre.replace(/'/g,"\\\'")}')"
              style="background:none;border:none;cursor:pointer;color:var(--g400);font-size:16px;line-height:1;padding:2px 4px;border-radius:4px"
              title="Eliminar nodo">🗑</button>
          </div>
          <div style="font-size:11px;color:var(--teal);margin-bottom:2px">✦ ${n.activaciones} activaciones · ${n.total_prospectos||0} prosp. totales</div>
          <div style="font-size:11px;color:var(--g400);margin-bottom:8px">Conversión: ${n.fecha_conversion||'—'} · Vínculo: ${n.vinculo||'—'}</div>
          ${yaActivo
            ?`<div style="font-size:11px;color:var(--teal);font-weight:500">✓ Activado esta semana · ${actEsta?.prospectos||0} prospectos</div>`
            :`<div id="act-form-${n.id}" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--g200)">
               <div style="font-size:12px;font-weight:500;color:var(--g700);margin-bottom:6px">¿Cuántos prospectos te dio esta semana?</div>
               <div style="display:flex;gap:6px;align-items:center">
                 <input type="number" id="act-prosp-${n.id}" min="0" max="30" value="0"
                   style="width:70px;padding:6px 8px;border:1.5px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;text-align:center;outline:none">
                 <button class="btn btn-success" style="font-size:12px;padding:6px 12px"
                   onclick="registrarActivacion('${n.id}','${n.nombre}')">Guardar</button>
                 <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px"
                   onclick="document.getElementById('act-form-${n.id}').style.display='none'">✕</button>
               </div>
             </div>
             <button class="btn btn-secondary" style="font-size:11px;padding:5px 10px;margin-top:6px"
               onclick="document.getElementById('act-form-${n.id}').style.display=document.getElementById('act-form-${n.id}').style.display==='none'?'block':'none'">
               + Activar esta semana
             </button>`
          }
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--g200)">
      <p style="font-size:11px;color:var(--g400);margin-bottom:8px;font-weight:500;text-transform:uppercase;letter-spacing:.05em">Evolución de nodos acumulados</p>
      <div style="position:relative;height:120px"><canvas id="chart-nodos-trend" aria-label="Evolución de nodos"></canvas></div>
    </div>
  </div>`;

  // Render nodos trend chart
  requestAnimationFrame(async()=>{
    // Get activaciones history for trend
    try{
      const allActs=await SB.get('activaciones_nodo',
        `asesor=eq.${encodeURIComponent(G.usuario)}&order=semana_inicio.asc&select=semana_inicio,nodo_id`);
      // Group by month
      const byMes={};
      allActs.forEach(a=>{
        const mo=a.semana_inicio?.slice(0,7);
        if(!mo)return;
        if(!byMes[mo])byMes[mo]=new Set();
        byMes[mo].add(a.nodo_id);
      });
      const mesesLabels=Object.keys(byMes).sort();
      let acum=0;
      const dataAcum=mesesLabels.map(mo=>{acum+=byMes[mo].size;return acum;});
      const dataMes=mesesLabels.map(mo=>byMes[mo].size);

      if(G.charts['nodos-trend']){G.charts['nodos-trend'].destroy();}
      const ctx=document.getElementById('chart-nodos-trend');
      if(ctx) G.charts['nodos-trend']=new Chart(ctx,{
        data:{labels:mesesLabels.map(m=>{const[y,mo]=m.split('-');return MESES_NOM[parseInt(mo)-1].slice(0,3)+' '+y.slice(2);}),
          datasets:[
            {type:'line',label:'Nodos acumulados',data:dataAcum,borderColor:'#0F6E56',backgroundColor:'rgba(15,110,86,.1)',fill:true,tension:.3,yAxisID:'y'},
            {type:'bar',label:'Activaciones del mes',data:dataMes,backgroundColor:'rgba(15,110,86,.3)',yAxisID:'y'},
          ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
          scales:{y:{ticks:{font:{size:10},stepSize:1}}}}
      });
    }catch(e){console.warn('nodos chart error:',e);}
  });
}

async function registrarActivacion(nodoId,nombreNodo){
  const prosp=parseInt(document.getElementById(`act-prosp-${nodoId}`)?.value||0);
  // Use most recent report week, same logic as renderNodosPanel
  const reportesMes=await getReportesMes(G.usuario,getMesActual()).catch(()=>[]);
  const lunes=reportesMes.length>0
    ? reportesMes.sort((a,b)=>new Date(b.semana_inicio)-new Date(a.semana_inicio))[0].semana_inicio
    : getLunes();
  try{
    // Get nodo data
    const [nodo]=await SB.get('nodos',`id=eq.${nodoId}`);
    // Update nodo
    await SB.patch('nodos',{
      activaciones:(nodo.activaciones||2)+1,
      total_prospectos:(nodo.total_prospectos||0)+prosp,
      ultima_activacion:lunes
    },`id=eq.${nodoId}`);
    // Save activacion
    await SB.post('activaciones_nodo',{
      nodo_id:nodoId, asesor:G.usuario,
      semana_inicio:lunes, prospectos:prosp
    });
    // Also save as contacto in current week's reporte (marked as nodo activation)
    const mesActual=getMesActual();
    const reportes=await getReportesMes(G.usuario,mesActual);
    const repActual=reportes.find(r=>r.semana_inicio===lunes);
    if(repActual){
      await SB.post('contactos',{
        reporte_id:repActual.id, asesor:G.usuario, empresa:(G.empresa||'zurich'),
        nombre:nombreNodo+'  ✦', vinculo:nodo.vinculo||'Conocido/a',
        tipo_contacto:'activacion_nodo',
        llamo:true, reunion:true, prospectos:prosp
      });
    }
    // Refresh panel
    await renderNodosPanel();
  }catch(e){alert('Error al registrar activación: '+e.message);}
}

/* ══ EQUIPO COMPLETO ══ */
async function eliminarNodo(nodoId, nombreNodo){
  const confirmar = confirm(
    `¿Eliminar el nodo "${nombreNodo}"?\n\nEsto borrará el nodo, sus activaciones y eliminará a esta persona del reporte actual. Esta acción no se puede deshacer.`
  );
  if(!confirmar) return;
  try{
    // 1. Delete activaciones (FK first)
    await SB.del('activaciones_nodo',`nodo_id=eq.${nodoId}`);
    // 2. Delete nodo
    await SB.del('nodos',`id=eq.${nodoId}`);
    // 3. Get all contactos of this person for this asesor and reset tipo_contacto
    //    so the system doesn't recreate the nodo on next save
    const allC=await SB.get('contactos',
      `asesor=eq.${encodeURIComponent(G.usuario)}&select=id,nombre`);
    const matchC=allC.filter(c=>esSimilar(c.nombre,nombreNodo));
    for(const c of matchC){
      await SB.patch('contactos',{tipo_contacto:'nuevo'},`id=eq.${c.id}`);
    }
    // 4. Remove this person from the current week's report entirely
    const mesActual=getMesActual();
    const reportesMes=await getReportesMes(G.usuario,mesActual);
    if(reportesMes.length){
      const repActual=reportesMes.sort((a,b)=>new Date(b.semana_inicio)-new Date(a.semana_inicio))[0];
      const contactosRep=await SB.get('contactos',
        `reporte_id=eq.${repActual.id}&select=id,nombre`);
      for(const c of contactosRep){
        if(esSimilar(c.nombre,nombreNodo)){
          await SB.del('contactos',`id=eq.${c.id}`);
        }
      }
    }
    // 5. Refresh
    await renderNodosPanel();
    await renderReporteLista();
  }catch(e){
    alert('Error al eliminar el nodo: '+e.message);
    console.error('eliminarNodo error:',e);
  }
}

async function eliminarContacto(contactoId, reporteId){
  if(!confirm('¿Eliminar este contacto del reporte?')) return;
  try{
    await SB.del('contactos',`id=eq.${contactoId}`);
    await renderReporteLista();
    await renderNodosPanel();
  }catch(e){
    alert('Error al eliminar: '+e.message);
  }
}

function kpiCard(lbl,val,sub,cls,thermo=false){
  const bg=cls==='ok'?'var(--teal-lt)':cls==='warn'?'var(--amber-lt)':cls==='bad'?'var(--red-lt)':'var(--g100)';
  const vc=cls==='ok'?'var(--teal)':cls==='warn'?'var(--amber)':cls==='bad'?'var(--red)':'var(--g900)';
  const th=thermo?`<div style="height:5px;background:var(--g200);border-radius:3px;overflow:hidden;margin-top:6px"><div style="height:100%;width:${Math.min(parseInt(val),100)}%;background:${vc};border-radius:3px"></div></div>`:'';
  return `<div style="background:${bg};border-radius:var(--r);padding:13px 15px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--g400);margin-bottom:4px">${lbl}</div>
    <div style="font-size:22px;font-weight:500;color:${vc};line-height:1.1">${val}</div>
    <div style="font-size:11px;color:var(--g400);margin-top:3px">${sub}</div>${th}
  </div>`;
}
function gapCard(lbl,val,sub,desc){
  const neg=typeof val==='number'?val<0:String(val).startsWith('-');
  const vc=neg?'#A32D2D':'#0F6E56';
  return `<div style="background:white;border:1px solid var(--g200);border-radius:var(--r);padding:13px 15px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--g400);margin-bottom:4px">${lbl}</div>
    <div style="font-size:22px;font-weight:500;color:${vc};line-height:1.1">${val}</div>
    <div style="font-size:11px;color:var(--g400);margin-top:3px">${sub}</div>
    <div style="font-size:10px;font-weight:500;color:${vc};margin-top:4px;text-transform:uppercase;letter-spacing:.05em">${desc}</div>
  </div>`;
}

async function renderEquipo(){
  const mes=document.getElementById('sel-mes-equipo')?.value||getMesActual();
  const periodos=parseInt(document.getElementById('sel-periodo-equipo')?.value||'1');
  const cont=document.getElementById('equipo-content');
  cont.innerHTML='<div class="ib bl">⏳ Cargando datos del equipo…</div>';

  // Build list of months
  const [y,m]=mes.split('-');
  const meses=[];
  for(let i=periodos-1;i>=0;i--){
    const d=new Date(parseInt(y),parseInt(m)-1-i,1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const mesInicio=meses[0]+'-01';
  const nextM=()=>{const[y2,m2]=meses[meses.length-1].split('-');return parseInt(m2)===12?`${parseInt(y2)+1}-01-01`:`${y2}-${String(parseInt(m2)+1).padStart(2,'0')}-01`;};
  const mesFin=nextM();

  try{
    // BULK LOAD — 3 queries total instead of N×M queries
    const [reportesBulk, metas, ingresosBulk] = await Promise.all([
      // All reportes for all asesores in date range, with contactos
      SB.get('reportes', `semana_inicio=gte.${mesInicio}&semana_inicio=lt.${mesFin}&order=asesor.asc,semana_num.asc&select=*`),
      // All metas
      SB.get('metas', `select=*`),
      // All ingresos in range
      SB.get('ingresos', `mes=gte.${meses[0]}&mes=lte.${meses[meses.length-1]}&select=*`)
    ]);

    // Load all contactos in one query
    const repIds = reportesBulk.map(r=>r.id);
    let contactosBulk = [];
    if(repIds.length > 0){
      // Supabase in() filter
      contactosBulk = await SB.get('contactos',
        `reporte_id=in.(${repIds.join(',')})&select=*`);
    }

    // Attach contactos to reportes
    reportesBulk.forEach(r=>{
      r.contactos = contactosBulk.filter(c=>c.reporte_id===r.id);
    });

    // Index by asesor
    const metaMap = {};
    metas.forEach(m=>{ metaMap[m.asesor]=m; });
    const ingMap = {};
    ingresosBulk.forEach(i=>{ if(!ingMap[i.asesor])ingMap[i.asesor]={}; ingMap[i.asesor][i.mes]=(i.ingreso_real||0); });

    // Calculate per-asesor stats
    const asesorStats = ASESORES.map(a=>{
      const reps = reportesBulk.filter(r=>r.asesor===a);
      const meta = metaMap[a]||{meta_contactos_semana:3,meta_prospectos_mes:15,meta_ventas_mes:5,meta_ingresos:2000000};
      // Para vista supervisor multi-mes, pasamos el mes seleccionado (primer mes del rango)
      const {semanas,totC,totR,totP,totPot,promG,efic,brecha} = calcIndicadores(reps, meses[0]);
      const sinReporte = semanas.filter(s=>s.contactos===0).length;
      const ingrTot = meses.reduce((s,mo)=>s+((ingMap[a]||{})[mo]||0),0);
      const metaIng = (meta.meta_ingresos||2000000)*periodos;
      const metaCont = (meta.meta_contactos_semana||3)*meses.length*4;
      return{a,totC,totR,totP,totPot,promG,efic,brecha,sinReporte,ingrTot,metaIng,metaCont,meta};
    });

    // Team totals
    const teamC   = asesorStats.reduce((s,x)=>s+x.totC,0);
    const teamP   = asesorStats.reduce((s,x)=>s+x.totP,0);
    const teamPot = asesorStats.reduce((s,x)=>s+x.totPot,0);
    const teamSR  = asesorStats.reduce((s,x)=>s+x.sinReporte,0);
    const teamMetaC = asesorStats.reduce((s,x)=>s+x.metaCont,0);
    const teamGapC  = teamC - teamMetaC;
    const teamGapP  = teamP - teamPot;
    const teamPromG = teamC ? +(teamP/teamC).toFixed(1) : 0;
    const teamPromGap = +(teamPromG-5).toFixed(1);
    const totalPossible = ASESORES.length * meses.length * 4;
    const indice = Math.round(
      (Math.min(teamC/Math.max(teamPot/5,1),1)*40)+
      (Math.min(teamPromG/5,1)*40)+
      ((totalPossible-teamSR)/totalPossible*20)
    );
    const periodoLabel = periodos===1 ? getMesLabel(mes) : `${getMesLabel(meses[0])} – ${getMesLabel(mes)}`;

    // Load team nodos (async, filled in after render)
    const teamNodosPromise = Promise.all(ASESORES.map(a=>getNodos(a)));

    let html=`<div class="ib bl" style="margin-bottom:4px">Período: ${periodoLabel} · ${meses.length} mes${meses.length>1?'es':''} · ${ASESORES.length} asesores · ${repIds.length} reportes cargados</div>`;

    // Row 1: Results KPIs
    html+=`<p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:8px">Resultados del período</p>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:8px">
      ${kpiCard('Prospectos reales',teamP,`${meses.length} mes${meses.length>1?'es':''} · ${ASESORES.length} asesores`,'')}
      ${kpiCard('Contactos totales',teamC,`Potencial de red activada`,'')}
      ${kpiCard('Prom. prosp./contacto',teamPromG,'Meta: 5.0 por contacto',teamPromG>=4?'ok':teamPromG>=2.5?'warn':'bad')}
      <div style="background:var(--teal-lt);border-radius:var(--r);padding:13px 15px" id="team-nodos-kpi">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--teal);margin-bottom:4px">✦ Nodos equipo</div>
        <div style="font-size:22px;font-weight:500;color:var(--teal);line-height:1.1" id="team-nodos-val">…</div>
        <div style="font-size:11px;color:var(--teal);margin-top:3px" id="team-nodos-sub">cargando…</div>
      </div>
      ${kpiCard('Índice efectividad',indice+'/100','Actividad + P/C + cobertura',indice>=60?'ok':indice>=40?'warn':'bad',true)}
    </div>`;

    // Row 2: Gaps
    html+=`<div style="font-size:11px;color:var(--g700);line-height:1.6;padding:8px 12px;background:var(--blue-lt);border-radius:var(--r);border-left:3px solid var(--blue-mid);margin-bottom:8px">
      El período de seguimiento define cuánto tiempo abarca el análisis de gaps. Reiniciarlo <strong>trimestralmente</strong> permite comparar entre trimestres y ver si el equipo está cerrando su brecha. <strong>Recomendación:</strong> incentiva que los asesores vuelvan a sus contactos conocidos y los conviertan en nodos activos — un gap que baja trimestre a trimestre indica que la red se está profundizando.
    </div>`;
    html+=`<p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--g400);margin-bottom:8px">Gaps del equipo — meta de supervisión</p>
    <div class="grid4" style="margin-bottom:14px">
      ${gapCard('Gap prospectos',teamGapP,`Real ${teamP} vs potencial ${teamPot}`,'Prospectos no obtenidos')}
      ${gapCard('Gap contactos',teamGapC,`Real ${teamC} vs meta ${teamMetaC}`,'Contactos bajo la meta')}
      ${gapCard('Gap P/C promedio',teamPromGap.toFixed(1),`Real ${teamPromG} vs meta 5.0`,'Calidad de solicitud de referidos')}
      ${gapCard('Sem. sin reporte',teamSR,`de ${totalPossible} posibles (${Math.round(teamSR/totalPossible*100)}%)`,'Inactividad documentada')}
    </div>`;

    // Table
    html+=`<div class="card"><div class="card-title">Desempeño individual — ${periodoLabel}</div>
    <div style="overflow-x:auto"><table class="dt" style="font-size:11px">
      <thead><tr>
        <th>Asesor</th>
        <th>Cont. <span class="ico-info" onmouseenter="showTooltip('cont-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Gap cont. <span class="ico-info" onmouseenter="showTooltip('gap-cont-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Prosp. <span class="ico-info" onmouseenter="showTooltip('prosp-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Gap prosp. <span class="ico-info" onmouseenter="showTooltip('gap-prosp-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>P/C <span class="ico-info" onmouseenter="showTooltip('pc-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>% meta <span class="ico-info" onmouseenter="showTooltip('meta-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Nodos ✦ <span class="ico-info" onmouseenter="showTooltip('nodos-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Ingreso <span class="ico-info" onmouseenter="showTooltip('ingreso-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Meta ing. <span class="ico-info" onmouseenter="showTooltip('meta-ing-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>Gap ing. <span class="ico-info" onmouseenter="showTooltip('gap-ing-col',event)" onmouseleave="hideTooltip()">i</span></th>
        <th>S/R <span class="ico-info" onmouseenter="showTooltip('sr-col',event)" onmouseleave="hideTooltip()">i</span></th>
      </tr></thead>
      <tbody>${asesorStats.map(s=>{
        const gapC=s.totC-s.metaCont;
        const metaP=Math.max(s.meta.meta_prospectos_mes||15,5);
        const avMes=metaP?Math.round(s.totP/(metaP*meses.length)*100):0;
        const gcP=gapC>=0?`<span class="pill pill-gn">+${gapC}</span>`:`<span class="pill pill-rd">${gapC}</span>`;
        const gpP=s.brecha<=0?`<span class="pill pill-gn">0</span>`:`<span class="pill ${s.brecha<20?'pill-am':'pill-rd'}">−${s.brecha}</span>`;
        const pcP=s.promG>=4.5?`<span class="pill pill-gn">${s.promG}</span>`:s.promG>=3?`<span class="pill pill-am">${s.promG}</span>`:`<span class="pill pill-rd">${s.promG}</span>`;
        const gapIng=s.ingrTot-s.metaIng;
        const giP=s.ingrTot?(gapIng>=0?`<span class="pill pill-gn">+${fmt(gapIng)}</span>`:`<span class="pill pill-rd">${fmt(gapIng)}</span>`):'<span style="color:var(--g400)">—</span>';
        const srP=s.sinReporte===0?`<span class="pill pill-gn">0</span>`:s.sinReporte<=1?`<span class="pill pill-am">${s.sinReporte}</span>`:`<span class="pill pill-rd">${s.sinReporte}</span>`;
        const nombre=s.a.split(' ').slice(0,2).join(' ');
        return`<tr><td><strong>${nombre}</strong></td><td>${s.totC}</td><td>${gcP}</td><td>${s.totP}</td><td>${gpP}</td><td>${pcP}</td>
          <td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:5px;background:var(--g200);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(avMes,100)}%;background:${avMes>=80?'#639922':avMes>=50?'#BA7517':'#E24B4A'};border-radius:3px"></div></div><span style="font-size:10px">${avMes}%</span></div></td>
          <td style="text-align:center" id="nodos-eq-${s.a.replace(/\s/g,'_')}"><span style="color:var(--g400)">…</span></td>
          <td style="font-size:11px">${s.ingrTot?fmt(s.ingrTot):'<span style="color:var(--g400)">—</span>'}</td>
          <td style="font-size:11px;color:var(--g400)">${fmt(s.metaIng)}</td>
          <td>${giP}</td><td>${srP}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <div style="font-size:11px;color:var(--g700);line-height:1.6;padding:10px 12px;background:var(--amber-lt);border-radius:var(--r);border-left:3px solid var(--amber);margin-top:12px">
      <strong>Observe la relación entre los gaps:</strong> cuando el gap de contactos y el gap P/C son negativos, el gap de ingreso tiende a ser mayor. Un P/C bajo no se compensa con más contactos — la calidad de la solicitud de referidos es determinante.
    </div></div>`;

    // Charts
    html+=`<div class="card" style="margin-top:12px">
      <div class="card-title">✦ Evolución de Nodos del equipo</div>
      <div style="display:flex;gap:14px;margin-bottom:6px;font-size:11px;color:var(--g400)">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:4px;background:#0F6E56;border-radius:2px;display:inline-block"></span>Nodos acumulados</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:0;border-top:2px dashed #185FA5;display:inline-block"></span>Prospectos de nodos</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(15,110,86,.3);border-radius:2px;display:inline-block"></span>Nuevos nodos</span>
      </div>
      <div style="position:relative;height:160px"><canvas id="chart-eq-nodos" role="img" aria-label="Nodos del equipo y prospectos"></canvas></div>
      <div id="eq-nodos-interpretacion" style="margin-top:6px"></div>
    </div>`;
    html+=`<div class="grid2" style="margin-top:12px">
      <div class="card"><div class="card-title">Evolución mensual — contactos y prospectos</div>
        <div style="position:relative;height:180px"><canvas id="chart-equipo-tend"></canvas></div>
        <div style="display:flex;gap:12px;margin-top:6px">
          <div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;background:#003781;border-radius:2px"></div><span style="font-size:10px;color:var(--g400)">Prospectos</span></div>
          <div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;background:#B5D4F4;border-radius:2px"></div><span style="font-size:10px;color:var(--g400)">Contactos</span></div>
          <div style="display:flex;align-items:center;gap:3px"><div style="width:10px;height:3px;background:#BA7517;border-radius:2px"></div><span style="font-size:10px;color:var(--g400)">P/C prom.</span></div>
        </div>
      </div>
      <div class="card"><div class="card-title">Ranking prospectos — período</div>
        <div style="position:relative;height:180px"><canvas id="chart-equipo-rank"></canvas></div>
      </div>
    </div>`;

    cont.innerHTML=html;

    // Load team nodos async
    teamNodosPromise.then(async (allNodos)=>{
      const flat=allNodos.flat();
      const totalNodos=new Set(flat.map(n=>n.asesor+'|'+n.nombre)).size;
      const el=document.getElementById('team-nodos-val');
      const sub=document.getElementById('team-nodos-sub');
      if(el) el.textContent=totalNodos;
      if(sub) sub.textContent=`en ${ASESORES.length} asesores`;
      // Fill per-asesor nodos cells
      ASESORES.forEach((a,i)=>{
        const nds=allNodos[i]||[];
        const el2=document.getElementById('nodos-eq-'+a.replace(/[\s]/g,'_'));
        if(el2) el2.innerHTML=nds.length>0?`<span class="pill pill-gn">${nds.length}</span>`:'<span style="color:var(--g400)">0</span>';
      });
      // Build team nodos chart with prospectos
      try{
        const actsPerAsesor=await Promise.all(ASESORES.map(a=>
          SB.get('activaciones_nodo',`asesor=eq.${encodeURIComponent(a)}&order=semana_inicio.asc&select=semana_inicio,nodo_id,prospectos`)
        ));
        const byMes={};
        actsPerAsesor.flat().forEach(a=>{
          const mo=a.semana_inicio?.slice(0,7);if(!mo)return;
          if(!byMes[mo]) byMes[mo]={nodos:new Set(),prospNodos:0};
          byMes[mo].nodos.add(a.nodo_id);
          byMes[mo].prospNodos+=(a.prospectos||0);
        });
        // Total prospectos per month from reportesBulk
        const repByMonth={};
        reportesBulk.forEach(r=>{
          const mo=r.semana_inicio?.slice(0,7);if(!mo)return;
          if(!repByMonth[mo])repByMonth[mo]=0;
          (r.contactos||[]).forEach(c=>{ repByMonth[mo]+=(c.prospectos||0); });
        });
        const mesesL=Object.keys(byMes).sort();
        if(!mesesL.length)return;
        let ac=0;
        const dAcum=[],dNuevos=[],dProspNodos=[],dProspTotal=[],dPct=[],lbls=[];
        mesesL.forEach(mo=>{
          const nv=byMes[mo].nodos.size; ac+=nv;
          const pn=byMes[mo].prospNodos;
          const pt=repByMonth[mo]||0;
          const pct=pt>0?Math.round(pn/pt*100):0;
          dAcum.push(ac);dNuevos.push(nv);dProspNodos.push(pn);dProspTotal.push(pt);dPct.push(pct);
          const[y,m]=mo.split('-');lbls.push(MESES_NOM[parseInt(m)-1].slice(0,3)+' '+y.slice(2));
        });
        buildNodosChart('chart-eq-nodos',lbls,dAcum,dNuevos,dProspNodos,dPct,'eq-nod');
        const interp=interpretarNodos(dAcum,dNuevos,dProspNodos,dProspTotal,dPct,lbls,true);
        const interpEl=document.getElementById('eq-nodos-interpretacion');
        if(interpEl)interpEl.innerHTML=interp;
      }catch(e){console.warn('team nodos chart error:',e);}
    }).catch(e=>console.warn('teamNodosPromise error:',e));

    // Charts after DOM
    requestAnimationFrame(()=>{
      // Per-month data for trend chart
      const trendLabels=meses.map(mo=>getMesLabel(mo).split(' ')[0]);
      const trendC=meses.map(mo=>reportesBulk.filter(r=>r.semana_inicio?.startsWith(mo)).reduce((s,r)=>s+(r.contactos?.length||0),0));
      const trendP=meses.map(mo=>reportesBulk.filter(r=>r.semana_inicio?.startsWith(mo)).reduce((s,r)=>s+(r.contactos||[]).reduce((x,c)=>x+(c.prospectos||0),0),0));
      const trendPC=trendC.map((c,i)=>c?+(trendP[i]/c).toFixed(1):0);

      if(G.charts['eq-tend']){G.charts['eq-tend'].destroy();}
      const c1=document.getElementById('chart-equipo-tend');
      if(c1) G.charts['eq-tend']=new Chart(c1,{
        data:{labels:trendLabels,datasets:[
          {type:'bar',label:'Prospectos',data:trendP,backgroundColor:'#003781',yAxisID:'y'},
          {type:'bar',label:'Contactos',data:trendC,backgroundColor:'#B5D4F4',yAxisID:'y'},
          {type:'line',label:'P/C',data:trendPC,borderColor:'#BA7517',backgroundColor:'transparent',yAxisID:'y2',pointRadius:4,borderWidth:2,tension:.3},
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
          scales:{y:{position:'left',ticks:{font:{size:10}}},y2:{position:'right',min:0,max:6,grid:{display:false},ticks:{font:{size:10}}}}}
      });

      // Ranking — solo asesores con al menos 1 prospecto, resto al fondo en gris
      const rankData=[...asesorStats].sort((a,b)=>b.totP-a.totP).map(s=>({
        name:s.a.split(' ')[0]+' '+((s.a.split(' ')[1]||'').charAt(0)+'.'||''),
        val:s.totP,
        sinDatos:s.totP===0
      }));
      if(G.charts['eq-rank']){G.charts['eq-rank'].destroy();}
      const c2=document.getElementById('chart-equipo-rank');
      if(c2) G.charts['eq-rank']=new Chart(c2,{
        type:'bar',
        data:{labels:rankData.map(d=>d.sinDatos?d.name+' —':d.name),datasets:[{data:rankData.map(d=>d.val),
          backgroundColor:rankData.map(d=>d.sinDatos?'#E8E7E2':d.val>=30?'#0F6E56':d.val>=15?'#BA7517':'#A32D2D'),borderRadius:4}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.raw===0?'Sin reportes':ctx.raw+' prospectos'}}},
          scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}}}
      });
    });

  }catch(e){
    cont.innerHTML=`<div class="ib rd"><strong>Error al cargar datos del equipo:</strong> ${e.message}<br><br>Verifica que el archivo esté publicado en Netlify (no abierto localmente).</div>`;
    console.error('renderEquipo error:',e);
  }
}
/* ══ DESEMPEÑO INDIVIDUAL ══ */
async function renderIndividual(){
  const asesor=document.getElementById('sel-asesor-individual')?.value||ASESORES[0];
  const mes=document.getElementById('sel-mes-individual')?.value||getMesActual();
  const cont=document.getElementById('individual-content');
  if(!cont){return;}
  cont.innerHTML='<div class="ib bl">⏳ Cargando informe de '+asesor+'…</div>';
  try{
    const [meta,reportes,ingreso,nodos]=await Promise.all([
      getMeta(asesor),
      getReportesMes(asesor,mes),
      getIngreso(asesor,mes),
      getNodos(asesor)
    ]);
    if(!reportes.length){
      cont.innerHTML=`<div class="ib am"><strong>${asesor}</strong> no tiene reportes en ${getMesLabel(mes)}.</div>`;
      return;
    }
    const prevU=G.usuario; G.usuario=asesor;
    const nodosCount=nodos.length;
    const totalActsNod=nodos.reduce((s,n)=>s+(n.activaciones||0),0);
    const totalProspNod=nodos.reduce((s,n)=>s+(n.total_prospectos||0),0);
    let h=`<div class="ib bl" style="margin-bottom:14px">Informe de <strong>${asesor}</strong> — ${getMesLabel(mes)}</div>`;
    h+=renderInformeHTML(asesor,mes,meta,reportes,ingreso);
    cont.innerHTML=h;
    G.usuario=prevU;
    renderInformeCharts(reportes,mes);
    setTimeout(()=>loadNodosEnInforme(asesor,reportes),400);
  }catch(e){
    cont.innerHTML=`<div class="ib rd"><strong>Error:</strong> ${e.message}</div>`;
    console.error('renderIndividual error:',e);
  }
}


/* ══ ONBOARDING SYSTEM ══ */
const OB_SLIDES_SUPERVISOR = [
  {icon:'🎯',title:'Bienvenida, Alejandra',body:'Esta es tu plataforma de Prospección y Metas. Aquí podrás simular los ingresos de cada asesor, hacer seguimiento de su actividad semanal y observar cómo la actividad de contacto se convierte en resultados de ingresos.'},
  {icon:'📊',title:'Simulador de Metas',body:'Comienza por el Simulador de Metas: define la antigüedad, persistencia y mix de productos de cada asesor. Al terminar, haz clic en "Guardar metas en Tracker" para que esos objetivos queden vinculados al sistema de seguimiento.'},
  {icon:'📋',title:'Equipo completo',body:'En "Equipo completo" verás el consolidado de actividad de todo tu equipo: contactos, prospectos, gaps y nodos. Los gaps son tu meta de supervisión: reducirlos semana a semana es la señal de que el equipo está progresando.'},
  {icon:'🌳',title:'El sistema de Nodos',body:'Un contacto se convierte en Nodo cuando vuelve a referir prospectos por segunda vez. Los nodos son el corazón del sistema: un asesor con muchos nodos activos tiene una red que trabaja para él. Observa su evolución mes a mes.'},
  {icon:'✅',title:'¡Listo para comenzar!',body:'Recuerda: la meta no es solo tener más contactos, sino profundizar las relaciones. El sistema te mostrará cuándo un contacto se convierte en nodo y cómo eso impacta en los ingresos. ¡Mucho éxito!'},
];
const OB_SLIDES_ASESOR = [
  {icon:'👋',title:'Bienvenido/a a tu Bitácora',body:'Esta es tu plataforma de prospección semanal. Aquí registrarás tus contactos, verás tus indicadores de desempeño y seguirás tu avance hacia las metas definidas por tu supervisora.'},
  {icon:'📞',title:'Registra tus contactos semanales',body:'Cada semana abre una nueva entrada en tu Bitácora Semanal. Ingresa a cada persona que contactaste: nombre, vínculo, si llamaste, si te reuniste y cuántos prospectos te dio. La meta es ≥5 prospectos por contacto.'},
  {icon:'🌱',title:'Los Nodos — tu mayor activo',body:'Cuando vuelves a un contacto y te refiere prospectos por segunda vez, ese contacto se convierte en Nodo. Los nodos son contactos que confían en ti y siguen refiriendo. ¡Cultívalos! Son tu red permanente.'},
  {icon:'📈',title:'Mi informe',body:'En "Mi informe" verás tus indicadores: prospectos obtenidos vs. tu meta, tasa de reunión, eficiencia de contactos y la evolución de tus nodos. Úsalo para identificar dónde mejorar cada semana.'},
  {icon:'🚀',title:'¡Todo listo!',body:'Recuerda: prospección constante = resultados consistentes. El sistema te mostrará automáticamente tu próximo lunes de reporte y te alertará cuando un contacto se convierta en tu nuevo nodo. ¡Adelante!'},
];

let _obSlide=0;
let _obSlides=[];

async function checkOnboarding(){
  if(!G.usuario||!G.rol) return;
  try{
    const lsKey='ob_seen_'+G.usuario.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').replace(/__+/g,'_');
    // Si ya lo vio en este navegador, no mostrar nunca más
    if(localStorage.getItem(lsKey)==='1') return;
    // Check Supabase — si onboarding_seen=true, marcar en localStorage y salir
    try{
      const seen=await SB.get('metas',`asesor=eq.${encodeURIComponent(G.usuario)}&select=onboarding_seen`);
      if(seen[0]?.onboarding_seen===true){localStorage.setItem(lsKey,'1');return;}
    }catch{}
    // Show onboarding
    _obSlides=G.rol==='supervisor'?OB_SLIDES_SUPERVISOR:OB_SLIDES_ASESOR;
    _obSlide=0;
    renderObSlide();
    const obModal=document.getElementById('modal-onboarding');
    if(obModal){obModal.classList.add('open');}
  }catch(e){
    console.warn('checkOnboarding error:',e);
  }
}

// Para resetear onboarding (útil en testing): abrir consola del browser y ejecutar resetOnboarding()
function resetOnboarding(){
  if(!G.usuario)return;
  const lsKey='ob_seen_'+G.usuario.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').replace(/__+/g,'_');
  localStorage.removeItem(lsKey);
  SB.patch('metas',{onboarding_seen:false},`asesor=eq.${encodeURIComponent(G.usuario)}`).catch(()=>{});
  alert(`Onboarding reseteado para ${G.usuario}. Recarga la página para verlo.`);
}

function renderObSlide(){
  const s=_obSlides[_obSlide];
  const total=_obSlides.length;
  const setT=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setT('ob-icon',s.icon);setT('ob-title',s.title);setT('ob-body',s.body);
  setT('ob-counter',`${_obSlide+1} de ${total}`);
  const prog=document.getElementById('ob-progress');if(prog)prog.style.width=`${((_obSlide+1)/total)*100}%`;
  const prev=document.getElementById('ob-prev');if(prev)prev.style.visibility=_obSlide>0?'visible':'hidden';
  const nextBtn=document.getElementById('ob-next');if(nextBtn)nextBtn.textContent=_obSlide===total-1?'¡Empezar! →':'Siguiente →';
}
function obNext(){
  if(_obSlide<_obSlides.length-1){_obSlide++;renderObSlide();}
  else{
    const obM=document.getElementById('modal-onboarding');
    if(obM){obM.classList.remove('open');obM.style.display='none';}
    // Mark as seen
    const lsKey2='ob_seen_'+G.usuario.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').replace(/__+/g,'_');
    try{localStorage.setItem(lsKey2,'1');}catch{}
    SB.patch('metas',{onboarding_seen:true},`asesor=eq.${encodeURIComponent(G.usuario)}`).catch(()=>{});
  }
}
function obPrev(){if(_obSlide>0){_obSlide--;renderObSlide();}}

/* ── TOOLTIPS ── */
const TOOLTIPS={
  'prospectos-obtenidos':'Prospectos obtenidos: total de prospectos referidos por tus contactos este mes. Es el resultado central de la actividad de contacto.',
  'contactos-realizados':'Contactos realizados: personas que activaste como nodo potencial esta semana. Cada contacto puede darte hasta 5 prospectos.',
  'tasa-reunion':'Tasa de reunión: % de contactos que aceptaron reunirse contigo. Una tasa sobre 60% indica buena capacidad de apertura.',
  'eficiencia-contactos':'Eficiencia de Contactos: cuánto del potencial máximo estás aprovechando. Si cada contacto diera 5 referidos, el potencial sería mayor. Meta: ≥80%.',
  'brecha':'Brecha de prospectos: cuántos prospectos no obtuviste respecto al potencial. Cada brecha es una oportunidad no capitalizada.',
  'nodos':'Nodos activos: contactos que han vuelto a referirte prospectos en más de una ocasión. Son tu red más valiosa — cultívalos.',
  'cont-col':'Contactos totales del período. Cada persona en la bitácora = 1 contacto.',
  'gap-cont-col':'Gap contactos: real menos meta semanal × 4 semanas. Verde = sobre meta.',
  'prosp-col':'Prospectos totales: referidos que cada contacto entregó al asesor.',
  'gap-prosp-col':'Gap prospectos: real vs potencial máximo (contactos × 5).',
  'pc-col':'Prospectos por Contacto. Meta ideal 5.0. Verde ≥4.5 · Amarillo ≥3.0 · Rojo <3.0.',
  'meta-col':'% cumplimiento meta mensual de prospectos del Simulador.',
  'nodos-col':'Nodos activos: contactos que refieren más de una vez. El activo más valioso.',
  'ingreso-col':'Ingreso real del período, registrado en Ingresos mensuales.',
  'meta-ing-col':'Meta de ingresos del Simulador para este asesor.',
  'gap-ing-col':'Gap ingresos: real menos meta. Verde = superó. Rojo = bajo meta.',
  'sr-col':'Semanas Sin Reporte. Verde=0 · Amarillo=1 · Rojo≥2.',
};

function showTooltip(key,event){
  const t=TOOLTIPS[key];if(!t)return;
  const m=document.getElementById('tooltip-modal');
  document.getElementById('tt-title').textContent=key.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  document.getElementById('tt-body').textContent=t;
  m.style.display='block';m.style.pointerEvents='none';
  const x=Math.min(event.clientX+12,window.innerWidth-300);
  const y=Math.max(event.clientY-60,10);
  m.style.left=x+'px';m.style.top=y+'px';
}
function hideTooltip(){document.getElementById('tooltip-modal').style.display='none';}
document.addEventListener('mousemove',e=>{
  const m=document.getElementById('tooltip-modal');
  if(m.style.display==='block'){
    const x=Math.min(e.clientX+12,window.innerWidth-300);
    const y=Math.max(e.clientY-60,10);
    m.style.left=x+'px';m.style.top=y+'px';
  }
});



function toggleCard(id){
  const el=document.getElementById(id);
  if(el) el.classList.toggle('open');
}
buildLoginSelect();

