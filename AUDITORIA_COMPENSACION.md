# Auditoría del motor de compensación vs. CONTEXTO_NEGOCIO.md

**Fecha:** 2026-06-02
**Auditor:** Claude Code (diagnóstico, sin modificar código)
**Vara de medir:** [CONTEXTO_NEGOCIO.md](CONTEXTO_NEGOCIO.md) (reglas extraídas del contrato Zurich y la campaña).
**Código auditado:** [public/compensacion/compania-z/datos.js](public/compensacion/compania-z/datos.js), [renta.js](public/compensacion/compania-z/renta.js), [perfil.js](public/compensacion/compania-z/perfil.js), [nodos.js](public/compensacion/compania-z/nodos.js) + [public/plataforma-core.js](public/plataforma-core.js) (UF/render).

> **Criterio (de la regla de oro del doc):** donde código y documento difieren, **no se asume cuál tiene razón**. Se reporta para decisión humana. Puede ser un bug del código o una condición vigente que el documento no refleja.

---

## Resumen ejecutivo

| # | Ítem checklist §6 | Veredicto |
|---|---|---|
| 1 | Factores AE = Z Puntos (200/100/50/25) | ⚠️ Coincide parcial — Salud y APV Flex con matices |
| 2 | Conversión a UF por tramos en cascada | ✅ Coincide |
| 3 | Persistencia: tabla mínima + cumplimiento→factor | ✅ Coincide |
| 4 | 120% restringido a mes 13+ | ✅ Coincide |
| 5 | Mecánica "mayor valor" campaña vs. contrato | ❌ **Difiere (crítico)** — toggle que reemplaza, no `Math.max` |
| 6 | Campañas como registros con vigencia | ❌ Difiere — hardcodeadas, sin fechas |
| 7 | Topes GI/antigüedad/póliza como parámetros | ❌ Difiere — números fijos en `datos.js` |
| 8 | Juego de tablas de comisión vigente (32% vs NUEVO) | ⚠️ Implementada la "original" (32%); verificar vigencia |
| 9 | Embudo inverso con tasas de §4 | ✅ Coincide (con granularidad extra) |

**Hallazgos adicionales fuera del checklist:** interpretación del tope por antigüedad (cap total vs. cap del tramo 5), tabla `ENDOSO_Z` no documentada, gates de Top 20 no aplicados, requisito de entrada a campaña distinto, y el bug de primas semilla en UF.

---

## Checklist §6 — punto por punto

### 1. Factores AE = Z Puntos, asignación 200/100/50/25

**REGLA** (§2.3, tabla de factores Z):
- 200%: Business Life, ProMujer
- 100%: Futuro Presente, Temporal, AP — y GI: Hogar
- 50%: APV, BL Flex, SAFE, Renta Preferente — y GI: Auto
- 25%: APV Flex
- *"Productos no individualizados en la tabla NO generan Z Puntos."*

**CÓDIGO** — [datos.js:14-31](public/compensacion/compania-z/datos.js#L14-L31):
- `BL` Vida Empresarial `z:2.00` ✓ · `PM` Vida Mujer `z:2.00` ✓
- `TP` Temporal `z:1.00` ✓ · `FP` "El Futuro es Hoy AE" `z:1.00` ✓ · `AP` `z:1.00` ✓
- `APV` `z:0.50` ✓ · `BLF` BL Flex `z:0.50` ✓
- `SS` Salud `z:0.50` ← **no figura en la tabla §2.3**
- GI: `AUTO z:0.50` ✓ · `HOGAR z:1.00` ✓
- APV Flex 25%: vía aporte `apvFlexEx` con `ENDOSO_Z['APVF']=[0.25,0.25,0.125]` ([datos.js:67](public/compensacion/compania-z/datos.js#L67), [renta.js:137-143](public/compensacion/compania-z/renta.js#L137-L143)) → 25% solo en columna "≥3 pólizas". ✓ parcial
- Renta Preferente 50%: vía aporte `rpMonto` con `ENDOSO_Z['RP']=[0.50,0.50,0.25]` ([datos.js:67](public/compensacion/compania-z/datos.js#L67), [renta.js:152-159](public/compensacion/compania-z/renta.js#L152-L159)). ✓ parcial

**VEREDICTO:** **Coincide parcialmente.**
- Los seis productos núcleo (BL, PM, TP, FP, AP, APV, BLF) y GI (Auto/Hogar) coinciden.
- ⚠️ **`SS` (Salud) declara `z:0.50`** pero Salud no aparece en la tabla de factores §2.3. La regla dice que un producto no listado **no genera Z Puntos**. Posible identidad con "SAFE" (listado a 50% en §2.3) — **no confirmable desde el doc**. Reportar para decisión.
- ⚠️ APV Flex (25%) y Renta Preferente (50%) **no son productos del mix** sino aportes/traspasos cuyo factor depende de la columna de endoso (≥3 / 2 / 0-1 pólizas NV), mecánica no descrita en §2.3 (ver Hallazgo A).

---

### 2. Conversión a UF por tramos en cascada

**REGLA** (§2.3 paso 3): tramos progresivos en cascada, cada tramo a su %:
0–49,99→10% · 50–99,99→12% · 100–149,99→15% · 150–200→18% · 200,01–tope→10%.

**CÓDIGO** — tabla [datos.js:51-57](public/compensacion/compania-z/datos.js#L51-L57):
```
{min:0,max:49.99,pct:.10} {min:50,max:99.99,pct:.12} {min:100,max:149.99,pct:.15}
{min:150,max:200,pct:.18} {min:200.01,max:9999,pct:.10}
```
Lógica de cascada en [renta.js:188-200](public/compensacion/compania-z/renta.js#L188-L200): por cada tramo `ap=Math.min(z,t.max)-t.min` (aplicación marginal), `uf+=ap*t.pct`. Tramo 5 (`min>=200`) tratado aparte sobre el `exceso=z-200`.

**VEREDICTO:** ✅ **Coincide.** Tramos, porcentajes y mecánica marginal en cascada idénticos. El tramo sobre 200 está al 10%.

---

### 3. Factor de persistencia (dos tablas)

**REGLA** (§2.4):
- Mínima por antigüedad: 1–12m=90% · 13–24m=82% · 25m+=78%.
- Cumplimiento (real/mínima)→factor: ≤50%→0 · 50,1–85%→0,5 · 85,1–90%→0,65 · 90,1–95%→0,9 · 95,1–100%→1,0 · 100,1–120%→1,2.

**CÓDIGO:**
- [datos.js:86](public/compensacion/compania-z/datos.js#L86): `PMIN=a=>a<=12?.90:a<=24?.82:.78` ✓
- [datos.js:88](public/compensacion/compania-z/datos.js#L88): `FP=(r,m,ant)=>{const c=r/m; if(c<=.5)return 0; if(c<=.85)return .5; if(c<=.9)return .65; if(c<=.95)return .9; if(c<=1)return 1; return ant>12?1.2:1.0}` ✓

**VEREDICTO:** ✅ **Coincide.** Ambas tablas reproducidas con exactitud.
- Nota menor: para cumplimiento **>120%** el código sigue devolviendo `1.2` (no hay corte superior en 120%). Es un tope implícito, coherente con la intención; señalado solo por completitud.

---

### 4. 120% restringido a mes 13+

**REGLA** (§2.4): el factor 120% aplica "solo desde mes 13".

**CÓDIGO** — [datos.js:88](public/compensacion/compania-z/datos.js#L88): la rama final `return ant>12?1.2:1.0` entrega 1,2 únicamente si `ant>12`; en mes ≤12 con sobrecumplimiento devuelve `1.0` (cap al 100%).

**VEREDICTO:** ✅ **Coincide.**

---

### 5. Mecánica "mayor valor" campaña vs. contrato (CRÍTICA)

**REGLA** (§3.1): la campaña calcula los Z Puntos bajo SUS reglas y los compara con el cálculo del contrato; **se paga el mayor de los dos** (cita: *"tomando el mayor valor entregado en el cálculo final de campaña vs Zpuntos"*). La campaña **complementa**, no sustituye.

**CÓDIGO:** el cálculo se controla con un **toggle booleano** `campana` ([renta.js:206](public/compensacion/compania-z/renta.js#L206), `perfil.js` `campana-toggle`). `simCalcZ(campana)` ([renta.js:90](public/compensacion/compania-z/renta.js#L90)) usa **o bien** los factores de campaña `CAMP_PRODS` **o bien** los del contrato `p.z` — nunca ambos. No existe ningún `Math.max` entre dos resultados. El propio título lo declara: *"Campaña … (reemplaza contrato)"* ([renta.js:289](public/compensacion/compania-z/renta.js#L289)).

**VEREDICTO:** ❌ **Difiere — desviación crítica.** El sistema **sustituye** (campaña O contrato según el switch) en lugar de **evaluar ambos y pagar el mayor**. Esto puede:
- Sub-pagar a un asesor cuyo cálculo de contrato superaría al de campaña (la campaña activa "tapa" el contrato).
- O sobre-pagar respecto del contrato si la campaña se deja activada fuera de un escenario donde el contrato rendiría más.
Reportado como desviación de diseño para decisión humana.

---

### 6. Campañas modeladas como registros con vigencia

**REGLA** (§3.3): cada campaña trae su propia nota de vigencia (inicio/fin). El motor debe tratarlas como **registros con fecha y reglas de override**, de modo que al vencer el sistema vuelva solo a Capa 1.

**CÓDIGO:** `CAMP_PRODS` ([datos.js:70-80](public/compensacion/compania-z/datos.js#L70-L80)) y `TOPES_CAMP` ([datos.js:59](public/compensacion/compania-z/datos.js#L59)) están **hardcodeados**. No hay fechas de vigencia (la campaña §3 declara ene–mar 2026, pago feb–abr 2026; eso no aparece en el código). La activación es un checkbox manual, no una condición temporal.

**VEREDICTO:** ❌ **Difiere.** Las campañas son código fijo, no registros con vigencia. El sistema **no** vuelve solo a Capa 1 al vencer la campaña; depende de que alguien apague el toggle.

---

### 7. Topes (GI 25% / antigüedad / póliza) como parámetros

**REGLA** (§2.5, §3, checklist 7): clave para multi-tenant — los topes deberían ser **parámetros** (no números fijos).

**CÓDIGO — valores (verificación de corrección):**
- **Tope GI 25%** — [renta.js:170](public/compensacion/compania-z/renta.js#L170): `const topeGI=campana?Infinity:zVI*0.25; const zGI=Math.min(zGIBruto,topeGI)`. Base 25% de Z VI ✓; en campaña liberado ✓ (§2.5 + §3 item 1).
- **Topes por antigüedad contrato** `TOPES_ORIG` — [datos.js:58](public/compensacion/compania-z/datos.js#L58): `[[6,300],[23,700],[47,800],[71,900],[95,1000],[119,1100],[999,1200]]` → escala granular 1–6=300 · 7–23=700 · 24–47=800 · 48–71=900 · 72–95=1.000 · 96–119=1.100 · 120+=1.200. Coincide con la **escala granular del disclaimer** que §2.5 marca como *"verificar cuál escala está vigente"* (la versión "gruesa" del contrato sería 300→700→…→1.200 desde mes 120). ⚠️ **Verificar cuál es la vigente.**
- **Topes campaña** `TOPES_CAMP` — [datos.js:59](public/compensacion/compania-z/datos.js#L59): `[[6,1000],[12,1500],[24,2000],[999,99999]]` → 1–6=1.000 · 7–12=1.500 · 13–24=2.000 · 25+=99.999. Coincide con §3 TABLA 1 (1.000/1.500/2.000/SIN TOPE) ✓. Matiz: "sin tope" se modela como `99999` (cap finito alto), no `Infinity`/`null`; ver `TOPE_T5` [datos.js:85](public/compensacion/compania-z/datos.js#L85).
- **Topes por póliza (campaña)** `CAMP_PRODS` — [datos.js:70-80](public/compensacion/compania-z/datos.js#L70-L80): BL/PM `tope:300` ✓ · APV `z:1.00,tope:600,capUF:500` ✓ (100% solo sobre UF500) · BLF `z:0.50,tope:300` ✓ · RP `z:0.50,tope:300` ✓ · APVF `z:0.50,tope:600,capUF:500` ✓ · SS/AP/TP `tope:null` (sin tope) ✓. Coincide con §3 TABLA 2.
  - ⚠️ **Falta "Ahorro Universitario" (cód. 562, 100% sin tope)** de §3 TABLA 2: no aparece en `CAMP_PRODS` ni en `SIM_PRODS`.

**VEREDICTO:** ❌ **Difiere en parametrización** (todos los topes son números fijos en `datos.js`, no config/DB — relevante para multi-tenant), aunque **los valores coinciden** con el contrato/campaña salvo: escala granular a verificar, "sin tope"=99999, y Ahorro Universitario ausente.

---

### 8. Juego de tablas de comisión vigente (32% "original" vs "NUEVO" 4%/0,8%)

**REGLA** (§2.2): el contrato trae DOS juegos. Verificar **cuál** está implementado y si es el vigente.

**CÓDIGO** — [datos.js:14-26](public/compensacion/compania-z/datos.js#L14-L26) (comisión `c` mes 1; incentivos `incM12/M24/M120`):
| Producto | §2.2 (original) | Código | ¿? |
|---|---|---|---|
| BL/PM/BLF | 32% → 32%/6%/3,6% | `c:.32, incM12:.32, incM24:.06, incM120:.036` | ✅ |
| Temporal (TP) | 16% → 2,4% (2–60), tope UF10 | `c:.16, cTopeUF:10, incM12:.024, incM24:.024, incM120:.024` | ⚠️ (ver nota) |
| AP | 8% / 8% | `c:.08, incM12/24/120:.08` | ✅ |
| Salud (SS) | 8% / 8% | `c:.08, incM12/24/120:.08` | ✅ |
| APV | UF fija 0,04/0,08 | `cUF:.08` | ⚠️ (solo 0,08; falta 0,04) |
| Futuro Presente | 0,8% → 0,8% (2–96) | `c:.056, incM12:.056, incM24:.024` | ❌ (ver nota) |
| Renta Preferente | 24% s/ rem. variable fondos mutuos | sin comisión (solo Z vía aporte) | ❌ no impl. |

**VEREDICTO:** ⚠️ **Implementada la tabla "original" (32%)**, no la "NUEVO" (4%/0,8%). **Verificar cuál es la vigente** (decisión humana). Adicionalmente:
- ❌ **`FP` "El Futuro es Hoy AE": `c:.056` (5,6%)** vs. §2.2 "Futuro Presente 0,8%". O los productos no son el mismo, o la tasa difiere en casi 7×. Reportar.
- ⚠️ TP: el incentivo 2,4% se aplica también en `incM120` (>60 meses), mientras §2.2 acota a "2–60". Y el `cTopeUF:10` está sobre la comisión de venta; §2.2 menciona "tope UF 10/mes" sin precisar comisión vs. incentivo.
- ⚠️ APV: el doc lista "UF fija (0,04 / 0,08)"; el código solo usa `cUF:.08`.
- ❌ Renta Preferente: no se implementa la comisión del 24% sobre remuneración variable de fondos mutuos (RP solo aporta Z Puntos vía 10% PPA × factor endoso).

---

### 9. Embudo inverso de prospección con tasas de §4

**REGLA** (§4): meta→ventas→contactos→prospectos; tasas de cierre por origen: Frío 10–15% (7–10 prosp.) · Referido nombre dado 25–30% (3–4) · Referido con presentación 40–50% (2–3) · Transferencia en vivo 55–70% (1–2). Nodo = contacto que refiere por 2ª vez; ~5 prospectos/nodo.

**CÓDIGO** — `SIM_METODOS` [datos.js:35-50](public/compensacion/compania-z/datos.js#L35-L50):
- `ref1` nombre dado `tasa:'25-30%'` ✓ · `ref2` presentado `tasa:'40-50%'` ✓ · `ref3` transferencia en vivo `tasa:'55-70%'` ✓ · `dig` leads digitales `tasa:'10-15%'` ✓ · `frio` `tasa:'2-4%'` (prospección masiva, granularidad extra del código).
- ~5 prospectos/nodo: [renta.js:366](public/compensacion/compania-z/renta.js#L366) `prospectos=m.esNodo?Math.ceil(vM)*5:...` y `nPorNodo:5`. ✓
- Embudo (ventas→contactos→prospectos) en `simRenderFunnel` [renta.js:359-426](public/compensacion/compania-z/renta.js#L359-L426).

**VEREDICTO:** ✅ **Coincide.** Las tasas de cierre por origen reproducen la tabla §4; el código añade granularidad (separa "leads digitales" de "prospección en frío", y un 4º método "referidos tras cierre").

---

## Hallazgos adicionales (fuera del checklist §6)

### Hallazgo A — Tabla `ENDOSO_Z` no está en el documento de negocio
[datos.js:62-68](public/compensacion/compania-z/datos.js#L62-L68) define factores Z para aportes/endosos que **varían según el nº de pólizas nueva-venta del período** (columnas ≥3 / 2 / 0-1), aplicados en [renta.js:132-159](public/compensacion/compania-z/renta.js#L132-L159). Ej.: `APV:[0.50,0.50,0.25]`, `APVF:[0.25,0.25,0.125]`, `RP:[0.50,0.50,0.25]`. **CONTEXTO_NEGOCIO.md no describe esta mecánica** (§2.3 paso 1 solo dice "aportes extraordinarios → 10% del monto como prima proyectada"). **No verificable contra el doc** — reportar para confirmar fuente.

### Hallazgo B — Interpretación del tope por antigüedad: ¿cap total de Z o cap del tramo 5?
[renta.js:191-194](public/compensacion/compania-z/renta.js#L191-L194): el tope `tope_t5` se aplica **solo sobre el exceso por encima de 200** (`exceso=z-200; ap=Math.min(exceso,tope_t5)`), no sobre el total de Z. El comentario [datos.js:84](public/compensacion/compania-z/datos.js#L84) lo dice explícito: *"tope del tramo 5 … NO es cap de AE total"*.
- §2.5 lo enuncia como **"Tope de Z Puntos por antigüedad"** (cap del total), y §3 lo refuerza: *"un asesor nuevo que en el contrato toparía en 300Z"*.
- Consecuencia: bajo el código, un asesor 1–6 meses (`tope_t5=300`) puede aportar al bono hasta `200+300 = 500Z`; bajo la lectura literal del contrato toparía en **300Z total**. (Para z≤300 ambos coinciden; la diferencia surge con alta producción.)
- **No se asume cuál es correcto.** Si el tope es sobre el total, el código sobre-paga a productores altos; si es sobre el tramo variable, el código está bien. **Reportar para decisión.**

### Hallazgo C — Bonos Top 20: gates no aplicados
§2.6 condiciona Top 20 a **persistencia ≥ 85% del target**, y Top 20 Crecimiento exige **incremento ≥ UF 750** de cartera. En código [renta.js:176-177](public/compensacion/compania-z/renta.js#L176-L177) el bono se suma con solo marcar el checkbox y el ranking, **sin verificar persistencia ni el incremento UF750**. Los valores de las escalas `TOP20_APE_UF`/`TOP20_CV_UF` ([datos.js:33-34](public/compensacion/compania-z/datos.js#L33-L34)) **sí coinciden** con §2.6. Reportar la ausencia de gates (puede ser intencional por ser simulador de gestión).

### Hallazgo D — Requisito de entrada a campaña distinto al documentado
§3.2 define el mix mínimo de entrada **1×1×1**: (CUI o APV o Temporal) + GI + (PL u ONCO). El código aplica un KPI distinto para pagar APV al 100% en campaña: `kpiSaludChk && tieneVidaMix && tieneGIMix` ([renta.js:102-105](public/compensacion/compania-z/renta.js#L102-L105)), es decir **Salud + Vida + GI**. Composición diferente a la del doc. Reportar.

### Hallazgo E — Rendimiento mínimo y Roll-Over no implementados
§2.7 (mínimo 2 pólizas/115 Z mensual; 6/345 trimestral) y §2.8 (situaciones especiales Roll-Over: ventas que no generan Z pero pagan comisión diferenciada) **no tienen lógica en el motor**. Probablemente fuera del alcance de un simulador de metas, pero se registra la ausencia.

### Hallazgo F — Primas semilla en UF fijadas con la UF de referencia (bug ya detectado)
[datos.js:101-103](public/compensacion/compania-z/datos.js#L101-L103) inicializa `simState.prima[id] = p.p / UF_VAL` con `UF_VAL=39357` (valor de referencia al cargar). `fetchUF()` ([plataforma-core.js:183-198](public/plataforma-core.js#L183-L198)) reasigna `UF_VAL` a la UF real de mindicador.cl y llama `simRender()`, **pero no recalcula `simState.prima`**. Efecto:
- Los **valores por defecto** de prima (en UF) quedan calculados con la UF de referencia; al llegar la UF real no se ajustan.
- Impacto acotado: las primas se editan manualmente en UF y el resto del cálculo es coherente en UF; el artefacto afecta solo a los defaults iniciales antes de que el usuario los toque. Aun así, los montos CLP-equivalentes de arranque no corresponden a la UF del día.
- Reportar como inconsistencia menor de correctitud.

---

## Para decisión humana (consolidado)

1. **Mecánica "mayor valor" (crítico, §3.1):** ¿implementar `Math.max(contrato, campaña)` en lugar del toggle excluyente? — Hallazgo §6.5.
2. **Tope por antigüedad (Hallazgo B):** ¿es cap del **total** de Z o del **tramo 5**? Define si el código sobre-paga a productores altos.
3. **Factor de Salud (SS) `z:0.50` (§6.1):** ¿corresponde a "SAFE"? Si no, Salud no debería generar Z en Capa 1.
4. **Tabla de comisión vigente (§6.8):** ¿"original" 32% (implementada) o "NUEVO" 4%/0,8%? Y aclarar `FP` 5,6% vs 0,8%.
5. **Escala de topes por antigüedad (§6.7):** ¿granular (24/48/72/96/119m) o gruesa del contrato?
6. **`ENDOSO_Z` (Hallazgo A):** confirmar fuente — no está en el documento.
7. **Productos/condiciones faltantes:** Ahorro Universitario (cód. 562) en campaña; comisión 24% Renta Preferente; gates Top 20 (persistencia ≥85%, UF750).
8. **Parametrización / vigencia (§6.6, §6.7):** mover factores/topes/campañas a config o DB con fechas de vigencia (necesario para multi-tenant y para volver solo a Capa 1 al vencer).
9. **Primas semilla (Hallazgo F):** recalcular `simState.prima` dentro de `fetchUF()` o sembrar en UF directamente.

---

*Auditoría de solo lectura. No se modificó código. Las desviaciones pueden ser bugs o condiciones vigentes que el documento de negocio no refleja; resolver con un humano antes de corregir.*
