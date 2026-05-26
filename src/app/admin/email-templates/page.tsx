'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Tipo = 'notificacion_sailor' | 'resumen_semanal'
type Template = {
  id: string; tipo: Tipo; version: number; asunto: string
  cuerpo_html: string; activo: boolean; notas: string | null; created_at: string
}

const TIPO_LABEL: Record<Tipo, string> = {
  notificacion_sailor: 'Notificación al asesor',
  resumen_semanal:     'Resumen semanal',
}

const VARS: Record<Tipo, { name: string; desc: string }[]> = {
  notificacion_sailor: [
    { name: '{{nombre}}',          desc: 'Primer nombre del asesor' },
    { name: '{{preview_mensaje}}', desc: 'Primeros 200 caracteres del mensaje' },
  ],
  resumen_semanal: [
    { name: '{{nombre}}',         desc: 'Primer nombre del asesor' },
    { name: '{{semana}}',         desc: 'Rango de fechas de la semana (ej: 19–26 mayo)' },
    { name: '{{total_mensajes}}', desc: 'Nº mensajes del coach en la semana' },
    { name: '{{total_senales}}',  desc: 'Nº señales capturadas en la semana' },
    { name: '{{perfil}}',         desc: 'Perfil conductual (ej: 🦅 Energético)' },
  ],
}

const PREVIEW_VARS: Record<Tipo, Record<string, string>> = {
  notificacion_sailor: { nombre: 'María', preview_mensaje: 'Esta semana notamos que estás generando más prospectos de lo habitual. ¡Es una señal muy positiva de tu momentum! Aprovecha este momento para…' },
  resumen_semanal:     { nombre: 'María', semana: '19–26 mayo 2026', total_mensajes: '3', total_senales: '7', perfil: '🦅 Energético' },
}

export default function EmailTemplatesPage() {
  const [tipo,      setTipo]      = useState<Tipo>('notificacion_sailor')
  const [versions,  setVersions]  = useState<Template[]>([])
  const [selVer,    setSelVer]    = useState<Template | null>(null)
  const [asunto,    setAsunto]    = useState('')
  const [cuerpo,    setCuerpo]    = useState('')
  const [notas,     setNotas]     = useState('')
  const [showPrev,  setShowPrev]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [activating,setActivating]= useState(false)
  const [toast,     setToast]     = useState<{ msg: string; err?: boolean } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  const load = useCallback(async (t: Tipo) => {
    const { data } = await supabase.from('email_templates')
      .select('*').eq('tipo', t).order('version', { ascending: false })
    const rows = data ?? []
    setVersions(rows)
    const active = rows.find(r => r.activo) ?? rows[0] ?? null
    if (active) { setSelVer(active); setAsunto(active.asunto); setCuerpo(active.cuerpo_html); setNotas(active.notas ?? '') }
    else { setSelVer(null); setAsunto(''); setCuerpo(''); setNotas('') }
  }, [])

  useEffect(() => { load(tipo) }, [tipo, load])

  function selectVersion(v: Template) {
    setSelVer(v); setAsunto(v.asunto); setCuerpo(v.cuerpo_html); setNotas(v.notas ?? '')
  }

  function insertVar(v: string) {
    const ta = bodyRef.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const next = ta.value.slice(0, s) + v + ta.value.slice(e)
    setCuerpo(next)
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + v.length; ta.focus() }, 0)
  }

  async function guardar() {
    if (!asunto.trim() || !cuerpo.trim()) { showToast('Asunto y cuerpo son obligatorios.', true); return }
    setSaving(true)
    const maxVer = versions.length ? Math.max(...versions.map(v => v.version)) : 0
    const { error } = await supabase.from('email_templates').insert({
      tipo, version: maxVer + 1, asunto: asunto.trim(), cuerpo_html: cuerpo.trim(),
      notas: notas.trim() || null, activo: false,
    })
    setSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast(`Versión ${maxVer + 1} guardada.`)
    load(tipo)
  }

  async function activar() {
    if (!selVer) return
    setActivating(true)
    await supabase.from('email_templates').update({ activo: false }).eq('tipo', tipo)
    await supabase.from('email_templates').update({ activo: true, updated_at: new Date().toISOString() }).eq('id', selVer.id)
    setActivating(false)
    showToast(`Versión ${selVer.version} activada.`)
    load(tipo)
  }

  async function eliminar(v: Template) {
    if (!confirm(`¿Eliminar versión ${v.version}?`)) return
    await supabase.from('email_templates').delete().eq('id', v.id)
    showToast(`Versión ${v.version} eliminada.`)
    load(tipo)
  }

  function previewHtml() {
    const vars = PREVIEW_VARS[tipo]
    return cuerpo.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Plantillas de email</h1>
      </div>

      {/* Tipo tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e8e6e3' }}>
        {(['notificacion_sailor', 'resumen_semanal'] as Tipo[]).map(t => (
          <button key={t} onClick={() => setTipo(t)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: tipo === t ? 700 : 400,
            color: tipo === t ? '#0b0a09' : '#8a8885', background: 'none',
            borderBottom: `2px solid ${tipo === t ? '#cbf135' : 'transparent'}`, marginBottom: -1,
          }}>
            {TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Lista de versiones */}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e6e3' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>Versiones</span>
          </div>
          {versions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a8885' }}>Sin versiones.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {versions.map(v => (
                <li key={v.id} onClick={() => selectVersion(v)} style={{
                  padding: '12px 18px', borderBottom: '1px solid #f5f3ef',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  background: selVer?.id === v.id ? '#f0ede8' : 'transparent',
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4a4844', flexShrink: 0 }}>v{v.version}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                    background: v.activo ? '#e6f3ed' : '#f0ede8',
                    color:      v.activo ? '#1f6f56' : '#8a8885',
                  }}>{v.activo ? 'Activa' : 'Inactiva'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8a8885' }}>
                    {new Date(v.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                  </span>
                  <button onClick={e => { e.stopPropagation(); eliminar(v) }} style={{
                    background: 'none', border: 'none', color: '#c8c6c3', fontSize: 12, cursor: 'pointer', padding: 2, flexShrink: 0,
                  }}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 24 }}>

          {/* Asunto */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Asunto del email</label>
            <input
              type="text" value={asunto} onChange={e => setAsunto(e.target.value)}
              placeholder="Asunto con {{variables}} soportadas"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Cuerpo HTML */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>Cuerpo HTML</label>
              <button onClick={() => setShowPrev(p => !p)} style={{
                fontSize: 11, fontWeight: 600, color: '#1a56c4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {showPrev ? '✏️ Editor' : '👁 Preview'}
              </button>
            </div>

            {showPrev ? (
              <iframe
                srcDoc={previewHtml()}
                style={{ width: '100%', height: 460, border: '1px solid #e8e6e3', borderRadius: 8 }}
                sandbox="allow-same-origin"
              />
            ) : (
              <textarea
                ref={bodyRef}
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
                rows={16}
                style={{
                  width: '100%', padding: 14, border: '1px solid #e8e6e3', borderRadius: 8,
                  fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, color: '#0b0a09',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* Variables */}
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f5f3ef', borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8885', marginBottom: 8 }}>
              Variables disponibles <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(clic para insertar)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VARS[tipo].map(({ name, desc }) => (
                <button key={name} onClick={() => insertVar(name)} title={desc} style={{
                  fontFamily: 'monospace', fontSize: 11, padding: '3px 10px',
                  background: '#fff', border: '1px solid #e8e6e3', borderRadius: 6,
                  color: '#1a56c4', cursor: 'pointer',
                }}>{name}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {VARS[tipo].map(({ name, desc }) => (
                <span key={name} style={{ fontSize: 11, color: '#8a8885' }}>
                  <code style={{ fontFamily: 'monospace', color: '#0b0a09' }}>{name}</code> — {desc}
                </span>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Notas internas (opcional)</label>
            <input
              type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: versión con nueva CTA para piloto mayo"
              style={{ width: '100%', padding: '9px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={guardar} disabled={saving || !asunto.trim() || !cuerpo.trim()} variant="dark">
              {saving ? 'Guardando…' : 'Guardar nueva versión'}
            </Btn>
            <Btn onClick={activar} disabled={activating || !selVer || selVer.activo} variant="teal">
              {activating ? 'Activando…' : 'Activar esta versión'}
            </Btn>
          </div>

          {selVer && (
            <p style={{ marginTop: 12, fontSize: 11, color: '#8a8885' }}>
              Versión {selVer.version} · creada {new Date(selVer.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {selVer.activo ? ' · ✅ Activa — usada en próximo envío' : ''}
            </p>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.err ? '#b03a3a' : '#0b0a09', color: '#fff',
          fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 7,
}

function Btn({ children, onClick, disabled, variant }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
  variant: 'dark' | 'teal'
}) {
  const base: React.CSSProperties = {
    padding: '10px 20px', border: 'none', borderRadius: 9, fontFamily: 'inherit',
    fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
  return (
    <button style={{ ...base, background: variant === 'dark' ? '#0b0a09' : '#1f6f56', color: variant === 'dark' ? '#cbf135' : '#fff' }}
      onClick={onClick} disabled={disabled}>{children}</button>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
