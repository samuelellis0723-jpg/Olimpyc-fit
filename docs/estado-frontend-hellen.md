# Estado del trabajo frontend de Olimpyc Fit

**Fecha de actualización:** 22 de noviembre de 2026
**Rama de trabajo:** `feat/frontend-hellen`
**Alcance:** frontend web React/Vite. No se documentan cambios de backend.

Este documento reúne el trabajo realizado en las interfaces de Olimpyc Fit, sus interacciones, las integraciones preparadas y sus límites. Distingue las respuestas locales de demostración de las operaciones conectadas al servicio. La presencia de una llamada en el frontend no demuestra por sí sola que el backend esté desplegado ni que una operación haya persistido.

## Resumen

El frontend contiene las experiencias separadas de Ana (cliente/atleta) y Eva (entrenadora), además de una maqueta administrativa aislada. Se conservaron las iteraciones visuales basadas en Stitch dentro de la aplicación React existente; el prototipo original se dejó como copia en `frontend-original-prototype/`.

Las pantallas se adaptaron primero a móvil para Ana y a escritorio para las tareas de gestión de Eva, con redistribución responsive para anchos menores y mayores. Se añadieron interacciones de navegación, formularios, indicadores de estado, temporizadores y confirmaciones accesibles. La identidad visual de Olimpyc Fit mantiene papel claro, tinta oscura, acento terracota, títulos editoriales y componentes sans serif.

## Experiencia de Ana

### Acceso y bienvenida

- Se conserva el acceso existente; la bienvenida posterior al acceso es un paso del flujo del cliente, no una página pública ni un reemplazo del login.
- El saludo usa el nombre disponible en el perfil, con saludo general si falta. La entrenadora se muestra solo si está asignada.
- La bienvenida conduce a una guía breve y después al perfil/rutina mediante la navegación de la aplicación.
- En el flujo demo, el indicador de bienvenida vista usa `localStorage` por perfil (`olimpyc-fit:onboarding:<id>`); la opción de mantener sesión demo usa `localStorage` o `sessionStorage`. No existe confirmación de persistencia en backend para ese indicador. En el flujo Supabase, la sesión se administra mediante Supabase Auth.
- Los recursos visuales deportivos entregados se integraron como assets locales, sin depender de URLs externas.

### Inicio, calendario y perfil/proceso

- La navegación del cliente separa Inicio, Entrenamiento y Mi perfil.
- Inicio y Entrenamiento usan el día seleccionado en el calendario para presentar el estado del plan y los detalles disponibles.
- El caso de demostración usa a Ana y Eva. La rutina V1 demo indica entrenamiento lunes y jueves; los demás días se muestran como descanso. Los datos locales están identificados como demostración.
- La vista de perfil/proceso ofrece calendario semanal, estado de entrenamiento/descanso/inasistencia, resumen motivador, calentamiento asignado cuando existe y secciones de progreso/perfil.
- La acción de registrar inasistencia solo se ofrece para días pasados de entrenamiento; es local/demo si no hay una integración de persistencia documentada.
- La información del perfil se presenta como solo lectura para la cliente. La cédula no se muestra.
- Evaluaciones y medidas ausentes aparecen como pendientes; no se inventan valores clínicos, fechas ni resultados.

### Calentamiento

- “Iniciar mi calentamiento” abre una pantalla independiente con secuencia, ejercicio activo, anteriores completados y siguientes bloqueados.
- Se puede avanzar marcando cada paso; el flujo no permite continuar a la rutina antes de completar la secuencia disponible.
- La imagen editorial se usa como vista previa. Si no hay un video real asignado, se comunica que el video o la guía están pendientes; la imagen no se presenta como video.
- El acceso se bloquea para días de descanso. El avance de esta experiencia permanece en frontend cuando no hay persistencia disponible.

### Entrenamiento y sesión

- La pantalla de entrenamiento presenta los ejercicios y prescripciones disponibles en la rutina del día. La rutina de brazos de ejemplo y su descanso de 60 segundos son datos ficticios de demostración, no una prescripción general ni una rutina aprobada.
- Cada serie se habilita en orden y se marca solo con una acción explícita. En la integración real se envía la serie al servicio; un error evita marcarla como realizada y permite reintentar.
- Cuando la rutina incluye descanso, el temporizador usa una hora de vencimiento y se actualiza al recuperar el foco de la pestaña. Incluye pausa/reanudación y aviso dentro de la app. No se pide permiso para notificaciones del navegador.
- El inicio requiere que `POST /sesiones` devuelva un `sesionId` directo válido. Ese identificador se conserva para las actualizaciones y la asistencia.
- El cierre envía estado (`completa` o `parcial`) y `finUtc` mediante `PATCH /sesiones/:sesionId`. La rutina solo se anuncia como completada si el servidor devuelve y confirma `estado: "completa"`; ante error, la sesión queda visible para reintento.
- El tiempo individual de ejercicio y algunos estados visuales siguen siendo locales; no se presentan como guardados si no se enviaron por el contrato.
- La solicitud de asistencia envía `sesionId`, ejercicio y estación a `POST /asistencias`. Tras validar la respuesta directa muestra turno, estado, hora recibida y referencia. Se bloquea el doble envío; los errores HTTP permiten reintento y una respuesta exitosa con formato ambiguo no se reenvía automáticamente.

## Experiencia de Eva

### Clientes asignados y ficha

- La vista real consulta los clientes asignados desde el servicio y selecciona al cliente mediante el `atletaId` recibido. No usa IDs de fixture para llamadas reales.
- La ficha ofrece evaluación, mediciones y seguimiento sin mostrar cédula.
- Las evaluaciones permiten crear y editar modalidad, objetivo, disponibilidad, nivel observado, restricciones, notas, revisión y observaciones privadas autorizadas a Eva.
- Las mediciones usan los campos documentados para variable, origen, estado, valor, unidad y fuente. Si el estado es medido, valor y unidad son obligatorios. El historial conserva los registros recibidos.
- Las pantallas manejan carga, error, vacío y reintento; informan éxito después de una respuesta exitosa.

### Planificación

- La pantalla de planificación trabaja con cliente, evaluación, `versionId`, `revision` y UUIDs de día/ítem obtenidos del servicio.
- Permite solicitar borradores, consultar y editar una versión, y aprobarla. No se debe presentar una edición o aprobación como confirmada antes de la respuesta exitosa del servidor.
- Los conflictos de revisión muestran la información del servidor y requieren recargar antes de reintentar.
- La reorganización V2 no se considera conectada hasta disponer del esquema completo de su cuerpo contractual. Los borradores no se exponen a Ana; la interfaz cliente consulta el plan publicado/vigente.
- La discrepancia previa de catálogo E1/E2 no se resuelve con equivalencias inventadas. Los nombres de demostración no se presentan como catálogo compartido confirmado.
- La vista demo de Eva permite organizar días/enfoques, agregar/editar/quitar/ordenar ejercicios y editar series, objetivo, descanso, equipo, carga e indicaciones. Esos ejercicios locales se identifican como ficticios y no se envían al catálogo compartido.
- La edición demo permite seleccionar una foto o video y ver su previsualización; las fotos requieren texto alternativo. Los límites de archivo y las vistas previas están en la interfaz, pero no hay contrato de subida integrado: los medios temporales no persisten al recargar ni se publican a Ana mediante backend.

### Cola de asistencia

- `GET /api/v1/entrenador/asistencias` se consume desde la capa de servicio y usa el arreglo `asistencias` de la respuesta.
- Se muestran atleta, turno, hora recibida, ejercicio, estación y estado, preservando el orden que devolvió el servidor.
- Eva marca la solicitud con `PATCH /api/v1/asistencias/:asistenciaId` y `{ "estado": "atendida" }`. La vista cambia a atendida únicamente después del éxito del PATCH.
- Incluye carga, error, vacío y reintento. La vista de demostración local de Eva es independiente y no se mezcla con esta cola real.

## Acceso, sesión y separación de modos

- `AuthProvider` integra la sesión Supabase cuando la configuración está presente y verifica la identidad del servidor antes de enrutar por rol.
- `planService` obtiene el `access_token` del proveedor de sesión e incluye `Authorization: Bearer <access_token>` en las solicitudes protegidas del modo real.
- Los roles de cliente y entrenador se mantienen separados. La interfaz no concede permisos basándose solo en campos editables del navegador.
- La demo UUID de planificación está limitada a desarrollo/local loopback y separada de Supabase. Sus tokens de entorno son ficticios y no se usan en modo real.
- La cola anterior/portal demo y los mocks se mantienen como demostración; no son evidencia de persistencia ni autorización real.

## Panel administrativo

- Existe una maqueta visual de administración con secciones de resumen, entrenadores, clientes, suscripciones, comentarios, máquinas y reportes.
- La ruta demo está identificada como modo interfaz sin autenticación ni persistencia. No consulta ni guarda datos reales.
- No se conectaron operaciones administrativas reales ni se debe habilitar acceso administrativo sin rol y endpoints autorizados por backend. La contratación/alta real de entrenadores requiere contrato y permisos del servidor.

## Integraciones del servicio

El frontend contiene métodos para las operaciones siguientes, según las rutas disponibles/documentadas en el proyecto:

| Área | Operaciones del frontend | Estado que puede afirmarse |
|---|---|---|
| Identidad | `GET /api/v1/auth/me` | Consulta mediante sesión real; requiere Supabase y API configurados. |
| Ana: rutina diaria | `GET /api/v1/me/rutina?fecha=...` | Consulta modo real preparada para estados documentados; no verificada contra servidor en este checkout. |
| Eva: clientes | `GET /api/v1/entrenador/clientes` | La ficha toma IDs de la respuesta real cuando el servicio está activo. |
| Eva: evaluaciones | `GET/POST /api/v1/atletas/:atletaId/evaluaciones`, `PATCH /api/v1/evaluaciones/:evaluacionId` | Formularios y llamadas preparadas; requiere sesión válida y API disponible. |
| Eva: mediciones | `POST /api/v1/evaluaciones/:evaluacionId/mediciones` | Validación y llamada preparadas según campos documentados. |
| Eva: planes | `POST /api/v1/planes`, `GET/PATCH /api/v1/planes/:versionId`, `POST /api/v1/planes/:versionId/aprobar` | Flujo de borrador/edición/aprobación implementado en frontend; despliegue/persistencia no verificados aquí. |
| V2 | `POST /api/v1/planes/:versionId/reorganizar` | La acción permanece bloqueada si no se conoce el cuerpo contractual completo. |
| Ana: sesiones | `POST /api/v1/sesiones`, `PATCH /api/v1/sesiones/:sesionId` | Inicio, serie/ejercicio activo y cierre conectados a través del servicio; respuestas se validan en la interfaz. |
| Asistencia Ana | `POST /api/v1/asistencias` | Solicitud real preparada con contexto de sesión; confirmación usa el JSON recibido. |
| Asistencia Eva | `GET /api/v1/entrenador/asistencias`, `PATCH /api/v1/asistencias/:asistenciaId` | GET usa `asistencias`; PATCH actualiza la vista tras éxito. |
| Administración | Ninguna operación real conectada | Pendiente de endpoints desplegados, rol autorizado y contratos confirmados. |

**Verificación:** la compilación Vite se ejecutó correctamente durante las últimas tareas de integración de la cola. `package.json` no define un script de pruebas. En esta sesión no se ejecutaron pruebas HTTP. El checkout revisado no tenía carpeta `backend` ni configuración local `.env` y no se disponía de una sesión Supabase de Eva/Ana; por ello no se afirma que se haya confirmado persistencia desde este entorno. La usuaria indicó que ya probó los recorridos de Ana y Eva; esa confirmación de uso se registra como reporte de la usuaria, no como una prueba HTTP reproducida en esta máquina.

## Cómo ejecutar el frontend

Desde la carpeta `frontend/`:

```sh
npm install
npm run dev
```

Para compilar:

```sh
npm run build
```

Para modo real se requieren las variables locales configuradas por el equipo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL`. No se deben guardar secretos en este documento ni en el repositorio. Para probar persistencia deben estar disponibles la API de desarrollo y sesiones auténticas autorizadas de Ana y Eva.

## Estado del árbol de trabajo

Al redactar este documento, la rama actual es `feat/frontend-hellen` y el árbol contiene varios cambios locales anteriores, incluyendo modificaciones y archivos sin seguimiento en frontend. No se creó commit ni se publicó el trabajo. Revisar esos cambios antes de preparar una publicación para separar cada entrega con precisión.
