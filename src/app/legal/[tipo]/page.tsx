'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import MarkdownDoc from '@/components/MarkdownDoc'

type Doc = { titulo: string; version: string; contenido: string; vigente_desde: string | null }

export default function LegalDocPage() {
  const params = useParams()
  const tipo = params.tipo as string
  const [doc, setDoc] = useState<Doc | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/legal?tipo=${tipo}`)
      .then(async r => { if (!r.ok) { setNotFound(true); return null } return r.json() })
      .then(d => { if (d) setDoc(d) })
      .catch(() => setNotFound(true))
  }, [tipo])

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fafaf7', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            Pro<span style={{ color: '#cbf135', background: '#0b0a09', padding: '1px 3px', borderRadius: 3 }}>xis</span>
          </div>
          {doc?.vigente_desde && (
            <p style={{ fontSize: 13, color: '#8a8885', marginTop: 12 }}>
              Versión {doc.version} · Vigente desde el {new Date(doc.vigente_desde).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        {notFound && <p style={{ color: '#8a8885' }}>Documento no encontrado.</p>}
        {doc?.contenido && <MarkdownDoc md={doc.contenido} />}
        {!doc && !notFound && <p style={{ color: '#8a8885' }}>Cargando…</p>}
      </div>
    </div>
  )
}
