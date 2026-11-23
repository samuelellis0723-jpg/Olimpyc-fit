# Contratos de Integración Backend — Olimpyc Fit (`/api/v1`)

## 1. Configuración Local y Sesión Supabase (sin secretos)

### Variables de entorno locales
* **Backend (`backend/.env`):**
  * `PORT=3000` (opcional; arranque con `npm start` desde `backend/`).
  * `SUPABASE_URL=<url_del_proyecto_supabase>`
  * `SUPABASE_ANON_KEY=<anon_key_publica>`
  * `SUPABASE_SERVICE_ROLE_KEY=<service_role_key_solo_servidor>`
  * `DEEPSEEK_API_KEY=<api_key_opcional>` (si no se define, arranca con proveedor simulado por defecto).
* **Frontend (`frontend/.env`):**
  * `VITE_API_URL=http://localhost:3000/api/v1`
  * `VITE_SUPABASE_URL=<url_del_proyecto_supabase>`
  * `VITE_SUPABASE_ANON_KEY=<anon_key_publica>`
*(Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` en el frontend ni subir archivos `.env` al repositorio).*

### Cómo obtiene el frontend la sesión y el `access_token`
1. El frontend mantiene intacto su flujo actual de inicio de sesión principal para todos los roles (`entrenador`, `atleta`, `administrador`).
2. Cuando un usuario inicia sesión con Supabase Auth (`supabase.auth.signInWithPassword({ email, password })`) o ya tiene sesión activa (`const { data: { session } } = await supabase.auth.getSession()`), obtiene `session.access_token` (JWT).
3. En cada llamada al backend (`/api/v1/...`), el frontend envía la cabecera:
   ```http
   Authorization: Bearer <session.access_token>
   ```
4. El servidor valida ese JWT contra Supabase Auth y resuelve en `public.miembros` el `usuarioId`, `gimnasioId` y `rol` (`"entrenador"`, `"atleta"` o `"administrador"`). La validación de rol, gimnasio y asignación activa (`entrenador_id` ↔ `atleta_id`, `fecha_fin IS NULL`) ocurre siempre en el servidor.

---

## 2. Identidad y Clientes Asignados

### `GET /api/v1/auth/me`
* **Acceso:** `entrenador`, `atleta` o `administrador` autenticado.
* **Respuesta `200 OK`:**
```json
{
  "usuarioId": "uuid-miembro",
  "gimnasioId": "uuid-gimnasio",
  "rol": "entrenador",
  "nombre": "Eva",
  "aliasVisible": "Eva"
}
```
*(Para la interfaz de administración, `rol` devuelve `"administrador"` junto con el `gimnasioId` al que está restringido su acceso).*

### `GET /api/v1/entrenador/clientes`
* **Acceso:** Exclusivo `entrenador` autenticado. Lista únicamente atletas con asignación activa (`fecha_fin IS NULL`) en su gimnasio.
* **Respuesta `200 OK`:**
```json
{
  "clientes": [
    {
      "asignacionId": "uuid-asignacion",
      "fechaInicio": "2026-11-01T00:00:00.000Z",
      "atletaId": "uuid-atleta",
      "nombre": "Ana",
      "aliasVisible": "Ana"
    }
  ]
}
```

---

## 3. Evaluaciones y Mediciones

### `GET /api/v1/atletas/:atletaId/evaluaciones`
* **Acceso:** `entrenador` con asignación activa al `atletaId` (incluye `observacionesPrivadas`), o `atleta` con `usuarioId === atletaId` (omite `observacionesPrivadas`).
* **Respuesta `200 OK`:**
```json
{
  "evaluaciones": [
    {
      "evaluacionId": "uuid-evaluacion",
      "codigoRef": null,
      "atletaId": "uuid-atleta",
      "autorId": "uuid-entrenador",
      "fecha": "2026-11-22T18:00:00.000Z",
      "modalidad": "presencial",
      "objetivo": "Fuerza base y estabilidad",
      "disponibilidadSemanal": 4,
      "nivelObservado": "intermedio",
      "estadoNivel": "observado",
      "restricciones": null,
      "notas": "Buena técnica inicial",
      "proximaRevision": "2026-12-06",
      "observacionesPrivadas": "Nota interna solo visible para entrenador",
      "mediciones": [
        {
          "medicionId": "uuid-medicion",
          "evaluacionId": "uuid-evaluacion",
          "variable": "peso_corporal",
          "origen": "observado",
          "fecha": "2026-11-22T18:00:00.000Z",
          "estado": "medido",
          "valor": 62.5,
          "unidad": "kg",
          "fuente": "balanza_gimnasio"
        }
      ]
    }
  ]
}
```

### `POST /api/v1/atletas/:atletaId/evaluaciones`
* **Acceso:** Exclusivo `entrenador` con asignación activa al `atletaId`.
* **Reglas de campos:** `modalidad` y `objetivo` obligatorios; `disponibilidadSemanal` entero `1..7` o `null`; `estadoNivel`: `"observado"` | `"pendiente"`; en `mediciones`, `origen`: `"observado"` | `"autorreportado"` | `"externo"` | `"sin_evaluar"`, `estado`: `"medido"` | `"pendiente"` (si es `"medido"`, `valor` y `unidad` son obligatorios).
* **Body (`201 Created`):**
```json
{
  "modalidad": "presencial",
  "objetivo": "Fuerza base y estabilidad",
  "disponibilidadSemanal": 4,
  "nivelObservado": "intermedio",
  "estadoNivel": "observado",
  "restricciones": null,
  "observacionesPrivadas": "Nota interna",
  "notas": "Evaluación inicial",
  "proximaRevision": "2026-12-06",
  "mediciones": [
    {
      "variable": "peso_corporal",
      "origen": "observado",
      "estado": "medido",
      "valor": 62.5,
      "unidad": "kg",
      "fuente": "balanza"
    }
  ]
}
```

### `PATCH /api/v1/evaluaciones/:evaluacionId`
* **Acceso:** Exclusivo `entrenador` con asignación activa al atleta de la evaluación.
* **Body (`200 OK`):** Campos parciales (`modalidad`, `objetivo`, `disponibilidadSemanal`, `nivelObservado`, `estadoNivel`, `restricciones`, `observacionesPrivadas`, `notas`, `proximaRevision`).

### `POST /api/v1/evaluaciones/:evaluacionId/mediciones`
* **Acceso:** Exclusivo `entrenador` con asignación activa al atleta de la evaluación.
* **Body (`201 Created`):**
```json
{
  "mediciones": [
    {
      "variable": "sentadilla_estimada",
      "origen": "observado",
      "estado": "medido",
      "valor": 70,
      "unidad": "kg",
      "fuente": "observacion_coach"
    }
  ]
}
```

---

## 4. Sesiones, Series y Asistencias

### `POST /api/v1/sesiones`
* **Acceso:** `atleta` autenticado (sobre una versión de plan en estado `"vigente"`).
* **Body (`201 Created`):**
```json
{
  "versionId": "uuid-version-plan",
  "diaId": "uuid-dia-plan",
  "itemActivoId": "uuid-item-plan",
  "estacionActual": "rack-1"
}
```

### `GET /api/v1/atletas/:atletaId/sesiones`
* **Acceso:** `atleta` propio o `entrenador` con asignación activa al `atletaId`.
* **Respuesta `200 OK`:**
```json
{
  "sesiones": [
    {
      "sesionId": "uuid-sesion",
      "codigoRef": null,
      "atletaId": "uuid-atleta",
      "versionId": "uuid-version-plan",
      "diaId": "uuid-dia-plan",
      "inicioUtc": "2026-11-22T18:30:00.000Z",
      "finUtc": null,
      "estado": "activa",
      "itemActivoId": "uuid-item-plan",
      "estacionActual": "rack-1",
      "series": []
    }
  ]
}
```

### `PATCH /api/v1/sesiones/:sesionId`
* **Acceso:** `atleta` dueño de la sesión o `entrenador` con asignación activa al atleta.
* **Body (`200 OK`):** Permite actualizar `estado` (`"activa"` | `"completa"` | `"parcial"`), `itemActivoId`, `estacionActual`, `finUtc` y/o registrar una serie ejecutada (`numeroSerie >= 1`, `repeticiones >= 0` o `segundosRealizados >= 0`):
```json
{
  "itemActivoId": "uuid-item-plan",
  "estacionActual": "rack-1",
  "estado": "activa",
  "serie": {
    "itemId": "uuid-item-plan",
    "numeroSerie": 1,
    "repeticiones": 10,
    "segundosRealizados": null
  }
}
```

### `POST /api/v1/asistencias`
* **Acceso:** `atleta` autenticado sobre su propia sesión activa. Asigna turno al entrenador activo.
* **Body (`201 Created`):**
```json
{
  "sesionId": "uuid-sesion",
  "ejercicioCapturado": "Sentadilla trasera",
  "estacionCapturada": "rack-1"
}
```

### `GET /api/v1/entrenador/asistencias`
* **Acceso:** Exclusivo `entrenador` autenticado. Devuelve cola de asistencias ordenadas por estado y turno.
* **Respuesta `200 OK`:**
```json
{
  "asistencias": [
    {
      "asistenciaId": "uuid-asistencia",
      "codigoRef": null,
      "sesionId": "uuid-sesion",
      "atletaId": "uuid-atleta",
      "atletaNombre": "Ana",
      "atletaAlias": "Ana",
      "entrenadorId": "uuid-entrenador",
      "ordenTurno": 1,
      "horaRecibidaUtc": "2026-11-22T18:35:00.000Z",
      "estado": "pendiente",
      "ejercicioCapturado": "Sentadilla trasera",
      "estacionCapturada": "rack-1",
      "horaAtencionUtc": null
    }
  ]
}
```

### `PATCH /api/v1/asistencias/:asistenciaId`
* **Acceso:** Exclusivo `entrenador` asignado a esa asistencia (`estado`: `"pendiente"` | `"atendida"`).
* **Body (`200 OK`):**
```json
{
  "estado": "atendida"
}
```

---

## 5. Contratos de Planificación Real y Diferencia con la Demo UUID

Las rutas base definidas en `backend/src/modules/planificacion/CONTRATOS.md` se mantienen montadas exactamente bajo `/api/v1`, pero con persistencia real en Supabase:
* `POST /api/v1/planes` — Crea borrador (`origen`: `"IA"` | `"DeepSeek"` | `"manual"`, `evaluacionId` UUID real, y `dias` si es `"manual"`). Devuelve `201 Created`.
* `GET /api/v1/planes/:versionId` — Consulta borrador o versión aprobada (`200 OK`).
* `PATCH /api/v1/planes/:versionId` — Edita borrador enviando `{ "revisionEsperada": 1, "cambios": { ... } }` (`200 OK`, incrementa `revision` y **conserva los UUIDs reales de `diaId` e `itemId`**). Si `revisionEsperada` no coincide, responde `409 REVISION_CONFLICTIVA` con `revisionActual`.
* `POST /api/v1/planes/:versionId/aprobar` — Aprueba el borrador enviando `{ "revisionEsperada": <numero> }` (`200 OK`), pasa la versión a `"vigente"` y archiva la anterior.
* `POST /api/v1/planes/:versionId/reorganizar` — Crea propuesta/borrador V2 sobre una versión vigente (`201 Created`).
* `GET /api/v1/me/rutina?fecha=YYYY-MM-DD` — Consulta la rutina vigente del atleta autenticado para esa fecha (`200 OK`).

### Diferencias clave entre la Demo y Supabase Real
1. **Identificadores reales (UUID v4) vs códigos de fixture (`T1`, `A1`, `EV1`, `E1`, `E2`):** En Supabase todos los IDs (`evaluacionId`, `versionId`, `diaId`, `itemId`, `ejercicioId`, `criterioId`) son UUIDs reales generados en PostgreSQL (`codigo_demo` / `codigo_ref` se usan solo como referencia interna, nunca como `id` en las peticiones HTTP).
2. **Estabilidad de `diaId` e `itemId` al editar:** Al hacer `PATCH /api/v1/planes/:versionId`, los UUIDs de `diaId` e `itemId` se preservan intactos entre revisiones para que el frontend pueda hacer diff y actualizar sin perder referencias.
3. **Identidad por JWT real:** Se elimina la cabecera/identidad simulada del servidor demo; cada llamada exige `Authorization: Bearer <access_token>` válido de Supabase Auth.

---

## 6. Interfaz de Administración (`rol: "administrador"` — Contrato Definido / Pendiente de Despliegue)

### Reglas de acceso y aislamiento
* **Ingreso:** Entra por el **mismo login principal** (`Authorization: Bearer <access_token>`). El servidor consulta `public.miembros`, verifica `rol === "administrador"` en `GET /api/v1/auth/me` y bloquea cualquier otra ruta `/api/v1/admin/*` con `403 SIN_PERMISO` si el rol no es `administrador`.
* **Aislamiento por gimnasio:** Todas las consultas y mutaciones filtran automáticamente por `actor.gimnasioId` resuelto en el servidor (nunca se confía en un `gimnasioId` enviado por el cliente).

### Operaciones administrativas (definidas para frontend / pendientes de SQL y router)

#### Gestión de Entrenadores, Clientes y Asignaciones
* `GET /api/v1/admin/miembros?rol=entrenador|atleta` — Lista miembros del gimnasio del administrador (`200 OK`):
```json
{
  "miembros": [
    {
      "miembroId": "uuid-miembro",
      "gimnasioId": "uuid-gimnasio",
      "rol": "entrenador",
      "nombre": "Eva",
      "aliasVisible": "Eva",
      "email": "eva.demo@olimpycfit.local",
      "activo": true
    }
  ]
}
```
* `POST /api/v1/admin/miembros` — Crea o vincula un entrenador o cliente dentro del gimnasio (`201 Created`):
```json
{
  "rol": "entrenador",
  "nombre": "Carlos",
  "aliasVisible": "Carlos",
  "email": "carlos@olimpycfit.local"
}
```
* `PATCH /api/v1/admin/miembros/:miembroId` — Actualiza datos o estado `activo` (`true` / `false`) de un miembro del mismo gimnasio (`200 OK`).
* `POST /api/v1/admin/asignaciones` — Asigna un entrenador a un cliente dentro del mismo gimnasio (`201 Created`):
```json
{
  "entrenadorId": "uuid-entrenador",
  "atletaId": "uuid-atleta"
}
```

#### Gestión de Suscripciones del Gimnasio
* `GET /api/v1/admin/suscripciones` — Lista suscripciones de clientes del gimnasio (`200 OK`):
```json
{
  "suscripciones": [
    {
      "suscripcionId": "uuid-suscripcion",
      "gimnasioId": "uuid-gimnasio",
      "atletaId": "uuid-atleta",
      "atletaNombre": "Ana",
      "plan": "Mensual Full",
      "estado": "activa",
      "fechaInicio": "2026-11-01",
      "fechaFin": "2026-12-01"
    }
  ]
}
```
* `POST /api/v1/admin/suscripciones` y `PATCH /api/v1/admin/suscripciones/:suscripcionId` — Crea o actualiza plan, fechas y `estado` (`"activa"` | `"pendiente"` | `"vencida"` | `"cancelada"`).

#### Consulta de Comentarios del Chat de Clientes
* `GET /api/v1/admin/comentarios` — Consulta comentarios enviados por clientes del gimnasio desde el chat (`200 OK`):
```json
{
  "comentarios": [
    {
      "comentarioId": "uuid-comentario",
      "gimnasioId": "uuid-gimnasio",
      "atletaId": "uuid-atleta",
      "atletaNombre": "Ana",
      "mensaje": "Excelente atención en el rack hoy",
      "fechaUtc": "2026-11-22T19:15:00.000Z",
      "leido": false
    }
  ]
}
```
* `PATCH /api/v1/admin/comentarios/:comentarioId` — Marca un comentario como revisado (`{ "leido": true }`, `200 OK`).

---

## 7. Errores Estándar de `/api/v1`

| HTTP | `codigo` | Cuándo ocurre |
| :--- | :--- | :--- |
| `401` | `NO_AUTENTICADO` | Falta `Authorization: Bearer <token>`, formato inválido o token expirado. |
| `403` | `SIN_PERMISO` | Rol sin permiso (ej. atleta/entrenador en ruta de administrador) o recurso fuera de su `gimnasioId` / asignación activa. |
| `404` | `NO_ENCONTRADO` | El recurso (`evaluacionId`, `sesionId`, `versionId`, `miembroId`, etc.) no existe en el gimnasio. |
| `409` | `REVISION_CONFLICTIVA` | `revisionEsperada` desactualizada en planificación (incluye `revisionActual`). |
| `422` | `SOLICITUD_INVALIDA` | Campos obligatorios faltantes, tipos inválidos o incumplimiento de reglas de negocio. |
| `503` | `PROVEEDOR_NO_DISPONIBLE` | Fallo temporal con Supabase o proveedor de IA. |

---

## 8. Resumen de Estado
* **Implementado en `develop`:** Arranque único (`npm start` en `backend/`), montaje de `/api/v1`, validación de JWT y asignaciones activas, persistencia real de planificación, perfil/clientes, evaluaciones, mediciones, sesiones, series y asistencias.
* **Conecta frontend:** Leer `session.access_token` de Supabase Auth desde el login principal, enviarlo en `Authorization: Bearer <token>` y conectar las pantallas de Eva, Ana y la maquetación del panel de Administración.
* **Pendiente en backend/BD:** Ejecutar migración SQL y endpoints de `/api/v1/admin/*` (rol `administrador` en `miembros`, suscripciones y comentarios del chat) y pruebas end-to-end sobre `develop`.