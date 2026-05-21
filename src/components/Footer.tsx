import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="site-footer">
      <span className="footer-label">Una herramienta de</span>
      <a href="https://theprecisionselling.com/" target="_blank" rel="noopener" className="footer-tps-link">
        <Image src="/tps-logo.png" alt="The Precision Selling" height={48} width={120} style={{ height: 48, width: 'auto' }} />
      </a>
    </footer>
  )
}
