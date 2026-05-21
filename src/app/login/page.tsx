'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const USERS = [
  { name: 'Diego Pérez',             pass: 'diegope2026$',          role: 'asesor'     },
  { name: 'Nazaret Johannesen',      pass: 'nazaretjoha$2026',      role: 'asesor'     },
  { name: 'Verónica Castillo',       pass: 'verocastil2026$',       role: 'asesor'     },
  { name: 'Fernanda Grothusen',      pass: 'fernagroth$2026',       role: 'asesor'     },
  { name: 'Sindy Martínez',          pass: 'SindyMar2026$$',        role: 'asesor'     },
  { name: 'Francis Arancibia',       pass: 'Francis$2026$$',        role: 'asesor'     },
  { name: 'Marcela Jara',            pass: 'MJara$$2026',           role: 'asesor'     },
  { name: 'María Francisca Lorenz',  pass: 'FrancBertoni$2026$',    role: 'asesor'     },
  { name: 'Oriana Jorquera',         pass: 'Ori$Jorq2026',          role: 'asesor'     },
  { name: 'Mauricio Gana',           pass: 'MauGana$2026$$',        role: 'asesor'     },
  { name: 'Alejandra Espinoza',      pass: 'AlejEspinoz$$026$$',    role: 'supervisor' },
]

const ROLE_LABEL: Record<string, string> = {
  asesor:     'Asesor/a · Tutorial de prospección',
  supervisor: 'Supervisora · Tutorial de gestión de equipos',
}
const ROLE_LABEL_PLATAFORMA: Record<string, string> = {
  asesor:     'Asesor/a · Proxis',
  supervisor: 'Supervisora · Proxis',
}
const ROLE_EMOJI: Record<string, string> = {
  asesor:     '🧑‍💼',
  supervisor: '📊',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destMode = searchParams.get('dest') === 'plataforma' ? 'plataforma' : 'tutorial'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [redirectUser, setRedirectUser] = useState<{ name: string; role: string } | null>(null)
  const [barWidth, setBarWidth] = useState('0%')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Por favor completa usuario y contraseña.')
      triggerShake()
      return
    }

    const user = USERS.find(
      u => u.name.toLowerCase() === username.toLowerCase() && u.pass === password
    )

    if (!user) {
      setError('Usuario o contraseña incorrectos.')
      triggerShake()
      return
    }

    localStorage.setItem('proxis_user', JSON.stringify({ name: user.name, role: user.role }))
    setRedirectUser(user)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setBarWidth('100%'))
    })

    const dest = destMode === 'plataforma'
      ? '/plataforma'
      : user.role === 'supervisor' ? '/tutorial/supervisor' : '/tutorial/asesor'

    setTimeout(() => router.push(dest), 2000)
  }

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  return (
    <div className="login-page">
      <div className="dot-bg-dark" />
      <div className="login-glow" />
      <div className="login-glow-2" />

      <div className="login-card">
        <Link href="/" className="logo login-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="4.5" fill="#a8cc1a"/>
            <circle cx="6" cy="9" r="3" fill="#a8cc1a" opacity="0.85"/>
            <circle cx="26" cy="9" r="3" fill="#a8cc1a" opacity="0.85"/>
            <circle cx="6" cy="23" r="3" fill="#a8cc1a" opacity="0.6"/>
            <circle cx="26" cy="23" r="3" fill="#a8cc1a" opacity="0.6"/>
            <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
            <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
            <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          </svg>
          <span className="logo-wordmark login-wordmark">Pro<span>xis</span></span>
          <span className="logo-tag login-tag">Prospección<br/>en práctica</span>
        </Link>

        {!redirectUser ? (
          <div>
            <div className="login-badge">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3.5 5l1 1 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Acceso seguro
            </div>
            <h1 className="login-title">
              {destMode === 'plataforma' ? <>Accede a<br/>Proxis</> : <>Bienvenido/a<br/>a tu tutorial</>}
            </h1>
            <p className="login-sub">
              {destMode === 'plataforma'
                ? 'Ingresa tus credenciales para abrir la plataforma.'
                : 'Ingresa tus credenciales para acceder al recorrido personalizado según tu perfil.'}
            </p>

            {error && (
              <div className="error-msg visible">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ animation: shake ? 'shake 0.35s ease' : 'none' }}
              autoComplete="off"
            >
              <div className="form-group">
                <label className="form-label" htmlFor="username">Usuario</label>
                <input
                  className={`form-input${error ? ' error' : ''}`}
                  type="text"
                  id="username"
                  placeholder="Tu nombre completo"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('password')?.focus() } }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Contraseña</label>
                <div className="input-wrap">
                  <input
                    className={`form-input${error ? ' error' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    id="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="off"
                  />
                  <button type="button" className="toggle-pw" onClick={() => setShowPw(v => !v)}>
                    {showPw ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 2l12 12M6.5 6.6A2 2 0 009.4 9.5M4.5 4.7C2.8 5.9 1 8 1 8s2.5 5 7 5c1.4 0 2.6-.4 3.6-.9M7 3.1C7.3 3 7.6 3 8 3c4.5 0 7 5 7 5s-.8 1.5-2 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2"/>
                        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button className="login-btn" type="submit">
                Ingresar
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <div className="redirect-overlay visible">
            <div className="redirect-avatar">{ROLE_EMOJI[redirectUser.role]}</div>
            <div className="redirect-name">{redirectUser.name}</div>
            <div className="redirect-role">
              {destMode === 'plataforma' ? ROLE_LABEL_PLATAFORMA[redirectUser.role] : ROLE_LABEL[redirectUser.role]}
            </div>
            <div className="redirect-bar-wrap">
              <div className="redirect-bar" style={{ width: barWidth }} />
            </div>
            <div className="redirect-txt">
              {destMode === 'plataforma' ? 'Cargando Proxis…' : 'Cargando tu tutorial…'}
            </div>
          </div>
        )}
      </div>

      <p className="login-footer">
        <Link href="/">← Volver a Proxis</Link>
        &nbsp;·&nbsp; Uso interno del equipo · The Precision Selling
      </p>

      <style>{`
        .login-page {
          background: var(--black);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .login-glow {
          position: fixed; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(168,204,26,0.08) 0%, transparent 70%);
          top: -150px; right: -150px; pointer-events: none; z-index: 0;
        }
        .login-glow-2 {
          position: fixed; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(168,204,26,0.05) 0%, transparent 70%);
          bottom: -120px; left: -100px; pointer-events: none; z-index: 0;
        }
        .login-card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; padding: 44px 48px;
          width: 100%; max-width: 420px;
          backdrop-filter: blur(12px);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
        }
        .login-logo { margin-bottom: 36px; }
        .login-wordmark { color: var(--white) !important; }
        .login-tag { color: rgba(255,255,255,0.35) !important; border-color: rgba(255,255,255,0.15) !important; }
        .login-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(168,204,26,0.12); color: var(--lime-dk);
          font-size: 10px; font-weight: 700; padding: 4px 12px;
          border-radius: 20px; letter-spacing: 0.08em; text-transform: uppercase;
          border: 1px solid rgba(168,204,26,0.25); margin-bottom: 16px;
        }
        .login-title {
          font-size: 24px; font-weight: 800; color: var(--white);
          letter-spacing: -0.03em; line-height: 1.2; margin-bottom: 6px;
        }
        .login-sub {
          font-size: 13px; color: rgba(255,255,255,0.45);
          line-height: 1.6; margin-bottom: 32px;
        }
        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .form-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.5);
        }
        .form-input {
          width: 100%; padding: 13px 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; font-size: 14px; color: var(--white);
          outline: none; transition: border-color 0.15s, background 0.15s;
          font-family: inherit;
        }
        .form-input::placeholder { color: rgba(255,255,255,0.2); }
        .form-input:focus { border-color: rgba(168,204,26,0.5); background: rgba(168,204,26,0.05); }
        .form-input.error { border-color: var(--error); }
        .input-wrap { position: relative; }
        .toggle-pw {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.3); padding: 4px;
          display: flex; align-items: center; transition: color 0.15s;
        }
        .toggle-pw:hover { color: rgba(255,255,255,0.6); }
        .error-msg {
          display: none; align-items: center; gap: 8px;
          background: rgba(232,99,10,0.12); border: 1px solid rgba(232,99,10,0.3);
          border-radius: 8px; padding: 10px 14px; font-size: 13px;
          color: #f09060; margin-bottom: 16px;
        }
        .error-msg.visible { display: flex; }
        .login-btn {
          width: 100%; padding: 14px; background: var(--lime);
          color: var(--black); border: none; border-radius: 10px;
          font-size: 14px; font-weight: 800; cursor: pointer;
          transition: all 0.15s; margin-top: 8px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-family: inherit;
        }
        .login-btn:hover { background: var(--lime-dk); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(168,204,26,0.3); }
        .login-btn:active { transform: translateY(0); }
        .redirect-overlay { display: none; flex-direction: column; align-items: center; text-align: center; padding: 20px 0 8px; }
        .redirect-overlay.visible { display: flex; }
        .redirect-avatar {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(168,204,26,0.15); border: 2px solid rgba(168,204,26,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 14px;
        }
        .redirect-name { font-size: 16px; font-weight: 700; color: var(--white); margin-bottom: 4px; }
        .redirect-role {
          font-family: var(--font-mono), monospace; font-size: 10px;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--lime-dk); margin-bottom: 20px;
        }
        .redirect-bar-wrap {
          width: 100%; height: 3px; background: rgba(255,255,255,0.1);
          border-radius: 2px; overflow: hidden; margin-bottom: 12px;
        }
        .redirect-bar { height: 100%; background: var(--lime); border-radius: 2px; transition: width 1.8s linear; }
        .redirect-txt { font-size: 12px; color: rgba(255,255,255,0.35); }
        .login-footer {
          position: relative; z-index: 1; margin-top: 28px; text-align: center;
          font-size: 11px; color: rgba(255,255,255,0.2); letter-spacing: 0.04em;
        }
        .login-footer a { color: rgba(255,255,255,0.35); transition: color 0.15s; }
        .login-footer a:hover { color: var(--lime-dk); }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
