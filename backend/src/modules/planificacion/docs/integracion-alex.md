# Integración con Alex

Esta nota propone pasos de integración; no afirma que los servicios compartidos estén conectados. Las interfaces canónicas están en [CONTRATOS.md](../CONTRATOS.md). Coordinar cualquier discrepancia antes de cambiar rutas o datos que consume Hellen.

## 1. Identidad, gimnasio y asignación

- Montar `crearRouterPlanificacion({ servicio, resolverActor })` en `app.use('/api/v1', router)`.
- Implementar `resolverActor(req)` desde la sesión autenticada y verificada. Puede leer un bearer del header `Authorization` para verificarlo; solo la verificación en servidor determina `{usuarioId,gimnasioId,rol}`. Nunca aceptar esos valores desde body, query ni headers no verificados/controlados por el cliente.
- Resolver la membresía del gimnasio y la asignación actual del entrenador al atleta en cada lectura y mutación. Mantener el comportamiento 404 genérico para recurso ajeno/inexistente; separar 401 identidad ausente y 403 rol incompatible.
- Confirmar con Hellen qué respuesta recibe cada rol. El atleta solo consulta `GET /me/rutina`; no puede listar versiones o aprobar.

## 2. Fuentes autorizadas y reproducibles

Conectar los adaptadores async definidos en el contrato:

- `obtenerEvaluacion({ gimnasioId, atletaId, evaluacionId })`: comprobar pertenencia y versión inmutable de evaluación; preservar fecha, publicaciones con fuente, mediciones y pendientes.
- `obtenerCatalogo({ gimnasioId, catalogoVersion? })`: retornar snapshot profesional versionado, incluidos criterios aprobados, revisor, fecha, procedencia, dosis, unidades y restricciones. Confirmar cómo se conserva y recupera la versión usada por cada plan; no sustituir silenciosamente el catálogo histórico.
- `tieneAsignacion({ gimnasioId, entrenadorId, atletaId })`: consulta autoritativa que se vuelve a verificar en cada acceso.
- `obtenerHistorialEjecutado({ gimnasioId, atletaId })`: leer solo sesiones relevantes y entregar al módulo la proyección `SesionResumen` (fecha, estado, día semanal y `ejercicioIds`). Acordar con el dueño de sesiones cuál es la definición de ejecutada y cómo se excluyen sesiones incompletas/no pertinentes.

Persistir en cada plan la evaluación y snapshot de catálogo/criterios que sostienen la propuesta; conservar historial de versiones, motivo, diferencias, origen y aprobación. Los nombres y formas físicas de tablas son decisiones de Alex: [modelo de datos del producto](../../../../../docs/02-modelo-de-datos.md) describe relaciones esperadas, no reemplaza el diseño de migraciones.

## 3. Repositorio y concurrencia

Reemplazar `crearRepositorioEnMemoria()` por un adaptador PostgreSQL que implemente los cinco métodos descritos en el contrato. Los métodos pueden ser async. Asegurar:

- `crearBorrador` inserta una versión en estado `borrador` y nunca modifica la vigente.
- `guardarRevision` compara `revisionEsperada` y estado en la misma mutación (CAS), incrementa una sola vez o retorna conflicto 409 con la revisión actual.
- `aprobar` dentro de una transacción compara revisión, rol/asignación y estado; mueve la nueva versión a `vigente`, la anterior a `historica`, y registra aprobador/fecha. Garantizar una sola vigente por gimnasio/atleta mediante restricción/transacción adecuada. Una falla no deja transición parcial.
- Reorganización guarda una nueva versión con `versionBaseId`; al terminar generación lenta y al aprobar, vuelve a comprobar que su base siga vigente. Si dejó de estarlo, rechaza con 409 `BASE_NO_VIGENTE` sin cambiar el plan publicado.
- Consultas de atleta filtran por identidad, gimnasio y estado vigente; versiones históricas quedan disponibles solo para entrenadores autorizados.

El contrato requiere atomicidad y CAS, pero no prescribe esquema SQL. Revisar índices únicos, aislamiento, políticas RLS, transacciones y claves de reintento conforme a las migraciones compartidas.

## 4. Sesiones, SE1 y montaje

El módulo no crea sesiones, series, intervalos ni solicitudes de asistencia. Acordar con el responsable del flujo SE1 cómo una sesión conserva `versionId` al iniciarse para que una aprobación posterior no cambie una sesión abierta. Probarlo con la interfaz de sesiones ya implementada. Integrar la cola/alertas de asistencia por su contrato propio; este módulo no implementa Web Push.

Alex debe confirmar el prefijo final, middlewares, límites de body, formato común de error, configuración de proveedor y política de logs/observabilidad. El módulo registra solo metadatos permitidos (operación, modelo, versiones, evaluación, resultado/código); no guardar clave, prompt, perfil ni salida cruda. El fallo de observabilidad no altera la mutación ni respuesta.

## Pendiente de confirmar antes de declarar integración

- Qué mecanismo de Auth verifica token, membresía, gimnasio, rol y asignación en el servidor.
- Migraciones/constraints concretas para snapshot, vigencia, aprobación, histórico y CAS; niveles de aislamiento y política de reintentos.
- Retención del catálogo y criterios aprobados; fuente profesional y revisión de cada criterio de producción.
- Contrato y dueño de sesiones: versión retenida por SE1, resumen ejecutado y disponibilidad de historial.
- Prefijo/router común, configuración segura, límites de solicitud y redacción de logs.
- Pruebas integradas con Supabase/PostgreSQL y autenticación real, aislamiento entre gimnasios, doble edición/aprobación y reorganización concurrente.

La evidencia actual se limita al módulo con identidad ficticia y repositorio temporal. Consulta [entrega y guion](./entrega-samuel.md) y [guía de interfaz](./integracion-hellen.md).
