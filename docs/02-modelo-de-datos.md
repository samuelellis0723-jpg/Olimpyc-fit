# Modelo relacional y diccionario · PostgreSQL en Supabase
Alex mantiene las migraciones y el modelo físico. Samuel define la semántica de versiones, dosis y validación. Hellen usa los nombres públicos del contrato. Cada entidad lleva identificador estable. Las fechas de actividad se guardan con instante UTC y se presentan en la zona del gimnasio. Los campos indicados como opcionales admiten ausencia de valor.

| Tabla propuesta | Relaciones y datos obligatorios | Opcionales y unidades |
|---|---|---|
| gimnasios | id, nombre, zona horaria | Nombre de bienvenida |
| miembros | id, gimnasioId, rol atleta/entrenador, identidad de acceso, nombre | Alias visible |
| asignaciones | id, atletaId, entrenadorId, gimnasioId, inicio | Fin de vigencia |
| evaluaciones | id, atletaId, autorId, fecha, modalidad, objetivo, disponibilidad semanal y nivel observado o pendiente | Restricciones, observaciones privadas, notas y próxima revisión |
| mediciones | id, evaluacionId, variable, origen, fecha, estado medido/pendiente | Valor y unidad juntos si medido, por ejemplo cm o kg. Bioimpedancia y tests conservan su fuente. |
| ejercicios | id, nombre, grupo muscular, instrucciones, versión de catálogo | Medio, alternativa estática y estaciones permitidas |
| criterios | id, ejercicioId, versión, texto, fuente, estado de revisión | Revisor y fecha obligatorios al aprobar criterio |
| versiones_plan | id, atletaId, evaluacionId, estado, origen, revisión, versión de catálogo | versionBaseId, motivo de cambio, autor y hora de aprobación, próxima revisión |
| dias_plan | id, versionId, índice semanal, día programado | Etiqueta |
| items_plan | id, diaId, ejercicioId, orden, series, unidad y objetivo por serie, descanso en segundos, motivo visible | Carga y unidad, criterio vinculado, calentamiento |
| sesiones | id, atletaId, diaId, versionId, inicio, estado activa/completa/parcial | Fin, item activo y estación actual |
| intervalos | id, sesionId, itemId, tipo ejercicio/descanso, inicio | Fin al cambiar de actividad. Duración derivada en segundos. |
| series | id, sesionId, itemId, número, instante | Repeticiones y segundos realizados según el ejercicio |
| asistencias | id, sesionId, atletaId, entrenadorId, orden por entrenador, hora recibida, estado | Ejercicio y estación capturados, hora de atención |
| dispositivos | id, entrenadorId, suscripción push, estado | Último envío y baja |
| envios_alerta | id, solicitudId, dispositivoId, estado, intentos | Próximo intento y motivo de fallo. Permite reanudar el envío. |

**Relaciones que conviene dibujar primero.** Un gimnasio tiene muchos miembros. En cada momento un atleta tiene un entrenador asignado, y un entrenador puede tener varios atletas. Una evaluación puede originar varias versiones. Cada versión tiene varios días y cada día contiene ejercicios prescritos que apuntan al catálogo. Una sesión pertenece a un día de una versión. Sus intervalos, series y solicitudes comparten esa sesión. Una solicitud puede originar envíos a dispositivos del mismo entrenador.

**Integridad y consultas.** Validar pertenencia al mismo gimnasio y evitar asignaciones activas solapadas. En una transacción, la aprobación sustituye la versión vigente del atleta, conserva la anterior como histórica y registra quién aprobó. Las sesiones abiertas retienen su versión original. Para la cola, serializar la asignación de turno por entrenador y guardar solicitud y envío pendiente en una misma transacción. Exigir una sola asistencia pendiente por sesión y unicidad de entrenador más orden. Indexar entrenador, estado y orden para recuperar la cola. La pareja sesión e ítem con número de serie es única. Registrar claves de operación para que un reintento tras perder conexión recupere el resultado confirmado.

**Comprobación con el caso compartido.** Publicar V2 de tres días. Consultar SE1 y confirmar que aún muestra los dos días de V1 como referencia. Consultar los pendientes de T1 y comprobar que Q3 pertenece solo a T2. Un cambio de estación posterior conserva B2 en el histórico de Q1.

**Decisiones físicas para PostgreSQL.** Separar el identificador de Supabase Auth de la membresía de cada gimnasio. Vincular ambos con una referencia y exigir unicidad por gimnasio e identidad. Usar instantes con zona horaria para eventos e índices únicos parciales para la asignación vigente por atleta, la versión vigente y la solicitud pendiente por sesión. Alex versiona las migraciones en Git. Aplicar políticas de acceso por fila a los datos expuestos al cliente y autorizar la suscripción al canal privado según gimnasio y destinatario. Verificar con las sesiones de Eva e Iván que cada uno recibe solo sus solicitudes.
