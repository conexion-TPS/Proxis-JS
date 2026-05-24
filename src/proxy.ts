import { NextRequest, NextResponse } from 'next/server'

const SAILOR_ORIGIN = 'https://sailor-front-ten.vercel.app'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  SAILOR_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age':       '86400',
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isSailorRoute = pathname.startsWith('/api/auth/sailor') ||
                        pathname.startsWith('/api/signals') ||
                        pathname.startsWith('/api/cuestionario')

  if (!isSailorRoute) return NextResponse.next()

  // Preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  const res = NextResponse.next()
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export const config = {
  matcher: ['/api/auth/sailor/:path*', '/api/signals', '/api/cuestionario/:path*'],
}
