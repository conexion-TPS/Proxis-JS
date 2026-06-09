import { createClient } from '@supabase/supabase-js'

// Cliente para el proyecto PROPIO de Viña: `sgu-vina-prospección` (Opción B).
// Proyecto Supabase dedicado, separado de Zurich (proxis-dev) y del proyecto de la app (B).
// Todo el acceso ocurre desde las API routes (servidor), así que usamos la SERVICE-ROLE key
// y dejamos las tablas con RLS cerrado: nada accesible desde el navegador con la anon key.
//
// Configurar en el entorno (Vercel + .env.local). Se acepta el nombre en MAYÚSCULAS
// o en minúsculas, por si Vercel obliga a un formato:
//   VINA_SUPABASE_URL          = https://<ref>.supabase.co   (de sgu-vina-prospección)
//   VINA_SUPABASE_SERVICE_KEY  = service_role key            (secreta, Settings → API)
const VINA_URL =
  process.env.VINA_SUPABASE_URL ?? process.env.vina_supabase_url

const VINA_KEY =
  process.env.VINA_SUPABASE_SERVICE_KEY ?? process.env.vina_supabase_service_key ??
  process.env.VINA_SUPABASE_ANON_KEY ?? process.env.vina_supabase_anon_key

export function supabaseVina() {
  if (!VINA_URL || !VINA_KEY) {
    throw new Error(
      'Faltan VINA_SUPABASE_URL y VINA_SUPABASE_SERVICE_KEY (proyecto sgu-vina-prospección)'
    )
  }
  return createClient(VINA_URL, VINA_KEY, { auth: { persistSession: false } })
}

export const EMPRESA_VINA = 'consorcio'
