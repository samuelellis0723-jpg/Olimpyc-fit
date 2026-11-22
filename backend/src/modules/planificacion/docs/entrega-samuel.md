# Entrega y guion de demostración de Samuel

## Qué se verificó

- `npm ci` instaló las dependencias del módulo de forma reproducible.
- `npm test` terminó con **51/51 pruebas aprobadas**. La suite no accede a servicios externos: usa dobles/fixtures y HTTP de loopback.
- Se realizó un ensayo real con el proveedor `deepseek-flash`, solo con fixtures ficticios: una generación y una reorganización. Ambas llamadas al proveedor respondieron HTTP 200.
- El flujo HTTP observado devolvió generación 201 con V1 borrador en días `[1,4]`; PATCH de E2 a descanso de 60 segundos creó revisión 2 y respondió 200; Eva aprobó y respondió 200. Ana consultó V1.
- La reorganización real creó V2 201 como borrador con días `[1,4,6]`; E2 quedó en el día 1 y mantuvo el descanso de 60 segundos. Ana siguió viendo V1 mientras V2 estaba pendiente. El movimiento específico del bloque E2 al sábado es el ejemplo del fixture simulado, no el cambio observado en el ensayo real.
- Al aprobar V2, la respuesta fue 200, Ana pasó a ver V2 y V1 quedó histórica y consultable por el entrenador (200). El proceso del ensayo se cerró.
- En una ejecución previa el proveedor devolvió una referencia a un dato no permitido: la API respondió 503 y no publicó ni guardó el borrador. Se corrigió la lista de referencias elegibles; el rechazo de salidas inválidas permanece.

Es un único ensayo real exitoso, no una prueba de disponibilidad sostenida. Se usaron identidad ficticia y repositorio temporal en memoria, incluso durante las llamadas reales al proveedor. No se probaron Supabase/Auth, frontend/UI, sesión SE1 ni Web Push. La suite no equivale a validación del modelo con profesionales.

## Arranque seguro de la demo simulada

Por defecto se usan proveedor simulado y fixtures ficticios; no requiere claves ni tráfico externo. Desde la raíz:

```sh
npm --prefix backend/src/modules/planificacion ci
npm --prefix backend/src/modules/planificacion start
```

O desde el módulo:

```sh
cd backend/src/modules/planificacion
npm ci
npm start
```

Usar `127.0.0.1`, el puerto indicado por el servidor y los actores ficticios documentados en [README del módulo](../README.md). Confirmar `X-Planificacion-Demo: modo-simulado; datos-ficticios`. No copiar claves a comandos compartidos ni registrar salidas privadas.

## Recorrido HTTP repetible con fixtures

Desde la raíz del repositorio, con el servidor simulado iniciado como arriba. El fixture es sintético; los IDs de item se extraen de la respuesta para no depender de su orden.

```sh
BASE=http://127.0.0.1:3001/api/v1
AUTH='X-Demo-Actor: entrenadoraEva'

# Generar V1 en borrador.
V1_JSON=$(curl -fsS -H "$AUTH" -H 'content-type: application/json' -d '{"origen":"IA","evaluacionId":"EV1"}' "$BASE/atletas/A1/planes")
node -e 'const p=JSON.parse(process.argv[1]);console.log(JSON.stringify({versionId:p.versionId,estado:p.estado,revision:p.revision,origen:p.origen},null,2))' "$V1_JSON"
V1=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).versionId)' "$V1_JSON")
ITEM=$(node -e 'const p=JSON.parse(process.argv[1]);const i=p.dias.flatMap(d=>d.items).find(x=>x.ejercicioId==="E2");if(!i)process.exit(2);process.stdout.write(i.itemId)' "$V1_JSON")

# Editar E2 a 60 s y revisar la respuesta.
PATCH_JSON=$(curl -fsS -X PATCH -H "$AUTH" -H 'content-type: application/json' -d "{\"revisionEsperada\":1,\"cambios\":{\"items\":[{\"itemId\":\"$ITEM\",\"descansoSegundos\":60}]}}" "$BASE/planes/$V1")
node -e 'const p=JSON.parse(process.argv[1]);const i=p.dias.flatMap(d=>d.items).find(x=>x.itemId===process.argv[2]);console.log(JSON.stringify({versionId:p.versionId,revision:p.revision,estado:p.estado,descansoE2:i.descansoSegundos},null,2))' "$PATCH_JSON" "$ITEM"

# Aprobar revisión 2: Ana consulta V1.
curl -fsS -X POST -H "$AUTH" -H 'content-type: application/json' -d '{"revisionEsperada":2}' "$BASE/planes/$V1/aprobacion"
curl -fsS -H 'X-Demo-Actor: atletaEva' "$BASE/me/rutina?fecha=2026-11-23"

# Crear V2 de tres días. Ana conserva V1 mientras V2 es borrador.
V2_JSON=$(curl -fsS -H "$AUTH" -H 'content-type: application/json' -d '{"motivo":"Regreso con tres días","ausencia":true,"disponibilidadRegreso":[1,4,6]}' "$BASE/planes/$V1/reorganizaciones")
node -e 'const p=JSON.parse(process.argv[1]).plan;console.log(JSON.stringify({versionId:p.versionId,estado:p.estado,versionBaseId:p.versionBaseId,motivo:p.motivo,diferencias:p.diferencias,dias:p.dias.map(d=>({diaSemana:d.diaSemana,ejercicioIds:d.items.map(i=>i.ejercicioId)}))},null,2))' "$V2_JSON"
V2=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).plan.versionId)' "$V2_JSON")
curl -fsS -H 'X-Demo-Actor: atletaEva' "$BASE/me/rutina?fecha=2026-11-23"

# Aprobar V2; V1 pasa a histórica y sigue consultable por el entrenador.
curl -fsS -X POST -H "$AUTH" -H 'content-type: application/json' -d '{"revisionEsperada":1}' "$BASE/planes/$V2/aprobacion"
curl -fsS -H "$AUTH" "$BASE/planes/$V1"
curl -fsS -H 'X-Demo-Actor: atletaEva' "$BASE/me/rutina?fecha=2026-11-23"
```

La respuesta de error sigue `{codigo,mensaje,camposPendientes?,revisionActual?}`. Para ver pendientes, enviar una generación con `EV_INCOMPLETA`: devuelve 422 y no guarda. Para control de revisión, repetir una aprobación con revisión antigua: devuelve 409 con la revisión actual. Un actor sin asignación recibe 404 genérico. Los cuerpos exactos y restantes errores están en [CONTRATOS.md](../CONTRATOS.md).

## Modo real

El modo real se ejecuta solo localmente con `PLANIFICACION_PROVEEDOR=real`, `DEEPSEEK_API_KEY` y `DEEPSEEK_MODEL` en el entorno o `.env` local ignorado por Git. Confirmar el modo por la salida de demo sin mostrar valores de configuración. El proveedor nunca debe recibir IDs de evaluación/gimnasio/atleta, identidad, tokens ni notas privadas; usa referencia seudónima, catálogo y contexto proyectado según el contrato. El ensayo descrito arriba usó datos ficticios; no reutilizarlo como prueba con personas reales.

## Siguientes responsables

- Alex: revisar y concretar autenticación/asignación confiables, snapshots y persistencia transaccional/CAS; ver [integración con Alex](./integracion-alex.md).
- Hellen: validar rutas, payloads, estados, errores y presentación por rol; ver [guía de integración para Hellen](./integracion-hellen.md).
- Antes de afirmar el flujo integrado, faltan comprobaciones reales con Supabase/Auth, almacenamiento persistente, montaje compartido, UI y sesión/atención. Web Push necesita su propio ensayo físico con el móvil bloqueado.
