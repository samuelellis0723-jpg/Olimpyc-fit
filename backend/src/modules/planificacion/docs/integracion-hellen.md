# Integración de planificación para Hellen

Esta guía traduce el contrato local de [CONTRATOS.md](../CONTRATOS.md) a estados y acciones de interfaz. Las rutas son relativas a `/api/v1`; Alex debe confirmar autenticación y montaje compartidos antes de consumirlas en la aplicación. La API local de demo usa actores ficticios.

## Punto de entrada reproducible en modo simulado

Desde la raíz del repositorio, instala y arranca la demo (por defecto usa proveedor simulado, fixtures ficticios y repo en memoria):

```sh
npm --prefix backend/src/modules/planificacion ci
PLANIFICACION_PROVEEDOR=simulado npm --prefix backend/src/modules/planificacion start
```

El servidor escucha en `http://127.0.0.1:3001` y confirma `X-Planificacion-Demo: modo-simulado; datos-ficticios`. El loopback solo es accesible desde la misma máquina. Si Vite/frontend corre en otro puerto u origen, configura un proxy de desarrollo local que conserve la ruta `/api/v1` y la reenvíe al target `http://127.0.0.1:3001`; así el navegador habla con frontend en el mismo origen y el servidor demo no necesita ni emite CORS. No apuntes un teléfono u otro equipo a `127.0.0.1` esperando acceder al servidor del portátil.

Para la demo, usa `X-Demo-Actor` con estos valores exactos:

| Rol | Header | Fixture |
|---|---|---|
| Entrenadora asignada | `X-Demo-Actor: entrenadoraEva` | Eva (`T1`, gimnasio `G1`, asignada a `A1`) |
| Entrenador no asignado | `X-Demo-Actor: entrenadorAjeno` | Comprueba el 404 genérico de asignación |
| Atleta | `X-Demo-Actor: atletaEva` | Ana (`A1`, gimnasio `G1`) |
| Atleta de otro gimnasio | `X-Demo-Actor: atletaOtroGimnasio` | Comprueba el aislamiento (`A2`, `G2`) |

Estos nombres y los alias compatibles de bearer son exclusivamente identidades ficticias locales; no son tokens Supabase ni identidades de producción. Los códigos fixture `A1`, `EV1`, `E1`, `E2` también son alias ficticios. En la API integrada, usar los UUID canónicos que la API devuelve.

## Consumo según rol

**Entrenador asignado:** puede generar borrador, consultar versión, editar borrador, aprobar y reorganizar una versión vigente. Mostrar claramente quién/qué versión se edita, revisión y estado. No presentar una propuesta como publicada antes de respuesta exitosa de aprobación.

**Atleta:** usa únicamente `GET /me/rutina?fecha=YYYY-MM-DD`. Nunca recibe acciones de editar/aprobar ni el historial de borradores. Mostrar el día de la versión vigente; una reorganización pendiente no cambia su rutina. Si no hay día programado o no hay plan, representar el estado explícito de la respuesta.

## Rutas, payloads y estados visibles

| Acción | Request | Éxito | Interacción sugerida |
|---|---|---|---|
| Crear borrador IA | `POST /atletas/:atletaId/planes` `{"origen":"IA","evaluacionId":"EV1"}` | `201 Plan`, inicialmente `borrador` | Confirmar que es una propuesta que requiere revisión; no publicarla automáticamente. |
| Consultar versión | `GET /planes/:versionId` | `200 Plan` | Renderizar versión, base si existe, origen, revisión, diferencias y estado. Solo entrenador asignado. |
| Editar borrador | `PATCH /planes/{versionIdDevueltoPorAPI}` `{"revisionEsperada":1,"cambios":{"items":[{"itemId":"{itemIdDevueltoPorAPI}","descansoSegundos":60}]}}` | `200 Plan`, revisión incrementada | Al recibirlo actualizar descanso y revisión. Si PATCH aún no se envía, la edición es local y sigue pendiente; guardar envía PATCH. |
| Aprobar | `POST /planes/{versionIdDevueltoPorAPI}/aprobacion` `{"revisionEsperada":2}` | `200 {plan,anterior}` | Solo entonces indicar publicado. Informar que la versión anterior pasa a histórica cuando exista. |
| Reorganizar vigente | `POST /planes/:versionId/reorganizaciones` `{"motivo":"Regreso con tres días","ausencia":true,"disponibilidadRegreso":[1,4,6]}` | `201 {plan,diferencias}`; plan nuevo en borrador | Comparar cambios, permitir revisión y conservar la versión publicada hasta una segunda aprobación. |
| Rutina de atleta | `GET /me/rutina?fecha=2026-11-23` | `200 {estado,plan?,dia?}` | `disponible`, `sin_sesion_programada` o `sin_plan`; la fecha debe ser ISO local. |

En PATCH, `items` puede incluir `itemId` y cambios parciales en `ejercicioId`, `criterioId`, `series`, `objetivoPorSerie`, `descansoSegundos` o `explicacion`; `proximaRevision` es opcional dentro de `cambios`. Mostrar datos de la respuesta persistida. La edición local previa a PATCH debe verse como no guardada. Para PATCH y aprobación, extraer `versionId` e `itemId` de la respuesta de creación/consulta; no usar los alias de fixture `V1`/`V2` como si fueran UUID ni tokens de demo como credenciales reales.

## Comparación de versiones

`diferencias` contiene `mantenidos`, `movidos` (con `deDia` y `aDia`), `agregados`, `retirados` y `explicacion`. Presentar el día en formato legible; ISO usa lunes `1` a domingo `7`. Una explicación general no sustituye las diferencias estructuradas. Ejemplo de fixture: V1 con `[1,4]`; reorganización a `[1,4,6]` propone V2 y puede trasladar un bloque al sábado. Marcar ese ejemplo como simulado. En cualquier respuesta real, usar los valores devueltos, sin asumir que el proveedor mantuvo los mismos ejercicios o IDs.

Caso de descanso: si V1 tiene E2 a 60 s y V2 conserva ese valor, mostrarlo como mantenido; si cambia, señalar el antes/después y pedir revisión. En el ensayo real documentado, E2 quedó a 60 s en V2. La ilustración de traslado al sábado proviene de fixture separado.

## Estados de error

Los errores usan JSON `{codigo,mensaje,camposPendientes?,revisionActual?}`:

- `401 NO_AUTENTICADO`: solicitar iniciar sesión/renovar sesión.
- `403 SIN_PERMISO`: explicar que la acción no corresponde al rol.
- `404 NO_ENCONTRADO`: recurso inexistente o fuera de asignación; mensaje neutro.
- `409 REVISION_CONFLICTIVA`: informar que otra edición ganó y ofrecer recargar con `revisionActual`. `BASE_NO_VIGENTE`: pedir recargar la versión antes de reorganizar/aprobar.
- `422 DATOS_PENDIENTES`: mostrar la pregunta concreta y campos faltantes. Si `disponibilidadRegreso` falta, preguntar qué días podrá entrenar al regresar y no enviar reorganización aún.
- `422 SOLICITUD_INVALIDA`: explicar validación de entrada sin representar el borrador como guardado.
- `503 PROVEEDOR_NO_DISPONIBLE` o `RESPUESTA_PROVEEDOR_INVALIDA`: dejar disponible la versión vigente y permitir reintentar o editar/crear manualmente, según flujo confirmado por Alex.

## Fixtures para validar la interfaz

Con proveedor simulado (marcado en la respuesta con `X-Planificacion-Demo: modo-simulado; datos-ficticios`), usar `X-Demo-Actor` según el rol y probar estas pantallas con datos sintéticos:

1. Eva genera V1; cabecera visible **Borrador · revisión 1**. Ana todavía no la ve.
2. Eva cambia localmente el descanso de E2 a 60 s; antes de guardar, distinguir edición pendiente. PATCH exitoso muestra revisión 2.
3. Eva aprueba revisión 2; mostrar V1 vigente. Ana ve V1 en su consulta de rutina.
4. Eva reorganiza por regreso a tres días; V2 aparece como borrador con base V1 y diferencias. Ana continúa viendo V1.
5. Eva aprueba V2; Ana ve V2 y V1 se conserva como histórica. Como entrenador, la consulta de V1 permite inspeccionar historial.
6. Probar 422 por datos incompletos, 409 revisión vieja y 503 de proveedor fallido; el plan aprobado no desaparece.

El guion solo confirma el flujo de API y no acredita UI ya integrada. La generación/reorganización real se ensayó una vez con fixtures; no hubo prueba con Supabase/Auth, aplicación frontend, SE1 ni Web Push. Revisar [evidencia y límites](./entrega-samuel.md) y coordinar montaje/identidad con [Alex](./integracion-alex.md).

## Contratos pendientes de confirmar

- Literales finales de estados/códigos y la forma compartida de errores, además del formato definitivo de PATCH, los campos de `diferencias` y los nombres que mostrará la UI.
- Cómo representar `camposPendientes`, preguntas de aclaración, revisión conflictiva (`revisionActual`) y conflictos de base no vigente; cuándo permitir reintentar o recargar.
- Interpretación de fecha local/zonas horarias en `GET /me/rutina`, soporte de flujo manual y qué experiencia ofrecer ante error del proveedor. Confirmar estos casos con Alex antes de fijar comportamiento común de producto.
