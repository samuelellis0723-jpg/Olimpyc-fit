# Integración de planificación para Hellen

Esta guía traduce el contrato local de [CONTRATOS.md](../CONTRATOS.md) a comandos de arranque local, autenticación de prueba, rutas, ejemplos y errores para conectar el frontend de forma reproducible antes de pasar al entorno compartido con Supabase.

## 1. Arranque local con UUID ficticios (repositorio en memoria + proveedor simulado)

Desde la raíz del repositorio:

```sh
npm --prefix backend/src/modules/planificacion ci
npm --prefix backend/src/modules/planificacion run start:uuid
```

Para ejecutar automáticamente todo el flujo V1 → editar → aprobar → V2 → aprobar y verificar estados/IDs sin intervención manual:

```sh
npm --prefix backend/src/modules/planificacion run demo:uuid
```

- El servidor local escucha en `http://127.0.0.1:3001` (base de API: `http://127.0.0.1:3001/api/v1`).
- Responde con la cabecera `X-Planificacion-Demo: modo-simulado; datos-ficticios; ids-uuid`.
- Incluye CORS únicamente para orígenes loopback (`http://localhost:*` y `http://127.0.0.1:*`, por ejemplo Vite en `http://localhost:5173`), permitiendo `GET`, `POST`, `PATCH`, `OPTIONS` y cabeceras `Authorization`, `Content-Type` y `X-Demo-Actor`.
- Todos los datos viven en memoria: al reiniciar el servidor demo se reinician los borradores y versiones.

## 2. UUID ficticios disponibles para la prueba local

Son identificadores UUID v4 sintéticos (definidos en `demo/fixtures/index.mjs` bajo `idsDemoUuid`); **no representan registros reales de Supabase**.

| Recurso ficticio | UUID de prueba |
|---|---|
| Gimnasio `G1` | `11111111-1111-4111-8111-111111111111` |
| Entrenadora Eva (`T1`) | `11111111-1111-4111-8111-111111111101` |
| Atleta Ana (`A1`) | `11111111-1111-4111-8111-111111111103` |
| Evaluación completa (`EV1`) | `11111111-1111-4111-8111-111111111201` |
| Evaluación incompleta (`EV_INCOMPLETA`) | `11111111-1111-4111-8111-111111111202` |
| Ejercicio `E1` (Sentadilla a banco) | `11111111-1111-4111-8111-111111111301` |
| Ejercicio `E2` (Press con mancuernas en banco) | `11111111-1111-4111-8111-111111111302` |
| Criterio aprobado `CR1` (`E1`) | `11111111-1111-4111-8111-111111111401` |
| Criterio aprobado `CR2` (`E2`) | `11111111-1111-4111-8111-111111111402` |

*(Los `versionId`, `diaId` e `itemId` se generan como UUID v4 dinámicos en cada creación y se leen de las respuestas JSON).*

## 3. Autenticación local vs. token real de Supabase

### En este servidor local de pruebas

El router exige autenticación en todas las rutas; una petición sin credenciales responde `401 NO_AUTENTICADO`. Usa el encabezado `Authorization` con uno de estos tokens ficticios de prueba (o `X-Demo-Actor` en pruebas con `curl`):

- **Entrenadora Eva (`T1`):** `Authorization: Bearer demo-entrenadora-eva` (alias `X-Demo-Actor: entrenadoraEva`)
- **Atleta Ana (`A1`):** `Authorization: Bearer demo-atleta-eva` (alias `X-Demo-Actor: atletaEva`)
- **Entrenador ajeno (`T2`):** `Authorization: Bearer demo-entrenador-ajeno` (útil para verificar `404` de aislamiento)
- **Atleta otro gimnasio (`A2`):** `Authorization: Bearer demo-atleta-otro-gimnasio`

### Qué cambia al integrar con el backend compartido y Supabase Auth

- Se mantiene exactamente la misma cabecera `Authorization: Bearer <access_token>`, pero `<access_token>` pasa a ser el **JWT emitido por Supabase Auth** al iniciar sesión.
- Desaparecen los tokens `demo-*` y la cabecera `X-Demo-Actor`; `identidadSupabase.js` en el backend de Alex valida el JWT con `supabaseAdmin.auth.getUser(token)` y resuelve `{ usuarioId: miembros.id, gimnasioId, rol }` en el servidor.
- En el frontend (`frontend/src/services/planService.js`), `request()` actualmente usa `credentials: 'include'` sin enviar `Authorization`; para consumir el backend de `develop` debe adjuntar `Authorization: Bearer <access_token>` de la sesión activa de Supabase.
- Los UUID del atleta, evaluación, catálogo y versiones vendrán dinámicamente desde los endpoints de Alex (`GET /atletas`, `GET /atletas/:id/ficha`, `GET /catalogo`) en lugar de la tabla fija anterior.

## 4. Rutas, solicitudes y respuestas esperadas (flujo completo V1 → V2)

Base común: `http://127.0.0.1:3001/api/v1`

### Paso 0: Sin token → `401`

```sh
curl -i "http://127.0.0.1:3001/api/v1/me/rutina?fecha=2026-11-23"
```

Respuesta `401`:
```json
{ "codigo": "NO_AUTENTICADO", "mensaje": "Se requiere una identidad autenticada." }
```

### Paso 1: Eva crea borrador V1 (`POST /atletas/:atletaId/planes`)

```sh
curl -sS -X POST "http://127.0.0.1:3001/api/v1/atletas/11111111-1111-4111-8111-111111111103/planes" \
  -H "Authorization: Bearer demo-entrenadora-eva" \
  -H "Content-Type: application/json" \
  -d '{"origen":"IA","evaluacionId":"11111111-1111-4111-8111-111111111201"}'
```

Respuesta `201`:
```json
{
  "versionId": "<UUID-V1>",
  "gimnasioId": "11111111-1111-4111-8111-111111111111",
  "atletaId": "11111111-1111-4111-8111-111111111103",
  "evaluacionId": "11111111-1111-4111-8111-111111111201",
  "origen": "DeepSeek",
  "estado": "borrador",
  "revision": 1,
  "catalogoVersion": "v1",
  "dias": [
    {
      "diaId": "<UUID-DIA-1>",
      "diaSemana": 1,
      "items": [
        { "itemId": "<UUID-ITEM-1>", "ejercicioId": "11111111-1111-4111-8111-111111111301", "orden": 1, "series": 2, "objetivoPorSerie": { "cantidad": 10, "unidad": "repeticiones" }, "descansoSegundos": 60, "criterioId": "11111111-1111-4111-8111-111111111401", "datosUtilizados": ["nivel"] },
        { "itemId": "<UUID-ITEM-2>", "ejercicioId": "11111111-1111-4111-8111-111111111302", "orden": 2, "series": 2, "objetivoPorSerie": { "cantidad": 10, "unidad": "repeticiones" }, "descansoSegundos": 90, "criterioId": "11111111-1111-4111-8111-111111111402", "datosUtilizados": ["nivel"] }
      ]
    },
    {
      "diaId": "<UUID-DIA-2>",
      "diaSemana": 4,
      "items": [
        { "itemId": "<UUID-ITEM-3>", "ejercicioId": "11111111-1111-4111-8111-111111111301", "orden": 1, "series": 2, "objetivoPorSerie": { "cantidad": 10, "unidad": "repeticiones" }, "descansoSegundos": 60, "criterioId": "11111111-1111-4111-8111-111111111401", "datosUtilizados": ["nivel"] }
      ]
    }
  ],
  "creadoEn": "2026-11-22T..."
}
```

### Paso 2: Eva edita borrador V1 (`PATCH /planes/:versionId`)

```sh
curl -sS -X PATCH "http://127.0.0.1:3001/api/v1/planes/<UUID-V1>" \
  -H "Authorization: Bearer demo-entrenadora-eva" \
  -H "Content-Type: application/json" \
  -d '{"revisionEsperada":1,"cambios":{"items":[{"itemId":"<UUID-ITEM-2>","descansoSegundos":60}],"proximaRevision":"2026-12-20"}}'
```

Respuesta `200`: mismo `Plan` con `"revision": 2`, `"proximaRevision": "2026-12-20"`, `descansoSegundos: 60` y exactamente los mismos `diaId` e `itemId`.

### Paso 3: Eva aprueba V1 (`POST /planes/:versionId/aprobacion`)

```sh
curl -sS -X POST "http://127.0.0.1:3001/api/v1/planes/<UUID-V1>/aprobacion" \
  -H "Authorization: Bearer demo-entrenadora-eva" \
  -H "Content-Type: application/json" \
  -d '{"revisionEsperada":2}'
```

Respuesta `200`:
```json
{
  "plan": { "versionId": "<UUID-V1>", "estado": "vigente", "revision": 2, "aprobacion": { "aprobadorId": "11111111-1111-4111-8111-111111111101", "fecha": "..." } },
  "anterior": null
}
```

### Paso 4: Ana consulta su rutina vigente (`GET /me/rutina?fecha=YYYY-MM-DD`)

```sh
curl -sS "http://127.0.0.1:3001/api/v1/me/rutina?fecha=2026-11-23" \
  -H "Authorization: Bearer demo-atleta-eva"
```

Respuesta `200` (el `2026-11-23` es lunes, `diaSemana: 1`):
```json
{
  "estado": "disponible",
  "plan": { "versionId": "<UUID-V1>", "estado": "vigente", "..." : "..." },
  "dia": { "diaId": "<UUID-DIA-1>", "diaSemana": 1, "items": ["..."] }
}
```

Otros estados posibles de `GET /me/rutina`: `{ "estado": "sin_plan" }` o `{ "estado": "sin_sesion_programada" }`.

### Paso 5: Eva crea V2 reorganizada (`POST /planes/:versionId/reorganizaciones`)

```sh
curl -sS -X POST "http://127.0.0.1:3001/api/v1/planes/<UUID-V1>/reorganizaciones" \
  -H "Authorization: Bearer demo-entrenadora-eva" \
  -H "Content-Type: application/json" \
  -d '{"motivo":"Regreso con tres días","ausencia":true,"disponibilidadRegreso":[1,4,6]}'
```

Respuesta `201`:
```json
{
  "plan": {
    "versionId": "<UUID-V2>",
    "versionBaseId": "<UUID-V1>",
    "estado": "borrador",
    "revision": 1,
    "motivo": "Regreso con tres días",
    "dias": [ { "diaSemana": 1 }, { "diaSemana": 4 }, { "diaSemana": 6 } ],
    "diferencias": { "mantenidos": ["..."], "movidos": [{ "itemId": "<UUID-ITEM-2>", "deDia": 1, "aDia": 6 }], "agregados": [], "retirados": [], "explicacion": "..." }
  },
  "diferencias": { "mantenidos": ["..."], "movidos": [{ "itemId": "<UUID-ITEM-2>", "deDia": 1, "aDia": 6 }], "agregados": [], "retirados": [], "explicacion": "..." }
}
```

Mientras `V2` siga en `"estado": "borrador"`, si Ana vuelve a llamar `GET /api/v1/me/rutina?fecha=2026-11-23`, seguirá recibiendo `"versionId": "<UUID-V1>"`. Eva también puede consultar detalles de `V2` o el histórico con `GET /api/v1/planes/<UUID-V2>` o `GET /api/v1/planes/<UUID-V1>`.

### Paso 6: Eva aprueba V2 y Ana pasa a ver V2

```sh
curl -sS -X POST "http://127.0.0.1:3001/api/v1/planes/<UUID-V2>/aprobacion" \
  -H "Authorization: Bearer demo-entrenadora-eva" \
  -H "Content-Type: application/json" \
  -d '{"revisionEsperada":1}'
```

Respuesta `200`: `{ "plan": { "versionId": "<UUID-V2>", "estado": "vigente", "..." }, "anterior": { "versionId": "<UUID-V1>", "estado": "historica", "..." } }`. A partir de este momento, `GET /api/v1/me/rutina?fecha=2026-11-23` como Ana devuelve `<UUID-V2>`.

## 5. Consumo según rol y errores del contrato

- **Entrenador asignado:** genera borradores, consulta versiones (`GET /planes/:versionId`), edita con `revisionEsperada`, aprueba y reorganiza versiones vigentes. Nunca presentar un borrador como publicado antes del `200` de `/aprobacion`.
- **Atleta:** consume únicamente `GET /me/rutina?fecha=YYYY-MM-DD`. Nunca recibe acciones de editar ni aprobar.
- **Errores JSON `{codigo, mensaje, camposPendientes?, revisionActual?}`:**
  - `401 NO_AUTENTICADO`: falta token o sesión expirada; solicitar inicio de sesión.
  - `403 SIN_PERMISO`: rol incompatible (ej. Ana intentando aprobar → `403`).
  - `404 NO_ENCONTRADO`: versión/atleta inexistente o fuera de asignación; mensaje neutro.
  - `409 REVISION_CONFLICTIVA`: revisión obsoleta; incluye `revisionActual` para ofrecer recarga. `BASE_NO_VIGENTE`: recargar plan vigente antes de reorganizar/aprobar.
  - `422 DATOS_PENDIENTES`: incluye `camposPendientes` y pregunta concreta (ej. evaluación incompleta o `ausencia: true` sin `disponibilidadRegreso`). `422 SOLICITUD_INVALIDA`: cuerpo no válido.
  - `503 PROVEEDOR_NO_DISPONIBLE` / `RESPUESTA_PROVEEDOR_INVALIDA`: mantener vigente el último plan aprobado y permitir reintentar o edición manual.

## 6. Límites actuales y pendientes para integración real

- Este modo local usa proveedor simulado y repositorio en memoria; no prueba almacenamiento real ni sesiones de entrenamiento.
- **Pendiente de verificar con Supabase (cuando Alex habilite acceso y corrija adaptadores):**
  1. Persistencia tras reiniciar el backend (`PostgreSQL`).
  2. Estabilidad real de `diaId` e `itemId` tras `PATCH` (pendiente en `backend/sql/002_catalogo_y_transacciones.sql`).
  3. Sesión `SE1` iniciada con `V1` conservando `V1` después de aprobar `V2` (rutas de sesiones aún pendientes en `develop`).
  4. Conexión de login real, envío de `Authorization: Bearer <jwt>` y llamadas `POST`/`PATCH`/reorganización desde el frontend de Hellen.
