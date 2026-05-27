'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type TokenInfo = { nivel: number | null; parent_nodo_id: string | null }

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const token  = params.token as string

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [checking,  setChecking]  = useState(true)

  const [nombre,       setNombre]       = useState('')
  const [email,        setEmail]        = useState('')
  const [tituloCargo,  setTituloCargo]  = useState('')
  const [password,     setPassword]     = useState('')
  const [password2,    setPassword2]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [done,         setDone]         = useState(false)
  const [formError,    setFormError]    = useState('')

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then(async r => {
        const json = await r.json()
        if (!r.ok) { setTokenError(json.error ?? 'Token no válido'); }
        else { setTokenInfo({ nivel: json.nivel, parent_nodo_id: json.parent_nodo_id }) }
      })
      .catch(() => setTokenError('Error al validar la invitación'))
      .finally(() => setChecking(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!nombre.trim())               return setFormError('El nombre es obligatorio.')
    if (!email.trim() || !email.includes('@')) return setFormError('Ingresa un correo válido.')
    if (password.length < 8)          return setFormError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== password2)       return setFormError('Las contraseñas no coinciden.')

    setSaving(true)
    try {
      const res = await fetch(`/api/join/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim().toLowerCase(), titulo_cargo: tituloCargo.trim(), password }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setFormError(json.error ?? 'Error al registrar'); }
      else { setDone(true) }
    } catch {
      setFormError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0a09',
      backgroundImage: 'radial-gradient(circle, rgba(203,241,53,0.06) 1px, transparent 1px)',
      backgroundSize: '28px 28px', padding: '24px 16px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '44px 48px',
        width: '100%', maxWidth: 440, backdropFilter: 'blur(12px)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a8cc1a', marginBottom: 20 }}>
          Proxis · Registro
        </div>

        {checking ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Verificando invitación…</p>
        ) : tokenError ? (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Invitación no válida</h1>
            <p style={{ color: '#f09060', fontSize: 13 }}>{tokenError}</p>
          </div>
        ) : done ? (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#cbf135', marginBottom: 12 }}>¡Listo!</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Tu cuenta fue creada. Ya puedes ingresar a tu dashboard de equipo.
            </p>
            <button onClick={() => router.push('/equipo/login')} style={{
              width: '100%', padding: 14, background: '#cbf135', color: '#0b0a09',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}>Ir al login</button>
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 8 }}>
              Crear tu acceso
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 28, lineHeight: 1.5 }}>
              Fuiste invitado a unirte al equipo. Completa tus datos para continuar.
            </p>

            {formError && (
              <div style={{ background: 'rgba(232,99,10,0.12)', border: '1px solid rgba(232,99,10,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f09060', marginBottom: 16 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={labelStyle}>Tu nombre completo</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Nombre Apellido" required style={{ ...inputStyle, marginBottom: 14 }} />

              <label style={labelStyle}>Tu correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com" required style={{ ...inputStyle, marginBottom: 14 }} />

              <label style={labelStyle}>Tu cargo o rol <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>(opcional)</span></label>
              <input value={tituloCargo} onChange={e => setTituloCargo(e.target.value)}
                placeholder="Supervisor regional, Gerente de zona…" style={{ ...inputStyle, marginBottom: 14 }} />

              <label style={labelStyle}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres" required style={{ ...inputStyle, marginBottom: 14 }} />

              <label style={labelStyle}>Confirmar contraseña</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
                placeholder="Repite la contraseña" required style={{ ...inputStyle, marginBottom: 24 }} />

              <button type="submit" disabled={saving} style={{
                width: '100%', padding: 14,
                background: saving ? 'rgba(203,241,53,0.5)' : '#cbf135',
                color: '#0b0a09', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
                {saving ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, fontSize: 14, color: '#fff',
  outline: 'none', fontFamily: 'inherit',
}
