'use client'
import { useEffect, useState, useCallback } from 'react'

type Reporte = { id: string; semana_inicio: string; semana_num: number; confirmado: boolean; sin_actividad: boolean }
type Contacto = { id?: string; reporte_id: string; nombre: string; vinculo: string; llamo: boolean; reunion: boolean; prospectos: number }
type Fila = { nombre: string; vinculo: string; llamo: boolean; reunion: boolean; prospectos: number }

const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']
const filaVacia = (): Fila => ({ nombre: '', vinculo: 'Conocido/a', llamo: false, reunion: false, prospectos: 0 })

export default function VinaPage() {
  const [token, setToken] = useState<string | null>(null)
  const [asesor, setAsesor] = useState<string>('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [cargando, setCargando] = useState(false)

  const [reportes, setReportes] = useState<Reporte[]>([])
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [filas, setFilas] = useState<Fila[]>([filaVacia()])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('vina_token')
    const a = localStorage.getItem('vina_asesor')
    if (t) { setToken(t); setAsesor(a ?? '') }
  }, [])

  const cargar = useCallback(async (tk: string) => {
    const r = await fetch('/api/vina/bitacora', { headers: { Authorization: `Bearer ${tk}` } })
    if (r.status === 401) { salir(); return }
    const d = await r.json()
    setReportes(d.reportes ?? [])
    setContactos(d.contactos ?? [])
    // Cargar en el editor los contactos de la semana activa (más reciente sin confirmar)
    const activa: Reporte | undefined = (d.reportes ?? []).find((x: Reporte) => !x.confirmado)
    if (activa) {
      const cs = (d.contactos ?? []).filter((c: Contacto) => c.reporte_id === activa.id)
      setFilas(cs.length ? cs.map((c: Contacto) => ({ nombre: c.nombre, vinculo: c.vinculo, llamo: c.llamo, reunion: c.reunion, prospectos: c.prospectos })) : [filaVacia()])
    }
  }, [])

  useEffect(() => { if (token) cargar(token) }, [token, cargar])

  async function login() {
    setErr(''); setCargando(true)
    try {
      const r = await fetch('/api/vina/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Error'); return }
      localStorage.setItem('vina_token', d.token)
      localStorage.setItem('vina_asesor', d.asesor)
      setToken(d.token); setAsesor(d.asesor)
    } catch { setErr('No se pudo conectar') }
    finally { setCargando(false) }
  }

  function salir() {
    localStorage.removeItem('vina_token'); localStorage.removeItem('vina_asesor')
    setToken(null); setAsesor(''); setReportes([]); setContactos([]); setFilas([filaVacia()])
  }

  async function accion(body: Record<string, unknown>) {
    const r = await fetch('/api/vina/bitacora', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    return r.json()
  }

  const semanaActiva = reportes.find(r => !r.confirmado)

  async function nuevaSemana() { setMsg(''); await accion({ accion: 'nueva_semana' }); if (token) await cargar(token) }
  async function guardar() {
    if (!semanaActiva) return
    setMsg('Guardando…')
    const d = await accion({ accion: 'guardar_contactos', reporte_id: semanaActiva.id, contactos: filas })
    setMsg(d.ok ? `Guardado (${d.guardados} contactos).` : (d.error ?? 'Error'))
    if (token) await cargar(token)
  }
  async function confirmar() {
    if (!semanaActiva) return
    if (!confirm('¿Confirmar la semana? No podrás editarla luego.')) return
    await guardar()
    await accion({ accion: 'confirmar', reporte_id: semanaActiva.id })
    if (token) await cargar(token)
  }

  // ── estilos ──
  const S = {
    wrap: { minHeight: '100vh', background: '#f5f3ef', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#161614' } as React.CSSProperties,
    header: { background: '#0b0a09', color: '#fff', padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
    chip: { background: '#cbf135', color: '#0b0a09', fontWeight: 800, padding: '2px 9px', borderRadius: 6, fontSize: 13, letterSpacing: '-.02em' } as React.CSSProperties,
    btn: { padding: '9px 16px', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', background: '#0b0a09', color: '#fff' } as React.CSSProperties,
    btnLime: { padding: '9px 16px', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: '#cbf135', color: '#0b0a09' } as React.CSSProperties,
    card: { background: '#fff', border: '1px solid #ecebe5', borderRadius: 14, padding: 20, margin: '14px auto', maxWidth: 920, boxShadow: '0 1px 2px rgba(20,18,12,.05)' } as React.CSSProperties,
    inp: { padding: '8px 10px', border: '1px solid #ecebe5', borderRadius: 8, fontSize: 13, width: '100%' } as React.CSSProperties,
    th: { textAlign: 'left' as const, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: '#9d9b93', padding: '8px 8px', borderBottom: '1px solid #ecebe5' },
    td: { padding: '6px 8px', borderBottom: '1px solid #f5f3ef', verticalAlign: 'middle' as const },
  }

  // ── LOGIN ──
  if (!token) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...S.card, maxWidth: 400, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>Pro<span style={{ color: '#a8cc1a' }}>xis</span></span>
            <span style={S.chip}>Consorcio Viña</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 2px' }}>Bitácora del asesor</h1>
          <p style={{ fontSize: 13, color: '#5d5b54', marginBottom: 18 }}>Acceso para asesores de Consorcio Viña.</p>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3a3934' }}>Email</label>
          <input style={{ ...S.inp, margin: '6px 0 12px' }} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3a3934' }}>Clave</label>
          <input style={{ ...S.inp, margin: '6px 0 12px' }} type="password" value={pass}
            onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="••••••••" />
          <button style={{ ...S.btn, width: '100%', marginTop: 6 }} onClick={login} disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
          {err && <div style={{ marginTop: 12, color: '#b03a3a', fontSize: 13 }}>{err}</div>}
        </div>
      </div>
    )
  }

  // ── APP ──
  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <span style={{ fontWeight: 800, fontSize: 17 }}>Pro<span style={{ color: '#cbf135' }}>xis</span></span>
        <span style={S.chip}>Consorcio Viña</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <span style={{ opacity: .85 }}>{asesor}</span>
          <button style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer' }} onClick={salir}>Salir</button>
        </div>
      </header>

      {/* Semana activa (editable) */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Bitácora semanal</h2>
          {!semanaActiva
            ? <button style={S.btnLime} onClick={nuevaSemana}>+ Nueva semana</button>
            : <span style={{ fontSize: 13, color: '#5d5b54' }}>Semana {semanaActiva.semana_num} · inicia {semanaActiva.semana_inicio}</span>}
        </div>

        {!semanaActiva && <p style={{ fontSize: 13, color: '#9d9b93' }}>No tienes una semana abierta. Crea una nueva para registrar tu actividad.</p>}

        {semanaActiva && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Nombre del contacto</th><th style={S.th}>Vínculo</th>
                <th style={S.th}>Llamó</th><th style={S.th}>Reunión</th><th style={S.th}>Prospectos</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td style={S.td}><input style={S.inp} value={f.nombre} placeholder="Nombre y apellido"
                      onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} /></td>
                    <td style={S.td}><select style={S.inp} value={f.vinculo}
                      onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, vinculo: e.target.value } : x))}>
                      {VINCULOS.map(v => <option key={v}>{v}</option>)}
                    </select></td>
                    <td style={{ ...S.td, textAlign: 'center' }}><input type="checkbox" checked={f.llamo}
                      onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, llamo: e.target.checked } : x))} /></td>
                    <td style={{ ...S.td, textAlign: 'center' }}><input type="checkbox" checked={f.reunion}
                      onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, reunion: e.target.checked } : x))} /></td>
                    <td style={S.td}><input type="number" min={0} style={{ ...S.inp, width: 72 }} value={f.prospectos}
                      onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, prospectos: +e.target.value } : x))} /></td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <button style={{ border: '1px solid #f0d2d2', background: '#fbe9e9', color: '#b03a3a', borderRadius: 7, width: 28, height: 28, cursor: 'pointer' }}
                        onClick={() => setFilas(fs => fs.length > 1 ? fs.filter((_, j) => j !== i) : [filaVacia()])}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={{ ...S.btn, background: '#fff', color: '#3a3934', border: '1px solid #ecebe5' }}
                onClick={() => setFilas(fs => [...fs, filaVacia()])}>+ Agregar contacto</button>
              <button style={S.btn} onClick={guardar}>💾 Guardar</button>
              <button style={S.btnLime} onClick={confirmar}>✓ Confirmar semana</button>
              {msg && <span style={{ alignSelf: 'center', fontSize: 12, color: '#1f6f56' }}>{msg}</span>}
            </div>
          </>
        )}
      </div>

      {/* Historial */}
      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Semanas registradas</h3>
        {reportes.length === 0 && <p style={{ fontSize: 13, color: '#9d9b93' }}>Aún no hay semanas.</p>}
        {reportes.map(r => {
          const cs = contactos.filter(c => c.reporte_id === r.id)
          const prospectos = cs.reduce((a, c) => a + (c.prospectos || 0), 0)
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #f5f3ef', fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 90 }}>Semana {r.semana_num}</span>
              <span style={{ color: '#5d5b54', minWidth: 110 }}>{r.semana_inicio}</span>
              <span style={{ color: '#5d5b54' }}>{cs.length} contactos · {prospectos} prospectos</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: r.confirmado ? '#e6f3ed' : '#f8ecd6', color: r.confirmado ? '#1f6f56' : '#a8691a' }}>
                {r.confirmado ? 'Confirmada' : (r.sin_actividad ? 'Sin actividad' : 'Abierta')}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#9d9b93', padding: 20 }}>
        © 2026 The Precision Selling · Bitácora Consorcio Viña
      </div>
    </div>
  )
}
