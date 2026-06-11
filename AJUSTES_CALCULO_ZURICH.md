# Ajustes al cálculo del Simulador Zurich (PASO 2)

> **Primera divergencia intencional del legacy.** Solo en rama `desarrollo`. El legacy
> `/plataforma` (`public/compensacion/compania-z/*`) **NO se toca**: estos cambios viven
> únicamente en el port React (`src/lib/simulador/calculo.ts` + `src/app/app/simulador/page.tsx`).
> Fuente: TPS + contrato Zurich. Fecha: 2026-06-11.

Hasta este paso, el port React era un calco numérico exacto del legacy (verificado 68/68,
ver `tools/comparacion-zurich/`). Este paso introduce las **primeras diferencias deliberadas**:
dos productos nuevos en el Mix, un campo de aporte nuevo, y una corrección de cálculo en el
aporte de Renta Preferente.

---

## A1 — APV Flexible como PRODUCTO del Mix (nuevo)

**Qué cambió:** se agregó `APVF` a `SIM_PRODS` (antes solo existía como *traspaso* en la sección Aportes).

| Atributo | Valor | Fuente |
|---|---|---|
| id / nombre | `APVF` / "APV Flexible" | id `APVF` para que `ENDOSO_Z` y `CAMP_PRODS` existentes le apliquen solos |
| Factor AE | **0.25 flat** sobre PPA (prima × 12) | contrato |
| Comisión venta mes 1 | `cUF` **0.08** (UF fijas por póliza, como APV) | contrato ⚠️ ver pregunta (i) |
| Incentivo mantención | **ninguno** | contrato |
| qty / prima default | 0 / 0 | TPS |
| pMax | 2000000 (el de APV) | **solo límite de formulario (UI)** — ver nota pMax |
| Campaña | vía `CAMP_PRODS['APVF']` existente (z 0.50, tope 600, capUF 500) | sin tratamiento nuevo |

**Ejemplo validado (TPS):** prima 2 UF → PPA 24 → **6 AE** (24 × 0.25).

**Nota:** el campo de **traspaso** APV Flexible de la sección Aportes (`apvFlexEx`) **se mantiene
tal cual** (factor variable por endoso, decisión P2). Coexisten el producto del Mix "APV Flexible"
y el aporte "APV AE Flexible — Traspaso cartera"; son dos cosas distintas que comparten la clave
de endoso `APVF`.

---

## A2 — Renta Preferente como PRODUCTO del Mix (nuevo)

**Qué cambió:** se agregó `RP` a `SIM_PRODS`.

| Atributo | Valor | Fuente |
|---|---|---|
| id / nombre | `RP` / "Renta Preferente" | — |
| Factor AE | **NO flat**: sigue `ENDOSO_Z['RP']` por columna de endoso → **≥3 pól 0.50 · 2 pól 0.50 · 0-1 pól 0.25** | contrato |
| Comisión venta | `c` **0.24** (24% sobre prima) | contrato |
| Incentivo mantención | **ninguno** | contrato |
| qty / prima default | 0 / 0 | TPS |
| pMax | 2000000 | solo límite de UI |
| Campaña | vía `CAMP_PRODS['RP']` existente (z 0.50, tope 300) | — |

**Implementación:** se agregó el atributo `zEndoso` a `ProdVida`. Cuando un producto tiene
`zEndoso` (RP → `'RP'`), su factor base = `ENDOSO_Z[zEndoso][endosoCol]` en vez del `z` fijo.
El `z: 0.50` del objeto RP es solo placeholder (no se usa en el cálculo).

---

## A3 — Aporte Renta Preferente (campo existente en Aportes): corregir cálculo y etiqueta

**Qué cambió (divergencia intencional del legacy):**
- AE pasa de **variable por endoso** a **FIJO = 5% del aporte** (decisión P4).
  - PPA = 10% del aporte; AE = PPA × 0.5 = 5% del aporte.
- La etiqueta del input ahora muestra **PPA (10%) y AE (5%)** (antes solo "AE: 5% del monto",
  que ya era 5% en la etiqueta pero el cálculo usaba el factor de endoso → inconsistencia que
  este ajuste resuelve).

**Ejemplo validado (TPS):** 500 UF → PPA 50 · **AE 25** (500 × 0.05).

**Divergencia vs legacy (por diseño):** el legacy calculaba `AE = (aporte × 0.10) × ENDOSO_Z['RP'][endosoCol]`.
- Con ≥3 o 2 pólizas (factor 0.50): `aporte × 0.10 × 0.50 = aporte × 0.05` → **coincide** con el nuevo.
- Con 0-1 pólizas (factor 0.25): legacy `aporte × 0.025` vs nuevo `aporte × 0.05` → **diverge por `aporte × 0.025`**.

---

## A4 — NUEVO campo en Aportes: Aporte extraordinario Business Life

**Qué cambió:** se agregó el estado `blEx` y un input en la sección Aportes.

| Atributo | Valor |
|---|---|
| PPA | 10% del aporte |
| AE | PPA × `ENDOSO_Z['BL'][endosoCol]` → **≥3 pól 0.80 · 2 pól 0.60 · 0-1 pól 0.50** |
| Comisión / incentivo | ninguno |
| Default | 0 |

**Ejemplo validado (TPS):** aporte 100 UF con 3+ pólizas → PPA 10 → **8 AE** (10 × 0.80).

---

## Mecánica transversal (P5)

Los productos nuevos `APVF` y `RP` **cuentan como pólizas** para el umbral de endoso. Como el
factor del producto `RP` depende de la columna de endoso, `endosoCol` se calcula **ANTES** del
loop de productos, como la suma de `qty` de **TODOS** los `SIM_PRODS` (incluidos los nuevos).
Ese valor es **idéntico** al cálculo post-loop original (que sumaba las mismas qty). El quirk
legacy del traspaso APVF (`apvFlexEx` suma +1 póliza **después** de fijar `endosoCol`) se
mantiene intacto y no afecta a `endosoCol`.

---

## Decisiones de UI (TPS, PASO 2)

- **Factor AE variable (RP producto y aporte A4):** **no se muestra** el factor en la UI del
  input/fila (la fila de RP en el Mix omite el "Factor AE: …%"; el aporte BL muestra solo el PPA).
  El factor realizado sigue apareciendo en la **tabla de desglose del mix** (columna derivada de
  `zTotal/ppaUF`), igual que para todos los aportes — esa columna es el resultado exacto, no una
  estimación.
- **Pill de campaña:** los dos productos nuevos (APV Flexible, Renta Preferente) **no llevan** pill
  de campaña (solo APV conserva su "campaña 100%").

## Notas / mismatches registrados

- **pMax NO cableado al input en React:** el `<input>` de prima usa `max={9999}` hardcodeado;
  `pMax` (2000000) es solo dato del producto, no el tope real del formulario. Paridad de dato,
  no de UI.
- **Coexistencia de nombres:** "Renta Preferente" aparece como producto del Mix (A2) y como aporte
  (A3, etiqueta "— Aporte extraordinario"); "APV Flexible" como producto (A1) y como traspaso
  ("APV AE Flexible — Traspaso cartera"). Es lo que define la spec.
- En la tabla de desglose, el aporte RP figura como **"Renta Preferente (aporte)"** para
  distinguirlo del producto RP del Mix.

---

## Preguntas abiertas

- **(i) Comisión APVF 0.08 vs 0.04:** según la versión del contrato, la comisión de venta de APV
  Flexible podría ser 0.04 en vez de 0.08. Implementado **0.08** (paralelo a APV) — **confirmar
  con el contrato vigente**.
- **(ii) Producto `PM` ("Vida Mujer"):** existe en la suite golden/spec pero no en el simulador
  (legacy ni React). **Referencia cruzada** a la deuda ya registrada en `DISENO_CONSOLIDACION.md`
  ("Producto `PM` … en la suite golden pero NO en el simulador"). Pendiente confirmar con contrato
  si debe incorporarse.

---

## Verificación

1. **Batería legacy↔React de 68 casos** (`tools/comparacion-zurich/comparar.mjs`): los casos sin
   `rpMonto` y sin tocar lo ajustado siguen idénticos; los casos con `rpMonto>0` divergen del
   legacy **por diseño** (A3) exactamente en `aporte × (0.05 − 0.10 × ENDOSO_Z['RP'][endosoCol])`.
2. **Asserts de los ajustes** (`tools/comparacion-zurich/verificar-ajustes.mjs`): los 3 ejemplos
   validados de TPS (A1, A3, A4) + casos de borde (RP producto con 0-1 vs ≥3 pólizas; APVF producto
   en campaña con cap 500 / factor 0.50) + cuantificación de la divergencia A3 caso a caso.
3. TPS valida además **visualmente** en el simulador.
