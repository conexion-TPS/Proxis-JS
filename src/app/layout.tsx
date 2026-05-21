import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-jakarta',
})

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Proxis — Prospección en Práctica',
  description: 'Plataforma de prospección comercial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jakarta.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
