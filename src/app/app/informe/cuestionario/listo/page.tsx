import { CuestionarioInformeProvider } from '../_provider'
import { CuestionarioListo } from '@conexion-tps/cuestionario-core'

export default function Page() {
  return <CuestionarioInformeProvider><CuestionarioListo /></CuestionarioInformeProvider>
}
