# LOGIN ZURICH — Alta completada (12-Jun-2026)
> Los 11 usuarios Zurich (10 asesores + Alejandra Espinoza Morral, supervisora) ya pueden entrar a /app vía /app/informe (login inline por email). Validado end-to-end en producción: login → JWT → resolución por email en persona (proxis_dev) → datos propios.

## Cómo quedó
- Credenciales en vina_credentials (proyecto Viña): 11 filas, empresa='zurich', hash bcrypt, activo=true. Consorcio intacto (7 filas).
- persona (proxis_dev): 11 emails reales poblados (antes null). 23 emails únicos en toda la tabla, sin colisiones.
- Validación en vivo: Diego Pérez (asesor) ve su informe con datos reales; gate C1.2 lo expulsa de las rutas Consorcio. Alejandra (supervisora) entra y resuelve bien.

## Deudas registradas en este frente
- D-LZ1: las credenciales Zurich nacen en Viña (vina_credentials) porque el login actual solo lee ahí. Conmutan a proxis_dev en Fase 3 junto con el login.
- D-LZ2 (cosmético): el JWT de todo usuario emite empresa='consorcio' (constante EMPRESA_VINA hardcodeada). Sin efecto: la identidad se resuelve por email, que ignora ese campo. Corregir al conmutar el login (Fase 3).
- D-LZ3 (routing): el gate C1.2 filtra por rol pero NO por tenant → una supervisora Zurich puede abrir /app/simulador-consorcio y el cascarón de /app/tracker-consorcio. SIN fuga de datos (verificado en vivo: los endpoints devuelven la negativa server-side por institucion_id y no muestra nada del equipo Consorcio). Cerrar agregando gate por tenant, junto con el resto de C1-Zurich (header/links por institución), ANTES de dar login a más supervisores.
- D-LZ4: el informe de una supervisora carga vacío (la pantalla es de asesor). La vista útil de Alejandra requiere un tracker Zurich en /app (no portado aún; solo existe el de Consorcio).
- Pendiente operativo: entrega de credenciales a los 11 por canal seguro del equipo. Las claves NO están en ningún archivo ni repo (solo hashes en BD).
