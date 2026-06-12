import { redirect } from 'next/navigation'

// La ruta /app/tracker-consorcio se unificó en /app/tracker (una sola vista de equipo
// para ambas empresas; el endpoint /api/app/equipo filtra por la institución del token).
// Este redirect conserva los links guardados (p.ej. de Valeska) hacia la ruta vieja.
export default function TrackerConsorcioRedirect() {
  redirect('/app/tracker')
}
