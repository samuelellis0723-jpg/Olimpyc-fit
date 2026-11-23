# Olimpyc Fit · Frontend

Prototipo React/Vite responsive para las tres experiencias del MVP. La copia del prototipo HTML/CSS/JS anterior está en `../frontend-original-prototype/`.

## Desarrollo local

```sh
npm install
npm run dev
```

La demo usa datos ficticios locales por defecto. Las acciones locales están marcadas en la interfaz y no se presentan como guardadas en el servidor.

La capa de servicios reconoce las rutas disponibles bajo `/api/v1`. Con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas, el frontend usa Supabase Auth y activa el modo API real; también necesita `VITE_API_URL` (por ejemplo, `http://localhost:3000/api/v1`). Las solicitudes protegidas requieren el `access_token` de la sesión activa; el servicio lo envía como `Authorization: Bearer ...` y falla antes de hacer la solicitud si no lo recibe.

El cliente compartido de Supabase está en `src/lib/supabaseClient.js`; el proveedor de autenticación mantiene su sesión y verifica `GET /api/v1/auth/me` antes de elegir una interfaz por `rol`. `planService.setAccessTokenProvider` obtiene el token vigente desde Supabase para las solicitudes posteriores. Este checkout no incluye un `.env` local ni una sesión de prueba, así que el modo real no se puede ejecutar aquí. Si falta cualquiera de las dos variables Supabase o su URL es inválida, la app muestra un error de configuración en vez de cambiar al modo demo.

El modo `uuid-demo` se mantiene separado para la demo local de planificación. Solo está disponible en desarrollo desde loopback, requiere `VITE_API_BASE_URL` (API local en el puerto `3001`) y los valores ficticios `VITE_UUID_DEMO_EVA_TOKEN`/`VITE_UUID_DEMO_ANA_TOKEN` proporcionados localmente. No uses esos tokens con el modo real. No agregues tokens ni secretos a archivos versionados; configura variables locales fuera del control de versiones.

En modo real, Ana consulta `GET /me/rutina?fecha=YYYY-MM-DD` y la vista de Eva consulta `GET /entrenador/clientes` y `GET /entrenador/asistencias`. Planificación usa `POST /planes`, `GET/PATCH /planes/:versionId` y `POST /planes/:versionId/aprobar`; la reorganización permanece bloqueada hasta disponer del cuerpo completo de su contrato. En sesión, Ana inicia con `POST /sesiones` y requiere el `sesionId` de la respuesta directa; registra series, ejercicio activo y el cierre (`completa` o `parcial`, con `finUtc`) mediante `PATCH /sesiones/:sesionId`, y solicita asistencia con `POST /asistencias`. La interfaz valida las respuestas de cierre y asistencia antes de mostrarlas como confirmadas. Eva marca solicitudes atendidas con `PATCH /asistencias/:asistenciaId`. La respuesta de `GET /entrenador/asistencias` usa el arreglo `asistencias`; Eva ve nombre, turno, hora, ejercicio, estación y estado, conservando el orden del servidor. La interfaz solo marca una solicitud atendida tras el éxito del PATCH. Todas estas operaciones requieren la sesión Supabase real. El cronómetro por ejercicio y las acciones del modo demo permanecen locales y separados. La vista administrativa está pendiente de rutas desplegadas; `/administracion/demo` es solo una maqueta disponible en desarrollo. Ningún dato local de la demo se presenta como respuesta o persistencia real. Consulta [el estado detallado del frontend](../docs/estado-frontend-hellen.md) para alcance y límites de las interfaces.

No se implementa backend ni se cambian contratos compartidos en este frontend.
