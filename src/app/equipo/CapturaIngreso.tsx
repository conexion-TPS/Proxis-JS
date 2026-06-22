'use client'

import { useState, useCallback } from 'react'

// F2c — Sección "Cierre de mes — ingresos" del portal /equipo.
// La cola la sirve GET /api/equipo/captura-ingreso (que la arma con org_subtree → SOLO los
// asesores del subárbol del supervisor, no toda la institución). Este componente solo la pinta
// y captura. La escritura (idempotente, upsert por persona_id+mes) ocurre en la RPC vía el POST.

type Item = {
  asesor: string
  persona_id: string | null
  estado: 'pendiente' | 'respondida'
  ingreso_obtenido: number | null
  meta_ingreso_mes: number | null
  cumplio: boolean | null
  diferencia: number | null
}

const fmt = (n: number | null) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CL'))

export default function CapturaIngreso({ token }: { token: string }) {
  const [open,     setOpen]     = useState(false)
  const [mesInput, setMesInput] = useState('')        // vacío → el server usa M-1
  const [mes,      setMes]      = useState('')        // mes efectivo devuelto por el server
  const [items,    setItems]    = useState<Item[]>([])
  const [draft,    setDraft]    = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [msg,      setMsg]      = useState('')

  const cargar = useCallback(async (m?: string) => {
    if (!token) return
    setLoading(true); setMsg('')
    const q = m && /^\d{4}-\d{2}$/.test(m) ? `?mes=${m}` : ''
    const r = await fetch(`/api/equipo/captura-ingreso${q}`, { headers: { Authorization: `Bearer ${token}` } })
    const j = await r.json().catch(() => ({}))
    setItems(j.items ?? [])
    setMes(j.mes ?? '')
    setMesInput(j.mes ?? '')
    setLoading(false)
  }, [token])

  function abrir() {
    const next = !open
    setOpen(next)
    if (next && !items.length) cargar()
  }

  async function guardar(it: Item) {
    if (!it.persona_id) { setMsg(`${it.asesor}: falta su ficha de persona; no se puede capturar.`); return }
    const raw   = draft[it.asesor] ?? (it.ingreso_obtenido != null ? String(it.ingreso_obtenido) : '')
    const monto = Number(raw)
    if (!Number.isFinite(monto) || monto < 0) { setMsg(`${it.asesor}: monto inválido.`); return }
    setSavingId(it.asesor); setMsg('')
    const r = await fetch('/api/equipo/captura-ingreso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ persona_id: it.persona_id, mes, ingreso_obtenido: monto }),
    })
    const j = await r.json().catch(() => ({}))
    setSavingId(null)
    if (!r.ok) { setMsg(j.error ?? 'No se pudo guardar.'); return }
    await cargar(mes)   // refresca estado/cumplió/diferencia (idempotente: re-informar sobreescribe)
  }

  const pendientes = items.filter(i => i.estado === 'pendiente').length

  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <button onClick={abrir} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💵</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0b0a09' }}>Cierre de mes — ingresos</span>
          {open && pendientes > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a8691a', background: '#fdecd0', borderRadius: 20, padding: '2px 9px' }}>
              {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span style={{ fontSize: 12, color: '#8a8885' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#8a8885' }}>Mes a informar (cerrado):</span>
            <input value={mesInput} onChange={e => setMesInput(e.target.value)} placeholder="YYYY-MM"
              style={{ width: 100, padding: '5px 9px', border: '1px solid #e8e6e3', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }} />
            <button onClick={() => cargar(mesInput)} disabled={loading} style={{
              padding: '5px 12px', border: '1px solid #e8e6e3', borderRadius: 7, background: '#f5f3ef',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#4a4844',
            }}>Ver</button>
            <span style={{ fontSize: 11, color: '#c8c6c3' }}>por defecto: mes anterior</span>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: '#8a8885', padding: '12px 0' }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ fontSize: 13, color: '#8a8885', padding: '12px 0' }}>No hay asesores en tu equipo para este mes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(it => (
                <div key={it.asesor} style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '10px 12px', borderRadius: 9,
                  background: it.estado === 'pendiente' ? '#fffaf0' : '#f7faf7',
                  border: `1px solid ${it.estado === 'pendiente' ? '#f3e2c0' : '#e2efe2'}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0b0a09', flex: '1 1 140px' }}>{it.asesor}</span>
                  <span style={{ fontSize: 11, color: '#8a8885' }}>meta {fmt(it.meta_ingreso_mes)}</span>
                  <input
                    type="number" min={0} placeholder="ingreso obtenido"
                    value={draft[it.asesor] ?? (it.ingreso_obtenido != null ? String(it.ingreso_obtenido) : '')}
                    onChange={e => setDraft(d => ({ ...d, [it.asesor]: e.target.value }))}
                    disabled={!it.persona_id}
                    style={{ width: 130, padding: '6px 9px', border: '1px solid #e8e6e3', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}
                  />
                  <button onClick={() => guardar(it)} disabled={savingId === it.asesor || !it.persona_id} style={{
                    padding: '6px 14px', border: 'none', borderRadius: 7, background: '#0b0a09', color: '#cbf135',
                    fontSize: 12, fontWeight: 700, cursor: it.persona_id ? 'pointer' : 'not-allowed',
                    opacity: (savingId === it.asesor || !it.persona_id) ? 0.6 : 1, fontFamily: 'inherit',
                  }}>{savingId === it.asesor ? '…' : it.estado === 'respondida' ? 'Actualizar' : 'Guardar'}</button>
                  {it.estado === 'respondida' && it.cumplio != null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: it.cumplio ? '#1f6f56' : '#b03a3a' }}>
                      {it.cumplio ? '✓ cumplió' : '✗ bajo meta'} ({it.diferencia != null && it.diferencia >= 0 ? '+' : ''}{fmt(it.diferencia)})
                    </span>
                  )}
                  {!it.persona_id && <span style={{ fontSize: 11, color: '#b03a3a' }}>sin ficha de persona</span>}
                </div>
              ))}
            </div>
          )}

          {msg && <div style={{ marginTop: 10, fontSize: 12, color: '#b03a3a' }}>{msg}</div>}
        </div>
      )}
    </div>
  )
}
