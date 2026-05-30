'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const VARIABLES = [
  '{{nombre}}','{{perfil}}','{{mes}}',
  '{{metaContactos}}','{{meta}}','{{metaProspectos}}',
  '{{metaVentas}}','{{metaIngresosMes}}',
  '{{pcPromedio}}','{{persistencia}}','{{semanasSinReporte}}',
  '{{nodosActivos}}','{{ingresoMes}}',
  '{{prospectosMesAnterior}}','{{ingresosMesAnterior}}','{{esPrimerMes}}',
]

type Trigger  = { trigger_id: string; descripcion: string | null }
type Version  = { id: string; trigger_id: string; version: number; body: string; activo: boolean; created_at: string }
type Asesor   = { asesor: string; org_nodo_id: string | null }
type OrgNodo  = { id: string; nombre: string; parent_id: string | null }

export default function PromptsPage() {
  const [triggers,  setTriggers]  = useState<Trigger[]>([])
  const [asesores,  setAsesores]  = useState<Asesor[]>([])
  const [orgNodos,  setOrgNodos]  = useState<OrgNodo[]>([])
  const [filtroNodo, setFiltroNodo] = useState('')
  const [versions,  setVersions]  = useState<Version[]>([])
  const [selTrigger, setSelTrigger] = useState('')
  const [selVersion, setSelVersion] = useState<Version | null>(null)
  const [body,      setBody]      = useState('')
  const [selAsesor, setSelAsesor] = useState('')
  const [compiled,  setCompiled]  = useState<{ text: string; ctx: Record<string, unknown> } | null>(null)
  const [preview,   setPreview]   = useState('')
  const [compileLoading,  setCompileLoading]  = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [activating, setActivating] = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; err?: boolean } | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    supabase.from('trigger_config').select('trigger_id,descripcion').order('trigger_id')
      .then(({ data }) => setTriggers(data ?? []))
    supabase.from('asesor_credentials').select('asesor, org_nodo_id').eq('activo', true).order('asesor')
      .then(({ data, error }) => {
        if (error) showToast('Error cargando asesores: ' + error.message, true)
        setAsesores((data ?? []) as Asesor[])
      })
    fetch('/api/admin/org').then(r => r.json()).then(d => setOrgNodos(d.nodos ?? []))
  }, [])

  const loadVersions = useCallback(async (tid: string) => {
    if (!tid) { setVersions([]); setSelVersion(null); setBody(''); return }
    const { data } = await supabase.from('prompts')
      .select('*').eq('trigger_id', tid).order('version', { ascending: false })
    const rows = data ?? []
    setVersions(rows)
    const active = rows.find(v => v.activo) ?? rows[0] ?? null
    setSelVersion(active)
    setBody(active?.body ?? '')
  }, [])

  function onTriggerChange(tid: string) {
    setSelTrigger(tid)
    setPreview('')
    setCompiled(null)
    loadVersions(tid)
  }

  function selectVersion(v: Version) {
    setSelVersion(v)
    setBody(v.body)
  }

  function insertVar(variable: string) {
    const ta = editorRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = ta.value.slice(0, start) + variable + ta.value.slice(end)
    setBody(next)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + variable.length
      ta.focus()
    }, 0)
  }

  async function guardarVersion() {
    if (!body.trim())   { showToast('La plantilla no puede estar vacía.', true); return }
    if (!selTrigger)    { showToast('Selecciona un trigger primero.', true); return }
    const maxVer = versions.length ? Math.max(...versions.map(v => v.version)) : 0
    setSaving(true)
    const { error } = await supabase.from('prompts').insert({
      trigger_id: selTrigger, version: maxVer + 1, body: body.trim(), activo: false,
    })
    setSaving(false)
    if (error) { showToast('Error al guardar: ' + error.message, true); return }
    showToast(`Versión ${maxVer + 1} guardada.`)
    loadVersions(selTrigger)
  }

  async function activarVersion() {
    if (!selVersion || !selTrigger) return
    setActivating(true)
    await supabase.from('prompts').update({ activo: false }).eq('trigger_id', selTrigger)
    await supabase.from('prompts').update({ activo: true  }).eq('id', selVersion.id)
    setActivating(false)
    showToast(`Versión ${selVersion.version} activada.`)
    loadVersions(selTrigger)
  }

  async function eliminarVersion(v: Version) {
    const msg = v.activo
      ? `La versión ${v.version} está ACTIVA. Si la eliminas el trigger quedará sin prompt.\n\n¿Continuar?`
      : `¿Eliminar la versión ${v.version}? Esta acción no se puede deshacer.`
    if (!confirm(msg)) return
    await supabase.from('prompts').delete().eq('id', v.id)
    showToast(`Versión ${v.version} eliminada.`)
    loadVersions(selTrigger)
  }

  async function compilarTemplate() {
    if (!selAsesor)  { showToast('Selecciona un asesor.', true); return }
    if (!selTrigger) { showToast('Selecciona un trigger.', true); return }
    setCompileLoading(true)
    setCompiled(null)
    setPreview('')
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asesor: selAsesor, triggerId: selTrigger, bodyOverride: body, dryRun: true }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error, true); return }
      setCompiled({ text: data.compiled, ctx: data.ctx })
    } catch (e: any) {
      showToast(e.message, true)
    }
    setCompileLoading(false)
  }

  async function generarConGemini() {
    if (!compiled) { showToast('Primero compila el template.', true); return }
    setPreviewLoading(true)
    setPreview('⏳ Generando con Gemini…')
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asesor: selAsesor, triggerId: selTrigger, bodyOverride: body }),
      })
      const data = await res.json()
      setPreview(data.message ?? data.error ?? 'Sin respuesta')
    } catch (e: any) {
      setPreview('Error: ' + e.message)
      showToast(e.message, true)
    }
    setPreviewLoading(false)
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/dashboard" style={{
          fontSize: 12, color: '#8a8885', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <ChevronLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3', fontSize: 14 }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Prompts</h1>
      </div>

      {/* Nota de uso */}
      <div style={{ background: '#f5f3ef', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 12, color: '#666', lineHeight: 1.6 }}>
        <strong style={{ color: '#0b0a09' }}>Esta sección es para diseñadores de prompts, no para operación diaria.</strong>{' '}
        Úsala para verificar variables antes de activar una versión, hacer A/B entre versiones, o depurar el contexto de un asesor específico.
        El preview usa datos reales del asesor seleccionado — si no tiene metas configuradas, verás valores por defecto (3 contactos, 15 prospectos).
      </div>

      {/* Trigger selector */}
      <div style={{
        background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12,
        padding: '18px 22px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <label style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#8a8885', whiteSpace: 'nowrap',
        }}>Trigger</label>
        <select
          value={selTrigger}
          onChange={e => onTriggerChange(e.target.value)}
          style={{
            flex: 1, padding: '9px 14px',
            border: '1px solid #e8e6e3', borderRadius: 8,
            fontFamily: 'inherit', fontSize: 13, color: '#0b0a09',
            background: '#fff', outline: 'none',
          }}
        >
          <option value="">— Selecciona un trigger —</option>
          {triggers.map(t => (
            <option key={t.trigger_id} value={t.trigger_id}>
              {t.trigger_id}{t.descripcion ? ` — ${t.descripcion}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Grid: version list + editor */}
      <div style={{
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start',
      }}>
        {/* Version list */}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #e8e6e3',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: '#8a8885',
            }}>Versiones</span>
          </div>
          {!selTrigger ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a8885' }}>
              Selecciona un trigger
            </div>
          ) : versions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a8885' }}>
              Sin versiones — escribe la primera plantilla.
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {versions.map(v => (
                <li key={v.id}
                  onClick={() => selectVersion(v)}
                  style={{
                    padding: '12px 18px', borderBottom: '1px solid #f5f3ef',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    background: selVersion?.id === v.id ? '#f0ede8' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: '#4a4844' }}>
                    v{v.version}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: v.activo ? '#e6f3ed' : '#f0ede8',
                    color:      v.activo ? '#1f6f56' : '#8a8885',
                  }}>
                    {v.activo ? 'Activa' : 'Inactiva'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a8885' }}>
                    {formatDate(v.created_at)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); eliminarVersion(v) }}
                    style={{
                      background: 'none', border: 'none', color: '#8a8885',
                      fontSize: 11, cursor: 'pointer', padding: '2px 4px',
                      borderRadius: 4, lineHeight: 1,
                    }}
                    title="Eliminar versión"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: 20 }}>
            <label style={labelStyle}>Plantilla del mensaje</label>
            <textarea
              ref={editorRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              placeholder="Selecciona un trigger para cargar su plantilla activa, o escribe una nueva..."
              style={{
                width: '100%', padding: 14,
                border: '1px solid #e8e6e3', borderRadius: 8,
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 13, lineHeight: 1.65, color: '#0b0a09',
                resize: 'vertical', outline: 'none',
              }}
            />

            {/* Variables */}
            <div style={{ marginTop: 14 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>
                Variables disponibles <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (clic para insertar)
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {VARIABLES.map(v => (
                  <button key={v} onClick={() => insertVar(v)} style={{
                    fontFamily: 'var(--font-mono), monospace', fontSize: 11,
                    background: '#f5f3ef', border: '1px solid #e8e6e3',
                    borderRadius: 6, padding: '3px 9px', color: '#4a4844',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>{v}</button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#8a8885', marginTop: 6 }}>
                {'{{perfil}}'} = E (Energético), S (Sociable), R (Relacional) o A (Reflexivo) según perfil conductual dominante.
              </p>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e8e6e3', margin: '20px 0' }} />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn onClick={guardarVersion} disabled={!selTrigger || saving} variant="dark">
                <SaveIcon /> {saving ? 'Guardando…' : 'Guardar nueva versión'}
              </Btn>
              <Btn onClick={activarVersion} disabled={!selVersion || selVersion.activo || activating} variant="teal">
                <CheckIcon /> {activating ? 'Activando…' : 'Activar esta versión'}
              </Btn>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e8e6e3', margin: '20px 0' }} />

            {/* Preview */}
            <div>
              <label style={labelStyle}>Probar con asesor</label>
              <p style={{ fontSize: 11, color: '#8a8885', marginBottom: 10, marginTop: -4 }}>
                <strong>Paso 1:</strong> compila las variables con datos reales del asesor (sin IA).
                <strong> Paso 2:</strong> si el template se ve bien, genera el mensaje con Gemini.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {orgNodos.length > 0 && (
                  <select
                    value={filtroNodo}
                    onChange={e => { setFiltroNodo(e.target.value); setSelAsesor(''); setCompiled(null); setPreview('') }}
                    style={{ padding: '9px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }}
                  >
                    <option value="">Todos los equipos</option>
                    {orgNodos.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                  </select>
                )}
                <select
                  value={selAsesor}
                  onChange={e => { setSelAsesor(e.target.value); setCompiled(null); setPreview('') }}
                  style={{
                    flex: 1, minWidth: 180, padding: '9px 14px',
                    border: '1px solid #e8e6e3', borderRadius: 8,
                    fontFamily: 'inherit', fontSize: 13, color: '#0b0a09',
                    background: '#fff', outline: 'none',
                  }}
                >
                  <option value="">{asesores.length === 0 ? '— Sin asesores cargados —' : '— Selecciona asesor —'}</option>
                  {asesores
                    .filter(a => !filtroNodo || a.org_nodo_id === filtroNodo)
                    .map(a => (
                      <option key={a.asesor} value={a.asesor}>{a.asesor}</option>
                    ))}
                </select>
                <Btn onClick={compilarTemplate} disabled={!selTrigger || !selAsesor || compileLoading} variant="outline">
                  <CodeIcon /> {compileLoading ? 'Compilando…' : '1. Compilar variables'}
                </Btn>
                <Btn onClick={generarConGemini} disabled={!compiled || previewLoading} variant="teal">
                  <EyeIcon /> {previewLoading ? 'Generando…' : '2. Generar con Gemini'}
                </Btn>
              </div>

              {/* Template compilado */}
              {compiled && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#8a8885', marginBottom: 6,
                  }}>Template compilado (prompt que se envía a Gemini)</div>
                  <div style={{
                    background: '#f0ede8', border: '1px solid #e8e6e3', borderRadius: 8,
                    padding: 14, fontSize: 12, lineHeight: 1.65, color: '#0b0a09',
                    whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono), monospace',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {compiled.text}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                    {Object.entries(compiled.ctx)
                      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                      .map(([k, v]) => (
                        <span key={k} style={{ fontSize: 11, color: '#8a8885' }}>
                          <span style={{ color: '#4a4844', fontWeight: 600 }}>{k}</span>: {String(v)}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Mensaje generado por Gemini */}
              <div style={{
                background: '#f5f3ef', border: '1px solid #e8e6e3', borderRadius: 8,
                padding: 16, fontSize: 13, lineHeight: 1.7,
                color: preview ? '#0b0a09' : '#8a8885',
                whiteSpace: 'pre-wrap', minHeight: 60,
                fontStyle: preview ? 'normal' : 'italic',
              }}>
                {preview || 'El mensaje final generado por Gemini aparecerá aquí (paso 2).'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.err ? '#b03a3a' : '#0b0a09',
          color: '#fff', fontSize: 13, fontWeight: 500,
          padding: '10px 22px', borderRadius: 30, zIndex: 999,
          whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

/* ── Helpers ── */
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#8a8885', marginBottom: 8,
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function Btn({ children, onClick, disabled, variant }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
  variant: 'dark' | 'teal' | 'outline'
}) {
  const base: React.CSSProperties = {
    padding: '9px 18px', border: 'none', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'all 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  }
  const variants: Record<string, React.CSSProperties> = {
    dark:    { background: '#0b0a09', color: '#fff' },
    teal:    { background: '#1f6f56', color: '#fff' },
    outline: { background: '#fff', color: '#4a4844', border: '1px solid #e8e6e3' },
  }
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>
}

function ChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function SaveIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2h7l2 2v7H2V2z" stroke="currentColor" strokeWidth="1.2"/><path d="M4 2v3h5V2M4 8h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}
function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function EyeIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5S3 2 6.5 2 12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
}
function CodeIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 3.5L1 6.5l3 3M9 3.5l3 3-3 3M7.5 2l-2 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
