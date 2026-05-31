'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type UserRow = {
  id: string; asesor: string; email: string; rol: string
  activo: boolean; created_at: string
  org_nodo_id: string | null; titulo_cargo: string | null
  meta: {
    supervisor: string | null
    meta_contactos_semana: number
    meta_prospectos_mes: number
    meta_ingresos: number
  } | null
}
type Inst    = { id: string; nombre: string; tipo: string; activo: boolean }
type Capa    = { id: string; institucion_id: string; nivel: number; nombre_cargo: string }
type Nodo    = { id: string; parent_id: string | null; institucion_id: string; capa_id: string | null; nombre: string; titulo_propio: string | null; activo: boolean }
type OrgUser = { id: string; nombre: string; email: string; org_nodo_id: string | null; cargo: string | null; activo: boolean; ultimo_login: string | null }
type Org     = { instituciones: Inst[]; capas: Capa[]; nodos: Nodo[]; usuarios: OrgUser[] }

const CARGO_LABEL: Record<string, string> = {
  supervisor: 'Supervisor', gerente_zonal: 'Gerente Zonal',
  gerente_regional: 'Gerente Regional', admin: 'Admin', asesor: 'Asesor',
}

/* ── helpers de árbol ── */
function childrenOf(nodos: Nodo[], parentId: string | null) {
  return nodos.filter(n => n.parent_id === parentId && n.activo)
}
function descendants(nodos: Nodo[], parentId: string): Nodo[] {
  const direct = childrenOf(nodos, parentId)
  return direct.flatMap(n => [n, ...descendants(nodos, n.id)])
}

export default function UsuariosPage() {
  const [users,   setUsers]   = useState<UserRow[]>([])
  const [org,     setOrg]     = useState<Org>({ instituciones: [], capas: [], nodos: [], usuarios: [] })
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Modal editar (metas de asesor)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [eSup,      setESup]      = useState('')
  const [eContSem,  setEContSem]  = useState(3)
  const [eProsMes,  setEProsMes]  = useState(15)
  const [eIngresos, setEIngresos] = useState(2_000_000)
  const [eSaving,   setESaving]   = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [uRes, oRes] = await Promise.all([
      fetch('/api/admin/usuarios').then(r => r.json()),
      fetch('/api/admin/org').then(r => r.json()),
    ])
    setUsers(uRes.users ?? [])
    setOrg({
      instituciones: oRes.instituciones ?? [],
      capas:         oRes.capas         ?? [],
      nodos:         oRes.nodos         ?? [],
      usuarios:      oRes.usuarios      ?? [],
    })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const supervisores = [...new Set(
    users.map(u => u.meta?.supervisor).filter(Boolean) as string[]
  )].sort()

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

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function expandAll()   { setCollapsed(new Set()) }
  function collapseAll() { setCollapsed(new Set(org.nodos.filter(n => n.activo).map(n => n.id))) }

  /* asesores y supervisores sin ubicación válida en el árbol */
  const nodoIds       = new Set(org.nodos.filter(n => n.activo).map(n => n.id))
  const asesoresSueltos = users.filter(u => !u.org_nodo_id || !nodoIds.has(u.org_nodo_id))
  const supsSueltos     = org.usuarios.filter(u => !u.org_nodo_id || !nodoIds.has(u.org_nodo_id))

  const totalPersonas = users.length + org.usuarios.length
  const activos       = users.filter(u => u.activo).length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', flex: 1 }}>Gestión de usuarios</h1>
        <Link href="/admin/jerarquia" style={{
          padding: '9px 16px', background: '#fff', color: '#0b0a09', textDecoration: 'none',
          border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, fontWeight: 600,
        }}>Importar / editar estructura →</Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Asesores activos',     value: activos,             color: '#1f6f56' },
          { label: 'Supervisión / gerencia', value: org.usuarios.length, color: '#1a56c4' },
          { label: 'Sin asignar',          value: asesoresSueltos.length + supsSueltos.length, color: '#a8691a' },
          { label: 'Total personas',       value: totalPersonas,       color: '#0b0a09' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controles de árbol */}
      {!loading && org.nodos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={expandAll}   style={btnSecondary}>▼ Expandir todo</button>
          <button onClick={collapseAll} style={btnSecondary}>▶ Colapsar todo</button>
        </div>
      )}

      {/* Árbol */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8a8885' }}>Cargando usuarios…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {org.instituciones.filter(i => i.activo).map(inst => (
            <div key={inst.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#0b0a09' }}>{inst.nombre}</span>
                <span style={{ fontSize: 10, color: '#aaa', background: '#f0f0ec', padding: '2px 8px', borderRadius: 10 }}>{inst.tipo}</span>
              </div>
              {childrenOf(org.nodos, null).filter(n => n.institucion_id === inst.id).map(n => (
                <NodeBranch key={n.id} nodo={n} depth={0}
                  nodos={org.nodos} capas={org.capas} orgUsers={org.usuarios} asesores={users}
                  collapsed={collapsed} onToggle={toggleCollapse}
                  onEdit={openEdit} onToggleActivo={toggleActivo} />
              ))}
            </div>
          ))}

          {/* Sin asignar */}
          {(asesoresSueltos.length > 0 || supsSueltos.length > 0) && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a8691a', marginBottom: 10 }}>
                ⚠️ Sin asignar a la estructura ({asesoresSueltos.length + supsSueltos.length})
              </div>
              {supsSueltos.map(u => (
                <div key={u.id} style={personRow}>
                  <span style={dot('#c4b5fd')} />
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{u.nombre}</div>
                    <div style={{ fontSize: 10, color: '#8a8885' }}>{CARGO_LABEL[u.cargo ?? 'supervisor'] ?? u.cargo}</div>
                  </div>
                  <span style={emailStyle}>{u.email}</span>
                  <span style={estadoChip(u.activo)}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
              ))}
              {asesoresSueltos.map(a => (
                <AsesorRow key={a.id} a={a} depth={0} onEdit={openEdit} onToggleActivo={toggleActivo} />
              ))}
            </div>
          )}

          {org.instituciones.filter(i => i.activo).length === 0 && asesoresSueltos.length === 0 && supsSueltos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 50, color: '#8a8885' }}>
              Sin estructura ni usuarios. Crea la jerarquía e importa personas desde{' '}
              <Link href="/admin/jerarquia" style={{ color: '#1a56c4' }}>Jerarquía organizacional</Link>.
            </div>
          )}
        </div>
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

// ── Rama del árbol (recursiva) ───────────────────────────────────────────────
function NodeBranch({ nodo, depth, nodos, capas, orgUsers, asesores, collapsed, onToggle, onEdit, onToggleActivo }: {
  nodo: Nodo; depth: number
  nodos: Nodo[]; capas: Capa[]; orgUsers: OrgUser[]; asesores: UserRow[]
  collapsed: Set<string>; onToggle: (id: string) => void
  onEdit: (u: UserRow) => void; onToggleActivo: (u: UserRow) => void
}) {
  const children     = childrenOf(nodos, nodo.id)
  const holders      = orgUsers.filter(u => u.org_nodo_id === nodo.id)
  const nodeAsesores = asesores.filter(a => a.org_nodo_id === nodo.id)
  const capa         = nodo.capa_id ? capas.find(c => c.id === nodo.capa_id) : null
  const cargoLabel   = capa?.nombre_cargo ?? nodo.titulo_propio ?? ''
  const isCollapsed  = collapsed.has(nodo.id)
  const hasContent   = children.length > 0 || nodeAsesores.length > 0

  const subIds   = new Set([nodo.id, ...descendants(nodos, nodo.id).map(n => n.id)])
  const subCount = orgUsers.filter(u => u.org_nodo_id && subIds.has(u.org_nodo_id)).length
                 + asesores.filter(a => a.org_nodo_id && subIds.has(a.org_nodo_id)).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginLeft: depth * 22, marginBottom: 4, borderRadius: 8, background: '#fafaf7', border: '1px solid #ece9e4' }}>
        {hasContent
          ? <button onClick={() => onToggle(nodo.id)} style={{ width: 16, height: 16, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, color: '#8a8885', padding: 0 }}>{isCollapsed ? '▶' : '▼'}</button>
          : <span style={{ width: 16 }} />}
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0b0a09' }}>{nodo.nombre}</span>
        {cargoLabel && <span style={{ fontSize: 10, color: '#666', background: '#eee', padding: '2px 8px', borderRadius: 10 }}>{cargoLabel}</span>}
        {holders.length > 0
          ? holders.map(h => (
              <span key={h.id} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: '#ede9fe', color: '#6b45c8', opacity: h.activo ? 1 : 0.5 }}>
                {h.nombre}{!h.activo && ' · inactivo'}
              </span>
            ))
          : <span style={{ fontSize: 10, color: '#aaa', background: 'rgba(0,0,0,0.05)', padding: '2px 9px', borderRadius: 20 }}>vacante</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a8885' }}>{subCount} {subCount === 1 ? 'persona' : 'personas'}</span>
      </div>

      {!isCollapsed && (
        <>
          {nodeAsesores.map(a => (
            <AsesorRow key={a.id} a={a} depth={depth + 1} onEdit={onEdit} onToggleActivo={onToggleActivo} />
          ))}
          {children.map(c => (
            <NodeBranch key={c.id} nodo={c} depth={depth + 1}
              nodos={nodos} capas={capas} orgUsers={orgUsers} asesores={asesores}
              collapsed={collapsed} onToggle={onToggle} onEdit={onEdit} onToggleActivo={onToggleActivo} />
          ))}
        </>
      )}
    </div>
  )
}

// ── Fila de asesor ───────────────────────────────────────────────────────────
function AsesorRow({ a, depth, onEdit, onToggleActivo }: {
  a: UserRow; depth: number; onEdit: (u: UserRow) => void; onToggleActivo: (u: UserRow) => void
}) {
  return (
    <div style={{ ...personRow, marginLeft: depth * 22, opacity: a.activo ? 1 : 0.55 }}>
      <span style={dot('#cbd5e1')} />
      <div style={{ minWidth: 150 }}>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{a.asesor}</div>
        <div style={{ fontSize: 10, color: '#8a8885' }}>{a.titulo_cargo || 'Asesor'}</div>
      </div>
      <span style={emailStyle}>{a.email}</span>
      {a.meta?.supervisor
        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#e8f0fe', color: '#1a56c4', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.meta.supervisor.split(' ')[0]}</span>
        : <span style={{ fontSize: 11, color: '#c8c6c3', width: 60 }}>sin sup.</span>}
      <span style={{ fontSize: 11, color: '#4a4844', whiteSpace: 'nowrap' }}>{a.meta?.meta_contactos_semana ?? '—'} c/sem</span>
      <span style={{ fontSize: 11, color: '#4a4844', whiteSpace: 'nowrap', minWidth: 48 }}>{a.meta?.meta_ingresos ? `$${(a.meta.meta_ingresos / 1000).toFixed(0)}k` : '—'}</span>
      <span style={estadoChip(a.activo)}>{a.activo ? 'Activo' : 'Inactivo'}</span>
      <button onClick={() => onEdit(a)} style={btnSecondary}>Editar</button>
      <button onClick={() => onToggleActivo(a)} style={{
        ...btnSecondary,
        color: a.activo ? '#b03a3a' : '#1f6f56',
        borderColor: a.activo ? '#f0b8b8' : '#c3e8d0',
        background: a.activo ? '#fbe9e9' : '#f0faf4',
      }}>{a.activo ? 'Desactivar' : 'Activar'}</button>
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

// ── estilos ──────────────────────────────────────────────────────────────────
const personRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', marginBottom: 3, borderRadius: 8, background: '#fff', border: '1px solid #f0eeea' }
const emailStyle: React.CSSProperties = { fontSize: 11, color: '#4a4844', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const dot = (c: string): React.CSSProperties => ({ width: 6, height: 6, borderRadius: 3, background: c, flexShrink: 0 })
const estadoChip = (activo: boolean): React.CSSProperties => ({ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', background: activo ? '#e6f3ed' : '#f5f3ef', color: activo ? '#1f6f56' : '#8a8885' })
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties  = { padding: '10px 20px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const btnCancel: React.CSSProperties   = { padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }
const btnSecondary: React.CSSProperties = { padding: '5px 12px', border: '1px solid #e8e6e3', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#4a4844', whiteSpace: 'nowrap' }
