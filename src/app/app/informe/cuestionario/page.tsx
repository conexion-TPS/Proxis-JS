import { CuestionarioInformeProvider } from './_provider'
import { CuestionarioLanding } from '@conexion-tps/cuestionario-core'

export default function Page() {
  return <CuestionarioInformeProvider><CuestionarioLanding /></CuestionarioInformeProvider>
}
