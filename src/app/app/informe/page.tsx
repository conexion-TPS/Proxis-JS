'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Mi Informe — calco fiel del legacy (panel-informe + app-shell de plataforma-core.js / plataforma/page.tsx).
 * App-shell oscuro (logo + UF + rol + Salir + module-bar + tabs) + 3 tarjetas + estado vacío + tooltips flotantes + gráficos.
 * Datos: /api/app/informe (proxis_dev por persona_id). Login: /api/vina/login (Consorcio).
 */

const TOKEN_KEY = 'app_token'
const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']
const getMesLabel = (m: string) => { const [y, mo] = m.split('-'); return `${MESES_NOM[parseInt(mo) - 1]} ${y}` }
const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const semaforo = (pct: number) => (pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'bad')
function last6Meses(): string[] {
  const out: string[] = [], now = new Date()
  for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return out
}

const TOOLTIPS: Record<string, string> = {
  'prospectos-obtenidos': 'Prospectos obtenidos: total de prospectos referidos por tus contactos este mes. Es el resultado central de la actividad de contacto.',
  'contactos-realizados': 'Contactos realizados: personas que activaste como nodo potencial esta semana. Cada contacto puede darte hasta 5 prospectos.',
  'eficiencia-contactos': 'Eficiencia de Contactos: cuánto del potencial máximo estás aprovechando. Si cada contacto diera 5 referidos, el potencial sería mayor. Meta: ≥80%.',
}

type Semana = { semana: number; fecha: string; contactos: number; reuniones: number; prospectos: number; potencial: number; prom: number; esFantasma: boolean; confirmado: boolean }
type Informe = {
  mes: string; hasReportes: boolean; semanasCount: number
  identidad?: { nombre: string; institucion: string | null; via: string; tipo: string }
  meta?: { meta_contactos_semana: number; meta_prospectos_mes: number; meta_ventas_mes: number; meta_ingresos: number }
  ingreso?: number
  kpis?: { totC: number; totR: number; totP: number; totPot: number; promG: number; tasaReu: number; efic: number; brecha: number; prospReu: number; mejorV: [string, number] | null }
  semanas?: Semana[]
  vincAcum?: Record<string, number>
  nodos?: {
    count: number; totalActs: number; totalProsp: number; ultPct: number
    lista: { nombre: string; activaciones: number; total_prospectos: number; fecha_conversion: string | null }[]
    chart: { labels: string[]; dAcum: number[]; dNuevos: number[]; dProspNodos: number[]; dProspTotal: number[]; dPct: number[] }
  }
  avances?: { avMes: number; avC: number | null; avIng: number | null }
}

// Calco de interpretarNodos() (esEquipo=false): mensajes según tendencia de la red de nodos.
function interpretarNodos(ch: { dAcum: number[]; dNuevos: number[]; dPct: number[]; labels: string[] }): { color: string; txt: string }[] {
  const { dAcum, dNuevos, dPct, labels } = ch
  if (!dAcum.length) return []
  const ultimo = dAcum[dAcum.length - 1], ultNuevos = dNuevos[dNuevos.length - 1], ultPct = dPct[dPct.length - 1]
  const msgs: { color: string; txt: string }[] = []
  let planos = 0; for (let i = dNuevos.length - 1; i >= 0; i--) { if (dNuevos[i] === 0) planos++; else break }
  if (planos >= 2) msgs.push({ color: '#BA7517', txt: `Llevas ${planos} mes${planos > 1 ? 'es' : ''} sin nuevos nodos — es momento de reactivar contactos anteriores.` })
  else if (ultNuevos >= 2) msgs.push({ color: '#0F6E56', txt: `Mes destacado: ${ultNuevos} nodos nuevos en ${labels[labels.length - 1]}. La red está creciendo activamente.` })
  else if (ultNuevos === 1) msgs.push({ color: '#0F6E56', txt: `Se agregó 1 nodo nuevo este mes. Ritmo constante de profundización.` })
  if (dPct.length >= 2) {
    const diff = ultPct - (dPct[dPct.length - 2] || 0)
    if (diff >= 10) msgs.push({ color: '#0F6E56', txt: `La proporción de prospectos de nodos subió ${diff}% este mes — la red está rindiendo más.` })
    else if (diff <= -10) msgs.push({ color: '#BA7517', txt: `La proporción de prospectos de nodos bajó ${Math.abs(diff)}% — los nodos están menos activos.` })
  }
  if (ultPct >= 40) msgs.push({ color: '#0F6E56', txt: `Más del ${ultPct}% de tus prospectos ya vienen de la red de nodos — hábito consolidado.` })
  else if (ultPct >= 20) msgs.push({ color: '#185FA5', txt: `${ultPct}% de tus prospectos vienen de nodos. El objetivo es superar el 40%.` })
  else if (ultimo > 0) msgs.push({ color: '#BA7517', txt: `Solo el ${ultPct}% de tus prospectos vienen de nodos — la red aún no está rindiendo su potencial.` })
  return msgs
}

type Tip = { show: boolean; x: number; y: number; title: string; body: string }

const CSS = `
:root{
  --blue:#0b0a09;--blue-mid:#3a3833;--blue-lt:#f2efe9;--blue-pale:#faf8f4;
  --lime:#cbf135;--lime-dk:#a8cc1a;
  --teal:#1f6f56;--teal-lt:#e6f3ed;
  --amber:#a8691a;--amber-lt:#f8ecd6;
  --red:#b03a3a;--red-lt:#fbe9e9;
  --green:#3b6d11;--green-lt:#e9f2dd;
  --g50:#fafaf7;--g100:#f5f3ef;--g200:#ecebe5;--g300:#dddbd3;--g400:#9d9b93;--g600:#5d5b54;--g700:#3a3934;--g900:#161614;
  --font:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;--mono:'DM Mono',ui-monospace,monospace;
  --r:10px;--rl:14px;--rx:18px;
  --shadow-1:0 1px 2px rgba(20,18,12,0.04);
}
.app-bg{min-height:100vh;background:var(--g100);color:var(--g900);font-family:var(--font);font-size:13.5px;line-height:1.55;letter-spacing:-0.005em;-webkit-font-smoothing:antialiased}
.app-bg *,.app-bg *::before,.app-bg *::after{box-sizing:border-box}
.app-bg h2,.app-bg h3,.app-bg p,.app-bg table{margin:0}

/* App-shell */
.header{background:#0b0a09;color:white;padding:11px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(255,255,255,0.05);box-shadow:0 1px 0 0 var(--lime-dk),0 4px 14px rgba(0,0,0,0.06)}
.hlogo-wrap{display:flex;align-items:center;background:transparent;border-radius:8px;flex-shrink:0}
.hdiv{width:1px;height:22px;background:rgba(255,255,255,.14);flex-shrink:0}
.hlogo-text{font-size:11px;font-weight:600;color:white;line-height:1.3}
.hlogo-text span{display:block;font-size:9.5px;font-weight:400;opacity:.55;letter-spacing:.1em;text-transform:uppercase;margin-top:1px}
.huf{font-size:11px;opacity:.7;display:inline-flex;align-items:center;gap:5px}
.uf-display{font-family:var(--mono);font-size:11px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:3px 10px;margin-left:2px;color:white;font-feature-settings:"tnum"}
.hrole{font-size:12px;opacity:.7}.hrole strong{font-weight:600;opacity:1}
.hml{margin-left:auto;display:flex;align-items:center;gap:10px}
.hinicio{font-size:12px;color:rgba(255,255,255,.5);text-decoration:none;padding:5px 12px;border:1px solid rgba(255,255,255,.2);border-radius:20px;transition:all .15s}
.hinicio:hover{color:rgba(255,255,255,.9)}
.hout{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:white;font-family:var(--font);font-size:12px;font-weight:500;padding:6px 14px;border-radius:20px;cursor:pointer;transition:all .15s}
.hout:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.24)}
.module-bar{background:white;border-bottom:1px solid var(--g200);padding:0 24px;display:flex;gap:0;overflow-x:auto}
.mod-btn{padding:14px 18px;font-size:13px;font-weight:600;color:var(--g400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:all .18s;display:flex;align-items:center;gap:7px;letter-spacing:-0.005em}
.mod-btn:hover{color:var(--g700)}
.mod-btn.active{color:#0b0a09;border-bottom-color:#0b0a09}
.tabs{display:flex;border-bottom:1px solid var(--g200);background:white;padding:0 24px;overflow-x:auto;gap:2px}
.tab{padding:11px 14px;font-size:13px;font-weight:500;color:var(--g400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:all .15s;letter-spacing:-0.005em}
.tab:hover{color:var(--g700)}
.tab.active{color:#0b0a09;border-bottom-color:#0b0a09;font-weight:600}
.tab-panel{padding:24px}

/* Encabezado del panel */
.informe-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.sel-std{padding:8px 12px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:13px;color:var(--g900);background:white;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239E9D97' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer;min-width:180px;transition:all .15s}
.sel-std:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(11,10,9,0.08)}

/* Cards */
.card{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:20px 22px;margin-bottom:14px;box-shadow:var(--shadow-1)}
.card-title{font-size:13px;font-weight:600;color:var(--g900);margin-bottom:16px;display:flex;align-items:center;gap:10px;letter-spacing:-0.005em}
.card-title::before{content:'';display:block;width:3px;height:14px;background:var(--lime-dk);border-radius:2px;flex-shrink:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mc{background:white;border:1px solid var(--g200);border-radius:var(--rl);padding:14px 16px;position:relative;box-shadow:var(--shadow-1)}
.mc.ok{background:var(--teal-lt);border-color:rgba(31,111,86,.22)}
.mc.warn{background:var(--amber-lt);border-color:rgba(168,105,26,.22)}
.mc.bad{background:var(--red-lt);border-color:rgba(176,58,58,.22)}
.mc-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--g400);margin-bottom:6px}
.mc.ok .mc-label{color:var(--teal)}.mc.warn .mc-label{color:var(--amber)}.mc.bad .mc-label{color:var(--red)}
.mc-value{font-size:22px;font-weight:600;font-family:var(--font);color:var(--g900);letter-spacing:-.022em;font-feature-settings:"tnum";line-height:1.15}
.mc.ok .mc-value{color:var(--teal)}.mc.warn .mc-value{color:var(--amber)}.mc.bad .mc-value{color:var(--red)}
.mc-sub{font-size:11px;color:var(--g600);margin-top:4px}
.mc-explain{font-size:11px;color:var(--g600);margin-top:7px;line-height:1.45;font-style:italic;border-top:1px solid rgba(0,0,0,.06);padding-top:6px}
.semaforo{position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 2px white}
.semaforo.ok{background:#22c55e}.semaforo.warn{background:#f59e0b}.semaforo.bad{background:#ef4444}
table.dt{width:100%;border-collapse:collapse;font-size:13px}
.dt th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:8px 10px;border-bottom:1px solid var(--g200)}
.dt td{padding:9px 10px;border-bottom:1px solid var(--g100);color:var(--g700)}
.dt tr:last-child td{border-bottom:none}
.dt tfoot td{font-weight:600;color:var(--g900);border-top:1px solid var(--g300);border-bottom:none;padding-top:10px;background:var(--g50)}
.pill{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:-0.005em;line-height:1.3}
.pill-am{background:var(--amber-lt);color:var(--amber)}
.pill-rd{background:var(--red-lt);color:var(--red)}
.pill-gn{background:var(--teal-lt);color:var(--teal)}
.pill-bl{background:var(--blue-lt);color:var(--blue)}
.chart-wrap{position:relative;height:220px;margin-top:10px}
.ico-info{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--g300);color:var(--g700);font-size:9px;font-weight:700;cursor:default;vertical-align:middle;margin-left:3px;font-style:normal;flex-shrink:0;line-height:1;font-family:var(--font)}
.ib{padding:10px 13px;border-radius:var(--r);font-size:12px;line-height:1.55;margin-bottom:12px;border:1px solid transparent}
.ib.am{background:var(--amber-lt);color:#7a4d0a;border-color:rgba(168,105,26,0.18)}
.ib.bl{background:var(--blue-lt);color:var(--blue);border-color:rgba(11,10,9,0.08)}
.ib.rd{background:var(--red-lt);color:var(--red);border-color:rgba(176,58,58,0.18)}
.ib strong{font-weight:600}
.copyright{text-align:center;font-size:11px;color:var(--g400);padding:28px 18px;border-top:1px solid var(--g200);margin-top:8px;display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}

@media(max-width:900px){.tab-panel{padding:16px}.module-bar,.tabs{padding:0 14px}.header{padding:9px 14px}.grid4{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}}

/* Login (gate funcional) */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--g100)}
.login-card{background:white;border:1px solid var(--g200);border-radius:var(--rx);padding:32px 30px;width:100%;max-width:400px;box-shadow:var(--shadow-1)}
.login-card input{width:100%;padding:11px 14px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:14px;color:var(--g900);outline:none;margin-bottom:12px}
.login-card input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(11,10,9,0.08)}
.login-btn{width:100%;padding:13px;border:none;border-radius:var(--r);background:#0b0a09;color:white;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer}
.login-btn:disabled{opacity:.5;cursor:not-allowed}
`

// Logo SVG del header (calco exacto)
function LogoProxis() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="16" cy="16" r="4.5" fill="#a8cc1a" />
      <circle cx="6" cy="9" r="3" fill="#a8cc1a" opacity="0.85" />
      <circle cx="26" cy="9" r="3" fill="#a8cc1a" opacity="0.85" />
      <circle cx="6" cy="23" r="3" fill="#a8cc1a" opacity="0.6" />
      <circle cx="26" cy="23" r="3" fill="#a8cc1a" opacity="0.6" />
      <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export default function InformePage() {
  const [token, setToken] = useState<string | null>(null)
  const [mes, setMes] = useState(last6Meses()[0])
  const [data, setData] = useState<Informe | null>(null)
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [uf, setUf] = useState<string>('…')
  const [tip, setTip] = useState<Tip>({ show: false, x: 0, y: 0, title: '', body: '' })

  const actRef = useRef<HTMLCanvasElement | null>(null)
  const potRef = useRef<HTMLCanvasElement | null>(null)
  const nodRef = useRef<HTMLCanvasElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartsRef = useRef<any[]>([])

  useEffect(() => { const t = localStorage.getItem(TOKEN_KEY); if (t) setToken(t) }, [])

  // UF (mindicador.cl) — igual que el legacy fetchUF()
  useEffect(() => {
    fetch('https://mindicador.cl/api/uf')
      .then((r) => r.json())
      .then((d) => setUf('$' + Math.round(d.serie[0].valor).toLocaleString('es-CL')))
      .catch(() => setUf('—'))
  }, [])

  const cargar = useCallback(async (tk: string, m: string) => {
    setCargando(true); setErr('')
    try {
      const r = await fetch(`/api/app/informe?mes=${m}`, { headers: { Authorization: `Bearer ${tk}` } })
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setToken(null); return }
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Error'); setData(null); return }
      setData(d)
    } catch { setErr('No se pudo conectar') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { if (token) cargar(token, mes) }, [token, mes, cargar])

  // Gráficos (Chart.js) — calco de renderInformeCharts()
  useEffect(() => {
    chartsRef.current.forEach((c) => c.destroy())
    chartsRef.current = []
    const semanas = data?.semanas
    if (!data?.hasReportes || !semanas || !actRef.current || !potRef.current) return
    let cancelado = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('chart.js/auto').then((mod: any) => {
      if (cancelado) return
      const Chart = mod.default
      const labels = semanas.map((s) => `Sem. ${s.semana}`)
      chartsRef.current.push(new Chart(actRef.current, {
        type: 'bar',
        data: {
          labels, datasets: [
            { label: 'Contactos', data: semanas.map((s) => s.contactos), backgroundColor: '#B5D4F4' },
            { label: 'Reuniones', data: semanas.map((s) => s.reuniones), backgroundColor: '#9FE1CB' },
            { label: 'Prospectos', data: semanas.map((s) => s.prospectos), backgroundColor: '#003781' },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false } } } },
      }))
      let ap = 0, ar = 0; const dp: number[] = [], dr: number[] = []
      semanas.forEach((s) => { ap += s.potencial; ar += s.prospectos; dp.push(ap); dr.push(ar) })
      chartsRef.current.push(new Chart(potRef.current, {
        type: 'line',
        data: {
          labels, datasets: [
            { label: 'Potencial', data: dp, borderColor: '#9E9D97', backgroundColor: 'transparent', borderDash: [5, 5] },
            { label: 'Real', data: dr, borderColor: '#003781', backgroundColor: 'rgba(0,55,129,.1)', fill: true },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false } } } },
      }))

      // Gráfico de nodos (calco de buildNodosChart) — tri-dataset, ejes y/y2/y3
      const nod = data.nodos
      if (nod && nod.count > 0 && nodRef.current) {
        const c = nod.chart
        chartsRef.current.push(new Chart(nodRef.current, {
          data: {
            labels: c.labels, datasets: [
              { type: 'bar', label: 'Nuevos nodos', data: c.dNuevos, backgroundColor: c.dNuevos.map((v) => v === 0 ? 'rgba(242,91,91,.18)' : 'rgba(15,110,86,.3)'), borderColor: c.dNuevos.map((v) => v === 0 ? '#F7C1C1' : '#5DCAA5'), borderWidth: 1, borderRadius: 3, yAxisID: 'y2', order: 3 },
              { type: 'line', label: 'Nodos acumulados', data: c.dAcum, borderColor: '#0F6E56', backgroundColor: 'rgba(15,110,86,.08)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: c.dNuevos.map((v) => v === 0 ? '#E24B4A' : '#0F6E56'), pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y', order: 1 },
              { type: 'line', label: 'Prospectos de nodos', data: c.dProspNodos, borderColor: '#185FA5', borderDash: [5, 4], backgroundColor: 'transparent', tension: .3, pointRadius: 3, borderWidth: 2, yAxisID: 'y3', order: 2 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plugins: { legend: { display: false }, tooltip: { callbacks: { afterBody: (items: any) => {
              const i = items[0]?.dataIndex; const pct = c.dPct[i]; const nn = c.dNuevos[i]; const lines: string[] = []
              if (pct != null) lines.push('% del total: ' + pct + '%'); if (nn === 0) lines.push('⚠ Sin nodo nuevo este mes'); return lines
            } } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { position: 'left', min: 0, title: { display: true, text: 'Acumulados', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { stepSize: 1, font: { size: 10 } } },
              y2: { position: 'right', min: 0, max: Math.max(...c.dNuevos) + 1, title: { display: true, text: 'Nuevos', font: { size: 10 } }, grid: { display: false }, ticks: { stepSize: 1, font: { size: 10 } } },
              y3: { display: false },
            },
          },
        }))
      }
    })
    return () => { cancelado = true; chartsRef.current.forEach((c) => c.destroy()); chartsRef.current = [] }
  }, [data])

  async function login() {
    setErr(''); setCargando(true)
    try {
      const r = await fetch('/api/vina/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Credenciales incorrectas'); return }
      localStorage.setItem(TOKEN_KEY, d.token); setToken(d.token)
    } catch { setErr('No se pudo conectar') }
    finally { setCargando(false) }
  }
  function salir() { localStorage.removeItem(TOKEN_KEY); setToken(null); setData(null) }

  // ── Tooltip flotante (calco de showTooltip/#tooltip-modal) ──
  function moverTip(k: string, e: React.MouseEvent) {
    const body = TOOLTIPS[k]; if (!body) return
    const title = k.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setTip({ show: true, title, body, x: Math.min(e.clientX + 12, window.innerWidth - 300), y: Math.max(e.clientY - 60, 10) })
  }
  const ocultarTip = () => setTip((t) => ({ ...t, show: false }))

  function Info({ k }: { k: string }) {
    return (
      <span onMouseEnter={(e) => moverTip(k, e)} onMouseMove={(e) => moverTip(k, e)} onMouseLeave={ocultarTip}
        style={{ cursor: 'help', color: 'var(--blue)', fontStyle: 'normal' }}> <span className="ico-info">i</span></span>
    )
  }

  // ── Tile (calco de mc / mcBad / mcOk / emptyMc) ──
  function Tile({ label, info, value, sub, pct, explain, tone, valueSize }: {
    label: string; info?: string; value: React.ReactNode; sub?: React.ReactNode
    pct?: number | null; explain?: string; tone?: 'ok' | 'bad'; valueSize?: number
  }) {
    const cls = tone ? `mc ${tone}` : pct != null ? `mc ${semaforo(pct)}` : 'mc'
    const dot = tone === 'bad' ? 'bad' : tone === 'ok' ? null : pct != null ? semaforo(pct) : null
    return (
      <div className={cls}>
        {dot && <div className={`semaforo ${dot}`} />}
        <div className="mc-label">{label}{info && <Info k={info} />}</div>
        <div className="mc-value" style={valueSize ? { fontSize: valueSize } : undefined}>{value}</div>
        {sub != null && sub !== '' && <div className="mc-sub">{sub}</div>}
        {explain && <div className="mc-explain">{explain}</div>}
      </div>
    )
  }

  // ── LOGIN ──
  if (!token) {
    return (
      <>
        <style>{CSS}</style>
        <div className="login-wrap">
          <div className="login-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>Pro<span style={{ color: '#a8cc1a' }}>xis</span></span>
              <span style={{ fontSize: 13, color: 'var(--g600)' }}>· Mi Informe</span>
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} placeholder="••••••••" />
            <button className="login-btn" onClick={login} disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
            {err && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{err}</div>}
          </div>
        </div>
      </>
    )
  }

  const k = data?.kpis, av = data?.avances, meta = data?.meta, semanas = data?.semanas, vincAcum = data?.vincAcum
  const rolTxt = data?.identidad?.tipo === 'mando' ? 'Supervisora' : 'Asesor/a'

  return (
    <>
      <style>{CSS}</style>
      <div className="app-bg">
        {/* App-shell oscuro */}
        <header className="header">
          <div className="hlogo-wrap" style={{ gap: 8 }}>
            <LogoProxis />
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: 'white', letterSpacing: '-0.04em' }}>Pro<span style={{ color: '#cbf135' }}>xis</span></span>
          </div>
          <div className="hdiv" />
          <div className="hlogo-text" style={{ fontSize: 11, fontWeight: 600, color: 'white', lineHeight: 1.3 }}>Prospección<span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: .7, letterSpacing: '.07em', textTransform: 'uppercase' }}>en práctica</span></div>
          <span className="huf">UF: <span className="uf-display">{uf}</span></span>
          <div className="hml">
            <div className="hrole">{data?.identidad?.nombre} · <strong>{rolTxt}</strong></div>
            <a href="/" className="hinicio">← Inicio</a>
            <button className="hout" onClick={salir}>Salir</button>
          </div>
        </header>

        {/* Module bar (asesor) */}
        <div className="module-bar">
          <div className="mod-btn active">📋 Mi actividad</div>
        </div>

        {/* Tabs (asesor) */}
        <div className="tabs">
          <div className="tab active">Mi informe</div>
          <div className="tab">Bitácora Semanal</div>
        </div>

        {/* Panel: Mi informe */}
        <div className="tab-panel">
          <div className="informe-head">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Mi informe de avance</h2>
              <p style={{ fontSize: 13, color: 'var(--g400)' }}>Indicadores de gestión de prospección</p>
            </div>
            <select className="sel-std" value={mes} onChange={(e) => setMes(e.target.value)}>
              {last6Meses().map((m) => <option key={m} value={m}>{getMesLabel(m)}</option>)}
            </select>
          </div>

          <div id="informe-content">
            {cargando && <div className="ib bl">Cargando informe…</div>}

            {!cargando && data && !data.hasReportes && (
              <div className="ib am"><strong>Sin reportes en {getMesLabel(mes)}.</strong> Ve a la pestaña <strong>Reporte semanal</strong> para ingresar tu actividad de la semana.</div>
            )}

            {!cargando && data?.hasReportes && k && av && meta && (
              <>
                {/* Card: Nodos activos (calco de renderInformeHTML nodos-section + loadNodosEnInforme) */}
                <div className="card" style={{ border: '2px solid var(--teal)', marginBottom: 16 }}>
                  <div className="card-title" style={{ color: 'var(--teal)' }}>✦ Nodos activos</div>
                  {data.nodos && data.nodos.count > 0 ? (
                    <>
                      <div className="grid4" style={{ marginBottom: 14 }}>
                        <div className="mc ok"><div className="mc-label">Nodos activos</div><div className="mc-value">{data.nodos.count}</div><div className="mc-sub">contactos convertidos en nodo</div></div>
                        <div className="mc"><div className="mc-label">Total activaciones</div><div className="mc-value">{data.nodos.totalActs}</div><div className="mc-sub">veces que han vuelto a referir</div></div>
                        <div className="mc"><div className="mc-label">Prospectos de nodos</div><div className="mc-value">{data.nodos.totalProsp}</div><div className="mc-sub">total histórico acumulado</div></div>
                        <div className="mc"><div className="mc-label">% del total este mes</div><div className="mc-value">{data.nodos.ultPct}%</div><div className="mc-sub">de prospectos vienen de nodos</div></div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {data.nodos.lista.map((n, i) => (
                          <div key={i} style={{ background: 'var(--teal-lt)', border: '1px solid rgba(15,110,86,.3)', borderRadius: 'var(--r)', padding: '9px 12px', minWidth: 160 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g900)' }}>🌳 {n.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2 }}>{n.activaciones} activaciones · {n.total_prospectos || 0} prosp.</div>
                            <div style={{ fontSize: 10, color: 'var(--g400)' }}>Nodo desde {n.fecha_conversion || '—'}</div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--g400)', marginBottom: 6 }}>Evolución de nodos acumulados y prospectos generados</p>
                      <div style={{ display: 'flex', gap: 14, marginBottom: 6, fontSize: 11, color: 'var(--g400)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 4, background: '#0F6E56', borderRadius: 2, display: 'inline-block' }} />Nodos acumulados</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 0, borderTop: '2px dashed #185FA5', display: 'inline-block' }} />Prospectos de nodos</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(15,110,86,.3)', borderRadius: 2, display: 'inline-block' }} />Nuevos nodos</span>
                      </div>
                      <div style={{ position: 'relative', height: 160 }}><canvas ref={nodRef} role="img" aria-label="Evolución nodos" /></div>
                      {interpretarNodos(data.nodos.chart).length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {interpretarNodos(data.nodos.chart).map((m, i) => (
                            <div key={i} style={{ fontSize: 11, lineHeight: 1.5, padding: '7px 10px', borderRadius: 'var(--r)', borderLeft: `3px solid ${m.color}`, background: m.color + '18', color: 'var(--g700)' }}>{m.txt}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--g100)', borderRadius: 'var(--r)' }}>
                      <span style={{ fontSize: 20 }}>🌱</span>
                      <p style={{ fontSize: 12, color: 'var(--g700)', lineHeight: 1.5 }}>Aún no hay nodos confirmados. Un contacto se convierte en <strong>nodo</strong> cuando refiere prospectos en más de una ocasión.</p>
                    </div>
                  )}
                </div>

                {/* Card: Resumen del mes */}
                <div className="card">
                  <div className="card-title">Resumen del mes — {getMesLabel(mes)}</div>
                  <div className="grid4" style={{ marginBottom: 12 }}>
                    <Tile label="Prospectos obtenidos" info="prospectos-obtenidos" value={k.totP} sub={`Meta: ${meta.meta_prospectos_mes} · ${av.avMes}% cumplido`} pct={av.avMes} explain="Total de prospectos que tus contactos te referenciaron este mes. Es el resultado central de toda la actividad de prospección." />
                    <Tile label="Contactos realizados" info="contactos-realizados" value={k.totC} sub={`Meta: ${meta.meta_contactos_semana * data.semanasCount} (${meta.meta_contactos_semana}/sem × ${data.semanasCount} sem)`} pct={av.avC} explain="Número de nodos relacionales activados. Cada contacto es una persona que puede referirte entre 3 y 5 prospectos calificados." />
                    <Tile label="Tasa de reunión" value={`${k.tasaReu}%`} sub={`${k.totR} reuniones de ${k.totC} contactos · Meta: ≥60%`} pct={Math.round(k.tasaReu / 60 * 100)} explain="Porcentaje de contactos que aceptaron reunirse. Mide tu capacidad de apertura y la confianza que genera tu acercamiento." />
                    <Tile label="Eficiencia de Contactos" info="eficiencia-contactos" value={`${k.efic}%`} sub={`Prospectos reales vs. potencial (${k.totPot})`} pct={k.efic} explain={`¿Cuánto del potencial máximo aprovechas? Si cada contacto diera 5 referidos, el potencial sería ${k.totPot}. Meta: ≥80%.`} />
                  </div>
                  <div className="grid4">
                    <Tile label="Prospectos / contacto" value={k.promG} sub="Meta: ≥ 4,5 prospectos" pct={Math.round(k.promG / 4.5 * 100)} explain="Indicador clave de efectividad. Si es bajo, trabajar el guión de solicitud, la confianza y la imagen personal ante el contacto." />
                    <Tile label="Prospectos / reunión" value={k.prospReu} sub={`${k.totR} reuniones · Meta: ≥ 4`} pct={Math.round(k.prospReu / 4 * 100)} explain="Calidad de cada reunión. Al reunirte, deberías salir siempre con al menos 4 nombres de referidos calificados." />
                    <Tile label="Brecha de prospectos" value={k.brecha} sub="Prospectos no obtenidos este mes" tone="bad" explain="Cuántos prospectos se perdieron por no llegar a 5 referidos por contacto. Representa oportunidad no capitalizada." />
                    {k.mejorV
                      ? <Tile label="Vínculo más productivo" value={k.mejorV[0]} sub={`${k.mejorV[1]} prospectos generados`} tone="ok" valueSize={18} explain="El tipo de relación que más referidos produce. Prioriza tu energía en estos vínculos." />
                      : <Tile label="Vínculo" value="—" sub="" valueSize={18} />}
                  </div>

                  {av.avIng !== null && data.ingreso != null && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--g200)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 10 }}>CORRELACIÓN ACTIVIDAD → INGRESOS</p>
                      <div className="grid2">
                        <Tile label="Ingresos del mes" value={fmt(data.ingreso)} sub={`Meta: ${fmt(meta.meta_ingresos)} · ${av.avIng}% cumplido`} pct={av.avIng} explain="Ingresos totales del mes vs. tu meta del simulador. La meta de ingresos es consecuencia directa de la actividad de prospección." />
                        <Tile label="Ingreso promedio por prospecto" value={k.totP ? fmt(data.ingreso / k.totP) : '—'} valueSize={18} sub={`${k.totP} prospectos → ${fmt(data.ingreso)}`} explain="Muestra cuánto vale en promedio cada prospecto generado. A mayor actividad consistente y mejor efectividad, mayor ingreso. Este indicador mejora con el tiempo." />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card: Evolución semanal */}
                <div className="card">
                  <div className="card-title">Evolución semanal</div>
                  <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table className="dt">
                      <thead><tr><th>Semana</th><th>Contactos</th><th>Reuniones</th><th>Tasa reunión</th><th>Prospectos</th><th>Potencial</th><th>Prom./contacto</th><th>Estado</th></tr></thead>
                      <tbody>
                        {(semanas ?? []).map((s, i) => {
                          const sinAct = s.contactos === 0
                          const rowStyle: React.CSSProperties = s.esFantasma ? { background: 'var(--red-lt)', opacity: .7 } : sinAct ? { background: 'var(--red-lt)' } : {}
                          const promCls = s.prom >= 4.5 ? 'pill-gn' : s.prom >= 3 ? 'pill-am' : 'pill-rd'
                          return (
                            <tr key={i} style={rowStyle}>
                              <td>Semana {s.semana} <span style={{ fontSize: 11, color: 'var(--g400)' }}>({s.fecha})</span></td>
                              <td><strong>{s.contactos}</strong></td><td>{s.reuniones}</td>
                              <td>{s.contactos ? Math.round(s.reuniones / s.contactos * 100) : 0}%</td>
                              <td><strong>{s.prospectos}</strong></td>
                              <td style={{ color: 'var(--g400)' }}>{s.potencial}</td>
                              <td>{sinAct ? <span className="pill pill-rd">Sin actividad</span> : <span className={`pill ${promCls}`}>{s.prom}</span>}</td>
                              <td>{s.esFantasma ? <span className="pill pill-rd">Sin reporte</span> : sinAct ? <span className="pill pill-rd">Sin contactos</span> : <span className="pill pill-bl">Guardado</span>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot><tr style={{ fontWeight: 600, borderTop: '2px solid var(--g200)' }}>
                        <td>Total mes</td><td>{k.totC}</td><td>{k.totR}</td><td>{k.tasaReu}%</td>
                        <td>{k.totP}</td><td style={{ color: 'var(--g400)' }}>{k.totPot}</td>
                        <td><span className={`pill ${k.promG >= 4.5 ? 'pill-gn' : k.promG >= 3 ? 'pill-am' : 'pill-rd'}`}>{k.promG}</span></td>
                        <td></td>
                      </tr></tfoot>
                    </table>
                  </div>
                  <div className="grid2">
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 6 }}>EVOLUCIÓN DE ACTIVIDAD</p>
                      <div className="chart-wrap"><canvas ref={actRef} role="img" aria-label="Gráfico de evolución de actividad semanal" /></div>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 6 }}>POTENCIAL vs. REAL ACUMULADO</p>
                      <div className="chart-wrap"><canvas ref={potRef} role="img" aria-label="Gráfico de potencial vs real acumulado" /></div>
                    </div>
                  </div>
                </div>

                {/* Card: Productividad por tipo de vínculo */}
                {vincAcum && Object.keys(vincAcum).length > 0 && (
                  <div className="card">
                    <div className="card-title">Productividad por tipo de vínculo</div>
                    <p style={{ fontSize: 12, color: 'var(--g400)', marginBottom: 12, marginLeft: 12 }}>Prospectos generados según el tipo de relación con el contacto. Identifica dónde concentrar el esfuerzo.</p>
                    <div className="grid4">
                      {VINCULOS.map((v) => (
                        <div className="mc" key={v}>
                          <div className="mc-label">{v}</div>
                          <div className="mc-value">{vincAcum[v] || 0}</div>
                          <div className="mc-sub">prospectos</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="copyright" style={{ marginTop: 24 }}>
            <span style={{ color: 'var(--g400)' }}>© 2026 The Precision Selling · Todos los derechos reservados</span>
          </div>
        </div>
      </div>

      {/* Tooltip flotante */}
      <div style={{ display: tip.show ? 'block' : 'none', position: 'fixed', zIndex: 900, pointerEvents: 'none', left: tip.x, top: tip.y }}>
        <div style={{ background: 'var(--g900)', color: 'white', borderRadius: 10, padding: '10px 14px', maxWidth: 280, fontSize: 12, lineHeight: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tip.title}</div>
          <div>{tip.body}</div>
        </div>
      </div>
    </>
  )
}
