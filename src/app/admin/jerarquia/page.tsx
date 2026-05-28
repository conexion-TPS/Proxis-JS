'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/* ── tipos ── */
type Institucion = { id: string; nombre: string; tipo: string; activo: boolean }
type Capa        = { id: string; institucion_id: string; nivel: number; nombre_cargo: string }
type Nodo        = { id: string; parent_id: string | null; institucion_id: string; capa_id: string | null; nombre: string; titulo_propio: string | null; activo: boolean }
type OrgUsuario  = { id: string; nombre: string; email: string; org_nodo_id: string | null; activo: boolean; ultimo_login: string | null }
type Invitacion  = { id: string; token: string; institucion_id: string; parent_nodo_id: string | null; nivel_sugerido: number | null; email_destino: string | null; expira_at: string }
type AsesorCred  = { asesor: string; org_nodo_id: string | null }
type Data        = { instituciones: Institucion[]; capas: Capa[]; nodos: Nodo[]; usuarios: OrgUsuario[]; invitaciones: Invitacion[] }

type Tab    = 'arbol' | 'asesores' | 'supervisores' | 'invitaciones'
type AsRow  = { csv_asesor: string; csv_equipo: string; asesor: string | null; nodo_id: string | null; status: 'ok' | 'no_asesor' | 'no_nodo' }
type SupRow = { nombre: string; email: string; password: string; csv_equipo: string; nodo_id: string | null; exists: boolean; status: 'ok' | 'no_nodo' | 'incomplete' }

const BASE = typeof window !== 'undefined' ? window.location.origin : ''

/* ── helpers ── */
function buildTree(nodos: Nodo[], parentId: string | null) {
  return nodos.filter(n => n.parent_id === parentId)
}
function capaLabel(capas: Capa[], capaId: string | null, nodo: Nodo) {
  if (!capaId) return nodo.titulo_propio ?? ''
  return nodo.titulo_propio ?? capas.find(c => c.id === capaId)?.nombre_cargo ?? ''
}
function parseCSV(raw: string): string[][] {
  return raw.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')))
    .filter(row => row.some(c => c))
}
function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ── NodoItem ── */
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
      <div onClick={() => onSelect(nodo)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', marginLeft: depth * 18,
        borderRadius: 8, cursor: 'pointer', marginBottom: 2,
        background: isActive ? 'rgba(203,241,53,0.12)' : 'transparent',
        border: `1px solid ${isActive ? 'rgba(203,241,53,0.4)' : 'transparent'}`,
      }}>
        {children.length > 0
          ? <span onClick={e => { e.stopPropagation(); setOpen(o => !o) }} style={{ fontSize: 10, color: '#888', cursor: 'pointer', width: 12, textAlign: 'center' }}>{open ? '▼' : '▶'}</span>
          : <span style={{ width: 12 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nodo.nombre}</div>
          {label && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{label}</div>}
        </div>
        {usuario
          ? <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.12)', color: '#16a34a', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{usuario.nombre.split(' ')[0]}</span>
          : <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.06)', color: '#aaa', padding: '2px 7px', borderRadius: 10 }}>vacante</span>}
      </div>
      {open && children.map(c => (
        <NodoItem key={c.id} nodo={c} nodos={nodos} capas={capas} usuarios={usuarios}
          onSelect={onSelect} selected={selected} depth={depth + 1} />
      ))}
    </div>
  )
}

/* ── StatusBadge ── */
function Badge({ status }: { status: 'ok' | 'exists' | 'no_asesor' | 'no_nodo' | 'incomplete' }) {
  const map = {
    ok:         { bg: '#e6f3ed', color: '#1f6f56', text: '✅ Listo' },
    exists:     { bg: '#dbeafe', color: '#1d4ed8', text: '↺ Actualizar' },
    no_asesor:  { bg: '#fbe9e9', color: '#b03a3a', text: '❌ Asesor no encontrado' },
    no_nodo:    { bg: '#fff3e0', color: '#a8691a', text: '⚠️ Equipo no encontrado' },
    incomplete: { bg: '#fbe9e9', color: '#b03a3a', text: '❌ Campos incompletos' },
  }
  const s = map[status]
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.text}</span>
}

/* ── CsvSection — shared layout for both CSV tabs ── */
function CsvSection({ title, description, templateContent, templateName, text, setText, onPreview, result, children }: {
  title: string; description: string; templateContent: string; templateName: string
  text: string; setText: (s: string) => void; onPreview: () => void; result: string; children?: React.ReactNode
}) {
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0b0a09', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 }}>{description}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => downloadCSV(templateContent, templateName)}
          style={{ ...btnStyle, background: 'transparent', border: '1px solid #cbf135', color: '#4a5c00', fontSize: 12 }}>
          ⬇ Descargar plantilla
        </button>
        <label style={{ ...btnStyle, cursor: 'pointer', background: '#f5f3ef', border: '1px solid #e5e5e5', color: '#4a4844', fontSize: 12 } as React.CSSProperties}>
          📁 Cargar .csv
          <input type="file" accept=".csv,.txt" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]; if (!f) return
              const reader = new FileReader()
              reader.onload = ev => setText(ev.target?.result as string ?? '')
              reader.readAsText(f, 'utf-8')
              e.target.value = ''
            }} />
        </label>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={7}
        placeholder={templateContent}
        style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e5e5', borderRadius: 10, fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: '#0b0a09', resize: 'vertical', outline: 'none', boxSizing: 'border-box' as const }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, marginBottom: 16 }}>
        <button onClick={onPreview} disabled={!text.trim()} style={{ ...btnStyle, opacity: !text.trim() ? 0.5 : 1 }}>
          Previsualizar
        </button>
      </div>
      {result && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: result.startsWith('✅') ? '#e6f3ed' : '#fbe9e9', color: result.startsWith('✅') ? '#1f6f56' : '#b03a3a' }}>
          {result}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── Página principal ── */
export default function JerarquiaPage() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('arbol')
  const [selected, setSelected] = useState<Nodo | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  /* árbol */
  const [newInst,       setNewInst]       = useState('')
  const [newCapaInst,   setNewCapaInst]   = useState('')
  const [newCapaNivel,  setNewCapaNivel]  = useState('')
  const [newCapaNombre, setNewCapaNombre] = useState('')
  const [newNodoNombre, setNewNodoNombre] = useState('')
  const [newNodoTitulo, setNewNodoTitulo] = useState('')
  const [newNodoParent, setNewNodoParent] = useState('')
  const [newNodoInst,   setNewNodoInst]   = useState('')
  const [newNodoCapa,   setNewNodoCapa]   = useState('')
  const [creds,         setCreds]         = useState<AsesorCred[]>([])
  const [selAsesor,     setSelAsesor]     = useState('')

  /* invitaciones */
  const [invInst,      setInvInst]      = useState('')
  const [invParent,    setInvParent]    = useState('')
  const [invNivel,     setInvNivel]     = useState('')
  const [invEmail,     setInvEmail]     = useState('')
  const [createdToken, setCreatedToken] = useState('')

  /* CSV asesores */
  const [asText,      setAsText]      = useState('')
  const [asRows,      setAsRows]      = useState<AsRow[]>([])
  const [asImporting, setAsImporting] = useState(false)
  const [asResult,    setAsResult]    = useState('')

  /* CSV supervisores */
  const [supText,      setSupText]      = useState('')
  const [supRows,      setSupRows]      = useState<SupRow[]>([])
  const [supImporting, setSupImporting] = useState(false)
  const [supResult,    setSupResult]    = useState('')

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

  /* ── CSV parsing ── */
  function parseAsRows() {
    if (!data) return
    const lines = parseCSV(asText)
    if (lines.length < 2) { setAsResult('El CSV debe tener encabezado + al menos una fila.'); return }
    const h = lines[0].map(x => x.toLowerCase())
    const iA = h.findIndex(x => x.includes('asesor') || x.includes('nombre'))
    const iE = h.findIndex(x => x.includes('equipo') || x.includes('nodo') || x.includes('team'))
    if (iA < 0 || iE < 0) { setAsResult('Columnas requeridas: "asesor" y "equipo"'); return }
    const rows: AsRow[] = lines.slice(1).filter(r => r[iA]?.trim()).map(r => {
      const csv_asesor = r[iA]?.trim() ?? ''
      const csv_equipo = r[iE]?.trim() ?? ''
      const credMatch  = creds.find(c => c.asesor.toLowerCase() === csv_asesor.toLowerCase())
      const nodoMatch  = data.nodos.find(n => n.nombre.toLowerCase() === csv_equipo.toLowerCase())
      return {
        csv_asesor, csv_equipo,
        asesor:  credMatch?.asesor ?? null,
        nodo_id: nodoMatch?.id     ?? null,
        status:  !credMatch ? 'no_asesor' : !nodoMatch ? 'no_nodo' : 'ok',
      }
    })
    setAsRows(rows); setAsResult('')
  }

  function parseSupRows() {
    if (!data) return
    const lines = parseCSV(supText)
    if (lines.length < 2) { setSupResult('El CSV debe tener encabezado + al menos una fila.'); return }
    const h = lines[0].map(x => x.toLowerCase())
    const iN = h.findIndex(x => x.includes('nombre') || x.includes('name'))
    const iE = h.findIndex(x => x.includes('email')  || x.includes('correo'))
    const iP = h.findIndex(x => x.includes('password') || x.includes('clave') || x.includes('contrase'))
    const iQ = h.findIndex(x => x.includes('equipo') || x.includes('nodo')  || x.includes('team'))
    if (iN < 0 || iE < 0 || iP < 0 || iQ < 0) {
      setSupResult('Columnas requeridas: nombre, email, password, equipo'); return
    }
    const rows: SupRow[] = lines.slice(1).filter(r => r[iN]?.trim()).map(r => {
      const nombre     = r[iN]?.trim() ?? ''
      const email      = r[iE]?.trim().toLowerCase() ?? ''
      const password   = r[iP]?.trim() ?? ''
      const csv_equipo = r[iQ]?.trim() ?? ''
      const nodoMatch  = data.nodos.find(n => n.nombre.toLowerCase() === csv_equipo.toLowerCase())
      const exists     = data.usuarios.some(u => u.email === email)
      const incomplete = !nombre || !email || !password
      return {
        nombre, email, password, csv_equipo,
        nodo_id: nodoMatch?.id ?? null,
        exists,
        status: incomplete ? 'incomplete' : !nodoMatch ? 'no_nodo' : 'ok',
      }
    })
    setSupRows(rows); setSupResult('')
  }

  /* ── Confirmar imports ── */
  async function confirmAsImport() {
    const valid = asRows.filter(r => r.status === 'ok')
    if (!valid.length) return
    setAsImporting(true)
    const r = await fetch('/api/admin/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'importar_asesores', rows: valid.map(r => ({ asesor: r.asesor!, org_nodo_id: r.nodo_id! })) }),
    })
    const j = await r.json()
    setAsImporting(false)
    if (!r.ok) { setAsResult('Error: ' + (j.error ?? 'desconocido')); return }
    setAsResult(`✅ ${j.updated} asesores asignados correctamente.`)
    setAsRows([]); setAsText('')
    await load()
  }

  async function confirmSupImport() {
    const valid = supRows.filter(r => r.status === 'ok')
    if (!valid.length) return
    setSupImporting(true)
    const r = await fetch('/api/admin/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'importar_usuarios', rows: valid.map(r => ({ nombre: r.nombre, email: r.email, password: r.password, org_nodo_id: r.nodo_id! })) }),
    })
    const j = await r.json()
    setSupImporting(false)
    if (!r.ok) { setSupResult('Error: ' + (j.error ?? 'desconocido')); return }
    setSupResult(`✅ ${j.processed} usuarios procesados.`)
    setSupRows([]); setSupText('')
    await load()
  }

  if (loading || !data) return <div style={{ padding: 40, color: '#888', fontSize: 14 }}>Cargando jerarquía…</div>

  const capasDeInst = (instId: string) => data.capas.filter(c => c.institucion_id === instId).sort((a, b) => a.nivel - b.nivel)
  const nodosRaiz   = (instId: string) => buildTree(data.nodos.filter(n => n.institucion_id === instId), null)
  const origin      = BASE || 'https://proxis.theprecisionselling.com'
  const asOk        = asRows.filter(r => r.status === 'ok').length
  const supOk       = supRows.filter(r => r.status === 'ok').length

  const TABS: { key: Tab; label: string }[] = [
    { key: 'arbol',        label: '🌲 Estructura'   },
    { key: 'asesores',     label: '📋 Asesores'     },
    { key: 'supervisores', label: '👤 Supervisores' },
    { key: 'invitaciones', label: '✉️ Invitaciones' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b0a09', marginBottom: 4 }}>Jerarquía organizacional</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        1 · Crea la estructura &nbsp;→&nbsp; 2 · Importa asesores desde CSV &nbsp;→&nbsp; 3 · Crea supervisores desde CSV
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e5e5' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === key ? 700 : 400,
            color: tab === key ? '#0b0a09' : '#888',
            borderBottom: `2px solid ${tab === key ? '#cbf135' : 'transparent'}`,
            marginBottom: -1, fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 13 }}>{msg}</div>}

      {/* ── TAB ESTRUCTURA ── */}
      {tab === 'arbol' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div>
            {data.instituciones.map(inst => (
              <div key={inst.id} style={{ marginBottom: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#f9f9f7', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0b0a09' }}>{inst.nombre}</span>
                  <span style={{ fontSize: 11, color: '#aaa', background: '#f0f0ec', padding: '2px 8px', borderRadius: 10 }}>{inst.tipo}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {capasDeInst(inst.id).map(c => (
                      <span key={c.id} style={{ fontSize: 10, color: '#666', background: '#eee', padding: '2px 8px', borderRadius: 10 }}>N{c.nivel} {c.nombre_cargo}</span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {nodosRaiz(inst.id).length === 0
                    ? <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>Sin nodos — crea el primero →</div>
                    : nodosRaiz(inst.id).map(n => (
                        <NodoItem key={n.id} nodo={n} nodos={data.nodos} capas={data.capas}
                          usuarios={data.usuarios} onSelect={setSelected} selected={selected} />
                      ))}
                </div>
              </div>
            ))}

            <details open style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 13, color: '#555', cursor: 'pointer', padding: '6px 0', fontWeight: 600 }}>+ Nueva institución / empresa</summary>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={newInst} onChange={e => setNewInst(e.target.value)} placeholder="Nombre de la empresa" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={async () => { if (!newInst.trim()) return; const r = await api({ accion: 'crear_institucion', nombre: newInst.trim() }); if (r) setNewInst('') }}
                  style={btnStyle} disabled={saving || !newInst.trim()}>Crear</button>
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Crea la empresa primero, luego agrega nodos y usa las pestañas para importar personas.</div>
            </details>
          </div>

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
              <input value={newNodoNombre} onChange={e => setNewNodoNombre(e.target.value)} placeholder="ej: Zona Norte, Equipo Sur" style={inputStyle} />
              <label style={labelStyle}>Título propio (opcional)</label>
              <input value={newNodoTitulo} onChange={e => setNewNodoTitulo(e.target.value)} placeholder="ej: Dirección Regional" style={inputStyle} />
              <button disabled={saving || !newNodoNombre || !newNodoInst} style={{ ...btnStyle, width: '100%', marginTop: 4 }}
                onClick={async () => {
                  const r = await api({ accion: 'crear_nodo', institucion_id: newNodoInst, parent_id: newNodoParent || null, capa_id: newNodoCapa || null, nombre: newNodoNombre, titulo_propio: newNodoTitulo || null })
                  if (r) { setNewNodoNombre(''); setNewNodoTitulo('') }
                }}>Crear nodo</button>
            </div>

            <details>
              <summary style={{ fontSize: 13, color: '#888', cursor: 'pointer', padding: '4px 0' }}>+ Definir nivel jerárquico</summary>
              <div style={{ ...panelStyle, marginTop: 8 }}>
                <select value={newCapaInst} onChange={e => setNewCapaInst(e.target.value)} style={inputStyle}>
                  <option value=''>Institución…</option>
                  {data.instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input value={newCapaNivel} onChange={e => setNewCapaNivel(e.target.value)} placeholder="Nivel (1, 2…)" type="number" style={{ ...inputStyle, width: 80 }} />
                  <input value={newCapaNombre} onChange={e => setNewCapaNombre(e.target.value)} placeholder="Nombre del cargo" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <button disabled={saving || !newCapaInst || !newCapaNivel || !newCapaNombre} style={{ ...btnStyle, width: '100%', marginTop: 8 }}
                  onClick={async () => {
                    const r = await api({ accion: 'crear_capa', institucion_id: newCapaInst, nivel: parseInt(newCapaNivel), nombre_cargo: newCapaNombre })
                    if (r) { setNewCapaNivel(''); setNewCapaNombre('') }
                  }}>Guardar nivel</button>
              </div>
            </details>

            {selected && (() => {
              const asesoresEnNodo     = creds.filter(c => c.org_nodo_id === selected.id)
              const asesoresSinAsignar = creds.filter(c => !c.org_nodo_id)
              return (
                <div style={{ ...panelStyle, borderColor: 'rgba(203,241,53,0.4)', background: 'rgba(203,241,53,0.04)' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Nodo seleccionado</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0b0a09' }}>{selected.nombre}</div>
                  {selected.titulo_propio && <div style={{ fontSize: 12, color: '#666' }}>{selected.titulo_propio}</div>}
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4, marginBottom: 12 }}>ID: {selected.id.slice(0, 8)}…</div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    Asesores ({asesoresEnNodo.length})
                  </div>
                  {asesoresEnNodo.length === 0
                    ? <div style={{ fontSize: 12, color: '#bbb', marginBottom: 10 }}>Ninguno — importa desde la pestaña Asesores</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                        {asesoresEnNodo.map(c => (
                          <div key={c.asesor} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f7', borderRadius: 7, padding: '5px 10px' }}>
                            <span style={{ fontSize: 12 }}>{c.asesor}</span>
                            <button onClick={async () => { await api({ accion: 'asignar_asesor', asesor: c.asesor, org_nodo_id: null }); setCreds(prev => prev.map(x => x.asesor === c.asesor ? { ...x, org_nodo_id: null } : x)) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#b03a3a', fontFamily: 'inherit', padding: '2px 6px' }}>quitar</button>
                          </div>
                        ))}
                      </div>}

                  {asesoresSinAsignar.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <select value={selAsesor} onChange={e => setSelAsesor(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                        <option value=''>Asignar uno a uno…</option>
                        {asesoresSinAsignar.map(c => <option key={c.asesor} value={c.asesor}>{c.asesor}</option>)}
                      </select>
                      <button disabled={!selAsesor || saving}
                        onClick={async () => { await api({ accion: 'asignar_asesor', asesor: selAsesor, org_nodo_id: selected.id }); setCreds(prev => prev.map(x => x.asesor === selAsesor ? { ...x, org_nodo_id: selected.id } : x)); setSelAsesor('') }}
                        style={{ ...btnStyle, padding: '7px 14px', opacity: !selAsesor || saving ? 0.5 : 1 }}>Asignar</button>
                    </div>
                  )}

                  <button onClick={() => { setNewNodoInst(selected.institucion_id); setNewNodoParent(selected.id) }}
                    style={{ ...btnStyle, width: '100%', background: 'transparent', border: '1px solid #cbf135', color: '#4a5c00' }}>
                    Crear hijo de este nodo →
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── TAB ASESORES ── */}
      {tab === 'asesores' && (
        <CsvSection
          title="Importar asesores desde CSV"
          description="Asigna asesores a sus equipos en lote. Los nombres deben coincidir exactamente con los registrados en la plataforma. Los que no coincidan aparecen en rojo — corrígelos en el CSV y vuelve a previsualizar."
          templateContent={'asesor,equipo\nJuan Pérez,Equipo Sur\nMaría González,Equipo Norte\nPedro Silva,Equipo Sur'}
          templateName="plantilla_asesores.csv"
          text={asText} setText={t => { setAsText(t); setAsRows([]); setAsResult('') }}
          onPreview={parseAsRows}
          result={asResult}
        >
          {asRows.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>
                <strong>{asRows.length}</strong> filas —{' '}
                <span style={{ color: '#1f6f56' }}>✅ {asOk} válidas</span>
                {asRows.length - asOk > 0 && <span style={{ color: '#b03a3a' }}> · ❌ {asRows.length - asOk} con errores (se omiten)</span>}
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9f9f7', borderBottom: '1px solid #e5e5e5' }}>
                      {['Asesor (CSV)', 'Equipo (CSV)', 'Estado'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {asRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f3ef' }}>
                        <td style={td}>{r.csv_asesor}</td>
                        <td style={td}>{r.csv_equipo}</td>
                        <td style={td}><Badge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={confirmAsImport} disabled={asOk === 0 || asImporting}
                  style={{ ...btnStyle, opacity: asOk === 0 || asImporting ? 0.5 : 1, minWidth: 200 }}>
                  {asImporting ? 'Asignando…' : `Confirmar ${asOk} asignaciones`}
                </button>
              </div>
            </>
          )}
        </CsvSection>
      )}

      {/* ── TAB SUPERVISORES ── */}
      {tab === 'supervisores' && (
        <CsvSection
          title="Importar supervisores y cargos jerárquicos"
          description="Carga directores, supervisores regionales y cualquier rol que deba acceder al portal de equipo. El campo 'equipo' debe coincidir exactamente con un nodo de la estructura. Si el email ya existe, la contraseña y el equipo se actualizan."
          templateContent={'nombre,email,password,equipo\nHernán Poblete,hp@empresa.com,clave123,Equipo Sur\nAna Martínez,am@empresa.com,pass456,Zona Norte\nCarlos Dir,cd@empresa.com,director789,Dirección Nacional'}
          templateName="plantilla_supervisores.csv"
          text={supText} setText={t => { setSupText(t); setSupRows([]); setSupResult('') }}
          onPreview={parseSupRows}
          result={supResult}
        >
          {supRows.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>
                <strong>{supRows.length}</strong> filas —{' '}
                <span style={{ color: '#1f6f56' }}>✅ {supOk} válidas</span>
                {supRows.filter(r => r.exists && r.status === 'ok').length > 0 && (
                  <span style={{ color: '#1d4ed8' }}> · ↺ {supRows.filter(r => r.exists && r.status === 'ok').length} actualizaciones</span>
                )}
                {supRows.length - supOk > 0 && <span style={{ color: '#b03a3a' }}> · ❌ {supRows.length - supOk} con errores (se omiten)</span>}
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9f9f7', borderBottom: '1px solid #e5e5e5' }}>
                      {['Nombre', 'Email', 'Equipo', 'Estado'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {supRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f3ef' }}>
                        <td style={td}>{r.nombre}</td>
                        <td style={{ ...td, fontSize: 11, color: '#555' }}>{r.email}</td>
                        <td style={td}>{r.csv_equipo}</td>
                        <td style={td}><Badge status={r.exists && r.status === 'ok' ? 'exists' : r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={confirmSupImport} disabled={supOk === 0 || supImporting}
                  style={{ ...btnStyle, opacity: supOk === 0 || supImporting ? 0.5 : 1, minWidth: 220 }}>
                  {supImporting ? 'Procesando…' : `Crear / actualizar ${supOk} usuarios`}
                </button>
              </div>
            </>
          )}
        </CsvSection>
      )}

      {/* ── TAB INVITACIONES ── */}
      {tab === 'invitaciones' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 12 }}>
              Invitaciones activas ({data.invitaciones.length})
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
              Opción avanzada: genera un link para que alguien se registre por su cuenta (útil para supervisores remotos).
            </div>
            {data.invitaciones.length === 0 && <div style={{ fontSize: 13, color: '#bbb', padding: '20px 0' }}>No hay invitaciones pendientes.</div>}
            {data.invitaciones.map(inv => {
              const inst = data.instituciones.find(i => i.id === inv.institucion_id)
              const nodo = inv.parent_nodo_id ? data.nodos.find(n => n.id === inv.parent_nodo_id) : null
              const link = `${origin}/join/${inv.token}`
              return (
                <div key={inv.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0b0a09' }}>{inv.email_destino ?? 'Sin destinatario específico'}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {inst?.nombre ?? '—'}{nodo ? ` · bajo ${nodo.nombre}` : ''}{inv.nivel_sugerido ? ` · nivel ${inv.nivel_sugerido}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>Expira: {new Date(inv.expira_at).toLocaleDateString('es-CL')}</div>
                    </div>
                    <button onClick={async () => { await api({ accion: 'revocar_invitacion', id: inv.id }) }}
                      style={{ fontSize: 11, color: '#dc2626', background: 'transparent', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      Revocar
                    </button>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input readOnly value={link} style={{ ...inputStyle, flex: 1, fontSize: 11, color: '#555', fontFamily: 'monospace' }} />
                    <button onClick={() => navigator.clipboard.writeText(link)} style={{ ...btnStyle, fontSize: 11, padding: '6px 12px', whiteSpace: 'nowrap' }}>Copiar</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={panelStyle}>
            <div style={panelTitle}>Nueva invitación</div>
            <label style={labelStyle}>Institución</label>
            <select value={invInst} onChange={e => setInvInst(e.target.value)} style={inputStyle}>
              <option value=''>Selecciona…</option>
              {data.instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <label style={labelStyle}>Nodo padre (opcional)</label>
            <select value={invParent} onChange={e => setInvParent(e.target.value)} style={inputStyle}>
              <option value=''>Sin padre (nodo raíz)</option>
              {data.nodos.filter(n => !invInst || n.institucion_id === invInst).map(n => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
              ))}
            </select>
            <label style={labelStyle}>Nivel sugerido</label>
            <input value={invNivel} onChange={e => setInvNivel(e.target.value)} type="number" placeholder="ej: 2" style={inputStyle} />
            <label style={labelStyle}>Email destino (opcional)</label>
            <input value={invEmail} onChange={e => setInvEmail(e.target.value)} type="email" placeholder="carlos@empresa.com" style={inputStyle} />
            <button disabled={saving || !invInst} style={{ ...btnStyle, width: '100%', marginTop: 4 }}
              onClick={async () => {
                const r = await api({ accion: 'crear_invitacion', institucion_id: invInst, parent_nodo_id: invParent || null, nivel_sugerido: invNivel ? parseInt(invNivel) : null, email_destino: invEmail || null })
                if (r?.data?.token) { setCreatedToken(`${origin}/join/${r.data.token}`); setInvEmail(''); setInvNivel('') }
              }}>Generar link</button>
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

/* ── estilos ── */
const td: React.CSSProperties  = { padding: '10px 14px', fontSize: 12, verticalAlign: 'middle' }
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8885' }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box', marginBottom: 6, outline: 'none',
}
const btnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 8, background: '#cbf135', border: 'none',
  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0b0a09',
  fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const panelStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '16px' }
const panelTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0b0a09', marginBottom: 12 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4, marginTop: 6 }
