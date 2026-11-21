# Especificación del asistente · DeepSeek
**Responsable Samuel.** El entrenador solicita una propuesta y decide si editarla, descartarla o aprobarla. Hellen presenta el estado devuelto y Alex proporciona la evaluación, el catálogo y la persistencia. El modelo nunca recibe una operación de publicación.

### Entradas y salidas acordadas
| Operación | Entradas mínimas | Resultado esperado |
|---|---|---|
| Generar | Referencia seudónima, evaluación fechada, objetivo, días disponibles, nivel u observación inicial, restricciones conocidas, catálogo y criterios revisados | Borrador por día con ejercicioId, dosis propuesta, descanso, motivo visible, criterioId, datos utilizados y pendientes. |
| Reorganizar | Lo anterior más versión vigente, sesiones ya ejecutadas y cambio indicado por el entrenador | Nueva versión con referencia a la anterior. Resumen de elementos mantenidos, movidos, añadidos o retirados, con su motivo. |
| Aclarar | Dato crítico ausente, contradictorio o restricción que el catálogo no permite resolver | Pregunta concreta al entrenador y campos pendientes. Conservar evaluación y plan vigentes. |

**Instrucción operativa.** Usa exclusivamente los ejercicios y criterios revisados suministrados. Distingue lo observado por el entrenador, lo comunicado por el atleta y lo pendiente de evaluar. Relaciona cada elección con el objetivo o un dato disponible. Expresa las propuestas en lenguaje que el atleta pueda comprender. Una nota privada queda en la ficha profesional. Una medición ausente o una proporción corporal aislada no autoriza inferir un diagnóstico. Solicita aclaración si una restricción impide aplicar los criterios disponibles.

**Validación en el servidor.** Comprobar forma de salida, número de días distintos, identificadores de catálogo y criterios vigentes, unidades, dosis dentro de los límites revisados y compatibilidad con restricciones registradas. Si falla, devolver el motivo a revisión. Registrar operación, modelo utilizado, versión de criterios, evaluación, versión base y resultado. El entrenador puede iniciar un borrador manual si DeepSeek falla. Identificar su origen al guardarlo.

### Caso de referencia para la demo
Ana dispone de lunes y jueves y busca constancia. Eva registró que practicó E1 y E2 durante una sesión inicial. Sin valores antropométricos registrados, las explicaciones deben poder sostenerse en esa observación. Como ejemplo de interfaz, V1 propone dos sesiones breves. Eva revisa la distribución, edita el descanso del banco a 60 segundos y aprueba. Al solicitar una tercera sesión, indicar qué bloque se traslada al sábado y si el total semanal cambia. Mostrar la decisión previa de Eva sobre el descanso y señalar cualquier cambio para su revisión. La versión vigente sigue siendo V1 hasta la segunda aprobación. Si el imprevisto es una semana de ausencia, pedir la disponibilidad de regreso y presentar un reajuste revisable, sin compensación automática de carga.

| Prueba | Resultado que acepta Samuel |
|---|---|
| Dos días y EV1 suficiente | Dos días distintos, motivos trazables y estado borrador. |
| Faltan días disponibles | Solicitud de aclaración «¿Cuántos días puede entrenar esta semana?» |
| Falta InBody con datos suficientes | La salida indica ausencia del dato y usa la observación disponible. |
| Restricción incompatible con todo el catálogo | Solicita revisión y no asigna ejercicios incompatibles. |
| Ejercicio o fuente inventada | El servidor rechaza la propuesta antes de publicarla. |
| Cambio a tres días con SE1 iniciada | V2 explica el cambio. SE1 continúa con V1 incluso después de aprobar V2. |
| DeepSeek tarda o falla | Se informa la incidencia y permanece disponible el último plan aprobado. |
| Atleta intenta aprobar o dos ventanas editan la misma revisión | Se deniega el primer caso. El segundo editor recarga la revisión vigente. |

**Validación profesional pendiente.** Antes de presentar una justificación como criterio de entrenamiento, registrar fuente, revisión y firma del profesional sobre los ejercicios del caso. En la prueba con Laura y Juan Diego, pedir que señalen qué modificarían y qué información falta. Conservar sus correcciones como casos de evaluación del siguiente ciclo.

**Integración con la web y la futura app.** Samuel mantiene las dos operaciones de DeepSeek dentro de Express. El servicio recibe de Alex la evaluación autorizada, la versión vigente y el catálogo almacenados en Supabase. Hellen presenta las respuestas de la API. La aprobación del entrenador persiste en PostgreSQL y conserva el historial para ambos clientes.
