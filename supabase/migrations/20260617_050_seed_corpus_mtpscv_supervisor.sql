-- Migración 050 — Seed corpus MTPSCV, escenario SUPERVISOR (16 celdas)
-- Modelo de dos ejes: escenario='supervisor', etapa_ciclo='coaching' (relación interna de coaching, no venta).
-- perfil = tipo del ASESOR (recibe coaching). tags = tipo del SUPERVISOR (interlocutor). Bidireccional: modula asesor y supervisor-coach.
-- Idempotente: WHERE NOT EXISTS por titulo. Requiere migración 046 (escenario + CHECKs).

-- Asesor ENERGÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','supervisor','coaching','energetico × energetico (supervisor)',
'DINÁMICA: dos perfiles de control en relación jerárquica; el asesor quiere autonomía de resultados y el supervisor quiere imponer su método. Pulseada por quién dirige el desarrollo.
RIESGO (baja integración): choque de mando — el asesor vive la dirección como invasión y se cierra; el supervisor sube la presión y la sesión se vuelve duelo de egos donde no entra aprendizaje.
FORMA RESUELTA (alta integración): el supervisor plantea el feedback como acuerdo entre pares orientado a resultados (cede protagonismo sin perder dirección); el asesor, con apertura, escucha aunque le cueste ceder control. Caso: el supervisor propone "tú eliges dos de estas tres correcciones de cierre y las medimos esta semana"; el asesor, que valora decidir, se compromete.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × energetico (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','supervisor','coaching','energetico × reflexivo (supervisor)',
'DINÁMICA: el asesor quiere ir rápido y por resultados; el supervisor quiere fundamentar cada ajuste con datos y método. Ritmos opuestos en la sesión.
RIESGO (baja integración): el supervisor abruma con análisis extensos; el asesor enérgico se impacienta, descarta el feedback como "teoría" y no lo aplica.
FORMA RESUELTA (alta integración): el supervisor sintetiza el desarrollo en pocas consecuencias accionables; el asesor reconoce que el rigor sostiene sus resultados y baja la prisa para escuchar el porqué. Caso: el supervisor analítico resume "tu objeción recurrente sale de saltarte el descubrimiento; corrígelo y tu cierre sube", y el asesor lo adopta al ver el resultado.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × reflexivo (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','supervisor','coaching','energetico × relacional (supervisor)',
'DINÁMICA: el asesor va al grano y quiere métricas; el supervisor cálido cuida el vínculo y la contención antes de corregir.
RIESGO (baja integración): el supervisor suaviza tanto el feedback que el mensaje correctivo se diluye; el asesor enérgico no percibe dirección clara y desestima la sesión como charla.
FORMA RESUELTA (alta integración): el supervisor mantiene la calidez pero entrega la corrección directa y medible que el asesor necesita; el asesor valora el respaldo humano detrás del dato. Caso: acompaña con calidez pero cierra con "te lo digo claro porque quiero verte ganar: este mes te falta constancia en el seguimiento"; el asesor agradece la franqueza.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × relacional (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','supervisor','coaching','energetico × magnetico (supervisor)',
'DINÁMICA: dos altas energías en la relación de coaching; conexión rápida y entusiasta, sesiones animadas.
RIESGO (baja integración): mucha chispa y poca sustancia — se entusiasman mutuamente, la sesión termina en arenga y no queda un plan de desarrollo concreto ni seguimiento.
FORMA RESUELTA (alta integración): el supervisor encauza el entusiasmo compartido en un compromiso de desarrollo medible; el asesor acepta que la energía debe aterrizar en acción. Caso: se motivan, pero el supervisor cierra fijando "una meta esta semana, la revisamos el viernes con número en mano".',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × magnetico (supervisor)');

-- Asesor REFLEXIVO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','supervisor','coaching','reflexivo × energetico (supervisor)',
'DINÁMICA: el asesor quiere entender y procesar el feedback con calma; el supervisor enérgico quiere corrección inmediata y acción ya.
RIESGO (baja integración): el supervisor presiona por velocidad y bloquea al asesor, que se repliega, se siente atropellado y deja de exponer sus dudas.
FORMA RESUELTA (alta integración): el supervisor baja la presión y da espacio para procesar, pidiendo un compromiso con plazo razonable; el asesor, con apertura, acepta moverse antes de tener el 100% de certeza. Caso: el supervisor aprende a decir "tómate el día para revisarlo, pero el jueves lo aplicamos"; el asesor, sin sentirse forzado, avanza.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × energetico (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','supervisor','coaching','reflexivo × reflexivo (supervisor)',
'DINÁMICA: dos perfiles cautos y minuciosos; confianza técnica mutua y diagnósticos sólidos.
RIESGO (baja integración): "parálisis por análisis" a dos bandas — la sesión se vuelve un ejercicio intelectual interminable y nunca se traduce en cambio de conducta; el desarrollo no avanza.
FORMA RESUELTA (alta integración): el supervisor introduce un cierre con plazo al propio proceso de coaching; ambos acuerdan pasar del análisis a una prueba concreta. Caso: el supervisor propone "ya diagnosticamos suficiente; esta semana pruebas este ajuste y la próxima medimos", destrabando la acción.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × reflexivo (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','supervisor','coaching','reflexivo × relacional (supervisor)',
'DINÁMICA: el asesor busca rigor y criterio en el feedback; el supervisor cálido prioriza el vínculo y el clima emocional. Buena base si el supervisor aporta también sustancia.
RIESGO (baja integración): el supervisor da contención donde el asesor esperaba un diagnóstico técnico; el asesor lo percibe como falta de criterio y no confía en la dirección.
FORMA RESUELTA (alta integración): el supervisor envuelve un feedback fundamentado en interés genuino; el asesor valora que detrás del trato cálido hay análisis serio. Caso: una supervisora cálida acompaña su cercanía con un diagnóstico concreto de dónde se traba el cierre; el asesor, tranquilo, lo adopta.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × relacional (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','supervisor','coaching','reflexivo × magnetico (supervisor)',
'DINÁMICA: el asesor es medido y quiere datos; el supervisor expansivo motiva con visión y energía. Ritmos y lenguajes opuestos.
RIESGO (baja integración): el supervisor inspira sin estructura; el asesor reflexivo desconfía del entusiasmo sin sustento y desconecta del coaching.
FORMA RESUELTA (alta integración): el supervisor respalda su entusiasmo con un dato verificable y un plan claro; el asesor se permite contagiarse de la visión sin perder el rigor. Caso: el supervisor modera la arenga y le muestra al asesor la cifra que mejora si ajusta su ritmo de cierre; el reflexivo se suma.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × magnetico (supervisor)');

-- Asesor RELACIONAL
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','supervisor','coaching','relacional × energetico (supervisor)',
'DINÁMICA: el asesor cálido necesita sentirse apoyado para recibir la corrección; el supervisor enérgico va directo a la métrica y al ajuste.
RIESGO (baja integración): el supervisor corrige en seco; el relacional lo vive como rechazo personal, se desmotiva y entra en conducta sumisa (acepta de boca, no cambia).
FORMA RESUELTA (alta integración): el supervisor mantiene la firmeza pero enmarca la corrección en respaldo a la persona; el asesor entiende que el feedback directo no es ataque y toma la iniciativa de aplicarlo. Caso: el supervisor abre con "valoro cómo cuidas a tus clientes; ahora vamos a que eso se convierta en cierres"; el relacional, sostenido, actúa.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × energetico (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','supervisor','coaching','relacional × reflexivo (supervisor)',
'DINÁMICA: el asesor cálido y el supervisor cauto pueden construir confianza profunda; el asesor busca vínculo, el supervisor busca método.
RIESGO (baja integración): el supervisor entrega diagnóstico frío y datos donde el relacional esperaba calor; el asesor se siente evaluado, no acompañado, y se retrae.
FORMA RESUELTA (alta integración): el supervisor acompaña su rigor con calidez explícita; el asesor recibe el dato como ayuda, no como juicio. Caso: el supervisor suaviza su informe con un "esto lo trabajamos juntos, no es una nota"; la asesora, tranquila, lo aplica.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × reflexivo (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','supervisor','coaching','relacional × relacional (supervisor)',
'DINÁMICA: dos perfiles de vínculo; clima cálido y de mucha confianza en la relación de coaching.
RIESGO (baja integración): "complacencia recíproca" — ninguno quiere incomodar al otro, la conversación correctiva difícil nunca se da y el desarrollo se estanca en buen clima sin avance.
FORMA RESUELTA (alta integración): el supervisor activa firmeza con calidez (suma dominancia a su ruta) y nombra lo que hay que corregir sin romper el vínculo; el asesor acepta que el cariño incluye exigencia. Caso: la supervisora dice "porque me importa tu carrera, hoy te voy a decir algo incómodo sobre tu cierre"; la asesora lo recibe bien.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × relacional (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','supervisor','coaching','relacional × magnetico (supervisor)',
'DINÁMICA: ambos orientados a personas; sesiones de coaching cálidas y animadas, mucha afinidad.
RIESGO (baja integración): la sesión se vuelve un encuentro social agradable; el supervisor motiva pero no estructura y el asesor no se lleva un plan concreto de desarrollo.
FORMA RESUELTA (alta integración): el supervisor capitaliza la afinidad para fijar un compromiso amable pero concreto; el asesor toma la iniciativa de sostenerlo. Caso: el supervisor, tras una charla cálida, agenda ahí mismo con la asesora la acción de la semana y la fecha de revisión.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × magnetico (supervisor)');

-- Asesor MAGNÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','supervisor','coaching','magnetico × energetico (supervisor)',
'DINÁMICA: dos asertividades altas; el asesor busca reconocimiento y protagonismo, el supervisor quiere control y resultados.
RIESGO (baja integración): compiten por la escena en la sesión; el supervisor corrige duro y el magnético, herido en su necesidad de aprobación, reacciona a la defensiva (conducta bajo presión: ataque).
FORMA RESUELTA (alta integración): el supervisor reconoce primero y corrige después, dándole protagonismo al asesor sobre su propia mejora; el asesor recibe la firmeza sin sentirla como descrédito. Caso: el supervisor abre reconociendo el carisma del asesor y luego pide "ahora hazlo medible: foco y seguimiento"; el magnético, valorado, se enfoca.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × energetico (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','supervisor','coaching','magnetico × reflexivo (supervisor)',
'DINÁMICA: el asesor expansivo necesita reconocimiento y energía; el supervisor analítico corrige con métrica, datos y detalle. Choque de necesidades — el desajuste más severo.
RIESGO (baja integración): el supervisor abruma al magnético con planillas y diagnósticos fríos; el asesor, que necesita brillar y ser visto, se aburre, se siente menospreciado y desconecta del coaching.
FORMA RESUELTA (alta integración): el supervisor traduce el dato a un reto motivador y reconoce el avance; el asesor acepta que el respaldo en números sostiene su brillo (suma foco y sustancia, su ruta). Caso: el supervisor presenta la corrección como "estos números te van a hacer ver aún mejor frente al equipo"; el magnético se engancha y aterriza.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × reflexivo (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','supervisor','coaching','magnetico × relacional (supervisor)',
'DINÁMICA: ambos cálidos y orientados a personas; conexión emocional rápida en el coaching.
RIESGO (baja integración): el supervisor evita la corrección para no romper el buen clima y el magnético, que ya elude el detalle, queda sin estructura; ambos se quedan en lo afectivo y el desarrollo no concreta.
FORMA RESUELTA (alta integración): el supervisor mantiene la calidez pero introduce el foco y el seguimiento que al magnético le faltan; el asesor acepta aterrizar su entusiasmo en compromisos. Caso: el supervisor, sin enfriar el vínculo, dice "me encanta tu energía; vamos a convertirla en tres seguimientos concretos esta semana"; el magnético se compromete.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × relacional (supervisor)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','supervisor','coaching','magnetico × magnetico (supervisor)',
'DINÁMICA: dos carismas; la sesión de coaching es pura energía, simpatía y motivación mutua.
RIESGO (baja integración): puro entusiasmo y elogio recíproco, cero concreción — se motivan, se aplauden y la sesión no deja ningún plan de desarrollo ni seguimiento medible.
FORMA RESUELTA (alta integración): el supervisor toma la responsabilidad de aterrizar la energía en compromisos concretos con fecha; el asesor acepta que el entusiasmo necesita estructura. Caso: dos perfiles magnéticos disfrutan la sesión; el supervisor, antes de cerrar, convierte la motivación en "una meta, una fecha, un número", para que la chispa no se evapore.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × magnetico (supervisor)');
