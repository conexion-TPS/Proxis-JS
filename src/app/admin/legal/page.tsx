'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Doc = { id: string; tipo: string; version: string; titulo: string; contenido: string; activo: boolean; vigente_desde: string }
type Aceptacion = { id: string; tipo: string; version: string; email: string; nombre_completo: string; plataforma: string; aceptado_at: string }

const TIPOS: Record<string, string> = {
  terminos_asesor_corporativo:     'Términos Asesor Corporativo',
  terminos_asesor_independiente:   'Términos Asesor Independiente',
  terminos_supervisor:             'Términos Supervisor',
  dpa_empresa:                     'DPA — Empresas B2B',
  consentimiento_datos_secundarios: 'Consentimiento Uso Secundario',
  politica_privacidad:             'Política de Privacidad',
}

export default function LegalPage() {
  const [docs,        setDocs]        = useState<Doc[]>([])
  const [aceptaciones, setAceptaciones] = useState<Aceptacion[]>([])
  const [selectedTipo, setSelectedTipo] = useState<string>('terminos_asesor_corporativo')
  const [editing,     setEditing]     = useState<Doc | null>(null)
  const [form,        setForm]        = useState({ version: '', titulo: '', contenido: '' })
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [docsRes, acepRes] = await Promise.all([
      supabase.from('legal_documentos').select('*').order('tipo').order('version'),
      supabase.from('legal_aceptaciones').select('id,tipo,version,email,nombre_completo,plataforma,aceptado_at').order('aceptado_at', { ascending: false }).limit(100),
    ])
    setDocs(docsRes.data ?? [])
    setAceptaciones(acepRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function openNew() {
    const activo = docs.find(d => d.tipo === selectedTipo && d.activo)
    const nextVer = activo ? bumpVersion(activo.version) : '1.0'
    setForm({ version: nextVer, titulo: activo?.titulo ?? TIPOS[selectedTipo], contenido: activo?.contenido ?? '' })
    setEditing(null)
  }

  function bumpVersion(v: string) {
    const [major, minor] = v.split('.').map(Number)
    return `${major}.${minor + 1}`
  }

  async function guardar() {
    if (!form.version || !form.titulo || !form.contenido) { showToast('Completa todos los campos'); return }
    const { error } = await supabase.from('legal_documentos').upsert(
      { tipo: selectedTipo, version: form.version, titulo: form.titulo, contenido: form.contenido, activo: false },
      { onConflict: 'tipo,version' }
    )
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Documento guardado (borrador)')
    setEditing(null)
    load()
  }

  async function publicar(doc: Doc) {
    if (!confirm(`¿Publicar versión ${doc.version}? Todos los usuarios deberán re-aceptar en su próximo acceso.`)) return
    // Deactivate all versions of this tipo
    await supabase.from('legal_documentos').update({ activo: false }).eq('tipo', doc.tipo)
    // Activate this version
    const { error } = await supabase.from('legal_documentos').update({ activo: true, vigente_desde: new Date().toISOString() }).eq('id', doc.id)
    if (error) { showToast('Error: ' + error.message); return }
    showToast(`Versión ${doc.version} publicada`)
    load()
  }

  function exportar() {
    const filtered = aceptaciones.filter(a => a.tipo === selectedTipo)
    const csv = ['id,tipo,version,email,nombre_completo,plataforma,fecha',
      ...filtered.map(a => `${a.id},${a.tipo},${a.version},"${a.email}","${a.nombre_completo}",${a.plataforma},${a.aceptado_at}`)
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `aceptaciones_${selectedTipo}.csv`; a.click()
  }

  const docsTipo = docs.filter(d => d.tipo === selectedTipo)
  const acepTipo = aceptaciones.filter(a => a.tipo === selectedTipo)
  const activoDoc = docsTipo.find(d => d.activo)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Documentos Legales</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div>
          {Object.entries(TIPOS).map(([tipo, label]) => {
            const activo = docs.find(d => d.tipo === tipo && d.activo)
            return (
              <button key={tipo} onClick={() => setSelectedTipo(tipo)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                background: selectedTipo === tipo ? '#0b0a09' : 'transparent',
                color: selectedTipo === tipo ? '#e8e6e3' : '#4a4844',
                border: '1px solid', borderColor: selectedTipo === tipo ? '#e8e6e3' : 'transparent',
                borderRadius: 8, marginBottom: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              }}>
                {label}
                {activo && <span style={{ display: 'block', fontSize: 10, color: '#1f6f56', marginTop: 2 }}>v{activo.version} activa</span>}
              </button>
            )
          })}
        </div>

        {/* Main */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{TIPOS[selectedTipo]}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {acepTipo.length > 0 && (
                <button onClick={exportar} style={btnOutline}>Exportar CSV ({acepTipo.length})</button>
              )}
              <button onClick={openNew} style={btnPrimary}>+ Nueva versión</button>
            </div>
          </div>

          {/* Versions */}
          {loading ? <div style={{ color: '#8a8885' }}>Cargando…</div> : (
            <>
              {docsTipo.length === 0 && <div style={{ color: '#8a8885', fontSize: 13 }}>Sin versiones aún.</div>}
              {docsTipo.map(doc => (
                <div key={doc.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>v{doc.version}</span>
                      {doc.activo
                        ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#e6f3ed', color: '#1f6f56' }}>ACTIVA</span>
                        : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#f5f3ef', color: '#8a8885' }}>borrador</span>
                      }
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditing(doc); setForm({ version: doc.version, titulo: doc.titulo, contenido: doc.contenido }) }} style={btnOutline}>Editar</button>
                      {!doc.activo && <button onClick={() => publicar(doc)} style={btnPrimary}>Publicar</button>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#8a8885' }}>
                    {doc.vigente_desde ? `Vigente desde: ${new Date(doc.vigente_desde).toLocaleDateString('es-CL')}` : 'Sin publicar'}
                    {' · '}{acepTipo.filter(a => a.version === doc.version).length} aceptaciones
                  </div>
                </div>
              ))}

              {/* Form nueva versión / editar */}
              {(editing !== null || form.version) && !editing && (
                <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '20px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Nueva versión</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Versión</label>
                    <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Título</label>
                    <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Contenido (Markdown)</label>
                    <textarea value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                      rows={12} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={guardar} style={btnPrimary}>Guardar borrador</button>
                    <button onClick={() => setForm({ version: '', titulo: '', contenido: '' })} style={btnOutline}>Cancelar</button>
                  </div>
                </div>
              )}

              {editing && (
                <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '20px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Editar v{editing.version}</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Título</label>
                    <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Contenido (Markdown)</label>
                    <textarea value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                      rows={12} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={guardar} style={btnPrimary}>Guardar</button>
                    <button onClick={() => setEditing(null)} style={btnOutline}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Acceptances log */}
              {acepTipo.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Últimas aceptaciones</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>{['Nombre', 'Email', 'Versión', 'Plataforma', 'Fecha'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0 8px 8px 0', color: '#8a8885', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {acepTipo.slice(0, 20).map(a => (
                        <tr key={a.id} style={{ borderTop: '1px solid #f5f3ef' }}>
                          <td style={{ padding: '8px 8px 8px 0' }}>{a.nombre_completo}</td>
                          <td style={{ padding: '8px 8px 8px 0', color: '#4a4844' }}>{a.email}</td>
                          <td style={{ padding: '8px 8px 8px 0' }}>v{a.version}</td>
                          <td style={{ padding: '8px 8px 8px 0', color: '#4a4844' }}>{a.plataforma}</td>
                          <td style={{ padding: '8px 0', color: '#8a8885' }}>{new Date(a.aceptado_at).toLocaleDateString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0b0a09', color: '#fff', fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnOutline: React.CSSProperties = { padding: '8px 14px', background: '#fff', color: '#4a4844', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }
