'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type TriggerRow = {
  trigger_id: string
  descripcion: string | null
  asunto: string | null
  cooldown_dias: number | null
  umbral: number | null
  activo: boolean
  _isNew?: boolean
}

export default function TriggersPage() {
  const [triggers,  setTriggers]  = useState<TriggerRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<Partial<TriggerRow>>({})
  const [remitente, setRemitente] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    load()
    supabase.from('config').select('value').eq('key', 'remitente').limit(1)
      .then(({ data }) => { if (data?.[0]) setRemitente(data[0].value) })
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('trigger_config').select('*').order('trigger_id')
    setLoading(false)
    if (error) { showToast('Error cargando triggers: ' + error.message, true); return }
    setTriggers(data ?? [])
  }

  function startEdit(t: TriggerRow) {
    setEditingId(t.trigger_id)
    setEditState({ ...t })
  }

  function cancelEdit() {
    setTriggers(prev => prev.filter(t => !t._isNew))
    setEditingId(null)
    setEditState({})
  }

  async function toggleActivo(tid: string, activo: boolean) {
    await supabase.from('trigger_config').update({ activo, updated_at: new Date().toISOString() })
      .eq('trigger_id', tid)
    setTriggers(prev => prev.map(t => t.trigger_id === tid ? { ...t, activo } : t))
    showToast(`${tid} ${activo ? 'activado' : 'pausado'}.`)
  }

  async function guardarFila(isNew: boolean) {
    const { trigger_id, descripcion, asunto, cooldown_dias, umbral, activo } = editState
    if (!trigger_id?.trim()) { showToast('El Trigger ID no puede estar vacío.', true); return }

    const payload: Record<string, unknown> = {
      trigger_id: trigger_id.trim(),
      descripcion: descripcion || null,
      asunto: asunto || null,
      cooldown_dias: cooldown_dias ?? null,
      umbral: umbral ?? null,
      activo: activo ?? true,
      updated_at: new Date().toISOString(),
    }

    if (isNew) {
      const { error } = await supabase.from('trigger_config').insert(payload)
      if (error) { showToast('Error al crear: ' + error.message, true); return }
      showToast(`Trigger "${trigger_id}" creado.`)
    } else {
      const { trigger_id: _, ...updates } = payload
      const { error } = await supabase.from('trigger_config').update(updates)
        .eq('trigger_id', editingId!)
      if (error) { showToast('Error al guardar: ' + error.message, true); return }
      showToast(`Trigger "${trigger_id}" guardado.`)
    }
    setEditingId(null)
    setEditState({})
    load()
  }

  function nuevoTrigger() {
    if (triggers.find(t => t._isNew)) return
    const nuevo: TriggerRow = {
      trigger_id: '', descripcion: '', asunto: '',
      cooldown_dias: 7, umbral: null, activo: true, _isNew: true,
    }
    setTriggers(prev => [nuevo, ...prev])
    setEditingId('')
    setEditState(nuevo)
  }

  async function saveRemitente() {
    if (!remitente.trim()) { showToast('El nombre no puede estar vacío.', true); return }
    await supabase.from('config').update({ value: remitente }).eq('key', 'remitente')
    showToast('Remitente guardado.')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px',
    border: '1px solid #e8e6e3', borderRadius: 6,
    fontFamily: 'inherit', fontSize: 13, color: '#0b0a09',
    background: '#fff', outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ChevLeft /> Panel admin
          </Link>
          <span style={{ color: '#c8c6c3' }}>/</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Triggers</h1>
        </div>
        <button onClick={nuevoTrigger} style={darkBtnStyle}>
          <PlusIcon /> Nuevo trigger
        </button>
      </div>

      {/* Remitente global */}
      <div style={{
        background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12,
        padding: '18px 22px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', whiteSpace: 'nowrap' }}>
          Nombre del remitente
        </span>
        <input
          value={remitente}
          onChange={e => setRemitente(e.target.value)}
          placeholder="Ej: Proxis Coach"
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <button onClick={saveRemitente} style={{ ...darkBtnStyle, padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
          Guardar
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafaf7', borderBottom: '1px solid #e8e6e3' }}>
              {['Trigger ID','Descripción','Asunto del email','Cooldown (días)','Umbral','Estado','Acciones'].map(h => (
                <th key={h} style={{
                  padding: '11px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: '#8a8885',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8a8885', padding: 32 }}>Cargando…</td></tr>
            ) : triggers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8a8885', padding: 32 }}>Sin triggers. Crea el primero.</td></tr>
            ) : triggers.map(t => {
              const isEditing = editingId === t.trigger_id
              return (
                <tr key={t.trigger_id || '_new'} style={{
                  borderBottom: '1px solid #f5f3ef',
                  background: isEditing ? '#fffdf5' : 'transparent',
                }}>
                  {isEditing ? (
                    <>
                      <td style={tdStyle}>
                        <input style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace', fontSize: 12 }}
                          value={editState.trigger_id ?? ''}
                          onChange={e => setEditState(s => ({ ...s, trigger_id: e.target.value }))}
                          readOnly={!t._isNew}
                          placeholder="trigger-id"
                        />
                      </td>
                      <td style={tdStyle}>
                        <textarea style={{ ...inputStyle, resize: 'none' }} rows={2}
                          value={editState.descripcion ?? ''}
                          onChange={e => setEditState(s => ({ ...s, descripcion: e.target.value }))}
                          placeholder="Descripción"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input style={inputStyle}
                          value={editState.asunto ?? ''}
                          onChange={e => setEditState(s => ({ ...s, asunto: e.target.value }))}
                          placeholder="Asunto del email"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input style={{ ...inputStyle, width: 80 }} type="number" min={1}
                          value={editState.cooldown_dias ?? ''}
                          onChange={e => setEditState(s => ({ ...s, cooldown_dias: parseInt(e.target.value) || null }))}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input style={{ ...inputStyle, width: 80 }} type="number" step={0.01}
                          value={editState.umbral ?? ''}
                          onChange={e => setEditState(s => ({ ...s, umbral: parseFloat(e.target.value) || null }))}
                        />
                      </td>
                      <td style={tdStyle}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!editState.activo}
                            onChange={e => setEditState(s => ({ ...s, activo: e.target.checked }))}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12, color: '#4a4844' }}>Activo</span>
                        </label>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <SmBtn onClick={() => guardarFila(!!t._isNew)} variant="teal">Guardar</SmBtn>
                          <SmBtn onClick={cancelEdit} variant="ghost">Cancelar</SmBtn>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: '#4a4844' }}>{t.trigger_id}</td>
                      <td style={tdStyle}>{t.descripcion || '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#4a4844' }}>{t.asunto || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{t.cooldown_dias ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{t.umbral ?? '—'}</td>
                      <td style={tdStyle}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={t.activo}
                            onChange={e => toggleActivo(t.trigger_id, e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12, color: '#4a4844' }}>{t.activo ? 'Activo' : 'Pausado'}</span>
                        </label>
                      </td>
                      <td style={tdStyle}>
                        <SmBtn onClick={() => startEdit(t)} variant="ghost">Editar</SmBtn>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.err ? '#b03a3a' : '#0b0a09',
          color: '#fff', fontSize: 13, fontWeight: 500,
          padding: '10px 22px', borderRadius: 30, zIndex: 999,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, verticalAlign: 'middle' }

const darkBtnStyle: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', background: '#0b0a09', color: '#fff',
  display: 'inline-flex', alignItems: 'center', gap: 7,
}

function SmBtn({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: 'teal' | 'ghost' }) {
  const styles: Record<string, React.CSSProperties> = {
    teal:  { background: '#1f6f56', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#4a4844', border: '1px solid #e8e6e3' },
  }
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      fontFamily: 'inherit', cursor: 'pointer', ...styles[variant],
    }}>{children}</button>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
}
