# Contrato funcional de API y eventos · propuesta v1
Base común /api/v1. Las rutas son relativas a esa base. El servidor obtiene gimnasio, identidad y rol de la sesión. Alex mantiene identidad, catálogo, sesiones y asistencia. Samuel mantiene planificación. Hellen consume ambos módulos.

| Método y ruta | Quién | Datos enviados | Éxito y campos consumidos |
|---|---|---|---|
| POST /demo/sesiones | Ambas vistas | identidad demo preasignada | 201 sesión autenticada con usuarioId, rol, gimnasioId y nombre. |
| GET /me | Usuario | Sesión | 200 identidad y entrenador asignado cuando corresponda. |
| GET /atletas | Entrenador | Sesión | 200 lista asignada con id, nombre y actividad actual. |
| GET /atletas/{id}/ficha | Entrenador asignado | Atleta | 200 objetivo, disponibilidad, modalidad, última evaluación, revisión, tiempo y series de sesión. |
| POST /atletas/{id}/evaluaciones | Entrenador asignado | Objetivo, días, nivel, modalidad, observaciones, mediciones con unidad y procedencia | 201 evaluacionId, fecha, versión y pendientes. |
| GET /catalogo | Usuario | Sesión | 200 ejercicioId, nombre, grupo, estación compatible, guía y medio. |
| POST /atletas/{id}/planes | Entrenador asignado | evaluacionId, origen IA o manual y, para manual, días y ejercicios | 201 versión en borrador con días, ejercicios y motivos. 422 si se necesitan datos críticos. |
| GET /planes/{versionId} | Entrenador asignado | Versión | 200 borrador o histórico con revisión, origen y detalle editable del borrador. |
| PATCH /planes/{versionId} | Entrenador asignado | revisionEsperada y cambios en ejercicio, dosis, razón o próxima revisión | 200 detalle guardado y nueva revisión. |
| POST /planes/{versionId}/aprobacion | Entrenador asignado | revisionEsperada | 200 versión vigente, aprobador y fecha. |
| POST /planes/{versionId}/reorganizaciones | Entrenador asignado | Versión vigente, motivo y nueva disponibilidad o ausencia | 201 nuevo borrador con versionBaseId, diferencias y explicación. |
| GET /me/rutina?fecha=AAAA-MM-DD | Atleta | Fecha local del gimnasio | 200 plan aprobado, día y ejercicios o estado sin_plan/sin_sesion_programada. |
| POST /sesiones | Atleta | versionId aprobada, diaId, clave de operación | 201 sesionId y estado activa. Reintento recupera la misma sesión. |
| GET /sesiones/{id} | Dueño o entrenador asignado | Sesión | 200 versión fijada, ejercicio actual, intervalos, series y ayuda pendiente. |
| PATCH /sesiones/{id}/actividad | Atleta dueño | Acción iniciar ejercicio, iniciar descanso, cambiar estación o finalizar, instante, ejercicio prescrito y clave de operación | 200 actividad y tiempos reconocidos. Cierre parcial conserva el progreso. |
| PUT /sesiones/{id}/series/{itemId}/{numero} | Atleta dueño | Repeticiones realizadas y tiempo en segundos | 200 serie confirmada y total. Repetir el registro conserva una sola serie. |
| PUT /me/dispositivos/{id} | Entrenador | Suscripción push del dispositivo y estado del permiso | 200 dispositivo asociado al usuario actual. Revocar vía DELETE en la misma ruta. |
| POST /sesiones/{id}/asistencia | Atleta dueño | Clave de operación | 201 solicitudId, orden, estado pendiente y hora del servidor. Si ya existe una pendiente, 200 con el turno existente. |
| GET /me/cola | Entrenador | Sesión | 200 pendientes propios en orden, con atleta, ejercicio y estación capturados al solicitar ayuda. |
| POST /asistencias/{id}/atencion | Entrenador destinatario | Identificador del turno | 200 atendida. Atender un turno posterior devuelve 409. Repetir el primero ya atendido devuelve su resultado. |

**Ejemplo de extremo a extremo.** Con EV1, Samuel entrega V1, revisión 1, origen DeepSeek, dos días y estado borrador. Eva modifica el descanso, recibe revisión 2 y aprueba esa revisión. Ana inicia SE1 con V1 y registra una serie de E2 en B2. La primera solicitud devuelve Q1, pendiente, orden 1 para T1. Un segundo toque devuelve Q1. Leo genera Q2, orden 2 de T1. Sol genera Q3, orden 1 de T2. Al atender Q1 desaparece de los pendientes de Eva y Ana ve «Solicitud atendida».

**Eventos.** Tras confirmar la escritura, asistencia.creada despierta la cola privada del destinatario. La notificación push muestra «Tienes una solicitud de asistencia» y abre la cola autenticada. asistencia.atendida actualiza al atleta dueño y al entrenador. Cada evento incluye eventoId, solicitudId, estado y fecha del servidor. Descartar eventos repetidos por identificador. Al volver a la app, releer la cola o la sesión. La aceptación del push por el proveedor y la aparición en pantalla son comprobaciones distintas.

**Errores comunes.** El cuerpo lleva codigo, mensaje y, cuando aplica, camposPendientes o revisionActual. 401 requiere iniciar sesión. 403 indica rol incompatible. 404 cubre recursos inexistentes o ajenos. 409 cubre revisión antigua, día incompatible, sesión cerrada o turno fuera de orden. 422 incluye valores inválidos o datos críticos ausentes. 503 informa indisponibilidad del proveedor y permite reintentar o iniciar edición manual. Mostrar «Solicitud registrada» únicamente tras confirmación del servidor. Una conexión interrumpida permite recuperar el estado antes de reenviar.

**Identidad y entrega de eventos.** Las identidades demo corresponden a usuarios ficticios preasignados en Supabase Auth. Express valida el token recibido y resuelve el gimnasio y el rol a partir de la membresía. Hellen consume /api/v1 para las operaciones del negocio. Una vez confirmada la escritura, el canal privado de Realtime avisa a la vista abierta, que recupera el estado autorizado desde la API. El envío Web Push conserva el mismo solicitudId para abrir la cola después de desbloquear el teléfono. El envío a dispositivos y las credenciales de DeepSeek pertenecen al servidor.
