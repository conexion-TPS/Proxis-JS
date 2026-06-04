# Proxis — Contexto de negocio (fuente verificable)

> **Qué es este documento y qué NO es.**
> Esto es la **vara de medir**, no la documentación del código. Contiene únicamente reglas extraídas de los **documentos fuente** del proyecto (contrato, tablas de campaña, comprobantes de pago reales). Cada regla está marcada con su origen.
>
> **Regla de oro para Claude Code:** este documento dice lo que el sistema de compensación *debería* hacer según los documentos originales. NO dice cómo está implementado hoy en el código. Tu trabajo es leer la implementación real del repo y **contrastarla** contra estas reglas para detectar desviaciones. Si el código y este documento difieren, no asumas cuál tiene razón: repórtalo para que un humano decida.
>
> Lo que NO está aquí (porque no tiene fuente verificable y debe levantarse del código vivo): cómo el simulador implementa los factores hoy, qué tramos están efectivamente programados, cómo el motor de IA genera mensajes, el esquema actual de Supabase.

---

## 0. Por qué el renombre a "AE"

El sistema de compensación que modela Proxis es el de **Zurich Chile Seguros de Vida S.A.** (contrato de Agente de Ventas / Asesor Ejecutivo). En el material comercial y en la plataforma se **despersonalizó la fuente**: lo que en los documentos Zurich se llama **"Z Puntos"** se renombró a **"AE"** (y términos asociados se neutralizaron) para no exponer explícitamente que los datos provienen de Zurich.

Implicación para el código: **"AE" y "Z Puntos" son el mismo concepto.** Cualquier lógica de cálculo basada en "puntos AE" se valida contra las reglas de "Z Puntos" de este documento. El renombre es de presentación, no de mecánica.

Implicación para multi-tenant: el hecho de que ya se haya despersonalizado a "AE" es la primera señal de que el motor de compensación **debe ser parametrizable**, no clavado a Zurich. La nueva empresa tendrá su propia nomenclatura, sus propios factores y sus propios topes.

---

## 1. El sistema tiene dos capas que se superponen

Esta es la idea central que cualquier implementación debe respetar. No son dos sistemas separados: la campaña **interviene parámetros específicos** del cálculo contractual y deja el resto intacto.

- **Capa 1 — Contrato (permanente):** define el motor de cálculo completo.
- **Capa 2 — Campaña (transitoria):** hace un *override* temporal de unos pocos parámetros y se evalúa **en paralelo**, pagando el mayor de los dos resultados.

> **Fuente del marco legal de la superposición:** Contrato, cláusula III ("Campañas de Venta") autoriza explícitamente "un sistema de renta variable extraordinario y transitorio" pactado por períodos determinados. Cláusula OCTAVA reserva a la compañía el derecho de "modificar periódicamente los montos, porcentajes y/o duración de los incentivos y bonos". Esa es la base que permite la campaña sin renegociar el contrato.

---

## 2. CAPA 1 — Componentes del contrato

> **Fuente de toda esta sección:** `contrato_vida__asesores_ejecutivos_Contrato_original_tope_300z_hasta_6_meses_.pdf` (texto indexado del contrato).

### 2.1 Sueldo base
Fijo mensual, pagado el **día 26** de cada mes (o hábil anterior). Base para gratificación legal.

> Fuente: cláusula SÉPTIMA (Pago de remuneración).

### 2.2 Comisión de venta (mes 1) e Incentivo de mantención (mes 2+)
Ambos se calculan sobre la **prima básica mensual de fallecimiento contra pago de la prima proyectada mensual**. Tasas por producto (verificar contra implementación):

| Producto | Comisión venta (mes 1) | Incentivo mantención |
|---|---|---|
| Business Life / ProMujer / BL Flex | 32% prima básica | 32% (meses 2–12) → 6% (13–24) → 3,6% (25–120) |
| Business Life "NUEVO" (tabla nueva) | 4% prima básica | 4% (2–12) → 0,8% (13–120) |
| Temporales | 16% prima mensual | 2,4% (2–60), **tope UF 10/mes** |
| Accidentes Personales | 8% | 8% |
| Seguro de Salud | 8% | 8% |
| APV / APV Flex | UF fija (0,04 / 0,08) | — |
| Futuro Presente | 0,8% prima proyectada | 0,8% (2–96) |
| Renta Preferente | 24% sobre remuneración variable de fondos mutuos | — |

> **Advertencia:** el contrato contiene DOS juegos de tablas (una "original" con 32% y otra "NUEVO" con 4%/0,8%). Esto suele indicar una transición de condiciones. Claude Code debe verificar **cuál de las dos** está implementada y si corresponde a la vigente. No asumir.

### 2.3 Bono de producción — el motor central
Embudo de cuatro pasos:

1. **Prima proyectada anual** de cada producto (la prima anualizada). Aportes extraordinarios (iniciales, traspasos APV, esporádicos) se convierten a prima proyectada al **10% del monto del aporte**.
2. **Ponderación por factor Z** → da los **Z Puntos** (= "AE"). Factores:

   | Factor Z | Productos |
   |---|---|
   | 200% | Business Life, ProMujer |
   | 100% | Futuro Presente, Temporal, AP — y en Generales (GI): Hogar |
   | 50% | APV, BL Flex, SAFE, Renta Preferente — y en GI: Auto |
   | 25% | APV Flex |

   > Productos no individualizados en la tabla **NO generan Z Puntos**.

3. **Conversión Z Puntos → UF por tramos progresivos** (cascada, cada tramo a su %):

   | Tramo Z Puntos | % de conversión |
   |---|---|
   | 0 – 49,99 | 10% |
   | 50 – 99,99 | 12% |
   | 100 – 149,99 | 15% |
   | 150 – 200 | 18% |
   | 200,01 – tope según permanencia | 10% |

4. **Multiplicación por factor de persistencia** (ver 2.4).

> Fuente: contrato, sección "d) BONO DE PRODUCCIÓN" y "Definición Z puntos"; diagrama "Bono Producción + Persistencia"; comprobantes reales `PAGO_Z_PUNTOS_MAS__SEGUROS_GENERALES_1.pdf` y `NUEVO_BONO_PRODUCCION_1.pdf`.

### 2.4 Factor de persistencia
La persistencia real se compara contra la persistencia **mínima exigida según antigüedad**, y de ahí sale un factor que multiplica el bono en UF.

Persistencia mínima por antigüedad:
| Antigüedad | Persistencia mínima |
|---|---|
| Meses 1–12 | 90% |
| Meses 13–24 | 82% |
| Mes 25+ | 78% |

Factor por cumplimiento de persistencia:
| Cumplimiento (real / mínima) | % del bono |
|---|---|
| 0,0% – 50,0% | 0% |
| 50,1% – 85,0% | 50% |
| 85,1% – 90,0% | 65% |
| 90,1% – 95,0% | 90% |
| 95,1% – 100,0% | 100% |
| 100,1% – 120,0% | 120% (solo desde mes 13) |

> Fuente: contrato, tabla "Factor por cumplimiento de Persistencia". Confirmado en comprobantes reales (ej.: persistencia objetivo 82%, real 87,5% → cumplimiento 106,8% → factor 1,2).
>
> Rescates parciales/totales y pagos directos sin cobro automático **cuentan** en el cálculo de persistencia. Pólizas siniestradas **no** cuentan.

### 2.5 Topes estructurales (los que la campaña modifica)
- **Tope de Z Puntos por antigüedad** (contrato original): meses 1–6 = **300Z**; 7–23 = 700Z; escalando hasta 1.200Z desde mes 120.
  > El simulador standalone declara una escala más granular en su disclaimer: 1–6m=300Z · 7–23m=700Z · 24–47m=800Z · 48–71m=900Z · 72–95m=1.000Z · 96–119m=1.100Z · 120m+=1.200Z. **Verificar cuál escala está vigente.**
- **Tope de Z Puntos GI** (Generales): máximo **25% de los Z Puntos VI**, solo por venta a clientes nuevos (no cartera vigente).

### 2.6 Bonos Top 20 (rankings)
Premios mensuales en UF por ranking, condicionados a persistencia ≥ 85% del target:
- **Top 20 APE:** escala UF/mes [23,18,13,11,9,7,6,6,4,4,3,3,3,2,2,2,1,1,1,1].
- **Top 20 Crecimiento de valor póliza:** requiere incremento ≥ UF 750 de saldo de cartera respecto al mes anterior. Escala UF/mes [11,8,8,8,5,5,5,2,2,2,1,1,1,1,1,1,1,1,1,1]. No considera aportes a pólizas con tasa garantizada.

> Fuente: contrato, secciones "BONO TOP 20" + arreglos `TOP20_APE_UF` / `TOP20_CV_UF` ya presentes en el código del simulador.

### 2.7 Rendimiento mínimo contractual
Mínimo mensual: 2 pólizas de Vida Individual que sumen **115 Z Puntos**. Trimestral: 6 pólizas que sumen **345 Z Puntos**.

> Fuente: contrato, cláusula 12 "Rendimiento Mínimo".

### 2.8 Situaciones especiales (Roll-Over)
Ciertas ventas (cliente con póliza no vigente <12 meses, póliza del propio agente o familiar, misma familia de productos con póliza vigente, rescates recientes) **no generan Z Puntos** ni premios/bonos, pero sí pagan comisión bajo una tabla diferenciada. Los traspasos solo cuentan si vienen de **otras compañías**, no entre productos de la misma.

> Fuente: contrato, sección "f) COMISIONES E INCENTIVOS DE MANTENCIÓN PARA SITUACIONES ESPECIALES (Roll_Over)" y la tabla de 9 familias de productos.

---

## 3. CAPA 2 — La campaña (override transitorio)

**"Campaña Complemento de Producción Emitida"** — vigencia declarada: gestión **enero 2026 (pago febrero) hasta marzo 2026 (pago abril)**.

> Fuente: `Campaña_Complemento_Produccion_Emitida.jpeg` (TABLA 1 y TABLA 2) + entrevista con Alejandra.

La campaña **NO reemplaza el bono de producción.** Modifica exactamente tres cosas y deja el resto del motor igual:

1. **Elimina** el tope de Z Puntos GI atado al 25% de los Z de Vida (transitoriamente).
2. **Reemplaza los topes por antigüedad** (TABLA 1, "tope Z Puntos emitidos"):
   | Antigüedad | Tope campaña |
   |---|---|
   | 1–6 meses | 1.000 Z |
   | 7–12 meses | 1.500 Z |
   | 13–24 meses | 2.000 Z |
   | 25+ meses | SIN TOPE |
   > Este es el corazón de lo que explica Alejandra: un asesor nuevo que en el contrato toparía en 300Z (~$1,5M) bajo campaña llega a 1.000Z (~$4M+).
3. **Cambia ponderadores y agrega topes por póliza** (TABLA 2):
   | Cód. | Producto | Ponderación campaña | Tope Z/póliza |
   |---|---|---|---|
   | 557 | Seguro Salud | 100% | sin tope |
   | 552 | Zurich APV | 100% solo sobre UF 500 capital | 600 Z |
   | 558 | Accidentes Personales | 100% | sin tope |
   | 555/556 | Temporales | 100% | sin tope |
   | 562 | Ahorro Universitario | 100% | sin tope |
   | 550 | Business Life | 100% | 300 Z |
   | 551 | ProMujer | 100% | 300 Z |
   | 560 | Seguro APV Flex | 50% solo sobre UF 500 capital | 600 Z |
   | 561 | Seguro BL Flex | 50% | 300 Z |
   | 554 | Renta Preferente | 50% | 300 Z |

### 3.1 Mecánica "mayor valor" (CRÍTICA)
La campaña calcula los Z Puntos emitidos bajo SUS reglas y los compara con el cálculo Z Puntos normal del contrato. **Se paga el mayor de los dos.** Por eso *complementa* y no sustituye.

> Cita textual del criterio (campaña): "tomando el mayor valor entregado en el cálculo final de campaña vs Zpuntos".

### 3.2 Requisito de entrada a la campaña
Mix mínimo **1×1×1**: (CUI o APV o Temporal) + GI + (PL u ONCO). En el mes 1 se puede reemplazar la póliza GI por Vida o PL u ONCO.

### 3.3 Otras campañas presentes en el proyecto
Hay PDFs de campañas adicionales que deben revisarse por separado y que también modifican el cálculo base con notas de vigencia propias:
- `NUEVO_BONO_PRODUCCION_1.pdf` — campaña de liberación de tope (gestión ago–dic 2025, pago sep 2025–ene 2026).
- `Bono_produccion_persistencia.pdf`, `Concurso.pdf`, `PAGO_Z_PUNTOS_MAS__SEGUROS_GENERALES_1.pdf`, `Comision202603.pdf`.

> **Patrón a internalizar:** cada campaña trae su propia nota al pie de vigencia. El motor debe tratar las campañas como **registros con fecha de inicio/fin** y reglas de override, no como código fijo. Cuando una campaña vence, el sistema vuelve solo a la Capa 1.

---

## 4. La capa de prospección (Precision Selling / embudo inverso)

El simulador no calcula solo el bono: traduce una **meta de ingresos** en **actividad de prospección necesaria** mediante un embudo inverso.

Lógica (del Marco Referencial de Cálculo):
- Comisión por venta = prima promedio × tasa de comisión (ej. $1.500.000 × 30% = $450.000).
- Ventas necesarias = meta de ingresos / comisión por venta (redondeo hacia arriba).
- Contactos = ventas × ratio de cierre (~1:6).
- Prospectos = contactos × ratio de prospección (~1:5).

Tasas de cierre de referencia (Granum · LIMRA · MDRT · Finseca · NAIFA), por origen del prospecto:
| Origen | Tasa cierre | Prospectos/venta |
|---|---|---|
| Frío (sin referido) | 10–15% | 7–10 |
| Referido (nombre dado) | 25–30% | 3–4 |
| Referido con presentación del nodo | 40–50% | 2–3 |
| Transferencia en vivo (nodo presenta) | 55–70% | 1–2 |

**Sistema de Nodos:** un contacto se convierte en **nodo** cuando refiere prospectos por **segunda vez**. 1 nodo activo genera en promedio ~5 prospectos referidos. Los nodos son el activo central del lado asesor.

> Fuente: `Marco_Referencial_de_Calculo.docx`, `Proporciones_y_Flujo...docx`, `Ratios_Venta_Seguro_Vida_Industria.docx`, y el código del simulador (`SIM_METODOS`, tasas de cierre).

---

## 5. Las dos mitades de Proxis (contexto de producto)

- **Lado SUPERVISOR:** simulador (con datos AE despersonalizados) + tracker para monitorear asesores (contactos, prospectos, gaps, nodos, correlación actividad→ingresos).
- **Lado ASESOR:** Bitácora semanal (registro de contactos: nombre, vínculo, llamada, reunión, prospectos obtenidos; meta ≥5 prospectos/contacto) + visor de actividad / "Mi informe".

**Persona clave:** Alejandra Espinoza — SGU (supervisora) en Zurich Chile, ~8 asesores + nuevos ingresos. Necesidad declarada: gestionar al equipo con eficiencia sin perder tiempo en administración.

**Motor de IA (perfiles conductuales D/R/S):** existe un diseño de personalización de la voz del sistema según estilo conductual del asesor (Directivo / Relacional / Sistemático), que se infiere del patrón de uso y refina con micro-assessments. Este diseño está documentado en chats previos pero **el motor real vive en un repo separado de Claude Code aún no conectado a Proxis** — su implementación debe levantarse de ese repo, no de aquí.

---

## 6. Checklist de contraste para Claude Code

Cuando tengas el mapa del código real, verifica una por una:

1. ¿"AE" en el código = Z Puntos con los factores de §2.3? ¿Los factores 200/100/50/25 están bien asignados por producto?
2. ¿La conversión a UF es **por tramos en cascada** (§2.3 paso 3) y no un % plano?
3. ¿El factor de persistencia usa las dos tablas de §2.4 (mínima por antigüedad + cumplimiento→%)?
4. ¿El 120% está restringido a mes 13+?
5. ¿Existe la mecánica **"mayor valor" campaña vs. contrato** (§3.1)? Si no existe, ¿se está pagando solo una de las dos capas?
6. ¿Las campañas están modeladas como **registros con vigencia** o están hardcodeadas? (define si el sistema puede volver solo a Capa 1 al vencer.)
7. ¿El tope GI 25% y los topes por antigüedad/póliza son **parámetros** o números fijos? (clave para multi-tenant.)
8. ¿Qué juego de tablas de comisión está vigente: la "original" (32%) o la "NUEVO" (4%/0,8%)? (§2.2)
9. ¿El embudo inverso de prospección usa las tasas de §4?

Donde el código difiera de estas reglas: **reportar, no corregir en silencio.** Puede ser un bug del código o una condición vigente que cambió y que este documento no refleja. Decide con un humano.
