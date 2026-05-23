/* ═══════════════════════════════════════════════════════════════
   Proxis Admin — _core.js
   Funciones compartidas entre todos los módulos admin y
   proxis_plataforma.html (banner de mensajes).
═══════════════════════════════════════════════════════════════ */

/* ── AMBIENTE ─────────────────────────────────────────────── */
const IS_DEV = window.location.hostname === 'localhost'  ||
               window.location.hostname === '127.0.0.1'  ||
               window.location.hostname.includes('proxis-dev');

/* ── CREDENCIALES ─────────────────────────────────────────── */
const _SB_URL_PROD = 'https://uolmsxoudvkopscxbvij.supabase.co';
const _SB_KEY_PROD = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbG1zeG91ZHZrb3BzY3hidmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Mzc2NjcsImV4cCI6MjA5MjQxMzY2N30.as4hUh_FEE4Qsj9mv5hUljvVW-wfxysqfWy5a9qFFI8';

const _SB_URL_DEV  = 'https://mkqgbmwmvypcjzlxidsm.supabase.co';
const _SB_KEY_DEV  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rcWdibXdtdnlwY2p6bHhpZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODU1OTgsImV4cCI6MjA5NTA2MTU5OH0.odPm8YC7Jb2dzY7GmGQThg2rPNyd6yNkCOqye7W-l_4';

const CORE_SB_URL = IS_DEV ? _SB_URL_DEV  : _SB_URL_PROD;
const CORE_SB_KEY = IS_DEV ? _SB_KEY_DEV  : _SB_KEY_PROD;

// Pegar aquí cuando estén disponibles:
const GEMINI_KEY = 'REDACTED';
const RESEND_KEY = 're_2iEP2Kbw_9DNXTUW519CRzDzmVKknQ64Y';

/* ── SUPABASE CLIENT ──────────────────────────────────────── */
const SBC = {
  _h(x = {}) {
    return {
      apikey: CORE_SB_KEY,
      Authorization: `Bearer ${CORE_SB_KEY}`,
      'Content-Type': 'application/json',
      ...x
    };
  },
  async get(table, qs = '') {
    const r = await fetch(`${CORE_SB_URL}/rest/v1/${table}?${qs}`, { headers: this._h() });
    if (!r.ok) throw new Error(`SBC.get ${table}: HTTP ${r.status}`);
    return r.json();
  },
  async post(table, data) {
    const r = await fetch(`${CORE_SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: this._h({ Prefer: 'return=representation' }),
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`SBC.post ${table}: HTTP ${r.status}`);
    return r.json();
  },
  async patch(table, data, qs) {
    const r = await fetch(`${CORE_SB_URL}/rest/v1/${table}?${qs}`, {
      method: 'PATCH',
      headers: this._h({ Prefer: 'return=representation' }),
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`SBC.patch ${table}: HTTP ${r.status}`);
    return r.json();
  },
  async del(table, qs) {
    const r = await fetch(`${CORE_SB_URL}/rest/v1/${table}?${qs}`, {
      method: 'DELETE',
      headers: this._h()
    });
    if (!r.ok) throw new Error(`SBC.del ${table}: HTTP ${r.status}`);
  }
};

/* ── BUILD CONTEXT ────────────────────────────────────────── */
// Devuelve el contexto completo de un asesor para compilar prompts.
async function buildContext(asesor) {
  const mes = getMesActualCore();
  const [y, m] = mes.split('-').map(Number);
  const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  const [metaArr, reportes, ingresoArr] = await Promise.all([
    SBC.get('metas', `asesor=eq.${encodeURIComponent(asesor)}`),
    SBC.get('reportes',
      `asesor=eq.${encodeURIComponent(asesor)}&semana_inicio=gte.${mes}-01&semana_inicio=lt.${nextM}-01&order=semana_inicio.desc`),
    SBC.get('ingresos', `asesor=eq.${encodeURIComponent(asesor)}&mes=eq.${mes}`)
  ]);

  const meta = metaArr[0] || {};

  // Últimas 4 semanas con sus contactos
  const ultimas4 = reportes.slice(0, 4);
  for (const r of ultimas4) {
    r.contactos = await SBC.get('contactos', `reporte_id=eq.${r.id}&order=created_at.asc`);
  }

  // Semanas sin reporte (diferencia entre semanas esperadas y reportes existentes)
  const semanasSinReporte = calcSemanasSinReporte(reportes);

  // P/C promedio de las últimas 4 semanas
  const pcPromedio = calcPcPromedio(ultimas4);

  // Proyección de Z (prospectos) al ritmo actual
  const zProyectados = calcZProyectados(ultimas4, meta.meta_prospectos_mes);

  // Persistencia: semanas consecutivas bajo umbral de contactos
  const persistenciaActual = calcPersistencia(reportes, meta.meta_contactos_semana);

  // Nodos activos del mes
  const nodosArr = await SBC.get('activaciones_nodo',
    `asesor=eq.${encodeURIComponent(asesor)}&semana_inicio=gte.${mes}-01&semana_inicio=lt.${nextM}-01`);

  return {
    nombre:                asesor,
    meta_contactos_semana: meta.meta_contactos_semana  || 3,
    meta_prospectos_mes:   meta.meta_prospectos_mes    || 15,
    meta_ingresos:         meta.meta_ingresos          || 2000000,
    perfil_conductual:     meta.perfil_conductual      || null,
    semanas_sin_reporte:   semanasSinReporte,
    reportes_recientes:    ultimas4,
    nodos_activos:         nodosArr.length,
    ingreso_mes_actual:    ingresoArr[0]?.ingreso_real || 0,
    mes_actual:            mes,
    pc_promedio:           pcPromedio,
    z_proyectados:         zProyectados,
    persistencia_actual:   persistenciaActual
  };
}

function getMesActualCore() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calcSemanasSinReporte(reportes) {
  if (!reportes.length) return 0;
  const hoy = new Date();
  const lunesHoy = new Date(hoy);
  const dow = hoy.getDay();
  lunesHoy.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
  const ultimoReporte = new Date(reportes[0].semana_inicio);
  const diff = Math.floor((lunesHoy - ultimoReporte) / (7 * 24 * 3600 * 1000));
  return Math.max(0, diff);
}

function calcPcPromedio(reportes) {
  if (!reportes.length) return 0;
  const totales = reportes.map(r => {
    const contactos = r.contactos || [];
    const total = contactos.length;
    const prospectos = contactos.reduce((s, c) => s + (c.prospectos || 0), 0);
    return total > 0 ? prospectos / total : 0;
  });
  return +(totales.reduce((a, b) => a + b, 0) / totales.length).toFixed(2);
}

function calcZProyectados(reportes, metaMes) {
  if (!reportes.length) return 0;
  const totalZ = reportes.reduce((s, r) => {
    return s + (r.contactos || []).reduce((a, c) => a + (c.prospectos || 0), 0);
  }, 0);
  const semanasPasadas = reportes.length;
  const semanasMes = 4;
  const ritmo = totalZ / semanasPasadas;
  return Math.round(ritmo * semanasMes);
}

function calcPersistencia(reportes, metaSemanal) {
  let count = 0;
  for (const r of reportes) {
    const contactos = (r.contactos || []).length;
    if (contactos < (metaSemanal || 3)) count++;
    else break;
  }
  return count;
}

/* ── COMPILE TEMPLATE ─────────────────────────────────────── */
// Reemplaza variables {{variable}} en la plantilla con valores del contexto.
function compileTemplate(plantilla, ctx) {
  const perfil = ctx.perfil_conductual
    ? Object.entries(ctx.perfil_conductual).sort((a, b) => b[1] - a[1])[0][0]
    : 'S';

  return plantilla
    .replace(/\{\{nombre\}\}/g,             ctx.nombre                || '')
    .replace(/\{\{perfil\}\}/g,             perfil)
    .replace(/\{\{zPuntos\}\}/g,            ctx.z_proyectados         ?? '')
    .replace(/\{\{meta\}\}/g,               ctx.meta_prospectos_mes   ?? '')
    .replace(/\{\{metaContactos\}\}/g,      ctx.meta_contactos_semana ?? '')
    .replace(/\{\{semanasSinReporte\}\}/g,  ctx.semanas_sin_reporte   ?? '')
    .replace(/\{\{pcPromedio\}\}/g,         ctx.pc_promedio           ?? '')
    .replace(/\{\{ingresoMes\}\}/g,         ctx.ingreso_mes_actual    ?? '')
    .replace(/\{\{nodosActivos\}\}/g,       ctx.nodos_activos         ?? '')
    .replace(/\{\{persistencia\}\}/g,       ctx.persistencia_actual   ?? '')
    .replace(/\{\{mes\}\}/g,               ctx.mes_actual            || '');
}

/* ── CALL GEMINI ──────────────────────────────────────────── */
async function callGemini(prompt, maxTokens = 500) {
  if (!GEMINI_KEY) throw new Error('GEMINI_KEY no configurada.');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
      })
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/* ── SEND EMAIL ───────────────────────────────────────────── */
async function sendEmail(asesor, asunto, mensaje) {
  if (!RESEND_KEY) throw new Error('RESEND_KEY no configurada.');
  const emailArr = await SBC.get('asesor_emails', `asesor=eq.${encodeURIComponent(asesor)}`);
  if (!emailArr.length) throw new Error(`No hay email registrado para ${asesor}.`);
  const to = emailArr[0].email;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Proxis <proxis@imrbrasil.com>',
      to,
      subject: asunto || 'Mensaje de tu coach Proxis',
      text: mensaje
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend error: ${err.message || res.status}`);
  }
  return res.json();
}

/* ── SEND NOTIFICATION ────────────────────────────────────── */
const CANAL = 'email'; // 'email' | 'fcm' (futuro)

async function sendNotification(asesor, mensaje) {
  if (CANAL === 'email') {
    await sendEmail(asesor, 'Mensaje de tu coach Proxis', mensaje);
  }
}

/* ── GENERATE MESSAGE ─────────────────────────────────────── */
// dryRun=true: solo genera y retorna el texto, no guarda ni envía.
async function generateMessage(asesor, triggerId, dryRun = false) {
  // 1. Contexto del asesor
  const ctx = await buildContext(asesor);

  // 2. Plantilla activa del trigger
  const prompts = await SBC.get('prompts',
    `trigger_id=eq.${encodeURIComponent(triggerId)}&activo=eq.true&order=version.desc&limit=1`);
  if (!prompts.length) throw new Error(`No hay prompt activo para trigger "${triggerId}".`);
  const plantilla = prompts[0];

  // 3. Compilar plantilla con contexto
  const compilado = compileTemplate(plantilla.body, ctx);

  // 4. Llamar a Gemini
  const body = await callGemini(compilado);

  if (!dryRun) {
    // 5. Guardar en message_log
    const [log] = await SBC.post('message_log', {
      asesor,
      trigger_id:     triggerId,
      body,
      prompt_version: plantilla.version
    });

    // 6. Enviar notificación
    await sendNotification(asesor, body);

    return { body, logId: log?.id };
  }

  return { body };
}
