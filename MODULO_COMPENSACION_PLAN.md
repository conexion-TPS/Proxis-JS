# Plan de ejecución — motor genérico de compensación (Zurich como primera spec)

**Estado:** plan para revisión. No se ha tocado código de Zurich.
**Decisiones aprobadas:** motor genérico único · specs en Supabase · panel desde `inputSchema()` · primer paso = extraer embudo + motor genérico con Zurich, **sin alterar su funcionamiento**.
**Base:** [MODULO_COMPENSACION_CONTRATO.md](MODULO_COMPENSACION_CONTRATO.md).

> **Restricción rectora:** cuidado EXTREMO con Zurich. Ningún paso altera su conducta hasta que esté demostrado, número por número, que el motor nuevo reproduce el viejo. Cero cambios a la BD de bitácora.

---

## Parte A — Esquema completo de la spec declarativa (target del motor)

Esto es [datos.js](public/compensacion/compania-z/datos.js) + las reglas de [renta.js](public/compensacion/compania-z/renta.js) expresadas como **datos**. Es lo que el admin/IA producirán por empresa.

```jsonc
{
  "id": "compania-z", "empresa": "zurich", "version": 1,
  "moneda": "CLP", "unidad": "UF", "sueldoBase": 539000,

  "productosVI": [
    { "id":"BL","nombre":"Vida Empresarial","factor":2.00,
      "comisionVenta":0.32, "incentivos":{"m2_12":0.32,"m13_24":0.06,"m25_120":0.036},
      "primaInicialCLP":200000,"primaMaxCLP":2000000 },
    { "id":"TP","nombre":"Seguro Temporal","factor":1.00,"comisionVenta":0.16,"comisionTopeUF":10,
      "incentivos":{"m2_12":0.024,"m13_24":0.024,"m25_120":0.024} },
    { "id":"APV","nombre":"APV","factor":0.50,"comisionUF":0.08 }
    // … resto de SIM_PRODS (PM, FP, AP, SS, BLF) con sus campos
  ],
  "productosGI": [
    { "id":"AUTO","nombre":"Auto","factor":0.50 },
    { "id":"HOGAR","nombre":"Hogar","factor":1.00 }
  ],
  "aportes": [
    { "id":"APVEX","nombre":"APV aporte extra","ppaPctMonto":0.10,"factorPorEndoso":"APV" },
    { "id":"APVFLEX","nombre":"APV Flexible traspaso","ppaPctMonto":0.10,"factorPorEndoso":"APVF" },
    { "id":"RP","nombre":"Futura Renta","ppaPctMonto":0.10,"factorPorEndoso":"RP" }
  ],
  "endosoZ": {                 // factores [≥3 pól. NV, 2 pól. NV, 0-1 pól. NV]
    "BL":[0.80,0.60,0.50], "APV":[0.50,0.50,0.25], "APVF":[0.25,0.25,0.125], "RP":[0.50,0.50,0.25]
    // … resto de ENDOSO_Z
  },

  "tramos": [
    {"min":0,"max":49.99,"pct":0.10},{"min":50,"max":99.99,"pct":0.12},
    {"min":100,"max":149.99,"pct":0.15},{"min":150,"max":200,"pct":0.18},
    {"min":200.01,"max":null,"pct":0.10}
  ],
  "topesPorAntiguedad":        [[6,300],[23,700],[47,800],[71,900],[95,1000],[119,1100],[999,1200]],

  "persistencia": {
    "minimaPorAntiguedad": [[12,0.90],[24,0.82],[999,0.78]],
    "factorPorCumplimiento": [[0.50,0],[0.85,0.5],[0.90,0.65],[0.95,0.9],[1.00,1.0],[1.20,1.2]],
    "bono120SoloDesdeMes": 13
  },

  "campania": {
    "id":"complemento_produccion_emitida",
    "overrides": { "BL":{"factor":2.00,"tope":300}, "APV":{"factor":1.00,"tope":600,"capUF":500} /* CAMP_PRODS */ },
    "topesPorAntiguedad": [[6,1000],[12,1500],[24,2000],[999,null]],
    "liberaTopeGI": true,
    "kpiAPV100": ["vida","gi","salud"]
  },
  "topeGI": { "pctDeVI": 0.25 },

  "bonos": [
    { "id":"top20ape","tipo":"rankingUF","escala":[23,18,13,11,9,7,6,6,4,4,3,3,3,2,2,2,1,1,1,1],"requierePersistencia":0.85 },
    { "id":"top20cv","tipo":"rankingUF","escala":[11,8,8,8,5,5,5,2,2,2,1,1,1,1,1,1,1,1,1,1],"requiereIncrementoUF":750 }
  ],

  // Reglas/desviaciones que la auditoría marcó → se deciden AQUÍ, explícitas (ver AUDITORIA_COMPENSACION.md)
  "reglas": {
    "campaniaModo": "reemplaza",        // "reemplaza" (hoy) | "mayorValor" (lo que pide el contrato §3.1)
    "topeAntiguedadAplicaA": "tramo5"   // "tramo5" (hoy) | "total" (lectura literal del contrato)
  },

  // Lo que el NÚCLEO renderiza como panel de entrada (inputSchema)
  "modificadoresUI": [
    { "id":"campana","tipo":"toggle","label":"Campaña 2026","default":true },
    { "id":"kpiSalud","tipo":"toggle","label":"KPI Salud XS" },
    { "id":"top20ape","tipo":"toggleRank","label":"Bono Top 20 APE","rankMax":20 }
  ]
}
```

> Las desviaciones de la auditoría (mayor-valor, tope total vs tramo 5, gates de Top 20, etc.) **dejan de ser ambiguas**: se vuelven campos de `reglas`. Para Zurich los fijamos **exactamente como están hoy** (`reemplaza`, `tramo5`) para preservar conducta; cambiarlos es una decisión de negocio aparte.

---

## Parte B — Almacenamiento en Supabase (registro + specs)

Tabla pensada para que el **admin de Proxis_dev** la gestione cuando se integre:

```sql
create table comp_specs (
  id          uuid primary key default gen_random_uuid(),
  empresa     text not null,              -- 'zurich', 'vina', 'brasil'
  modulo_id   text not null,              -- 'compania-z'
  tipo        text not null default 'declarativo',  -- 'declarativo' | 'custom'
  spec        jsonb,                      -- la spec de la Parte A (si declarativo)
  version     int not null default 1,
  activo      boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique (empresa, version)
);
```

**Decisión de despliegue abierta (te la marco, no la asumo):** ¿en qué proyecto Supabase vive `comp_specs`? Debe ser **el mismo que lea el admin de Proxis_dev** cuando se integre. Hasta integrarlo, el motor puede leer la spec de Zurich desde un **archivo del repo** (fallback), y migrarla a la tabla cuando el admin entre. Así no bloqueamos el paso 1 por una decisión de infraestructura que depende de otro proyecto.

---

## Parte C — Plan de extracción (paso 1), preservando Zurich

Todo en una **ruta paralela**; `compania-z` sigue vivo e intacto hasta el final.

**Fase 0 — Red de seguridad (golden master). NO altera Zurich.**
- Aislar el cálculo puro de Zurich (`simCalcZ`/`simCalcBonoUF`/embudo) en funciones **sin DOM ni globals**, alimentadas por un estado explícito — como **copia paralela**, sin tocar el `compania-z` vivo.
- Generar una **matriz de escenarios** (mix de productos × antigüedad × persistencia × campaña on/off × aportes × bonos) y **snapshotear** las salidas actuales (AE, bono UF, ingreso, contactos, prospectos).
- Ese snapshot es la **verdad** contra la que se compara todo lo nuevo.

**Fase 1 — Motor genérico.**
- Construir en el núcleo el motor que interpreta la spec (Parte A) → debe reproducir el snapshot de Zurich **idéntico** (tolerancia 0 en AE/UF; redondeos de $ documentados).
- Si un número no calza → se corrige el motor o se ajusta la spec, nunca se toca Zurich.

**Fase 2 — Embudo al núcleo.**
- Mover `SIM_METODOS` + `simRenderFunnel` al núcleo (genérico). El motor entrega `ventas`; el embudo del núcleo produce contactos/prospectos. Verificar contra snapshot.

**Fase 3 — Panel desde `inputSchema()`.**
- El núcleo renderiza el panel desde `modificadoresUI` + productos de la spec. Verificar paridad visual/funcional con el panel actual de Zurich.

**Fase 4 — Loader por tenant + registro.**
- Cargar motor + spec por `empresa`. Zurich carga su spec → se comporta igual.

**Fase 5 — Cutover con interruptor.**
- Cambiar el supervisor de Zurich al motor nuevo **detrás de un flag**, solo tras paridad total con el golden master. `compania-z` queda como fallback hasta validarlo en producción. Recién entonces se retira.

**Garantías transversales:**
- Cero cambios a `reportes`/`contactos`/`metas` (esquema y datos). La salida `_simMeta` se mantiene.
- En cada fase, verificación contra el golden master + QA manual de la vista de supervisor de Zurich.
- `compania-z` no se borra hasta que el motor+spec esté probado en prod.

---

## Parte D — Qué necesito de ti para arrancar

1. **Visto bueno al esquema de spec (Parte A)** — ¿algún campo del modelo de pago de Zurich que falte o esté mal nombrado?
2. **Fase 0 ya, sin riesgo:** ¿arranco con el **golden master** (aislar el cálculo puro en copia paralela + snapshot de escenarios)? Es 100% read-only respecto a Zurich: no cambia su código vivo ni la BD; solo crea la red de seguridad. Es el primer paso correcto antes de cualquier refactor.
3. **Spec de Zurich:** ¿la dejo primero como **archivo en el repo** (para no depender del proyecto del admin) y la migramos a `comp_specs` cuando se integre el admin de Proxis_dev? (Recomendado para no bloquear.)

---

*Tras tu OK a la Parte A y a arrancar Fase 0, el siguiente entregable es el golden master: el arnés de cálculo puro + la matriz de escenarios con sus snapshots — sin tocar el `compania-z` vivo.*
