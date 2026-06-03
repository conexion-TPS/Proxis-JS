# Consorcio — datos recopilados (parcial) para su módulo de compensación

**Fuente:** notas de voz (WhatsApp) + 2 tablas "Sueldo Mes 6/12 — Factor 8" (JPEG, 2026-06-03).
**Estado:** PARCIAL. Falta data clave (ver §4). No alcanza para una spec completa todavía.

> Consorcio NO encaja en el esquema de spec de Zurich (productos × factores × tramos).
> Es un modelo **tabular por APE + componentes, dependiente de antigüedad**. Requiere
> extender el esquema (nuevo tipo de spec) o un módulo programable. El motor/embudo del
> núcleo no cambian.

## 1. Conceptos base
- Unidad: **APE** = prima básica anualizada = **"puntos consorcio" (CNS)**.
- Referencia: `50 CNS = 50 APE ≈ 1 póliza de vida de 4 UF`.
- **Vida se paga al 100% en todos los productos** (sin factores diferenciados tipo Zurich).
- **Base + Gratificación fija: $729.000** (Zurich era $539.000).
- Óptimo declarado: **100–120 APE/mes → sueldos de $3.000.000+**.

## 2. Componentes del sueldo (de las tablas, "Factor 8")
Por nivel de producción (CNS). Dos cortes de antigüedad: **Mes 6** y **Mes 12**.

| Componente | 50 CNS | 100 CNS | 150 CNS | 200 CNS | 300 CNS |
|---|---|---|---|---|---|
| Base+Gratificación (fijo) | 729.000 | 729.000 | 729.000 | 729.000 | 729.000 |
| Comisión Ventas | 20.000 | 455.000 | 915.000 | 1.300.000 | 1.950.000 |
| Bono Excelencia | 0 | 125.000 | 437.500 | 600.000 | 600.000 |
| Recaudación — **Mes 12** | 164.176 | 364.835 | 656.703 | 948.571 | 1.422.857 |
| Recaudación — **Mes 6** | 82.088 | 182.418 | 328.352 | 474.286 | 711.428 |
| AUM (=salud) — **Mes 12** | 15.396 | 30.792 | 46.187 | 61.583 | 92.375 |
| AUM (=salud) — **Mes 6** | 7.698 | 15.396 | 23.094 | 30.792 | 46.187 |
| **TOTAL (Factor 8) Mes 12** | 928.572 | 1.704.627 | 2.784.391 | 3.639.154 | 4.794.232 |
| **FACTOR 10 — Mes 12** | 949.207 | 2.111.831 | 3.373.121 | 4.054.494 | 5.417.242 |
| **TOTAL (Factor 8) Mes 6** | 838.786 | 1.506.813 | 2.432.945 | 3.134.077 | 4.036.616 |
| **FACTOR 10 — Mes 6** | 851.604 | 1.876.665 | 2.960.435 | 3.504.247 | 4.591.871 |

Observaciones:
- **Recaudación y AUM(salud) escalan con antigüedad**: Mes 12 = exactamente **2×** Mes 6.
- **Factor (8 vs 10)** = multiplicador de desempeño que sube el total (efecto mayor en CNS altos).

## 3. Estructura de pago (de las notas de voz)
- **12 ítems de pago.** Familias:
  - **Vida** (al 100%).
  - **Inversiones** (aportes al bebé, ahorro flexible, fondos mutuos) — "vida inversiones", aparte.
  - **Multiproducto** = todo lo demás: auto, hogar, salud (complementario/catastrófico/oncológico),
    cuentas vista/corriente, tarjetas de crédito, crédito hipotecario, créditos de consumo.
    Comisiones **más altas** que vida.
- **Bonos trimestrales**: por vida, por producción de multiproducto, por venta de inversiones,
  por recaudación, por persistencia. Mejoran con antigüedad.
- **Colchón de comisiones**: empieza ~32% y baja a ~2X% con el tiempo (más alto que Zurich).
- **Persistencia**: penaliza pólizas anuladas/caducadas/rescatadas; las vigentes (ahorro/PV) suman.

## 4. LO QUE FALTA (para construir el módulo)
- 🔴 **Multiproducto**: tabla/fórmula de comisiones (no está en los JPEG).
- 🔴 **Factor 8/10**: qué lo determina y cómo se calcula.
- 🔴 **Conversión APE ↔ producto/prima** por línea (cómo una venta se vuelve CNS).
- 🔴 **Fórmulas de cada bono trimestral** (vida, multiproducto, inversiones, recaudación, persistencia).
- 🔴 **Tabla de Recaudación/AUM por antigüedad** completa (tenemos Mes 6 y Mes 12; falta la curva).
- 🟡 Una **liquidación real** ayudaría a calibrar (lo mencionaste).

## 5. Implicación de diseño
El esquema de spec debe crecer para soportar un modelo **"APE → componentes (tabla por nivel
× antigüedad) × factor"**. Es interpolable desde las tablas. Cuando llegue la data faltante,
se arma como **datos** (spec tabular) o, si la lógica de bonos es muy particular, como módulo
programable que implementa el mismo contrato (entrada: escenario; salida: ingreso + proyección).
