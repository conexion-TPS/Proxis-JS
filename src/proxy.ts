import { NextRequest, NextResponse } from 'next/server'

const SAILOR_ORIGIN = 'https://sailor-front-ten.vercel.app'

// SOLO DESARROLLO: orígenes locales del front del asesor, para verificar en localhost.
// En producción (Vercel build = production) SIEMPRE se fija SAILOR_ORIGIN (prod intacto).
const DEV_ORIGINS = ['http://localhost:3001', 'http://localhost:3000']

function allowOrigin(origin: string | null): string {
  if (process.env.NODE_ENV !== 'production' && origin && DEV_ORIGINS.includes(origin)) return origin
  return SAILOR_ORIGIN
}

function corsFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin':  allowOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isSailorRoute = pathname.startsWith('/api/auth/sailor') ||
                        pathname.startsWith('/api/signals') ||
                        pathname.startsWith('/api/cuestionario')

  if (!isSailorRoute) return NextResponse.next()

  const cors = corsFor(req.headers.get('origin'))

  // Preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: cors })
  }

  const res = NextResponse.next()
  Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export const config = {
  matcher: ['/api/auth/sailor/:path*', '/api/signals', '/api/cuestionario/:path*'],
}
