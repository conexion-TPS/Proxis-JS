import type { NextConfig } from "next";

const SAILOR_ORIGIN = 'https://sailor-front-ten.vercel.app'

const CORS = [
  { key: 'Access-Control-Allow-Origin',  value: SAILOR_ORIGIN },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@conexion-tps/cuestionario-core'],
  async headers() {
    return [
      { source: '/api/auth/sailor',         headers: CORS },
      { source: '/api/auth/sailor/:path*',  headers: CORS },
      { source: '/api/signals',             headers: CORS },
      { source: '/api/cuestionario/:path*', headers: CORS },
    ]
  },
};

export default nextConfig;
