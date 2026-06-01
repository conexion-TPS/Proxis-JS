import { supabaseAdmin } from '@/lib/supabase'
import MarkdownDoc from '@/components/MarkdownDoc'

export const metadata = {
  title: 'Política de Privacidad — Proxis',
  description: 'Cómo Proxis recopila, usa y protege tus datos personales.',
}

export const dynamic = 'force-dynamic'

export default async function PoliticaPrivacidadPage() {
  const sb = supabaseAdmin()
  const { data: doc } = await sb
    .from('legal_documentos')
    .select('titulo, version, contenido, vigente_desde')
    .eq('tipo', 'politica_privacidad')
    .eq('activo', true)
    .single()

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#fafaf7', minHeight: '100vh', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
            Pro<span style={{ color: '#cbf135', background: '#0b0a09', padding: '1px 3px', borderRadius: 3 }}>xis</span>
          </div>
          {doc?.vigente_desde && (
            <p style={{ fontSize: 13, color: '#8a8885', marginTop: 12 }}>
              Versión {doc.version} · Vigente desde el {new Date(doc.vigente_desde).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {doc?.contenido
          ? <MarkdownDoc md={doc.contenido} />
          : <p style={{ color: '#8a8885' }}>La Política de Privacidad no está disponible en este momento. Escribe a privacidad@theprecisionselling.com.</p>
        }
      </div>
    </div>
  )
}
