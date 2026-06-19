-- Migración 049 — Seed corpus MTPSCV, escenario CLIENTE (16 celdas)
-- Modelo de dos ejes: escenario='cliente' (columna), etapa_ciclo='prospeccion' (prospección sobre clientes: pedir referidos, convertir en nodo).
-- tags = solo tipo de interlocutor. Idempotente: WHERE NOT EXISTS por titulo.

-- Asesor ENERGÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','cliente','prospeccion','energetico × energetico (cliente)',
'DINÁMICA: el asesor quiere eficiencia en el servicio; el cliente enérgico quiere resultados y respeto a su tiempo.
RIESGO (baja integración): el asesor da la cuenta por cerrada tras la venta y no hace seguimiento; el cliente se siente "ya exprimido" y no recompra ni deriva.
FORMA RESUELTA (alta integración): el asesor mantiene contacto breve y orientado a resultado, y pide referidos capitalizando su éxito. Caso: tras un siniestro bien resuelto, llama corto y directo —"quedó resuelto en 48 horas; ¿conoces a alguien del rubro que merezca este nivel?".',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × energetico (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','cliente','prospeccion','energetico × reflexivo (cliente)',
'DINÁMICA: el asesor quiere cerrar el ciclo rápido; el cliente reflexivo quiere confirmar que todo opera como se prometió.
RIESGO (baja integración): el asesor minimiza dudas técnicas postventa; el reflexivo desconfía y no renueva.
FORMA RESUELTA (alta integración): el asesor actúa como consultor y comparte detalles que el cliente puede verificar. Caso: modera su prisa y envía al cliente analítico un resumen claro del estado de su póliza y cómo aprovecharla mejor.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × reflexivo (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','cliente','prospeccion','energetico × relacional (cliente)',
'DINÁMICA: el asesor es resolutivo; el cliente relacional valora sentirse cuidado en el tiempo.
RIESGO (baja integración): el asesor solo aparece cuando hay gestión; el relacional siente que la relación era solo comercial.
FORMA RESUELTA (alta integración): el asesor suma calidez y contacto no transaccional. Caso: llama sin motivo de venta, solo para saber cómo está la familia; el cliente, fidelizado, lo recomienda en su círculo.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × relacional (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','cliente','prospeccion','energetico × magnetico (cliente)',
'DINÁMICA: dos energías; postventa con buena química.
RIESGO (baja integración): el asesor cierra el trato y desaparece; el magnético, que necesita reconocimiento, se siente olvidado.
FORMA RESUELTA (alta integración): el asesor reconoce al cliente y lo hace protagonista. Caso: felicita al cliente magnético por su decisión y le propone "recomiéndame y te hago quedar como el que cuida a su gente".',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × magnetico (cliente)');

-- Asesor REFLEXIVO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','cliente','prospeccion','reflexivo × energetico (cliente)',
'DINÁMICA: el asesor da servicio detallado; el cliente enérgico quiere lo esencial y rápido.
RIESGO (baja integración): el asesor satura con reportes; el enérgico se impacienta.
FORMA RESUELTA (alta integración): el asesor sintetiza el valor entregado en resultados. Caso: resume al cliente enérgico "tu cobertura está activa, sin pendientes; cualquier cosa, una llamada".',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × energetico (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','cliente','prospeccion','reflexivo × reflexivo (cliente)',
'DINÁMICA: dos perfiles minuciosos; relación postventa sólida y de confianza técnica.
RIESGO (baja integración): la relación se vuelve puramente técnica y fría; falta el calor que sostiene la lealtad.
FORMA RESUELTA (alta integración): el asesor suma una pizca de calidez genuina al rigor. Caso: mantiene su precisión en los reportes pero suma un interés sincero por cómo le va al cliente, afianzando la renovación.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × reflexivo (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','cliente','prospeccion','reflexivo × relacional (cliente)',
'DINÁMICA: el asesor riguroso; el cliente que valora el vínculo.
RIESGO (baja integración): el asesor responde con datos donde el relacional quería cercanía; la lealtad no prende.
FORMA RESUELTA (alta integración): el asesor activa su ruta (sumar calidez): contacto humano además del técnico. Caso: acompaña su servicio impecable con llamadas cálidas de seguimiento; el cliente lo siente cercano y deriva.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × relacional (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','cliente','prospeccion','reflexivo × magnetico (cliente)',
'DINÁMICA: el asesor medido; el cliente expansivo que quiere reconocimiento.
RIESGO (baja integración): el asesor da servicio correcto pero frío; el magnético se aburre y no recuerda derivar.
FORMA RESUELTA (alta integración): el asesor suma energía y reconocimiento. Caso: celebra con entusiasmo genuino el aniversario de póliza del cliente magnético, que encantado lo recomienda.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × magnetico (cliente)');

-- Asesor RELACIONAL
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','cliente','prospeccion','relacional × energetico (cliente)',
'DINÁMICA: el asesor cálido; el cliente enérgico que valora eficiencia.
RIESGO (baja integración): el asesor alarga el contacto social; el enérgico lo siente innecesario.
FORMA RESUELTA (alta integración): el asesor mantiene calidez pero va al punto en el servicio. Caso: saluda breve y resuelve la gestión del cliente enérgico sin rodeos, y le pide un referido con franqueza.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × energetico (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','cliente','prospeccion','relacional × reflexivo (cliente)',
'DINÁMICA: el asesor cálido; el cliente que quiere confirmar que todo opera bien.
RIESGO (baja integración): la calidez sin sustancia no tranquiliza al reflexivo postventa.
FORMA RESUELTA (alta integración): el asesor acompaña la calidez con confirmación verificable. Caso: envía al cliente analítico un estado claro de su póliza junto a su trato amable; el cliente, tranquilo, renueva.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × reflexivo (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','cliente','prospeccion','relacional × relacional (cliente)',
'DINÁMICA: dos perfiles de vínculo; relación postventa cálida y natural —" el terreno más fértil para fidelizar.
RIESGO (baja integración): tanto vínculo afectivo que el asesor no pide la derivación por no "aprovecharse"; el activo relacional se desperdicia.
FORMA RESUELTA (alta integración): el asesor activa su ruta (sumar dominancia): convierte el vínculo en pedido amable de referidos. Caso: sobre una relación cálida, dice "me encantaría cuidar a alguien que quieras tanto como te cuido a ti".',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × relacional (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','cliente','prospeccion','relacional × magnetico (cliente)',
'DINÁMICA: ambos orientados a personas; postventa con mucho calor.
RIESGO (baja integración): el magnético promete recomendaciones por entusiasmo y no concreta; el relacional no insiste.
FORMA RESUELTA (alta integración): el asesor capitaliza el entusiasmo con un compromiso concreto y amable. Caso: aprovecha el entusiasmo del cliente magnético para agendar juntos, en el momento, el contacto al referido.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × magnetico (cliente)');

-- Asesor MAGNÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','cliente','prospeccion','magnetico × energetico (cliente)',
'DINÁMICA: dos energías; postventa chispeante.
RIESGO (baja integración): el asesor busca protagonismo donde el enérgico quiere eficiencia; choque.
FORMA RESUELTA (alta integración): el asesor pone el carisma al servicio del cliente. Caso: hace quedar bien al cliente enérgico —"tu decisión fue la acertada—" y le pide referidos sin robarle la escena.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × energetico (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','cliente','prospeccion','magnetico × reflexivo (cliente)',
'DINÁMICA: el asesor expansivo; el cliente que quiere verificar.
RIESGO (baja integración): el entusiasmo postventa sin respaldo inquieta al reflexivo.
FORMA RESUELTA (alta integración): el asesor baja revoluciones y respalda con datos. Caso: modera la efusividad y confirma al cliente analítico, con cifras, que su póliza rinde como se prometió.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × reflexivo (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','cliente','prospeccion','magnetico × relacional (cliente)',
'DINÁMICA: ambos cálidos; postventa de mucha conexión.
RIESGO (baja integración): el asesor abruma al relacional pausado con su energía.
FORMA RESUELTA (alta integración): el asesor baja revoluciones y escucha. Caso: modera su intensidad con el cliente reservado, le da espacio, y este lo recomienda por sentirse cómodo.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × relacional (cliente)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','cliente','prospeccion','magnetico × magnetico (cliente)',
'DINÁMICA: dos carismas; postventa pura simpatía.
RIESGO (baja integración): mucha celebración mutua, ninguna concreción de referidos.
FORMA RESUELTA (alta integración): el asesor toma la iniciativa de concretar. Caso: dos magnéticos disfrutan la relación; el asesor convierte el entusiasmo compartido en una lista concreta de referidos antes de que se diluya.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × magnetico (cliente)');
