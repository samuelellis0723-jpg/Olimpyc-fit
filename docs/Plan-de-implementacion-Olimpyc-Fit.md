# Olimpyc Fit | Plan de implementación
**Documento de preparación para Hellen, Alex y Samuel · 21 de noviembre de 2026**

## 1. Qué debe demostrar el equipo

**Entrega del domingo 22 de noviembre de 2026.** El equipo dispone de aproximadamente 34 horas efectivas para presentar el MVP a un gimnasio. La demostración debe probar tres experiencias conectadas y dos decisiones de planificación supervisadas. Usar un portátil y dos teléfonos permite ver quién publica, quién entrena y quién recibe la alerta.

| Experiencia | Tarea principal | Resultado visible |
|---|---|---|
| Atleta · web app móvil | Abrir su rutina aprobada, consultar el movimiento y grupo muscular, iniciar el ejercicio, registrar tiempos y series, cambiar el orden y pedir ayuda. | Ve cuánto lleva, qué le falta y si su solicitud fue registrada y atendida. |
| Entrenador · web de escritorio | Gestionar atletas asignados, revisar evaluaciones y métricas, crear, editar, aprobar y reorganizar rutinas. | Compara dos versiones de un plan y decide cuál publicar. Para la demo bastan métricas derivadas de una sesión, como tiempo registrado y series completadas. |
| Entrenador · móvil en sala | Recibir las alertas de sus atletas y atender su cola personal desde el teléfono. | Ve al atleta, el ejercicio o estación y el turno que corresponde. |

**Arquitectura propuesta para continuar después del evento.** Una web responsive en React/Vite con tres vistas por rol y tarea, una API modular Node/Express y PostgreSQL administrado en Supabase. Alex mantiene las migraciones y el esquema versionado. Supabase Auth identifica al usuario, Express comprueba su rol y asignación y Supabase Realtime actualiza la cola abierta. Web Push entrega el aviso al dispositivo suscrito cuando la web está en segundo plano. En la futura app se reutilizarán la API, los datos y las reglas de negocio. La interfaz y el canal de notificación se adaptarán a la tecnología móvil elegida. Compartir identidades, planes versionados y sesiones entre las tres vistas. El servidor resuelve el gimnasio y entrenador asignado. El canal de notificación y el proveedor de IA se conectan a través de sus módulos, de forma que el piloto pueda ampliar uno sin rehacer el otro. El equipo confirma acceso a DeepSeek integrado. El ensayo comprobará su funcionamiento de extremo a extremo. Para esta entrega, preparar dos entrenadores y tres atletas ficticios, dos de ellos asignados al mismo entrenador.

## 2. Qué aportó cada fuente y cómo afecta al producto

| Fuente | Observación o propuesta | Decisión de diseño y comprobación |
|---|---|---|
| Laura | Combina evaluación del movimiento, fuerza básica, composición corporal, objetivo y días disponibles. A distancia depende más del formulario y de mediciones externas. | Incluir modalidad, disponibilidad y procedencia. El entrenador puede guardar una ficha parcial. Un dato ausente aparece como pendiente. Un caso de dos días produce dos sesiones semanales. |
| Laura | Reprograma cada cuatro a seis semanas, puede revisar cardio aproximadamente cada quince días y describe una prueba de fuerza hacia el tercer mes. La disponibilidad puede cambiar entre ciclos. | Separar fecha de revisión del plan, seguimiento y reevaluación. El entrenador elige las fechas. Cambiar de dos a tres días crea una revisión y conserva el ciclo anterior. Nutrición queda fuera del producto inicial. |
| Juan Diego | Usa diseños de rutinas en Canva, menciona Excel en su entorno y adapta volumen, descanso y frecuencia al objetivo o deporte. Observa una primera sesión y utiliza bioimpedancia. | Dar el mismo lugar a una observación de sesión que a un test estructurado, identificando su origen. Permitir editar series, repeticiones y descanso en el borrador. Probar con una ficha sin batería formal de tests. |
| Hellen, en «Hellen dijo» | Bienvenida del gimnasio, registro único, guía inicial, entrenador asignado, meta del ciclo, progreso y cola por llegada. También distingue los comentarios para la empresa de las alertas al entrenador. | Primera visita guiada y retorno directo a la rutina del día. Mantener visible quién atiende. Al cerrar una sesión incompleta, mostrar los ejercicios pendientes y dejar confirmar. Reservar reportes empresariales para un canal con acceso propio. |
| Alex | Integra tests, catálogo muscular, panel del entrenador y sesión guiada. Da importancia al visor anatómico y al lenguaje visual de tinta. | Catálogo común con grupo muscular, estación, guía y recurso visual. Un identificador conecta evaluación, propuesta y pantalla. Hellen dirige el diseño y Alex entrega los datos que necesita el visor. |
| Samuel | Quiere que el agente relacione antropometría, observaciones, objetivos y seguimiento, y que el cliente entienda sus ejercicios y pueda pedir ayuda. | La propuesta debe identificar qué dato registrado y qué criterio revisado respaldan cada elección. El entrenador puede corregirla. Los ejemplos anatómicos del equipo son hipótesis que requieren revisión profesional antes de convertirse en reglas. |
| Conversación posterior sobre las entrevistas | El equipo propone comunicar ausencias y reorganizar entrenamientos. Menciona membresías y cobros como oportunidad futura. | En la demo, el entrenador introduce el imprevisto y revisa el nuevo borrador. Para el piloto, añadir el aviso de ausencia desde el móvil del atleta. El entrenador decide si conserva o revisa el plan. Una ausencia por sí sola no justifica aumentar cargas. |
| Documento maestro y mentorías | Piden dos interfaces, explicabilidad, progresión, ayuda contextual y una demo vertical. Definen identidad y visión empresarial. | Priorizar un recorrido completo antes de ampliar catálogos. Traducir «ubicación exacta» a estación identificada por el cliente. Si hay dos máquinas iguales, se necesita un identificador visible o se muestra únicamente el ejercicio conocido. |

Las entrevistas describen dos prácticas concretas. Sirven para diseñar entradas flexibles y para reclutar pruebas de uso. La rapidez de captura, el interés de otros gimnasios y la utilidad real de la cola todavía se deben medir.

## 3. Alcance por entrega

| Entrega | Qué entra | Condición para avanzar |
|---|---|---|
| MVP del hackathon | Acceso demo por rol, bienvenida y regreso, cartera asignada, ficha y evaluación breve, catálogo pequeño, generación inicial y reorganización en vivo con DeepSeek, comparación de versiones, edición y aprobación, rutina del día con series y descanso, guía anatómica de los ejercicios de muestra, registro de tiempos y series, sesión activa, cola móvil individual FIFO y fecha de próxima revisión. | El equipo demuestra las tres vistas, dos aprobaciones humanas y una notificación visible en la pantalla bloqueada del entrenador asignado. |
| Primera versión piloto | Alta por invitación, historial comparable por fecha y unidad, aviso de fin de ciclo, calendario semanal, ausencia y revisión de disponibilidad, progresión aprobada después de reevaluar, explorador muscular y ampliación de animaciones. | Entrenadores prueban un ciclo y una replanificación. Se aprueba el manejo de datos reales antes de reclutar clientes. |
| Ampliación | Espacios para entrenadores independientes. Adjuntos InBody y fotos opcionales con controles de acceso y borrado, agenda de citas, membresías y cobros para independientes. Para empresas, sedes, QR, asistencia, equipos, reportes de averías y canal confidencial de conducta. | Confirmar demanda, destinatarios y operación por tipo de negocio. Para denuncias, acordar quién recibe y atiende antes de habilitar envíos. |

Para el MVP basta registrar manualmente una medición externa ficticia con fecha, fuente y unidad. La cédula propuesta para el alta requiere justificar su necesidad con el gimnasio. La demo usa identidades ficticias preasignadas. La alerta en sala se ofrece en sesiones presenciales con entrenador asignado. Para los clientes remotos, la vista explica cómo solicitar una revisión del plan cuando ese canal esté disponible.

## 4. Tres responsables y una frontera clara entre los dos backends

| Persona | Decide y entrega | Entrega a sus compañeros | Prueba que lidera |
|---|---|---|---|
| **Hellen · producto y frontend** | Portada, navegación, bienvenida, tres experiencias por rol y dispositivo, formularios, estados de conexión, producción de animaciones, visor y accesibilidad. Posee los componentes, páginas, rutas y servicios de consumo del frontend. | Mapa de pantallas y campos necesarios para Alex y Samuel, ejemplos visuales de espera, rechazo, datos faltantes y éxito. | Recorrido desde móvil y escritorio, teclado, retorno a sesión, lectura de mensajes y claridad de la aprobación. |
| **Alex · plataforma, operación en sala y datos** | Estructura del servidor, identidad y asignaciones, perfiles, evaluaciones, catálogo, sesiones, series, alertas y canal en vivo. Mantiene los modelos, las migraciones, los datos demo y la integración de infraestructura. | A Hellen, acceso, ficha, sesión y cola. A Samuel, lectura del perfil autorizado y catálogo, y operaciones de persistencia de versiones acordadas. | Integridad en PostgreSQL, aislamiento por usuario y espacio, orden de cola, reconexión y reintentos. |
| **Samuel · backend de planificación e IA** | Generación y validación de propuestas, reglas de elegibilidad del catálogo, editor de borrador en servidor, aprobación, consulta del plan vigente, revisión de ciclo, integración del proveedor y evaluación de resultados. | A Hellen, operaciones de generar, editar, publicar y consultar. A Alex, requisitos de almacenamiento y la consulta del plan aprobado que usa una sesión. | Casos de personalización, datos insuficientes, edición concurrente, fallo del proveedor y publicación exclusivamente humana. |

**Ejemplo de frontera.** Si Hellen pide mostrar el motivo de selección de un ejercicio, Samuel define su significado y lo entrega con el plan. Si requiere persistencia, Alex prepara el cambio de datos y Samuel lo consume. Hellen desarrolla la tarjeta con un ejemplo acordado desde el primer día. Si una alerta aparece duplicada, Alex corrige el origen y Hellen verifica la pantalla. Samuel no interviene en la cola.

**Acuerdo de colaboración.** Una tarea corta, un dueño, una rama y una revisión de la persona que consume el resultado. Alex mantiene el arranque común del servidor y el orden de migraciones. Samuel mantiene el módulo de planificación y su contrato. Hellen mantiene la navegación y el contrato de presentación. Los tres pueden ayudar con pruebas y revisión. Para trasladar una implementación, el responsable actual registra el traspaso en la tarjeta antes de que la otra persona edite esos archivos. Integrar al cierre de cada bloque del cronograma. Cada revisión debe indicar qué cambió para el consumidor y qué ejemplo puede repetir.

## 5. Contratos que desbloquean el trabajo paralelo

Acordar en papel los siguientes intercambios y un ejemplo ficticio de cada respuesta. El responsable de cada operación mantiene sus campos, estados y errores. Ante un cambio incompatible, productor y consumidor pactan la transición en la misma tarjeta.

| Operación y dueño | Entrada y salida mínimas | Regla compartida |
|---|---|---|
| Abrir ficha y registrar evaluación · Alex | Cliente asignado, objetivo, días disponibles, modalidad, experiencia, fecha, observación o test, unidad, procedencia, restricciones y campos pendientes. Devuelve versión de evaluación. | Diferenciar observado, autorreportado, externo y sin evaluar. Nuevas mediciones conservan las anteriores. |
| Preparar propuesta · Samuel | Evaluación identificada, disponibilidad y catálogo habilitado. Devuelve borrador por día, ejercicios, dosis propuesta, motivos, datos utilizados y aspectos pendientes de revisión. | Si falta un dato necesario para justificar una elección, pedirlo o dejar la decisión al entrenador. |
| Editar, aprobar y consultar · Samuel | Borrador, versión esperada, cambios y entrenador asignado. Devuelve versión aprobada, autor, fecha y próxima revisión. | Un borrador es privado al entrenador. Una segunda edición sobre una versión antigua pide recargar. Una sesión iniciada conserva su versión. |
| Reorganizar el plan · Samuel | Versión vigente, cambio de disponibilidad o ausencia, restricciones y observaciones. Devuelve un nuevo borrador, un resumen de cambios por día y sus motivos. | La ayuda rápida al entrenador permite ajustar el borrador. El entrenador decide qué publicar y conserva el contacto con el atleta. |
| Abrir sesión y marcar avance · Alex | Cliente autenticado, plan aprobado, día, ejercicio activo, estación si se conoce y series completadas, inicio y fin de ejercicio o descanso. Devuelve el avance y los tiempos recuperables tras recargar. | Reordenar la ejecución cambia el ejercicio activo. La prescripción y las cargas de referencia siguen bajo control del entrenador. |
| Solicitar y atender ayuda · Alex | Sesión activa y contexto observado al pulsar. Devuelve turno, estado y confirmación al cliente. Alex guarda la solicitud y envía una notificación push al teléfono registrado del entrenador asignado. El turno permanece en la cola aunque falle la entrega del aviso. | FIFO por entrenador según recepción en servidor, con desempate estable. El servidor permite atender primero la solicitud pendiente más antigua y evita difundirla a otros entrenadores. Una alerta pendiente por sesión. Al reconectar, recuperar la cola guardada. Una segunda pulsación devuelve el turno abierto. |
| Mostrar el recorrido · Hellen | Consume los intercambios con ejemplos compartidos y después con datos del servidor. | Distinguir enviando, confirmado, sin conexión y atendido. Pedir ayuda sin ejercicio marcado sigue siendo posible y el panel muestra «Ejercicio sin indicar». |

**Modelo conceptual para Alex.** Espacio de trabajo → miembros y asignaciones entrenador-cliente. Cliente → evaluaciones fechadas y ciclos. Ciclo → versiones de rutina → días y ejercicios prescritos. Catálogo → ejercicios, grupos, estaciones y medios visuales. Sesión → versión aprobada, ejercicio activo y series realizadas. Solicitud de ayuda → sesión, entrenador, estación al solicitar, hora y estado. Conservar un solo detalle oficial por ejercicio prescrito. La IA propone elementos del catálogo y el servidor valida esa referencia antes de guardar.

## 6. Diseño de la experiencia y del asistente

**Hellen.** En el sitio público, «Cada cuerpo, su propio camino» conduce a los dos accesos de demostración. En el móvil, la primera pantalla tras entrar debe resolver «qué me toca hoy», «quién me acompaña» y «cómo empiezo». Durante la sesión, dejar el ejercicio activo, la guía, el porqué y el botón «Solicitar asistencia» al alcance del pulgar. Hellen prepara la activación de notificaciones en el móvil del entrenador y la apertura de su cola al tocar el aviso. En escritorio, priorizar gestión, comparación de planes y métricas. En el móvil del entrenador, situar la siguiente solicitud pendiente y la acción de atender como primera pantalla. Hellen producirá animaciones propias para los ejercicios de la demostración. Acordar esos ejercicios con Samuel al inicio y revisar con un entrenador tanto el movimiento como la zona muscular resaltada. Usar el mismo catálogo en ambas generaciones de la demo. Emplear papel #F5F3ED, tinta #252520 y terracota #A52D23, titular serif y controles sans serif. Cada estado lleva texto. Cada animación debe disponer de una imagen quieta y una explicación leíble. Usar el aviso oficial «Usa datos ficticios. No ingreses información real de salud».

**Samuel.** Preparar un catálogo pequeño revisado por un entrenador, con identificador, objetivo de uso, condiciones de selección, guía y referencia de criterio. Conservar quién revisó el criterio, la fuente y su versión. El proveedor recibe únicamente los campos necesarios de una ficha ficticia seudonimizada. El servidor comprueba días, ejercicios permitidos, justificación, referencias y datos faltantes. Si el resultado incluye ejercicios inventados, restricciones incompatibles o fuentes inexistentes, devolverlo a revisión. El entrenador puede editar un borrador manual o abrir un ejemplo precargado, identificado como tal, si falla la generación. Guardar versión de evaluación, catálogo, origen y aprobación para reproducir qué vio el cliente.

**Alex.** El servidor verifica espacio, rol y asignación tanto en consultas como en eventos en vivo. La selección de rol de la portada abre una identidad demo con permisos delimitados. La ficha del cliente y las restricciones se muestran solo a quien corresponda. Los eventos de cola contienen los datos operativos de la alerta. Antes del piloto, definir acceso, conservación y eliminación de información sensible, y revisar qué información recibe el proveedor. Mantener separadas las notas privadas del entrenador y la explicación que verá el cliente.

## 7. Secuencia de ejecución y tablero inicial

Las franjas siguientes distribuyen las 34 horas del equipo como ventana de trabajo compartida. Ajustar turnos y pausas en el arranque según la disponibilidad individual.

| Horas | Hellen | Alex | Samuel | Comprobación al cierre |
|---|---|---|---|---|
| 0–2 | Dibuja tres recorridos y acuerda los movimientos que animará. | Define identidades, asignaciones y eventos de cola. | Define perfil base, cambio de disponibilidad y salidas de DeepSeek. | Un ejemplo por intercambio y un teléfono de prueba elegido para comprobar recepción con la pantalla bloqueada. |
| 2–8 | Prepara las tres vistas con datos de ejemplo y la primera animación. | Habilita acceso, fichas, evaluaciones y catálogo. Prueba con Hellen un envío push al teléfono bloqueado. | Prueba la integración existente con un perfil ficticio, valida el borrador y define la comparación entre versiones. | El aviso de prueba aparece con la pantalla bloqueada y permisos concedidos. Cada persona dispone de los mismos identificadores. |
| 8–16 | Conecta editor de escritorio y rutina móvil. | Entrega persistencia de versiones, registro de sesión, tiempos y series. | Conecta generación inicial, edición y aprobación. | Primera rutina publicada en escritorio y ejecutada en teléfono. |
| 16–24 | Conecta avisos, cola móvil, comparación de borradores y animaciones de muestra. | Entrega enrutamiento individual, FIFO y recuperación tras desconexión. | Integra reorganización en vivo, resumen de cambios y segunda aprobación. | La alerta llega a la pantalla bloqueada del entrenador correcto y el atleta recibe el plan revisado después de aprobarse. |
| 24–29 | Verifica lectura, movimiento reducido y temporizadores en móvil. | Prueba dos entrenadores, solicitudes simultáneas y doble toque. | Prueba faltantes, indisponibilidad y coherencia de las dos versiones. | Recorrido completo en dispositivos de presentación. |
| 29–34 | Conduce dos ensayos y ajusta problemas de uso. | Prepara entorno y restauración de datos demo. | Verifica las dos operaciones de DeepSeek y el respaldo identificado. | Demo lista con margen para corregir fallos de integración. |

**Si se estrecha el plazo.** Reducir el número de ejercicios ilustrados, métricas y efectos decorativos. Proteger los tres recorridos, las dos operaciones con DeepSeek, la aprobación humana y el aviso al móvil asignado. Conservar después del evento la misma estructura de asignaciones, sesiones y versiones para el piloto.

### Primeras tarjetas listas para repartir

| Tarjeta y dueño | Depende de | Se acepta cuando |
|---|---|---|
| H1 · Recorrido de primera visita y retorno / Hellen | Identidades demo acordadas | Un cliente identifica su entrenador y entra a la rutina desde el teléfono. |
| A1 · Datos y permisos / Alex | Tres fichas ficticias | Cada entrenador ve sus clientes y un tercero no puede abrir sus fichas ni sus alertas. |
| S1 · Contrato del borrador / Samuel | Catálogo y ficha de ejemplo | Se distinguen propuesta válida, información insuficiente y fallo del proveedor. |
| S2 · Edición y publicación / Samuel | S1 y persistencia acordada con Alex | Se publica la edición humana y el cliente recibe exactamente esa versión. |
| H2 · Ficha, editor y sesión / Hellen | Ejemplos de A1 y S1 | En móvil se ve el motivo aprobado y el ejercicio activo puede cambiarse. |
| A2 · Ejecución y ayuda / Alex | A1 y referencia de plan de S2 | Dos atletas del mismo entrenador producen dos turnos ordenados. Otro entrenador solo recibe las alertas de sus propios atletas. Recargar el panel conserva la cola. |
| S3 · Generación, reorganización y pruebas / Samuel | S1 y criterios revisados | Genera ambos borradores con DeepSeek, identifica sus diferencias y permite continuar ante un fallo. |
| H3 · Ensayo integrado / Hellen | A2, S2, S3 y H2 | Los tres reproducen la demo y registran qué funcionó en vivo y qué utilizó datos preparados. |

## 8. Cómo decidir si está listo

| Caso de aceptación | Resultado esperado | Responsable |
|---|---|---|
| Cliente presencial, objetivo y dos días disponibles | Dos jornadas propuestas, con motivos vinculados a entradas existentes. El entrenador cambia un ejercicio y la vista del cliente refleja ese cambio. | Samuel + Hellen |
| Cliente remoto, sin evaluación presencial ni InBody | La ficha conserva el origen y los pendientes. El asistente identifica faltantes y el cliente no ve el botón de asistencia en sala. | Samuel + Hellen |
| Cambio de disponibilidad para el próximo ciclo | En la demo, la revisión de dos a tres días conserva el plan histórico y la sesión ya iniciada. | Samuel + Alex |
| Teléfono bloqueado y app en segundo plano | Con permisos activos, el atleta pulsa «Solicitar asistencia». El aviso aparece en el teléfono bloqueado del entrenador asignado. El otro entrenador no recibe el aviso. Tras desbloquear y abrir la notificación, el destinatario ve su cola FIFO y puede atender el turno. | Alex + Hellen |
| Máquina ocupada, cambio de ejercicio, dos clientes piden ayuda | La cola indica cliente, estación conocida y orden. Atender el primero actualiza ambas pantallas. Una alerta ya emitida conserva el contexto original. | Alex + Hellen |
| Doble toque, pérdida de conexión y recarga | No se duplican series ni turnos. El cliente distingue una solicitud sin confirmar y puede recuperar su estado. | Alex |
| Proveedor indisponible, ejercicio ajeno al catálogo o criterio sin fuente | Se comunica el problema, se conserva el plan vigente y solo se publica tras una decisión válida del entrenador. | Samuel |
| Cliente intenta editar prescripción o acceder a otra ficha | El servidor deniega la operación. La pantalla explica cómo solicitar un cambio. | Alex en identidad y Samuel en planificación |
| Sesión con ejercicios pendientes, navegación por teclado y movimiento reducido | Se puede terminar conscientemente una sesión parcial y consultar instrucciones sin depender de color o animación. | Hellen |

**Validación con los entrevistados.** Invitar a Laura a preparar una semana de dos días y explicar qué dato le falta para aprobarla. Invitar a Juan Diego a registrar una primera sesión observada y adaptar series o descansos. Medir tiempo de ficha y aprobación frente a su método habitual, pasos que necesitaron explicación y motivos de corrección del borrador. En sala, cronometrar desde que se pulsa «Solicitar asistencia» hasta que aparece el aviso en la pantalla bloqueada y verificar que el entrenador identifica a la persona y la estación. Registrar resultados por participante y decidir el siguiente cambio según el obstáculo observado.

## 9. Reunión inicial y guion de entrega

| Decisión pendiente | Quién la cierra | Momento y consecuencia |
|---|---|---|
| Dispositivo de prueba y permisos de notificación | Alex y Hellen | Hora 0. Elegir el teléfono de la demo y habilitar notificaciones en la pantalla de bloqueo. Probar la recepción antes de la hora 8. |
| Campos críticos, referencias y movimientos de muestra | Samuel con un entrenador, Hellen prepara los recursos y Alex confirma identificadores | Horas 0–2. Objetivo, disponibilidad, nivel y observaciones forman el perfil base. Registrar qué faltante requiere aclaración antes de generar. |
| Repositorio, avances existentes y rúbrica si está disponible | Los tres | Al inicio, comprobar qué se reutiliza y contrastar los criterios de entrega con el tablero. |

**Guion propuesto de tres minutos.** En escritorio, Samuel presenta un perfil de dos días, genera con DeepSeek, explica un ejercicio y aprueba la rutina. Desde el teléfono del atleta, Hellen muestra la animación, registra una serie y su tiempo, cambia de estación y pulsa «Solicitar asistencia». En el teléfono del entrenador asignado, Alex muestra el aviso con la pantalla bloqueada, desbloquea el teléfono, abre su cola y atiende el primer turno. De vuelta en escritorio, Samuel cambia la disponibilidad a tres días y pide una reorganización. Muestra al jurado qué cambió, por qué y cómo el atleta recibe la nueva versión solo después de la segunda aprobación.

**Primer paso del equipo.** Reunirse con una sola ficha ficticia sobre la mesa y recorrerla hasta la alerta atendida. Al salir, Hellen debe tener sus pantallas y estados, Alex los registros que persisten y Samuel las entradas, salidas y límites del asistente. Ese acuerdo permite abrir H1, A1 y S1 en paralelo.
