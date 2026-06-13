'use client'
import { useState } from 'react'
import { useAuth } from './AuthProvider'

/*
 * LoginScreen — pantalla de login compartida del /app (lote login negro + ojo).
 * Calco visual del login NEGRO del legacy (/plataforma #screen-login: fondo #0b0a09
 * + glow lime + textura de puntos, .lcard blanca, logo de nodos + "Proxis", título
 * "Ingresa a tu cuenta", campos, botón negro full, footer ©).
 *
 * 2 divergencias deliberadas aprobadas vs el legacy:
 *   1) Campo EMAIL (no el nombre+select del legacy) — el login /app autentica por email.
 *   2) OJO de mostrar/ocultar contraseña (SVG inline; sin librería de íconos).
 *
 * Sesión vía useAuth().login. Tokens (--shadow-3/--ring/--blue/--red/...) los provee
 * SHELL_CSS del layout. La reemplazan las 5 pantallas (app índice, informe, simulador,
 * simulador-consorcio, tracker) donde antes tenían su login inline duplicado.
 */

const CSS = `
#screen-login{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0a09;padding:24px;background-image:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(203,241,53,0.08),transparent 60%),radial-gradient(circle at 15% 85%,rgba(203,241,53,0.05),transparent 45%);position:relative}
#screen-login::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}
.lcard{background:white;border-radius:var(--rx);padding:40px 36px;width:100%;max-width:420px;box-shadow:var(--shadow-3);position:relative;z-index:1}
.llogo-wrap{display:flex;align-items:center;gap:10px;background:#0b0a09;border-radius:10px;padding:11px 14px;margin-bottom:24px}
.ltitle{font-size:22px;font-weight:700;color:#0b0a09;margin-bottom:5px;letter-spacing:-0.028em;line-height:1.2}
.lsub{font-size:13px;color:var(--g600);margin-bottom:24px;line-height:1.5}
.lfield{margin-bottom:14px}
.lfield label{display:block;font-size:11px;font-weight:600;color:var(--g700);margin-bottom:7px;text-transform:uppercase;letter-spacing:0.07em}
.lfield input{width:100%;padding:11px 14px;border:1px solid var(--g200);border-radius:var(--r);font-family:var(--font);font-size:14px;color:var(--g900);background:white;outline:none;transition:all .18s;appearance:none;-webkit-appearance:none}
.lfield input[type=password]{letter-spacing:.1em}
.lfield input:focus{border-color:var(--blue);box-shadow:var(--ring)}
.lpass{position:relative}
.lpass input{padding-right:42px}
.leye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;padding:6px;cursor:pointer;color:var(--g400);display:flex;align-items:center;line-height:0;transition:color .15s}
.leye:hover{color:var(--g700)}
.lbtn{width:100%;justify-content:center;margin-top:14px;padding:13px;background:#0b0a09;color:white;border:none;border-radius:var(--r);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .18s;letter-spacing:-0.005em}
.lbtn:hover{background:#2a2926}
.lbtn:disabled{opacity:.6;cursor:not-allowed}
.lmsg{padding:10px 12px;border-radius:var(--r);font-size:12px;margin-top:10px;border:1px solid rgba(176,58,58,0.18);background:var(--red-lt);color:var(--red)}
.lfooter{font-size:11px;color:var(--g400);text-align:center;margin-top:18px}
`

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState('')
  const [cargando, setCargando] = useState(false)

  async function onLogin() {
    if (cargando) return
    setErr(''); setCargando(true)
    const res = await login(email, pass)
    setCargando(false)
    if (!res.ok) setErr(res.error ?? 'Credenciales incorrectas')
  }
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onLogin() }

  return (
    <>
      <style>{CSS}</style>
      <div id="screen-login">
        <div className="lcard">
          <div className="llogo-wrap">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="16" cy="16" r="4.5" fill="#a8cc1a" />
              <circle cx="6" cy="9" r="3" fill="#a8cc1a" opacity="0.85" />
              <circle cx="26" cy="9" r="3" fill="#a8cc1a" opacity="0.85" />
              <circle cx="6" cy="23" r="3" fill="#a8cc1a" opacity="0.6" />
              <circle cx="26" cy="23" r="3" fill="#a8cc1a" opacity="0.6" />
              <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke="#a8cc1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: 'white', letterSpacing: '-0.04em' }}>Pro<span style={{ color: '#cbf135' }}>xis</span></span>
          </div>
          <div className="ltitle">Ingresa a tu cuenta</div>
          <div className="lsub">Acceso restringido al personal autorizado.</div>
          <div className="lfield">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} placeholder="tu@email.com" autoComplete="username" spellCheck={false} />
          </div>
          <div className="lfield">
            <label>Contraseña</label>
            <div className="lpass">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={onEnter} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" className="leye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={showPass ? 'Ocultar' : 'Mostrar'}>
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
          <button className="lbtn" onClick={onLogin} disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
          {err && <div className="lmsg">{err}</div>}
          <div className="lfooter">© 2026 The Precision Selling · Todos los derechos reservados</div>
        </div>
      </div>
    </>
  )
}
