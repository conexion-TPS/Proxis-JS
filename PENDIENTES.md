# Pendientes — decisiones diferidas

## Motor de compensación Zurich (de AUDITORIA_COMPENSACION.md)
1. Mecánica "mayor valor" campaña vs contrato: hoy es toggle excluyente (renta.js:206/289), el contrato exige Math.max(contrato, campaña). DECISIÓN PENDIENTE: ¿corregir o el contrato dice otra cosa?
2. Tope por antigüedad: el código lo aplica solo al exceso sobre 200 (renta.js:191-194), el contrato sugiere cap del total. Divergen en alta producción. PENDIENTE revisar contrato.
3. Campañas hardcodeadas sin fechas de vigencia: el sistema no vuelve solo a Capa 1.
4. Tabla de comisión: está la "original" 32%, no la "NUEVO" 4%/0,8%. PENDIENTE confirmar vigencia con negocio (Alejandra/RRHH).
5. ENDOSO_Z (datos.js:62-68): tabla sin fuente documental. PENDIENTE confirmar origen.
6. Piezas del contrato no implementadas: gate persistencia ≥85% Top 20, comisión 24% Renta Preferente, Ahorro Universitario en campaña.
7. Nomenclatura: "SS" (factor 0.50) ¿es SAFE? Aclarar.
8. Primas semilla en UF (datos.js:101-103): se fijan con UF de referencia y fetchUF() no las recalcula.

## Bitácora Consorcio Viña (Opción B — proyecto propio sgu-vina-prospección, piloto en /vina)
Contexto: Viña vive en su PROPIO proyecto Supabase (sgu-vina-prospección), totalmente separado de Zurich (proxis-dev) y del proyecto de la app (B). Login DB (bcrypt+JWT) contra vina_credentials. Acceso solo vía API routes con service-role; RLS cerrado. La columna `empresa` queda en 'vina' (residual, por no cambiar el código).
1. Requiere env vars en Vercel + local: VINA_SUPABASE_URL y VINA_SUPABASE_SERVICE_KEY (de sgu-vina-prospección). Sin ellas, /api/vina/* lanza error. PENDIENTE confirmarlas seteadas en prod.
2. Aislamiento por nombre: reportes/contactos/metas keyed por `asesor` (texto). Dentro del proyecto Viña no colisiona con Zurich (proyectos distintos), pero PENDIENTE migrar a un id estable de asesor (no nombre) si crece el equipo.
3. Panel de supervisor Viña: no existe (solo la bitácora del asesor). PENDIENTE construir vista de supervisor para sgu-vina-prospección.
4. Funciones de bitácora no portadas al piloto: detección/gestión de Nodos (nodos/activaciones_nodo), simulador de metas e indicadores/"Mi informe". El piloto cubre semanas + contactos + confirmar. PENDIENTE si se requieren.
5. Unificación futura: hoy hay TRES proyectos Supabase (proxis-dev/Zurich, B/app-server con org+asesor_credentials, sgu-vina-prospección/Viña). PENDIENTE decidir consolidación de identidad/datos si se multiplican empresas.
6. Migrar login de Zurich a DB: Zurich sigue con la lista hardcodeada USUARIOS en plataforma-core.js. PENDIENTE.
