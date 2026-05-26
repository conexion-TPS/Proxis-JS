'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type UserRow = {
  id: string; asesor: string; email: string; rol: string
  activo: boolean; created_at: string
  meta: {
    supervisor: string | null
    meta_contactos_semana: number
    meta_prospectos_mes: number
    meta_ingresos: number
  } | null
}

const DEFAULT_META = { supervisor: '', meta_contactos_semana: 3, meta_prospectos_mes: 15, meta_ingresos: 2_000_000 }

export default function UsuariosPage() {
  const [users,    setUsers]    = useState<UserRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  // Modales
  const [createModal, setCreateModal] = useState(false)
  const [editTarget,  setEditTarget]  = useState<UserRow | null>(null)

  // Formulario crear
  const [cNombre,  setCNombre]  = useState('')
  const [cEmail,   setCEmail]   = useState('')
  const [cPass,    setCPass]    = useState('')
  const [cSup,     setCSup]     = useState('')
  const [cContSem, setCContSem] = useState(3)
  const [cProsMes, setCProsMes] = useState(15)
  const [cIngresos,setCIngresos]= useState(2_000_000)
  const [cSaving,  setCSaving]  = useState(false)

  // Formulario editar
  const [eSup,     setESup]     = useState('')
  const [eContSem, setEContSem] = useState(3)
  const [eProsMes, setEProsMes] = useState(15)
  const [eIngresos,setEIngresos]= useState(2_000_000)
  const [eSaving,  setESaving]  = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/usuarios')
    const data = await r.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Supervisores existentes (para dropdown)
  const supervisores = [...new Set(
    users.map(u => u.meta?.supervisor).filter(Boolean) as string[]
  )].sort()

  async function handleCreate() {
    if (!cNombre.trim() || !cEmail.trim() || !cPass) return
    setCSaving(true)
    const r = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: cNombre, email: cEmail, password: cPass,
        supervisor: cSup || null,
        meta_contactos_semana: cContSem,
        meta_prospectos_mes:   cProsMes,
        meta_ingresos:         cIngresos,
      }),
    })
    const data = await r.json()
    setCSaving(false)
    if (data.ok) {
      showToast('Asesor creado correctamente.')
      setCreateModal(false)
      resetCreate()
      load()
    } else {
      showToast(data.error ?? 'Error al crear', false)
    }
  }

  function resetCreate() {
    setCNombre(''); setCEmail(''); setCPass(''); setCSup('')
    setCContSem(3); setCProsMes(15); setCIngresos(2_000_000)
  }

  function openEdit(u: UserRow) {
    setEditTarget(u)
    setESup(u.meta?.supervisor ?? '')
    setEContSem(u.meta?.meta_contactos_semana ?? 3)
    setEProsMes(u.meta?.meta_prospectos_mes ?? 15)
    setEIngresos(u.meta?.meta_ingresos ?? 2_000_000)
  }

  async function handleEdit() {
    if (!editTarget) return
    setESaving(true)
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asesor: editTarget.asesor,
        supervisor: eSup || null,
        meta_contactos_semana: eContSem,
        meta_prospectos_mes:   eProsMes,
        meta_ingresos:         eIngresos,
      }),
    })
    setESaving(false)
    setEditTarget(null)
    showToast('Cambios guardados.')
    load()
  }

  async function toggleActivo(u: UserRow) {
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asesor: u.asesor, activo: !u.activo }),
    })
    showToast(u.activo ? 'Asesor desactivado.' : 'Asesor activado.')
    load()
  }

  const activos  = users.filter(u => u.activo).length
  const inactivos = users.filter(u => !u.activo).length
  const sinSup   = users.filter(u => !u.meta?.supervisor).length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', flex: 1 }}>Gestión de usuarios</h1>
        <button onClick={() => setCreateModal(true)} style={{
          padding: '9px 18px', background: '#0b0a09', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Nuevo asesor</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Activos',      value: activos,   color: '#1f6f56' },
          { label: 'Inactivos',    value: inactivos, color: '#8a8885' },
          { label: 'Sin supervisor', value: sinSup,  color: '#a8691a' },
          { label: 'Total',        value: users.length, color: '#0b0a09' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8a8885' }}>Cargando usuarios…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a8885' }}>Sin usuarios registrados. Crea el primero con el botón de arriba.</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafaf7', borderBottom: '1px solid #e8e6e3' }}>
                {['Asesor','Email','Supervisor','Contactos/sem','Ingresos meta','Estado','Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f5f3ef', opacity: u.activo ? 1 : 0.55 }}>
                  <td style={{ ...td, fontWeight: 600 }}>{u.asesor}</td>
                  <td style={{ ...td, fontSize: 11, color: '#4a4844' }}>{u.email}</td>
                  <td style={td}>
                    {u.meta?.supervisor
                      ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#e8f0fe', color: '#1a56c4', fontWeight: 600 }}>{u.meta.supervisor.split(' ')[0]}</span>
                      : <span style={{ fontSize: 11, color: '#c8c6c3' }}>—</span>
                    }
                  </td>
                  <td style={td}>{u.meta?.meta_contactos_semana ?? '—'}</td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {u.meta?.meta_ingresos
                      ? `$${(u.meta.meta_ingresos / 1000).toFixed(0)}k`
                      : '—'
                    }
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                      background: u.activo ? '#e6f3ed' : '#f5f3ef',
                      color: u.activo ? '#1f6f56' : '#8a8885' }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ ...td, display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(u)} style={btnSecondary}>Editar</button>
                    <button onClick={() => toggleActivo(u)} style={{
                      ...btnSecondary,
                      color: u.activo ? '#b03a3a' : '#1f6f56',
                      borderColor: u.activo ? '#f0b8b8' : '#c3e8d0',
                      background: u.activo ? '#fbe9e9' : '#f0faf4',
                    }}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear */}
      {createModal && (
        <Modal title="Nuevo asesor" onClose={() => { setCreateModal(false); resetCreate() }}>
          <Field label="Nombre completo">
            <input value={cNombre} onChange={e => setCNombre(e.target.value)} placeholder="Ej: Ana García López" style={inputStyle} />
          </Field>
          <Field label="Email">
            <input value={cEmail} onChange={e => setCEmail(e.target.value)} type="email" placeholder="ana@empresa.com" style={inputStyle} />
          </Field>
          <Field label="Contraseña temporal">
            <input value={cPass} onChange={e => setCPass(e.target.value)} type="password" placeholder="Mínimo 6 caracteres" style={inputStyle} />
          </Field>
          <Field label="Supervisor (opcional)">
            <input
              value={cSup} onChange={e => setCSup(e.target.value)}
              placeholder={supervisores.length > 0 ? `Ej: ${supervisores[0]}` : 'Nombre del supervisor'}
              list="sups-list" style={inputStyle}
            />
            <datalist id="sups-list">{supervisores.map(s => <option key={s} value={s} />)}</datalist>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Contactos/sem">
              <input value={cContSem} onChange={e => setCContSem(Number(e.target.value))} type="number" min={1} style={inputStyle} />
            </Field>
            <Field label="Prospectos/mes">
              <input value={cProsMes} onChange={e => setCProsMes(Number(e.target.value))} type="number" min={1} style={inputStyle} />
            </Field>
            <Field label="Meta ingresos">
              <input value={cIngresos} onChange={e => setCIngresos(Number(e.target.value))} type="number" min={0} step={100000} style={inputStyle} />
            </Field>
          </div>
          <ModalActions>
            <button onClick={() => { setCreateModal(false); resetCreate() }} style={btnCancel}>Cancelar</button>
            <button
              onClick={handleCreate}
              disabled={cSaving || !cNombre.trim() || !cEmail.trim() || !cPass}
              style={{ ...btnPrimary, opacity: cSaving || !cNombre.trim() || !cEmail.trim() || !cPass ? 0.5 : 1 }}>
              {cSaving ? 'Creando…' : 'Crear asesor'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* Modal editar */}
      {editTarget && (
        <Modal title={`Editar: ${editTarget.asesor}`} onClose={() => setEditTarget(null)}>
          <Field label="Supervisor">
            <input
              value={eSup} onChange={e => setESup(e.target.value)}
              placeholder="Nombre del supervisor"
              list="sups-list-edit" style={inputStyle}
            />
            <datalist id="sups-list-edit">{supervisores.map(s => <option key={s} value={s} />)}</datalist>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Contactos/sem">
              <input value={eContSem} onChange={e => setEContSem(Number(e.target.value))} type="number" min={1} style={inputStyle} />
            </Field>
            <Field label="Prospectos/mes">
              <input value={eProsMes} onChange={e => setEProsMes(Number(e.target.value))} type="number" min={1} style={inputStyle} />
            </Field>
            <Field label="Meta ingresos">
              <input value={eIngresos} onChange={e => setEIngresos(Number(e.target.value))} type="number" min={0} step={100000} style={inputStyle} />
            </Field>
          </div>
          <ModalActions>
            <button onClick={() => setEditTarget(null)} style={btnCancel}>Cancelar</button>
            <button onClick={handleEdit} disabled={eSaving} style={{ ...btnPrimary, opacity: eSaving ? 0.5 : 1 }}>
              {eSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#0b0a09' : '#b03a3a', color: '#fff',
          fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>{children}</div>
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const td: React.CSSProperties = { padding: '11px 14px', fontSize: 12, verticalAlign: 'middle' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties  = { padding: '10px 20px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const btnCancel: React.CSSProperties   = { padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }
const btnSecondary: React.CSSProperties = { padding: '5px 12px', border: '1px solid #e8e6e3', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#4a4844' }
