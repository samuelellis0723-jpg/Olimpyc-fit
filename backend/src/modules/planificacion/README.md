# Planificación Olimpyc Fit

Módulo de generación, edición, aprobación y reorganización de planes. El router se monta bajo `/api/v1` con `crearRouterPlanificacion({ servicio, resolverActor })`; no crea Express global ni resuelve identidades de producción. Las propuestas comienzan como `borrador`. Solo la aprobación explícita del entrenador publica una versión.

## Inicio local

Desde la raíz:

```sh
npm --prefix backend/src/modules/planificacion ci
npm --prefix backend/src/modules/planificacion start
```

O desde este directorio:

```sh
npm ci
npm start
```

El servidor escucha en `127.0.0.1`. `PORT=0` elige un puerto efímero. Por defecto usa fixtures ficticios y proveedor simulado; `X-Planificacion-Demo` identifica ese modo. La identidad también es ficticia (`X-Demo-Actor` o bearer local) y el repositorio vive solo en memoria.

Actores aceptados: `entrenadoraEva`, `entrenadorAjeno`, `atletaEva` y `atletaOtroGimnasio`. Por ejemplo, `X-Demo-Actor: entrenadoraEva` o `Authorization: Bearer demo-entrenadora-eva`; los bearer disponibles son `demo-entrenadora-eva`, `demo-entrenador-ajeno`, `demo-atleta-eva` y `demo-atleta-otro-gimnasio`. Son credenciales ficticias de demo local, no sirven para producción.

Para usar DeepSeek, configurar `PLANIFICACION_PROVEEDOR=real`, `DEEPSEEK_API_KEY` y `DEEPSEEK_MODEL` en el entorno o en `.env` local no versionado. El ensayo registrado usó `deepseek-flash`, exclusivamente con fixtures, y completó una generación y una reorganización con respuesta upstream HTTP 200 en ambas. Esto acredita una ejecución observada, no disponibilidad sostenida ni integración de producción. Incluso en modo real, identidad y persistencia siguen siendo demo/volátiles. No imprimir ni compartir claves.

## Contrato y estados

Las seis rutas, cuerpos exactos, respuestas y errores están en [CONTRATOS.md](./CONTRATOS.md). Las rutas son locales al módulo y requieren revisión de Alex y Hellen antes de integrarse con la API común. Los errores de dominio usan `{ codigo, mensaje, camposPendientes?, revisionActual? }`; la identidad ausente da 401, el recurso ajeno 404 y errores inesperados 503 genérico. La propuesta inválida se rechaza antes de guardarse.

El atleta solo consulta la versión vigente/aprobada. Editar genera una revisión del borrador mediante CAS; reorganizar crea una nueva versión borrador vinculada a su base y no reemplaza la publicada. Las sesiones y asistencia quedan fuera del módulo.

## Verificación reproducible

```sh
npm --prefix backend/src/modules/planificacion test
```

La instalación reproducible se verificó con `npm ci`; la suite registró 51/51 pruebas aprobadas. Las pruebas no llaman al proveedor: el tráfico HTTP de tests se limita a loopback y usa dobles/fixtures.

El [guion de entrega](./docs/entrega-samuel.md) separa verificación simulada de evidencia del ensayo real y documenta sus límites. [Integración con Alex](./docs/integracion-alex.md) y [guía para Hellen](./docs/integracion-hellen.md) especifican los siguientes contratos a revisar.

## Integración pendiente

`index.mjs` exporta `crearRouterPlanificacion`, `crearServicioPlanificacion`, `crearProveedorDeepSeek`, `crearRepositorioEnMemoria`, `crearProveedorSimulado` y `ErrorPlanificacion`. Los adaptadores de evaluación, catálogo, asignación e historial llegan desde fuera. Faltan identidad confiable, persistencia atómica compartida, integración de sesiones y asistencia, montaje real y consumo de interfaz. El repo en memoria y la identidad de demo no equivalen a Supabase Auth/PostgreSQL.
