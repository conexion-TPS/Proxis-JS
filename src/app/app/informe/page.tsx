'use client'
import { useCallback, useEffect, useState } from 'react'

/*
 * Mi Informe (piloto Fase B) — vista NUEVA en el destino final (/app).
 * Lee de proxis_dev vía /api/app/informe (KPIs server-side, por persona_id).
 * Login: reusa el auth real de Consorcio (/api/vina/login) → guarda token en localStorage.
 * Solo tarjetas KPI (el chart de nodos queda fuera del piloto, a propósito).
 */

const TOKEN_KEY = 'app_token'

type Mejor = [string, number] | null
type Informe = {
  mes: string
  hasReportes: boolean
  semanasCount: number
  identidad: { nombre: string; institucion: string | null; via: string }
  meta?: { meta_contactos_semana: number; meta_prospectos_mes: number; meta_ventas_mes: number; meta_ingresos: number }
  ingreso?: number
  kpis?: {
    totC: number; totR: number; totP: number; totPot: number
    promG: number; tasaReu: number; efic: number; brecha: number; prospReu: number; mejorV: Mejor
  }
  avances?: { avMes: number; avC: number | null; avIng: number | null }
}

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
function last6Meses(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`) }
  return out
}
function mesLabel(m: string) { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) }

export default function InformePage() {
  const [token, setToken] = useState<string | null>(null)
  const [mes, setMes] = useState(last6Meses()[0])
  const [data, setData] = useState<Informe | null>(null)
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')

  // login
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')

  useEffect(() => { const t = localStorage.getItem(TOKEN_KEY); if (t) setToken(t) }, [])

  const cargar = useCallback(async (tk: string, m: string) => {
    setCargando(true); setErr('')
    try {
      const r = await fetch(`/api/app/informe?mes=${m}`, { headers: { Authorization: `Bearer ${tk}` } })
      if (r.status === 401) { salir(); return }
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Error'); setData(null); return }
      setData(d)
    } catch { setErr('No se pudo conectar') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { if (token) cargar(token, mes) }, [token, mes, cargar])

  async function login() {
    setErr(''); setCargando(true)
    try {
      const r = await fetch('/api/vina/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Credenciales incorrectas'); return }
      localStorage.setItem(TOKEN_KEY, d.token)
      setToken(d.token)
    } catch { setErr('No se pudo conectar') }
    finally { setCargando(false) }
  }
  function salir() { localStorage.removeItem(TOKEN_KEY); setToken(null); setData(null) }

  // ── estilos (consistentes con /vina) ──
  const S = {
    wrap: { minHeight: '100vh', background: '#f5f3ef', fontFamily: "system-ui,sans-serif", color: '#161614' } as React.CSSProperties,
    header: { background: '#0b0a09', color: '#fff', padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
    chip: { background: '#cbf135', color: '#0b0a09', fontWeight: 800, padding: '2px 9px', borderRadius: 6, fontSize: 13 } as React.CSSProperties,
    card: { background: '#fff', border: '1px solid #ecebe5', borderRadius: 14, padding: 20, margin: '14px auto', maxWidth: 920 } as React.CSSProperties,
    inp: { padding: '8px 10px', border: '1px solid #ecebe5', borderRadius: 8, fontSize: 13, width: '100%' } as React.CSSProperties,
    btn: { padding: '9px 16px', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', background: '#0b0a09', color: '#fff' } as React.CSSProperties,
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 } as React.CSSProperties,
  }

  // ── LOGIN ──
  if (!token) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...S.card, maxWidth: 400, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>Pro<span style={{ color: '#a8cc1a' }}>xis</span></span>
            <span style={S.chip}>Mi Informe</span>
          </div>
          <p style={{ fontSize: 13, color: '#5d5b54', marginBottom: 16 }}>Acceso de asesor (Consorcio).</p>
          <input style={{ ...S.inp, marginBottom: 10 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          <input style={{ ...S.inp, marginBottom: 12 }} type="password" value={pass}
            onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} placeholder="••••••••" />
          <button style={{ ...S.btn, width: '100%' }} onClick={login} disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
          {err && <div style={{ marginTop: 12, color: '#b03a3a', fontSize: 13 }}>{err}</div>}
        </div>
      </div>
    )
  }

  // ── APP ──
  const k = data?.kpis
  const av = data?.avances
  const meta = data?.meta
  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <span style={{ fontWeight: 800, fontSize: 17 }}>Pro<span style={{ color: '#cbf135' }}>xis</span></span>
        <span style={S.chip}>Mi Informe</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          {data?.identidad && <span style={{ opacity: .85 }}>{data.identidad.nombre} · {data.identidad.institucion}</span>}
          <button style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer' }} onClick={salir}>Salir</button>
        </div>
      </header>

      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>Mes</strong>
        <select style={{ ...S.inp, width: 'auto' }} value={mes} onChange={(e) => setMes(e.target.value)}>
          {last6Meses().map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
        {cargando && <span style={{ fontSize: 12, color: '#9d9b93' }}>Cargando informe…</span>}
      </div>

      {err && <div style={{ ...S.card, color: '#b03a3a', fontSize: 13 }}>{err}</div>}

      {data && !data.hasReportes && !cargando && (
        <div style={{ ...S.card, fontSize: 14, color: '#a8691a', background: '#f8ecd6' }}>
          <strong>Sin reportes en {mesLabel(mes)}.</strong> Aún no hay actividad registrada este mes.
        </div>
      )}

      {data?.hasReportes && k && av && meta && (
        <>
          <div style={S.card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Resumen del mes — {mesLabel(mes)}</h2>
            <div style={{ ...S.grid4, marginBottom: 12 }}>
              <Kpi label="Prospectos obtenidos" value={k.totP} sub={`Meta: ${meta.meta_prospectos_mes} · ${av.avMes}% cumplido`} pct={av.avMes} />
              <Kpi label="Contactos realizados" value={k.totC} sub={`Meta: ${meta.meta_contactos_semana}/sem × ${data.semanasCount} sem`} pct={av.avC} />
              <Kpi label="Tasa de reunión" value={`${k.tasaReu}%`} sub={`${k.totR} de ${k.totC} · Meta ≥60%`} pct={Math.round(k.tasaReu / 60 * 100)} />
              <Kpi label="Eficiencia de contactos" value={`${k.efic}%`} sub={`Reales vs potencial (${k.totPot})`} pct={k.efic} />
            </div>
            <div style={S.grid4}>
              <Kpi label="Prospectos / contacto" value={k.promG} sub="Meta ≥ 4,5" pct={Math.round(k.promG / 4.5 * 100)} />
              <Kpi label="Prospectos / reunión" value={k.prospReu} sub={`${k.totR} reuniones · Meta ≥ 4`} pct={Math.round(k.prospReu / 4 * 100)} />
              <Kpi label="Brecha de prospectos" value={k.brecha} sub="No obtenidos este mes" tone="bad" />
              {k.mejorV
                ? <Kpi label="Vínculo más productivo" value={k.mejorV[0]} sub={`${k.mejorV[1]} prospectos`} tone="ok" />
                : <Kpi label="Vínculo más productivo" value="—" sub="" />}
            </div>
          </div>

          {av.avIng !== null && data.ingreso != null && (
            <div style={S.card}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9d9b93', marginBottom: 10 }}>
                Correlación actividad → ingresos
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                <Kpi label="Ingresos del mes" value={fmt(data.ingreso)} sub={`Meta: ${fmt(meta.meta_ingresos)} · ${av.avIng}%`} pct={av.avIng} />
                <Kpi label="Ingreso por prospecto" value={k.totP ? fmt(data.ingreso / k.totP) : '—'} sub={`${k.totP} prospectos`} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, pct, tone }: { label: string; value: string | number; sub?: string; pct?: number | null; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? '#b03a3a' : tone === 'ok' ? '#1f6f56' : '#161614'
  const barColor = pct == null ? '#ecebe5' : pct >= 80 ? '#1f6f56' : pct >= 50 ? '#a8691a' : '#b03a3a'
  return (
    <div style={{ border: '1px solid #ecebe5', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#9d9b93' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, margin: '4px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#5d5b54' }}>{sub}</div>}
      {pct != null && (
        <div style={{ height: 5, background: '#f0efe9', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: barColor }} />
        </div>
      )}
    </div>
  )
}
