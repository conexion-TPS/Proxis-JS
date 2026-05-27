'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/* ── tipos ── */
type Institucion = { id: string; nombre: string; tipo: string; activo: boolean }
type Capa        = { id: string; institucion_id: string; nivel: number; nombre_cargo: string }
type Nodo        = { id: string; parent_id: string | null; institucion_id: string; capa_id: string | null; nombre: string; titulo_propio: string | null; activo: boolean }
type OrgUsuario  = { id: string; nombre: string; email: string; org_nodo_id: string | null; activo: boolean; ultimo_login: string | null }
type Invitacion  = { id: string; token: string; institucion_id: string; parent_nodo_id: string | null; nivel_sugerido: number | null; email_destino: string | null; expira_at: string }

type AsesorCred = { asesor: string; org_nodo_id: string | null }
type Data = { instituciones: Institucion[]; capas: Capa[]; nodos: Nodo[]; usuarios: OrgUsuario[]; invitaciones: Invitacion[] }

const BASE = typeof window !== 'undefined' ? window.location.origin : ''

/* ── helpers ── */
function buildTree(nodos: Nodo[], parentId: string | null): Nodo[] {
  return nodos.filter(n => n.parent_id === parentId)
}

function capaLabel(capas: Capa[], capaId: string | null, nodo: Nodo): string {
  if (!capaId) return nodo.titulo_propio ?? ''
  const c = capas.find(c => c.id === capaId)
  return nodo.titulo_propio ?? c?.nombre_cargo ?? ''
}

/* ── componente árbol ── */
function NodoItem({ nodo, nodos, capas, usuarios, onSelect, selected, depth = 0 }: {
  nodo: Nodo; nodos: Nodo[]; capas: Capa[]; usuarios: OrgUsuario[]
  onSelect: (n: Nodo) => void; selected: Nodo | null; depth?: number
}) {
  const [open, setOpen] = useState(true)
  const children = buildTree(nodos, nodo.id)
  const usuario  = usuarios.find(u => u.org_nodo_id === nodo.id)
  const label    = capaLabel(capas, nodo.capa_id, nodo)
  const isActive = selected?.id === nodo.id

  return (
    <div>
      <div
        onClick={() => onSelect(nodo)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', marginLeft: depth * 18,
          borderRadius: 8, cursor: 'pointer',
          background: isActive ? 'rgba(203,241,53,0.12)' : 'transparent',
          border: `1px solid ${isActive ? 'rgba(203,241,53,0.4)' : 'transparent'}`,
          marginBottom: 2,
        }}
      >
        {children.length > 0 && (
          <span
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ fontSize: 10, color: '#888', cursor: 'pointer', width: 12, textAlign: 'center' }}
          >
            {open ? '▼' : '▶'}
          </span>
        )}
        {children.length === 0 && <span style={{ width: 12 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nodo.nombre}
          </div>
          {label && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{label}</div>
          )}
        </div>
        {usuario ? (
          <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.12)', color: '#16a34a', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            {usuario.nombre.split(' ')[0]}
          </span>
        ) : (
          <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.06)', color: '#aaa', padding: '2px 7px', borderRadius: 10 }}>vacante</span>
        )}
      </div>
      {open && children.map(c => (
        <NodoItem key={c.id} nodo={c} nodos={nodos} capas={capas} usuarios={usuarios}
          onSelect={onSelect} selected={selected} depth={depth + 1} />
      ))}
    </div>
  )
}

/* ── página principal ── */
export default function JerarquiaPage() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'arbol' | 'invitaciones'>('arbol')
  const [selected, setSelected] = useState<Nodo | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  /* formularios */
  const [newInst,   setNewInst]   = useState('')
  const [newCapaInst, setNewCapaInst] = useState('')
  const [newCapaNivel, setNewCapaNivel] = useState('')
  const [newCapaNombre, setNewCapaNombre] = useState('')
  const [newNodoNombre, setNewNodoNombre] = useState('')
  const [newNodoTitulo, setNewNodoTitulo] = useState('')
  const [newNodoParent, setNewNodoParent] = useState('')
  const [newNodoInst, setNewNodoInst] = useState('')
  const [newNodoCapa, setNewNodoCapa] = useState('')
  const [invInst, setInvInst] = useState('')
  const [invParent, setInvParent] = useState('')
  const [invNivel, setInvNivel] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [createdToken, setCreatedToken] = useState('')
  const [creds,        setCreds]        = useState<AsesorCred[]>([])
  const [selAsesor,    setSelAsesor]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [orgRes, credsRes] = await Promise.all([
      fetch('/api/admin/org').then(r => r.json()),
      supabase.from('asesor_credentials').select('asesor, org_nodo_id').eq('activo', true).order('asesor'),
    ])
    setData(orgRes)
    setCreds((credsRes.data ?? []) as AsesorCred[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function api(body: object) {
    setSaving(true); setMsg('')
    const r = await fetch('/api/admin/org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json()
    setSaving(false)
    if (!r.ok) { setMsg('Error: ' + (j.error ?? 'desconocido')); return null }
    await load()
    return j
  }

  if (loading || !data) return (
    <div style={{ padding: 40, color: '#888', fontSize: 14 }}>Cargando jerarquía…</div>
  )

  const capasDeInst = (instId: string) => data.capas.filter(c => c.institucion_id === instId).sort((a, b) => a.nivel - b.nivel)
  const nodosRaiz   = (instId: string) => buildTree(data.nodos.filter(n => n.institucion_id === instId), null)
  const origin = BASE || 'https://proxis.theprecisionselling.com'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b0a09', marginBottom: 4 }}>Jerarquía organizacional</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Gestiona instituciones, niveles jerárquicos, nodos del árbol e invitaciones de supervisores.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e5e5' }}>
        {(['arbol', 'invitaciones'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#0b0a09' : '#888',
            borderBottom: `2px solid ${tab === t ? '#cbf135' : 'transparent'}`,
            marginBottom: -1,
          }}>
            {t === 'arbol' ? '🌲 Árbol' : '✉️ Invitaciones'}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 13 }}>{msg}</div>
      )}

      {/* ── TAB ÁRBOL ── */}
      {tab === 'arbol' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>

          {/* Columna izquierda: árbol por institución */}
          <div>
            {data.instituciones.map(inst => (
              <div key={inst.id} style={{ marginBottom: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#f9f9f7', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0b0a09' }}>{inst.nombre}</span>
                  <span style={{ fontSize: 11, color: '#aaa', background: '#f0f0ec', padding: '2px 8px', borderRadius: 10 }}>{inst.tipo}</span>
                  {/* niveles */}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {capasDeInst(inst.id).map(c => (
                      <span key={c.id} style={{ fontSize: 10, color: '#666', background: '#eee', padding: '2px 8px', borderRadius: 10 }}>
                        N{c.nivel} {c.nombre_cargo}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {nodosRaiz(inst.id).length === 0 ? (
                    <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>Sin nodos — crea el primero →</div>
                  ) : (
                    nodosRaiz(inst.id).map(n => (
                      <NodoItem key={n.id} nodo={n} nodos={data.nodos} capas={data.capas}
                        usuarios={data.usuarios} onSelect={setSelected} selected={selected} />
                    ))
                  )}
                </div>
              </div>
            ))}

            {/* Crear institución */}
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 13, color: '#888', cursor: 'pointer', padding: '6px 0' }}>+ Nueva institución / empresa</summary>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={newInst} onChange={e => setNewInst(e.target.value)} placeholder="Nombre de la empresa"
                  style={inputStyle} />
                <button onClick={async () => { if (!newInst) return; const r = await api({ accion: 'crear_institucion', nombre: newInst }); if (r) setNewInst('') }} style={btnStyle} disabled={saving}>
                  Crear
                </button>
              </div>
            </details>
          </div>

          {/* Columna derecha: panel de acciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Crear nodo */}
            <div style={panelStyle}>
              <div style={panelTitle}>Nuevo nodo</div>
              <label style={labelStyle}>Institución</label>
              <select value={newNodoInst} onChange={e => setNewNodoInst(e.target.value)} style={inputStyle}>
                <option value=''>Selecciona…</option>
                {data.instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
              <label style={labelStyle}>Nodo padre (opcional)</label>
              <select value={newNodoParent} onChange={e => setNewNodoParent(e.target.value)} style={inputStyle}>
                <option value=''>Sin padre (nodo raíz)</option>
                {data.nodos.filter(n => !newNodoInst || n.institucion_id === newNodoInst).map(n => (
                  <option key={n.id} value={n.id}>{n.nombre}</option>
                ))}
              </select>
              <label style={labelStyle}>Nivel / cargo</label>
              <select value={newNodoCapa} onChange={e => setNewNodoCapa(e.target.value)} style={inputStyle}>
                <option value=''>Sin nivel</option>
                {newNodoInst && capasDeInst(newNodoInst).map(c => (
                  <option key={c.id} value={c.id}>N{c.nivel} — {c.nombre_cargo}</option>
                ))}
              </select>
              <label style={labelStyle}>Nombre del nodo</label>
              <input value={newNodoNombre} onChange={e => setNewNodoNombre(e.target.value)} placeholder="ej: Zona Norte, Juan García"
                style={inputStyle} />
              <label style={labelStyle}>Título propio (opcional)</label>
              <input value={newNodoTitulo} onChange={e => setNewNodoTitulo(e.target.value)} placeholder="ej: Dir. Territorial Norte"
                style={inputStyle} />
              <button disabled={saving || !newNodoNombre || !newNodoInst} style={{ ...btnStyle, width: '100%', marginTop: 4 }}
                onClick={async () => {
                  const r = await api({ accion: 'crear_nodo', institucion_id: newNodoInst, parent_id: newNodoParent || null, capa_id: newNodoCapa || null, nombre: newNodoNombre, titulo_propio: newNodoTitulo || null })
                  if (r) { setNewNodoNombre(''); setNewNodoTitulo('') }
                }}>
                Crear nodo
              </button>
            </div>

            {/* Definir capa / nivel */}
            <details>
              <summary style={{ fontSize: 13, color: '#888', cursor: 'pointer', padding: '4px 0' }}>+ Definir nivel jerárquico</summary>
              <div style={{ ...panelStyle, marginTop: 8 }}>
                <select value={newCapaInst} onChange={e => setNewCapaInst(e.target.value)} style={inputStyle}>
                  <option value=''>Institución…</option>
                  {data.instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input value={newCapaNivel} onChange={e => setNewCapaNivel(e.target.value)} placeholder="Nivel (1, 2…)" type="number"
                    style={{ ...inputStyle, width: 80 }} />
                  <input value={newCapaNombre} onChange={e => setNewCapaNombre(e.target.value)} placeholder="Nombre del cargo"
                    style={{ ...inputStyle, flex: 1 }} />
                </div>
                <button disabled={saving || !newCapaInst || !newCapaNivel || !newCapaNombre} style={{ ...btnStyle, width: '100%', marginTop: 8 }}
                  onClick={async () => {
                    const r = await api({ accion: 'crear_capa', institucion_id: newCapaInst, nivel: parseInt(newCapaNivel), nombre_cargo: newCapaNombre })
                    if (r) { setNewCapaNivel(''); setNewCapaNombre('') }
                  }}>
                  Guardar nivel
                </button>
              </div>
            </details>

            {/* Nodo seleccionado */}
            {selected && (() => {
              const asesoresEnNodo = creds.filter(c => c.org_nodo_id === selected.id)
              const asesoresSinAsignar = creds.filter(c => !c.org_nodo_id)
              return (
                <div style={{ ...panelStyle, borderColor: 'rgba(203,241,53,0.4)', background: 'rgba(203,241,53,0.04)' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Nodo seleccionado</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0b0a09' }}>{selected.nombre}</div>
                  {selected.titulo_propio && <div style={{ fontSize: 12, color: '#666' }}>{selected.titulo_propio}</div>}
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4, marginBottom: 12 }}>ID: {selected.id.slice(0, 8)}…</div>

                  {/* Asesores asignados */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    Asesores ({asesoresEnNodo.length})
                  </div>
                  {asesoresEnNodo.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#bbb', marginBottom: 10 }}>Ninguno asignado</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                      {asesoresEnNodo.map(c => (
                        <div key={c.asesor} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f7', borderRadius: 7, padding: '5px 10px' }}>
                          <span style={{ fontSize: 12, color: '#0b0a09' }}>{c.asesor}</span>
                          <button
                            onClick={async () => { await api({ accion: 'asignar_asesor', asesor: c.asesor, org_nodo_id: null }); setCreds(prev => prev.map(x => x.asesor === c.asesor ? { ...x, org_nodo_id: null } : x)) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#b03a3a', fontFamily: 'inherit', padding: '2px 6px' }}
                          >
                            quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Picker para asignar */}
                  {asesoresSinAsignar.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <select value={selAsesor} onChange={e => setSelAsesor(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                        <option value=''>Asignar asesor…</option>
                        {asesoresSinAsignar.map(c => <option key={c.asesor} value={c.asesor}>{c.asesor}</option>)}
                      </select>
                      <button
                        disabled={!selAsesor || saving}
                        onClick={async () => {
                          await api({ accion: 'asignar_asesor', asesor: selAsesor, org_nodo_id: selected.id })
                          setCreds(prev => prev.map(x => x.asesor === selAsesor ? { ...x, org_nodo_id: selected.id } : x))
                          setSelAsesor('')
                        }}
                        style={{ ...btnStyle, padding: '7px 14px', opacity: !selAsesor || saving ? 0.5 : 1 }}
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                  {asesoresSinAsignar.length === 0 && creds.length > 0 && (
                    <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12 }}>Todos los asesores ya están asignados</div>
                  )}

                  <button
                    onClick={() => { setNewNodoInst(selected.institucion_id); setNewNodoParent(selected.id) }}
                    style={{ ...btnStyle, width: '100%', background: 'transparent', border: '1px solid #cbf135', color: '#4a5c00' }}
                  >
                    Crear hijo de este nodo →
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── TAB INVITACIONES ── */}
      {tab === 'invitaciones' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>

          {/* Lista de invitaciones activas */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 12 }}>
              Invitaciones activas ({data.invitaciones.length})
            </div>
            {data.invitaciones.length === 0 && (
              <div style={{ fontSize: 13, color: '#bbb', padding: '20px 0' }}>No hay invitaciones pendientes.</div>
            )}
            {data.invitaciones.map(inv => {
              const inst = data.instituciones.find(i => i.id === inv.institucion_id)
              const nodo = inv.parent_nodo_id ? data.nodos.find(n => n.id === inv.parent_nodo_id) : null
              const link = `${origin}/join/${inv.token}`
              return (
                <div key={inv.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0b0a09' }}>
                        {inv.email_destino ?? 'Sin destinatario específico'}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {inst?.nombre ?? '—'}{nodo ? ` · bajo ${nodo.nombre}` : ''}{inv.nivel_sugerido ? ` · nivel ${inv.nivel_sugerido}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                        Expira: {new Date(inv.expira_at).toLocaleDateString('es-CL')}
                      </div>
                    </div>
                    <button
                      onClick={async () => { await api({ accion: 'revocar_invitacion', id: inv.id }) }}
                      style={{ fontSize: 11, color: '#dc2626', background: 'transparent', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      Revocar
                    </button>
                  </div>
                  {/* Link para copiar */}
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input readOnly value={link} style={{ ...inputStyle, flex: 1, fontSize: 11, color: '#555', fontFamily: 'monospace' }} />
                    <button onClick={() => navigator.clipboard.writeText(link)}
                      style={{ ...btnStyle, fontSize: 11, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                      Copiar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Crear invitación */}
          <div style={panelStyle}>
            <div style={panelTitle}>Nueva invitación</div>
            <label style={labelStyle}>Institución</label>
            <select value={invInst} onChange={e => setInvInst(e.target.value)} style={inputStyle}>
              <option value=''>Selecciona…</option>
              {data.instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <label style={labelStyle}>Nodo padre (bajo quién entrará)</label>
            <select value={invParent} onChange={e => setInvParent(e.target.value)} style={inputStyle}>
              <option value=''>Sin padre (nodo raíz)</option>
              {data.nodos.filter(n => !invInst || n.institucion_id === invInst).map(n => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
              ))}
            </select>
            <label style={labelStyle}>Nivel sugerido</label>
            <input value={invNivel} onChange={e => setInvNivel(e.target.value)} type="number" placeholder="ej: 2"
              style={inputStyle} />
            <label style={labelStyle}>Email destino (opcional)</label>
            <input value={invEmail} onChange={e => setInvEmail(e.target.value)} type="email" placeholder="carlos@empresa.com"
              style={inputStyle} />
            <button disabled={saving || !invInst} style={{ ...btnStyle, width: '100%', marginTop: 4 }}
              onClick={async () => {
                const r = await api({ accion: 'crear_invitacion', institucion_id: invInst, parent_nodo_id: invParent || null, nivel_sugerido: invNivel ? parseInt(invNivel) : null, email_destino: invEmail || null })
                if (r?.data?.token) {
                  setCreatedToken(`${origin}/join/${r.data.token}`)
                  setInvEmail(''); setInvNivel('')
                }
              }}>
              Generar link
            </button>
            {createdToken && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>✓ Link generado:</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input readOnly value={createdToken} style={{ ...inputStyle, flex: 1, fontSize: 10, fontFamily: 'monospace' }} />
                  <button onClick={() => navigator.clipboard.writeText(createdToken)} style={{ ...btnStyle, fontSize: 11, padding: '6px 10px' }}>Copiar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── estilos compartidos ── */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box', marginBottom: 6,
  outline: 'none',
}
const btnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 8,
  background: '#cbf135', border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color: '#0b0a09',
  fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const panelStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e5e5',
  borderRadius: 12, padding: '16px',
}
const panelTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#0b0a09', marginBottom: 12,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#555',
  display: 'block', marginBottom: 4, marginTop: 6,
}
