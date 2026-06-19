-- Migración 047 — Seed corpus MTPSCV, escenario PROSPECTO (16 celdas)
-- Idempotente: INSERT ... WHERE NOT EXISTS por titulo. Re-aplicar no duplica.
-- perfil = id_tipo canónico ERRIM (tipo_catalogo). categoria = interaccion_tipos. etapa_ciclo = prospeccion.
-- escenario en columna propia; tags = solo tipo_interlocutor (modelo dos ejes). fuente = corpus_mtpscv. completitud = 100. embedding NULL (RAG fuera de alcance 2b).

-- Asesor ENERGÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','prospecto','prospeccion','energetico × reflexivo (prospecto)',
'DINÁMICA: el asesor empuja al cierre con ritmo rápido y afirmaciones directas; el prospecto Reflexivo necesita evidencia, tiempo y sensación de decidir bien. Su objeción casi nunca es un "no": es petición de datos para reducir el riesgo percibido.
RIESGO (baja integración): el asesor confunde la petición de datos con excusa y acelera; valida el temor del prospecto a ser apurado, que se retira a un "lo voy a pensar".
FORMA RESUELTA (alta integración): el asesor baja el ritmo y convierte el empuje en provisión ordenada de evidencia; conserva orientación a resultados pero al servicio del criterio del prospecto, acota plazos y deja madurar la decisión sin abandonarla.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × reflexivo (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','prospecto','prospeccion','energetico × energetico (prospecto)',
'DINÁMICA: dos perfiles de control; el prospecto mide si el asesor está "a su nivel". Riesgo de pugna por el control.
RIESGO (baja integración): choque de egos; el prospecto descarta al asesor por no cederle el mando.
FORMA RESUELTA (alta integración): el asesor mantiene dominancia pero cede la percepción de decisión. Caso: ante un empresario que quiere mandar, usa el cierre de opciones —"dos coberturas, usted elige cuál— y le transfiere el control sin perder la dirección.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × energetico (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','prospecto','prospeccion','energetico × relacional (prospecto)',
'DINÁMICA: el asesor empuja; el prospecto necesita sentir que le importa antes de evaluar nada.
RIESGO (baja integración): el ritmo del asesor deshumaniza al prospecto, que se cierra.
FORMA RESUELTA (alta integración): el asesor activa su ruta al Integrador (sumar calidez): baja revoluciones, hace small talk genuino, enfoca en cómo la póliza protege a la familia. Caso: frena su prisa con una clienta cálida, pregunta por sus hijos, y recién después plantea la cobertura como protección de ellos.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × relacional (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','prospecto','prospeccion','energetico × magnetico (prospecto)',
'DINÁMICA: dos altas energías; conexión rápida y entusiasta.
RIESGO (baja integración): mucha chispa, el cierre se diluye en entusiasmo mutuo sin concreción.
FORMA RESUELTA (alta integración): el asesor encauza la energía hacia una decisión concreta. Caso: comparte el entusiasmo pero aterriza "firmemos hoy la opción que te hace ver como el que resolvió esto para tu familia".',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × magnetico (prospecto)');

-- Asesor REFLEXIVO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','prospecto','prospeccion','reflexivo × energetico (prospecto)',
'DINÁMICA: el asesor quiere fundamentar; el prospecto quiere el punto y el resultado ya.
RIESGO (baja integración): el asesor abruma con análisis; el enérgico se impacienta y descarta.
FORMA RESUELTA (alta integración): el asesor activa su ruta (sumar empuje): sintetiza en consecuencias y ROI, no en proceso. Caso: resume a un empresario enérgico "dos opciones, esta te cubre X y cuesta Y; ¿avanzamos?", reservando el detalle para si lo piden.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × energetico (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','prospecto','prospeccion','reflexivo × reflexivo (prospecto)',
'DINÁMICA: dos perfiles cautos; confianza técnica mutua, pero lentitud.
RIESGO (baja integración): el análisis se vuelve fin en sí mismo y la decisión se bloquea ("parálisis por análisis" de ambos lados).
FORMA RESUELTA (alta integración): el asesor introduce un cierre validador con plazo. Caso: entrega toda la evidencia y marca "el proceso de firma avanza cuando usted tenga todos los elementos para decidir con certeza", dando permiso a cerrar.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × reflexivo (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','prospecto','prospeccion','reflexivo × relacional (prospecto)',
'DINÁMICA: el asesor aporta rigor; el prospecto necesita calor humano.
RIESGO (baja integración): el asesor responde con datos donde el relacional esperaba interés genuino; lo percibe frío.
FORMA RESUELTA (alta integración): el asesor activa su ruta (sumar calidez): deja la planilla, pregunta cómo se siente, enfoca en las personas. Caso: ante una clienta relacional, abandona el cuadro técnico y conversa sobre qué la preocupa de su familia antes de proponer.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × relacional (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','prospecto','prospeccion','reflexivo × magnetico (prospecto)',
'DINÁMICA: el asesor aporta rigor y comparativas; el prospecto Magnético decide por entusiasmo y visión, no por auditoría.
RIESGO (baja integración): el asesor abruma con datos y el prospecto se desconecta.
FORMA RESUELTA (alta integración): el asesor envuelve el dato en relato y beneficio vivido, selecciona los dos o tres números que importan y los pone al servicio de una imagen aspiracional con la que el prospecto se identifica.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × magnetico (prospecto)');

-- Asesor RELACIONAL
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','prospecto','prospeccion','relacional × reflexivo (prospecto)',
'DINÁMICA: el asesor cálido; el prospecto cauto que quiere credibilidad técnica.
RIESGO (baja integración): la calidez sin sustancia incomoda al reflexivo, que no confía.
FORMA RESUELTA (alta integración): el asesor mantiene calidez pero respalda con un dato verificable. Caso: acompaña su trato con un ejemplo concreto de cómo gestionó un siniestro; el reflexivo, tranquilizado, avanza.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × reflexivo (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','prospecto','prospeccion','relacional × relacional (prospecto)',
'DINÁMICA: dos perfiles de vínculo; clima muy agradable.
RIESGO (baja integración): "trampa de la complacencia recíproca": la visita se vuelve social y nadie cierra.
FORMA RESUELTA (alta integración): el asesor activa su ruta (sumar dominancia): conducción firme con calidez, pide la decisión sin romper el clima. Caso: tras una charla cálida, dice "porque me importa que quedes protegido de verdad, te pido que decidamos esto hoy".',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × relacional (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','prospecto','prospeccion','relacional × magnetico (prospecto)',
'DINÁMICA: ambos orientados a personas; mucha afinidad.
RIESGO (baja integración): dos que disfrutan la charla; el cierre se pospone indefinidamente.
FORMA RESUELTA (alta integración): el asesor capitaliza la afinidad con un cierre amable y firme. Caso: aprovecha el entusiasmo del prospecto magnético para cerrar en el momento de máxima conexión, sin dejar enfriar.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × magnetico (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','prospecto','prospeccion','relacional × energetico (prospecto)',
'DINÁMICA: el asesor construye vínculo y calidez; el prospecto Energético quiere ir al punto y decidir.
RIESGO (baja integración): el asesor alarga la conversación y el prospecto lo lee como pérdida de tiempo.
FORMA RESUELTA (alta integración): el asesor pone la respuesta directa primero (dos opciones claras entre las que el prospecto elige) y el vínculo al servicio de esa eficiencia.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × energetico (prospecto)');

-- Asesor MAGNÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','prospecto','prospeccion','magnetico × energetico (prospecto)',
'DINÁMICA: dos asertividades altas; el prospecto mide autoridad, el asesor quiere brillar.
RIESGO (baja integración): compiten por la escena; el enérgico descarta al asesor por "vendedor de humo".
FORMA RESUELTA (alta integración): el asesor activa su ruta (sumar sustancia): pone el carisma al servicio del prospecto y respalda con datos. Caso: ante un empresario enérgico, modera el show, demuestra solidez con una cifra concreta y lo hace sentir el que decide.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × energetico (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','prospecto','prospeccion','magnetico × relacional (prospecto)',
'DINÁMICA: ambos cálidos; conexión emocional rápida.
RIESGO (baja integración): el asesor arrolla con energía a un relacional pausado, que se siente abrumado.
FORMA RESUELTA (alta integración): el asesor baja revoluciones y escucha al ritmo del otro. Caso: modera su intensidad con una clienta reservada, le da espacio y enfoca en el bienestar de ella antes de proponer.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × relacional (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','prospecto','prospeccion','magnetico × magnetico (prospecto)',
'DINÁMICA: dos carismas; pura energía y simpatía.
RIESGO (baja integración): puro entusiasmo, cero concreción; nadie aterriza el cierre.
FORMA RESUELTA (alta integración): el asesor toma la responsabilidad de concretar. Caso: dos perfiles expansivos disfrutan la reunión; el asesor convierte la chispa en una firma concreta antes de que se evapore, con fecha y opción elegida.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × magnetico (prospecto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','prospecto','prospeccion','magnetico × reflexivo (prospecto)',
'DINÁMICA: el asesor persuade con carisma y visión de conjunto; el prospecto Reflexivo se mueve por evidencia y verificación.
RIESGO (baja integración): el asesor sube la emoción para vencer la objeción y el prospecto lee el entusiasmo como falta de sustancia.
FORMA RESUELTA (alta integración): el asesor ancla su energía en datos ordenados y verificables, respetando el ritmo de verificación del prospecto.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × reflexivo (prospecto)');
