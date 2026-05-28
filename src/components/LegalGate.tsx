'use client'

import { useEffect, useState, useRef } from 'react'

type Props = {
  tipo: string
  plataforma: 'web' | 'sailor' | 'equipo' | 'admin'
  asesor?: string
  orgUsuarioId?: string
  email: string
  onAceptado: () => void
}

export default function LegalGate({ tipo, plataforma, asesor, orgUsuarioId, email, onAceptado }: Props) {
  const [doc,           setDoc]          = useState<{ id: string; titulo: string; contenido: string; version: string } | null>(null)
  const [loading,       setLoading]      = useState(true)
  const [nombre,        setNombre]       = useState('')
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [checked,       setChecked]      = useState(false)
  const [saving,        setSaving]       = useState(false)
  const [error,         setError]        = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/legal?tipo=${tipo}`)
      .then(r => r.json())
      .then(d => { setDoc(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tipo])

  function handleScroll() {
    const el = contentRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolledToEnd(true)
  }

  async function aceptar() {
    if (!nombre.trim()) { setError('Ingresa tu nombre completo para continuar.'); return }
    if (!checked)        { setError('Debes marcar que aceptas los términos.'); return }
    setSaving(true)
    const res = await fetch('/api/legal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, plataforma, asesor, org_usuario_id: orgUsuarioId, email, nombre_completo: nombre.trim() }),
    })
    if (!res.ok) { setError('Error al registrar aceptación. Intenta nuevamente.'); setSaving(false); return }
    onAceptado()
  }

  if (loading) return (
    <div style={overlay}>
      <div style={{ color: '#e8e6e3', fontSize: 14 }}>Cargando términos…</div>
    </div>
  )

  if (!doc) return null

  const canAccept = scrolledToEnd && checked && nombre.trim().length > 3

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #2a2826' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#cbf135', marginBottom: 6 }}>
            Versión {doc.version}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#e8e6e3', margin: 0, letterSpacing: '-0.02em' }}>
            {doc.titulo}
          </h2>
        </div>

        {/* Content */}
        <div ref={contentRef} onScroll={handleScroll} style={contentBox}>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#c8c6c3', whiteSpace: 'pre-wrap' }}>
            {doc.contenido.replace(/^#+\s/gm, '').replace(/\*\*/g, '')}
          </div>
          {!scrolledToEnd && (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: '#8a8885' }}>
              ↓ Desplázate hasta el final para continuar
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 28px', borderTop: '1px solid #2a2826' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8885', display: 'block', marginBottom: 6 }}>
              Nombre completo
            </label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Como aparece en tu documento de identidad"
              style={{ width: '100%', padding: '10px 12px', background: '#1a1916', border: '1px solid #3a3835', borderRadius: 8, color: '#e8e6e3', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#cbf135', width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#c8c6c3', lineHeight: 1.5 }}>
              He leído y acepto los términos completos en la versión {doc.version}
            </span>
          </label>

          {error && (
            <div style={{ fontSize: 12, color: '#e87070', marginBottom: 12 }}>{error}</div>
          )}

          <button
            onClick={aceptar}
            disabled={!canAccept || saving}
            style={{
              width: '100%', padding: '12px', background: canAccept && !saving ? '#cbf135' : '#2a2826',
              color: canAccept && !saving ? '#0b0a09' : '#4a4844',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: canAccept && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'background 0.2s',
            }}>
            {saving ? 'Registrando aceptación…' : 'Acepto y continuar'}
          </button>

          <div style={{ fontSize: 11, color: '#4a4844', textAlign: 'center', marginTop: 10 }}>
            Esta aceptación queda registrada con fecha, hora y tu nombre completo.
          </div>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20,
}

const modal: React.CSSProperties = {
  background: '#0b0a09', border: '1px solid #2a2826', borderRadius: 16,
  width: '100%', maxWidth: 620, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

const contentBox: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '20px 28px',
  minHeight: 0,
}
