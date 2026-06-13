import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="site-nav">
      <Link href="/" className="logo">
        <span className="logo-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
        </span>
        <span className="logo-wordmark">Pro<span>xis</span></span>
        <span className="logo-tag">Prospección en práctica</span>
      </Link>
      <div className="nav-actions">
        <Link href="/login" className="nav-btn nav-btn-outline">Ver tutorial</Link>
        <Link href="/demo" className="nav-btn nav-btn-outline">Demo</Link>
        <Link href="/app" className="nav-btn nav-btn-lime">Abrir Proxis →</Link>
      </div>
    </nav>
  )
}
