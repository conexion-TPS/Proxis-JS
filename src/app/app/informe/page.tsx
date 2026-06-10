'use client'
import { useCallback, useEffect, useState } from 'react'
import MiInforme, { getMesLabel, type Informe } from '@/components/MiInforme'
import BitacoraSemanal, { type BitacoraDTO } from '@/components/BitacoraSemanal'

/*
 * Mi Informe — calco fiel del legacy (panel-informe + app-shell de plataforma-core.js / plataforma/page.tsx).
 * App-shell oscuro (logo + UF + rol + Salir + module-bar + tabs) + 3 tarjetas + estado vacío + tooltips flotantes + gráficos.
 * Datos: /api/app/informe (proxis_dev por persona_id). Login: /api/vina/login (Consorcio).
 */

const TOKEN_KEY = 'app_token'
function last6Meses(): string[] {
  const out: string[] = [], now = new Date()
  for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return out
}


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
  // Pestañas del módulo asesor (Mi informe / Bitácora Semanal inerte read-only)
  const [tab, setTab] = useState<'informe' | 'bitacora'>('informe')
  const [bitData, setBitData] = useState<BitacoraDTO | null>(null)
  const [bitLoading, setBitLoading] = useState(false)
  const [bitErr, setBitErr] = useState('')
  const [guia, setGuia] = useState(false) // acordeón de ayuda "¿Cómo funciona?" (toggle local, no escribe)

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

  // Bitácora Semanal — solo lectura (proxis_dev por persona_id, mes actual + previo). Carga al abrir la pestaña.
  const cargarBitacora = useCallback(async (tk: string) => {
    setBitLoading(true); setBitErr('')
    try {
      const r = await fetch(`/api/app/bitacora?mes=${last6Meses()[0]}`, { headers: { Authorization: `Bearer ${tk}` } })
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setToken(null); return }
      const d = await r.json()
      if (!r.ok) { setBitErr(d.error ?? 'Error'); setBitData(null); return }
      setBitData(d)
    } catch { setBitErr('No se pudo conectar') }
    finally { setBitLoading(false) }
  }, [])
  useEffect(() => { if (token && tab === 'bitacora' && !bitData) cargarBitacora(token) }, [token, tab, bitData, cargarBitacora])

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
          <div className={`tab${tab === 'informe' ? ' active' : ''}`} onClick={() => setTab('informe')}>Mi informe</div>
          <div className={`tab${tab === 'bitacora' ? ' active' : ''}`} onClick={() => setTab('bitacora')}>Bitácora Semanal</div>
        </div>

        {/* Panel: Mi informe */}
        {tab === 'informe' && (
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

            {!cargando && data?.hasReportes && <MiInforme dto={data} mes={mes} />}
          </div>

          <div className="copyright" style={{ marginTop: 24 }}>
            <span style={{ color: 'var(--g400)' }}>© 2026 The Precision Selling · Todos los derechos reservados</span>
          </div>
        </div>
        )}

        {/* Panel: Bitácora Semanal (inerte, read-only — calco A: /plataforma) */}
        {tab === 'bitacora' && (
        <div className="tab-panel">
          <div className="informe-head">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Bitácora Semanal</h2>
              <p style={{ fontSize: 13, color: 'var(--g400)' }}>Mes en curso: {getMesLabel(last6Meses()[0])}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setGuia((v) => !v)}
                style={{ fontSize: 12, padding: '7px 12px', background: 'white', border: '1px solid var(--g200)', borderRadius: 'var(--r)', color: 'var(--g700)', fontFamily: 'var(--font)', fontWeight: 500, cursor: 'pointer' }}
              >💡 ¿Cómo funciona?</button>
              {/* Recordatorio visual de A — inerte (la escritura es Fase 3) */}
              <button
                disabled
                title="Disponible en Fase 3"
                style={{ fontSize: 13, padding: '7px 14px', background: '#0b0a09', color: 'white', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--font)', fontWeight: 600, opacity: .4, cursor: 'not-allowed' }}
              >+ Nueva semana</button>
            </div>
          </div>

          {/* Acordeón de ayuda — calco de #bitacora-guia (plataforma/page.tsx:537-565). Solo informativo. */}
          {guia && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: 'var(--blue)', borderRadius: 'var(--rl)', padding: '20px 22px', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>📋 Cómo usar tu Bitácora Semanal</div>
                  <button onClick={() => setGuia(false)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: 'white', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Cerrar ✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📅 Informe semanal</div>
                    <p style={{ fontSize: 12, lineHeight: 1.6, opacity: .9 }}>Cada lunes abre una nueva semana y registra tus contactos: nombre, vínculo, si llamaste, si te reuniste y cuántos prospectos te dio. La meta es ≥5 prospectos por contacto.</p>
                    <div style={{ marginTop: 10, fontSize: 11, background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                      <strong>¿Un contacto volvió a darte prospectos?</strong><br />
                      Agrégalo en la semana nueva. El sistema detectará que ya estuvo antes y te preguntará si es la misma persona. Si confirmas → ¡se convierte en tu Nodo! 🌳
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🌳 Mis Nodos Activos</div>
                    <p style={{ fontSize: 12, lineHeight: 1.6, opacity: .9 }}>Un <strong>nodo</strong> es un contacto que te refirió prospectos en más de una ocasión. Es la señal de que confían en ti y siguen ayudándote a crecer.</p>
                    <div style={{ marginTop: 10, fontSize: 11, background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                      <strong>¿Quieres trabajar enfocado en tus nodos?</strong><br />
                      Usa la sección &quot;Mis Nodos Activos&quot; arriba para registrar activaciones directamente sobre cada nodo, sin pasar por el formulario semanal.
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, fontSize: 11, opacity: .75, textAlign: 'center' }}>
                  Las semanas anteriores se cierran automáticamente cuando abres una nueva · Solo la semana más reciente es editable
                </div>
              </div>
            </div>
          )}
          {bitLoading && <div className="ib bl">Cargando bitácora…</div>}
          {bitErr && <div className="ib rd">{bitErr}</div>}
          {!bitLoading && !bitErr && bitData && <BitacoraSemanal dto={bitData} />}
          <div className="copyright" style={{ marginTop: 24 }}>
            <span style={{ color: 'var(--g400)' }}>© 2026 The Precision Selling · Todos los derechos reservados</span>
          </div>
        </div>
        )}
      </div>

    </>
  )
}
