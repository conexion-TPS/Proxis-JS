# Contrato del módulo de compensación (plugin intercambiable)

**Estado:** propuesta para revisión. No es código de producción.
**Objetivo:** definir la frontera entre el **núcleo compartido** (una sola base de código, multi-tenant) y el **plugin de compensación por empresa** (intercambiable y programable), de modo que agregar una empresa NO sea forkear el sistema.

Diseñado a partir de cómo funciona hoy el simulador de Zurich (`public/compensacion/compania-z/`) — ver radiografía en la conversación y en [AUDITORIA_COMPENSACION.md](AUDITORIA_COMPENSACION.md).

---

## 0. Principios (acordados)

1. La empresa es **dato** en la Capa 1 (bitácora) y **plugin** en la Capa 2 (compensación).
2. El **prorrateo a contactos/prospectos es genérico → vive en el núcleo**, NO en el plugin.
3. El plugin queda **delimitado a sus variables** (modelo de pago y nada más) → habilita un dashboard + IA que lo generen.
4. La compensación se expone como **aproximada**; lo autoritativo es contactos/prospectos.
5. Refactor **sin tocar datos de Zurich**: cambia código/frontera, no el esquema ni las filas de bitácora. La salida a la tabla `metas` se mantiene idéntica.

---

## 1. Quién hace qué (frontera)

| Responsabilidad | Dueño |
|---|---|
| Auth + resolución de tenant `{asesor, empresa, rol}` | **Núcleo** |
| Bitácora (`reportes`/`contactos`/`metas`) y su scope por `empresa` | **Núcleo** |
| UF del día, lista de asesores, shell/CSS del simulador, montaje | **Núcleo** |
| **Embudo de prorrateo**: ventas proyectadas → contactos/prospectos | **Núcleo** |
| Persistir metas (tabla `metas`) | **Núcleo** |
| **Modelo de pago**: productos, factores, tramos, topes, comisiones, bonos, campaña | **Plugin** |
| Cálculo: escenario de productos → **ventas + ingreso proyectado** | **Plugin** |
| Declarar **qué se selecciona** (esquema de entrada del panel) | **Plugin** |

Regla de oro: **el plugin entrega "cuántas ventas / qué ingreso"; el núcleo lo prorratea a actividad y lo guarda.** El plugin no sabe nada de contactos ni prospectos.

---

## 2. El contrato (interfaz del plugin)

Un plugin de compensación expone tres cosas:

```ts
interface CompensationPlugin {
  meta: {
    id: string            // 'compania-z'
    empresa: string       // 'zurich'
    label: string         // 'Zurich · Asesor Ejecutivo'
    tipo: 'declarativo' | 'custom'
  }

  // (A) Qué selecciona el supervisor. Declarativo (preferido) o render propio.
  inputSchema?(): FieldSpec[]                      // caso declarativo
  mountPanel?(container: HTMLElement, ctx: Ctx): void  // caso custom

  // (B) El cálculo. Recibe el escenario y el contexto; devuelve la proyección.
  compute(scenario: Scenario, ctx: Ctx): Projection
}
```

### Contexto que entrega el NÚCLEO al plugin (sin globals)
```ts
interface Ctx {
  uf: number                 // UF del día (la trae el núcleo)
  asesor: string
  empresa: string
  onProjection(p: Projection): void   // el plugin avisa al núcleo cada cambio
}
```

### Entrada — el "escenario de venta"
```ts
interface Scenario {
  // Genéricos del asesor (los usa el modelo de pago)
  antiguedadMeses: number
  persistencia: number       // %
  metaIngreso: number

  // Mix de productos seleccionado (cantidades + prima)
  lineas: { productoId: string; cantidad: number; primaUF?: number }[]

  // Modificadores declarados por el plugin (campaña, KPIs, bonos, etc.)
  modificadores: Record<string, boolean | number | string>
}
```

### Salida — la proyección (lo único que el núcleo necesita)
```ts
interface Projection {
  ventas: number             // nº de ventas proyectadas  → el núcleo lo prorratea
  ingresoBrutoAprox: number  // $ aproximado (referencial)
  desglose?: DesgloseRow[]    // tabla referencial para mostrar (opcional)
  // El núcleo completa meta_contactos_semana y meta_prospectos_mes con su embudo.
}
```

### Salida final al dato (la arma el NÚCLEO, no el plugin)
```ts
// _simMeta — contrato FIJO hacia la tabla `metas` (idéntico al de hoy)
{
  asesor, empresa,
  meta_ventas_mes:        Projection.ventas,         // del plugin
  meta_ingresos:          Projection.ingresoBrutoAprox, // del plugin
  meta_contactos_semana,  meta_prospectos_mes,        // del embudo (núcleo)
}
```

---

## 3. La spec declarativa (lo que el dashboard/IA producen)

Para el caso común (Zurich y la mayoría), el modelo de pago **cabe como datos**. Un **motor de cálculo genérico** del núcleo interpreta esta spec; no hace falta escribir código:

```jsonc
{
  "id": "compania-z",
  "empresa": "zurich",
  "moneda": "CLP", "unidad": "UF",
  "sueldoBase": 539000,
  "productos": [
    { "id": "BL", "nombre": "Vida Empresarial", "categoria": "VI",
      "factor": 2.00, "comisionVenta": 0.32,
      "incentivos": { "m2_12": 0.32, "m13_24": 0.06, "m25_120": 0.036 } }
    // … resto de SIM_PRODS / SIM_PRODS_GI
  ],
  "aportes": [ { "id": "APV", "ppaPctMonto": 0.10, "factor": 0.50 } ],
  "tramos": [ {"min":0,"max":49.99,"pct":0.10}, /* … */ {"min":200.01,"max":null,"pct":0.10} ],
  "topesPorAntiguedad": [ [6,300],[23,700],[47,800],[71,900],[95,1000],[119,1100],[999,1200] ],
  "persistencia": {
    "minimaPorAntiguedad": [ [12,0.90],[24,0.82],[999,0.78] ],
    "factorPorCumplimiento": [ [0.50,0],[0.85,0.5],[0.90,0.65],[0.95,0.9],[1.0,1.0],[1.20,1.2] ],
    "bono120SoloDesdeMes": 13
  },
  "campania": {
    "activaPor": "modificador:campana",
    "overrides": { /* CAMP_PRODS */ },
    "topesPorAntiguedad": [ [6,1000],[12,1500],[24,2000],[999,null] ],
    "liberaTopeGI": true
  },
  "topeGI": { "pctDeVI": 0.25 },
  "bonos": [
    { "id": "top20ape", "tipo": "rankingUF", "escala": [23,18,13,/*…*/1], "requierePersistencia": 0.85 }
  ],
  "modificadoresUI": [
    { "id": "campana", "tipo": "toggle", "label": "Campaña 2026" },
    { "id": "kpiSalud", "tipo": "toggle", "label": "KPI Salud XS" }
  ]
}
```

> Esto es, literalmente, [datos.js](public/compensacion/compania-z/datos.js) **expresado como datos serializables** en vez de JS. Es lo que un **dashboard con documentación embebida** captura por formulario, y lo que la **IA emite** al leer contratos/liquidaciones. Las reglas/desviaciones detectadas en la auditoría (mayor-valor, tope total vs tramo 5, etc.) se resuelven aquí, una vez, en la spec.

---

## 4. La vía de escape (módulos custom)

Cuando una empresa NO cabe en la spec declarativa (ej. Brasil: 10k asesores, múltiples sistemas de pago por línea), el plugin entrega **código a medida** que implementa el **mismo contrato** (`compute(scenario, ctx)`), pero con lógica propia. El núcleo lo trata igual: le pasa el escenario, recibe la proyección. **No forkea el núcleo ni toca los otros plugins.**

Regla: el dashboard+IA cubren el caso **declarativo** (la mayoría); el caso **custom** sigue aislado por el contrato.

---

## 5. Registro `empresa → módulo` (dato/config)

Un registro mapea tenant a su plugin (config, no código):

| empresa | módulo | tipo |
|---|---|---|
| `zurich` | `compania-z` | declarativo (reconvertido) |
| `vina` | *(ninguno aún)* | — |
| `brasil` | `compania-br` | custom |

El **loader** elige el módulo por la `empresa` del supervisor logueado (hoy está clavado a `compania-z` en [page.tsx:25-28](src/app/plataforma/page.tsx#L25-L28)). Si una empresa no tiene módulo (Viña hoy), simplemente **no se muestra simulador** — su asesor usa solo la bitácora.

---

## 6. Cómo encaja Zurich (verificación de que el contrato es real)

- `compania-z` se reexpresa como **spec declarativa** (§3) + el motor genérico → **mismos números que hoy** (se verifica antes/después).
- El **embudo** (`SIM_METODOS` + `simRenderFunnel`) sale del plugin y pasa al **núcleo**.
- `simCalcZ`/`simCalcBonoUF` → se vuelven el **motor genérico** que interpreta la spec.
- La salida `_simMeta` → **idéntica**. La tabla `metas` no cambia. **Cero cambio de datos.**

---

## 7. Decisiones abiertas (para resolver contigo)

1. **Motor genérico vs. por-plugin para el caso declarativo:** ¿construimos UN motor de cálculo en el núcleo que interpreta la spec (recomendado: 1 motor, N specs de datos), o cada plugin trae su propio cálculo aunque sea declarativo? (Recomiendo el motor único: es lo que hace que el dashboard/IA produzcan solo datos.)
2. **Dónde vive el registro y las specs:** ¿tabla en Supabase (`empresas.modulo_compensacion` + spec en JSON) o archivos en el repo? (Tabla = coherente con multi-tenant y con el dashboard; archivos = más simple para empezar.)
3. **Panel de entrada:** ¿el núcleo renderiza el panel desde `inputSchema()` (genérico, declarativo) o cada plugin monta su panel? (Declarativo habilita el dashboard; custom queda como escape.)
4. **Alcance del primer paso real:** ¿extraemos el embudo al núcleo + definimos el motor genérico con Zurich como primera spec (preservando conducta), y recién después Consorcio? 

---

*Próximo artefacto sugerido tras aprobar este contrato: el esquema exacto de la **spec declarativa** (todos los campos) y el plan de extracción del embudo al núcleo — ambos preservando Zurich y sin tocar la BD.*
