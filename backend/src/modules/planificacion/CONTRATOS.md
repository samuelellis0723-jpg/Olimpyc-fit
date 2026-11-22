# Contratos canónicos del módulo de planificación

Contrato local para permitir implementación en paralelo. Las rutas de demo se implementan aquí; su montaje en `/api/v1`, identidad real, persistencia compartida y campos finales de presentación requieren revisión de Alex y Hellen antes de integración. Esto no fija esquema de base de datos. Ninguna operación del módulo crea sesiones de entrenamiento. Toda propuesta inicia como `borrador`; solo el entrenador puede aprobarla.

## Tipos JSON canónicos

Usar objetos JSON sin propiedades alternativas. Identificadores de ejemplo son strings (`G1`, `T1`, `A1`, `EV1`, `E1`). Fechas de calendario `YYYY-MM-DD` estrictas; instantes ISO 8601 con zona. Disponibilidad usa días ISO `1..7` (lunes a domingo). No normalizar entradas inválidas ni inferir datos que falten.

```js
Actor = { usuarioId: string, gimnasioId: string, rol: "entrenador" | "atleta" }
Evaluacion = {
  evaluacionId: string, gimnasioId: string, atletaId: string, autorId: string,
  fecha: "YYYY-MM-DD", modalidad: string, objetivo: string,
  diasDisponibles: number[], nivel?: string, observacion?: string,
  restricciones: string[], publicaciones: [{ dato: string, fuente: "atleta" | "entrenador" | "otra" }],
  mediciones: [{ variable: string, estado: "medida" | "pendiente",
    valor?: number, unidad?: string, origen: string, fecha: "YYYY-MM-DD" }]
}
Catalogo = {
  catalogoVersion: string,
  ejercicios: [{ ejercicioId: string, nombre: string, grupoMuscular: string,
    estaciones: string[], restriccionesIncompatibles: string[],
    dosis: { series: { min: number, max: number }, objetivoPorSerie: {
      unidad: "repeticiones" | "segundos", min: number, max: number },
      descansoSegundos: { min: number, max: number } } }],
  criterios: [{ criterioId: string, ejercicioId: string, version: string, texto: string,
    procedencia: string, estado: "aprobado", revisorId: string, revisadoEn: string }]
}
PerfilProveedor = {
  referenciaAtleta: string, fecha: "YYYY-MM-DD", modalidad: string, objetivo: string,
  diasDisponibles: number[], nivel?: string, observacion?: string,
  restricciones: string[], mediciones: [{ variable: string, estado: "medida" | "pendiente",
    valor?: number, unidad?: string, origen: string, fecha: "YYYY-MM-DD" }],
  publicaciones: [{ dato: string, fuente: "atleta" | "entrenador" | "otra" }]
}
ContextoProveedor = {
  perfil: PerfilProveedor, catalogo: Catalogo,
  historialEjecutado: SesionResumen[],
  versionBase?: { versionId: string, dias: Dia[] }
}
RespuestaProveedor =
  | { tipo: "propuesta", dias: DiaPropuesto[], aclaraciones: [] }
  | { tipo: "aclaracion", pregunta: string, camposPendientes: string[] }
RespuestaReorganizar =
  | { tipo: "propuesta", dias: DiaPropuesto[], explicacion: string }
  | { tipo: "aclaracion", pregunta: string, camposPendientes: string[] }
DiaPropuesto = { diaSemana: number, items: ItemPropuesto[] }
ItemPropuesto = { ejercicioId: string, orden: number, series: number,
  objetivoPorSerie: { cantidad: number, unidad: "repeticiones" | "segundos" },
  descansoSegundos: number, explicacion: string, criterioId: string,
  datosUtilizados: ("objetivo" | "nivel" | "observacion" | "restricciones" | "mediciones" | "historialEjecutado")[] }
Plan = {
  versionId: string, versionBaseId?: string, gimnasioId: string, atletaId: string,
  evaluacionId: string, origen: "manual" | "DeepSeek", estado: "borrador" | "vigente" | "historica",
  revision: number, catalogoVersion: string, dias: Dia[], creadoEn: string,
  proximaRevision?: "YYYY-MM-DD", motivo?: string, diferencias?: Diferencias,
  aprobacion?: { aprobadorId: string, fecha: string }
}
Dia = { diaId: string, diaSemana: number, items: Item[] }
Item = { itemId: string, ejercicioId: string, orden: number, series: number,
  objetivoPorSerie: { cantidad: number, unidad: "repeticiones" | "segundos" },
  descansoSegundos: number, explicacion: string, criterioId: string,
  datosUtilizados: ("objetivo" | "nivel" | "observacion" | "restricciones" | "mediciones" | "historialEjecutado")[] }
Cambios = { dias?: Dia[], proximaRevision?: "YYYY-MM-DD" }
PatchHTTP = { items?: [{ itemId: string, ejercicioId?: string, criterioId?: string,
  series?: number, objetivoPorSerie?: { cantidad: number, unidad: "repeticiones" | "segundos" },
  descansoSegundos?: number, explicacion?: string }], proximaRevision?: "YYYY-MM-DD" }
Diferencias = { mantenidos: string[], movidos: [{ itemId: string, deDia: number, aDia: number }],
  agregados: string[], retirados: string[], explicacion: string }
SesionResumen = { fecha: "YYYY-MM-DD", estado: "activa" | "completa" | "parcial",
  diaSemana: number, ejercicioIds: string[] }
```

`Evaluacion.publicaciones` y `PerfilProveedor.publicaciones` comparten exactamente el array de objetos `{dato,fuente}` y describen datos comunicados con procedencia, nunca notas privadas. InBody es una medición opcional con valor, unidad, origen y fecha. `ContextoProveedor` usa `referenciaAtleta` seudónima y nunca incluye `Actor`, nombres, correo, token, IDs de evaluación, gimnasio, atleta, ni IDs/actor de sesiones. `versionBase` contiene solo `versionId` y días. `SesionResumen` es la misma proyección sin IDs de sesión/versión/día ni actor: fecha, estado, día semanal y ejercicioIds. Cada item debe apuntar a un ejercicio y a un criterio aprobado de ese ejercicio; sus unidades, dosis y restricciones incompatibles se validan con el snapshot profesional versionado. `datosUtilizados` solo admite los seis nombres enumerados y cada referencia debe existir en el perfil/contexto. No se envían notas privadas ni se inventan rangos clínicos.

## Error de dominio

**Archivo:** `dominio/errores.mjs`. Export único: `ErrorPlanificacion extends Error`; firma `new ErrorPlanificacion({status,codigo,mensaje,camposPendientes?,revisionActual?})`. Expone esas propiedades y `name = "ErrorPlanificacion"`; copia los arrays/objetos. Status permitidos: 401, 403, 404, 409, 422, 503.

Mapeo estable: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO`; 404 `NO_ENCONTRADO` (incluye ajeno/inexistente); 409 `REVISION_CONFLICTIVA` (lleva `revisionActual`), `BASE_NO_VIGENTE` o transición incompatible; 422 `SOLICITUD_INVALIDA`/`DATOS_PENDIENTES` (lleva `camposPendientes`); 503 `PROVEEDOR_NO_DISPONIBLE`/`RESPUESTA_PROVEEDOR_INVALIDA`. Respuesta HTTP `{codigo,mensaje,camposPendientes?,revisionActual?}`. Errores desconocidos producen 503 genérico. Nunca incluir API key, prompt privado ni salida cruda del proveedor.

## Validación

**Archivo:** `dominio/validaciones.mjs`; exports síncronos puros: `validarEvaluacion(e) -> Evaluacion`, `validarCatalogo(c) -> Catalogo`, `validarSolicitudGenerar(x) -> {evaluacionId:string}`, `validarSolicitudReorganizar(x) -> {motivo:string,disponibilidad?:number[],ausencia?:boolean,disponibilidadRegreso?:number[]}`, `validarBorrador(b,contexto) -> propuesta validada`, `copiarPlan(p) -> Plan`. Solicitud de generación requiere únicamente `{evaluacionId}`. Solicitud de reorganización tiene exactamente los campos indicados; si `ausencia:true` y falta `disponibilidadRegreso`, retorna aclaración 422 con `camposPendientes:["disponibilidadRegreso"]`. `validarBorrador` acepta ambos envelopes: propuesta de generación `{tipo:"propuesta",dias,aclaraciones:[]}` y propuesta de reorganización `{tipo:"propuesta",dias,explicacion}`; las aclaraciones se validan aparte y nunca se persisten como plan. Validar fecha/días ISO, existencia de nivel u observación, mediciones y procedencia, IDs/versiones de catálogo, criterio aprobado ligado al mismo `ejercicioId`, restricciones incompatibles, unidades/dosis en límites, días distintos, explicaciones y referencias `datosUtilizados` existentes. Datos críticos ausentes: error 422 con pregunta concreta/campos pendientes; referencia inventada o incompatible: 422.

## Propiedad de archivos y exports

Cada fila es una asignación exclusiva de escritura. Se pueden importar `ErrorPlanificacion` en paralelo desde su firma; las pruebas que lo importen esperan solo a `dominio/errores.mjs`. `CONTRATOS.md` precede a consumidores. Los grupos de pruebas son exactamente `tests/{dominio,proveedores,datos,escenarios,aplicacion,http}`.

| Pieza / archivos exclusivos | Exports y contrato | Dependencia |
|---|---|---|
| Dominio: `dominio/errores.mjs`, `dominio/validaciones.mjs` | `ErrorPlanificacion`, validadores arriba | Ninguna |
| Proveedor: `proveedores/crearProveedorDeepSeek.mjs` | `crearProveedorDeepSeek({apiKey,model,fetchImpl=fetch,timeoutMs=20000}) -> {generar(contexto,solicitud:{},opciones?) async -> RespuestaProveedor, reorganizar(contexto,solicitud:{motivo,disponibilidad:number[],ausencia?},opciones?) async -> RespuestaReorganizar}` | Validaciones/error |
| Datos: `datos/crearRepositorioEnMemoria.mjs` | `crearRepositorioEnMemoria() -> repo`; métodos del repo debajo | Error; interfaz en contrato |
| Demo: `demo/proveedor-simulado.mjs`, `demo/fixtures/**` | `crearProveedorSimulado(fixtures) -> mismo contrato proveedor`; fixtures ficticios y adaptadores demo | Contrato de proveedor y tipos |
| Aplicación: `aplicacion/crearServicioPlanificacion.mjs` | `crearServicioPlanificacion({proveedor,repo,obtenerEvaluacion,obtenerCatalogo,tieneAsignacion,obtenerHistorialEjecutado,reloj}) -> servicio` | Proveedor, datos, dominio |
| HTTP/demo: `http/crearRouterPlanificacion.mjs`, `demo/servidor.mjs` | `crearRouterPlanificacion({servicio,resolverActor}) -> express.Router`; demo monta router local efímero | Aplicación y adaptador actor |
| Pruebas: seis carpetas fijadas arriba | `node:test`, fixtures falsos, `fetch` nativo; ninguna llamada DeepSeek real | Pieza correspondiente |

Los objetos de entrada/salida se copian defensivamente. Los métodos del repositorio pueden ser síncronos o asíncronos para permitir el adaptador de Alex; cada mutación ofrece CAS atómico indivisible. El repositorio en memoria hace el chequeo y escritura de CAS sin `await` dentro de la mutación. El servicio hace `await` en sus llamadas al repositorio. El adaptador persistente real debe garantizar CAS/única vigencia en una operación atómica propia; no se impone tabla ni esquema.

### Repositorio

`crearRepositorioEnMemoria()` devuelve `{obtenerPorId({gimnasioId,versionId}), obtenerVigente({gimnasioId,atletaId}), crearBorrador({gimnasioId,atletaId,plan}), guardarRevision({gimnasioId,versionId,revisionEsperada,cambios:{dias?:Dia[],proximaRevision?}}), aprobar({gimnasioId,versionId,revisionEsperada,aprobadorId,fecha})}`. Cada método retorna valor/copias (o Promise con el mismo valor si adaptación remota). Acceso/actualización se limita por gimnasio; el servicio valida asignación del atleta. `crearBorrador` no cambia vigencia; asigna `versionId` único en el gimnasio (contador del gimnasio, nunca por atleta), `revision:1`, estado `borrador`. En fixture limpio de demo, el contador da V1 y luego V2. `guardarRevision` recibe días completos y `proximaRevision` ya validados por aplicación; no interpreta PATCH. Incrementa exactamente una revisión por PATCH aceptado; divergencia 409 con revisión actual. `aprobar` compara revisión y estado dentro de mutación atómica, guarda aprobador y fecha, cambia el plan aprobado a `vigente` y el anterior a `historica`, dejando exactamente una vigente; retorna plan actualizado y anterior histórico. La generación inicial no requiere `versionBaseId`; solo reorganización lo fija. Una reorganización que termina lenta revalida que su base sigue vigente antes de guardar y al aprobar.

## Servicio y adaptadores

Todos los adaptadores del factory son funciones async, salvo `reloj() -> instante ISO` síncrono. `obtenerEvaluacion({gimnasioId,atletaId,evaluacionId}) -> Evaluacion`; `obtenerCatalogo({gimnasioId,catalogoVersion?}) -> Catalogo`; `tieneAsignacion({gimnasioId,entrenadorId,atletaId}) -> boolean`; `obtenerHistorialEjecutado({gimnasioId,atletaId}) -> SesionResumen[]`. En edición y aprobación de un borrador, la aplicación valida sus ejercicios y criterios contra el catálogo de su propio `catalogoVersion`; si el adaptador no puede devolver esa versión, responde 409 `CATALOGO_NO_DISPONIBLE` y no publica el plan. No existe adaptador duplicado de contexto ni evaluador opcional. Adaptadores de demo viven en `demo/fixtures/` y se identifican como ficticios. Fallos ajenos a autorización se normalizan sin datos sensibles.

El factory acepta además las opciones opcionales `modeloProveedor?: string` e `informarOperacion?: (evento) => void | Promise<void>`. Tras una operación `generar` o `reorganizar`, el evento puede registrar `{operacion,modeloProveedor,catalogoVersion,versionesCriterios,evaluacionId,versionBaseId?,resultado,codigoError?}`. El callback sirve para observabilidad y su fallo se ignora: nunca cambia la respuesta ni el resultado de una mutación. No registrar secretos, prompt, perfil ni salida de IA. La demo proporcionará el callback y una etiqueta de modelo que indique si es simulado o real.

Servicio que retorna el factory:

- `crearBorradorManual(actor,{atletaId,evaluacionId,dias}) async -> Plan`: solo entrenador asignado; valida evaluación/catalogo/ids/dosis y guarda `borrador`, origen `manual`.
- `generarBorrador(actor,{atletaId,evaluacionId}) async -> Plan | Aclaracion`: la entrada del validador HTTP es `{evaluacionId}`. El servicio recibe `{atletaId,evaluacionId}`, con `atletaId` tomado del path y autorizado, nunca del body; obtiene evaluación/catalogo fiables y crea `ContextoProveedor` con perfil proyectado y anonimizado; proveedor `generar(contexto,{})`; valida propuesta; persiste V1 borrador con `origen:"DeepSeek"`. Aclaración `{tipo:"aclaracion",pregunta,camposPendientes}` se devuelve como 422 y no guarda plan.
- `obtenerPlan(actor,{versionId}) async -> Plan`: solo entrenador; resuelve por ID, comprueba gimnasio y `tieneAsignacion`; ajeno/inexistente 404; rol incompatible 403. Atleta usa únicamente `obtenerRutina`.
- `editarBorrador(actor,{versionId,revisionEsperada,cambios:PatchHTTP}) async -> Plan`: busca por ID, comprueba asignación/rol y revisión; aplica PATCH validado a copia completa de `dias`, permitiendo cambiar `ejercicioId`, `criterioId`, dosis/explicación y `proximaRevision`; manda `repo.guardarRevision({gimnasioId,versionId,revisionEsperada,cambios:{dias,proximaRevision}})`.
- `aprobarBorrador(actor,{versionId,revisionEsperada}) async -> {plan,anterior}`: entrenador autorizado; la transacción CAS guarda aprobador/fecha y estado; conflictos 409 sin transición parcial.
- `reorganizarBorrador(actor,{versionId,motivo,disponibilidad?,ausencia?,disponibilidadRegreso?}) async -> {plan,diferencias}`: consulta versión por ID y verifica autorización; requiere versión vigente; `ausencia:true` exige `disponibilidadRegreso` y usa esos días como disponibilidad efectiva; si falta, error 422 con `camposPendientes:["disponibilidadRegreso"]` y pregunta «¿Qué días podrá entrenar al regresar?». Si no hay ausencia, la aplicación usa `disponibilidad` o, si falta, la disponibilidad de evaluación; pasa al proveedor exactamente `{motivo,disponibilidad,ausencia?}`. Toma evaluación, catálogo e historial ejecutado anonimizados. Respuesta del proveedor debe ser `RespuestaReorganizar` con explicación textual obligatoria; aplicación calcula `diferencias` comparando días/items de base y propuesta, y guarda V nueva con `versionBaseId`, `motivo`, `diferencias`, estado borrador; no altera vigente ni sesiones.
- `obtenerRutina(actor,{fecha}) async -> {estado,plan?,dia?}`: atleta identificado por `actor.usuarioId`; fecha local ISO; respuesta `estado:"sin_plan"`, `"sin_sesion_programada"` o `"disponible"`. Solo retorna vigente/aprobado.

Antes de responder o mutar un plan por ID, el servicio obtiene `{gimnasioId,versionId}` y comprueba actor y asignación; plan inexistente o ajeno al gimnasio/atleta da 404. Rol incompatible da 403. Un ID visible a otro atleta nunca permite inferir su existencia.

## Proveedor

`crearProveedorDeepSeek` implementa `generar(contexto:ContextoProveedor,solicitud:{},opciones?:{signal?}) async -> RespuestaProveedor` y `reorganizar(contexto:ContextoProveedor,solicitud:{motivo:string,disponibilidad:number[],ausencia?:boolean},opciones?:{signal?}) async -> RespuestaReorganizar`. En generación el objeto de solicitud es exactamente `{}`. En reorganización es exactamente `{motivo,disponibilidad,ausencia?}`; aplicación siempre resuelve disponibilidad a días ISO antes de llamar. Si falta disponibilidad de regreso tras ausencia, no llama al proveedor: retorna 422 con `camposPendientes:["disponibilidadRegreso"]`. Reorganización propuesta debe incluir `explicacion` no vacía. Esa explicación no reemplaza las `diferencias`, que calcula la aplicación comparando base y salida, sin aceptar diferencias inventadas del modelo. Respuesta aclaración en ambas operaciones tiene forma exacta `{tipo:"aclaracion",pregunta,camposPendientes}`. Usa fetch del servidor, timeout, `DEEPSEEK_API_KEY` y `DEEPSEEK_MODEL`; no registra claves, prompts, perfil ni respuesta cruda. Timeout/transporte/status no exitoso/JSON o estructura malformada -> `ErrorPlanificacion` 503. La salida pasa validadores antes de persistir. El proveedor nunca publica. `crearProveedorSimulado` conserva la misma firma con fixtures ficticios; `demo/servidor.mjs` usa `PLANIFICACION_PROVEEDOR=simulado` por defecto.

## HTTP de demo: seis operaciones

Todas las rutas relativas a `/api/v1`; actor se resuelve del lado servidor con `resolverActor(req) async -> Actor`, nunca del body. Estos cuerpos son canónicos para el módulo/demo. El montaje y autenticación de producción requieren revisión de Alex/Hellen. Error HTTP: JSON exacto `{codigo,mensaje,camposPendientes?,revisionActual?}`.

| Operación | Body exacto | Respuesta éxito |
|---|---|---|
| `POST /atletas/:atletaId/planes` | `{origen:"manual",evaluacionId,dias}` o `{origen:"IA",evaluacionId}` (`"DeepSeek"` se admite como alias explícito) | 201 `Plan` estado borrador, `origen:"manual"` o emisión `origen:"DeepSeek"`; falta crítica de cualquiera da 422 aclaración sin persistencia |
| `GET /planes/:versionId` | Sin body; solo entrenador asignado | 200 `Plan` |
| `PATCH /planes/:versionId` | `{revisionEsperada,cambios:PatchHTTP}` | 200 `Plan` con revisión incrementada |
| `POST /planes/:versionId/aprobacion` | `{revisionEsperada}` | 200 `{plan,anterior}` |
| `POST /planes/:versionId/reorganizaciones` | `{motivo,disponibilidad?:number[],ausencia?:boolean,disponibilidadRegreso?:number[]}` | 201 `{plan,diferencias}` (V nueva en borrador) o 422 aclaración; `ausencia:true` sin `disponibilidadRegreso` pregunta días de regreso |
| `GET /me/rutina?fecha=YYYY-MM-DD` | Sin body | 200 `{estado,plan?,dia?}` con estados declarados arriba |

PATCH literal: `{ "revisionEsperada": 1, "cambios": { "items": [{ "itemId": "IT1", "descansoSegundos": 60 }], "proximaRevision": "2026-12-20" } }` retorna Plan con descanso actualizado, `proximaRevision` y `revision:2`. `items` acepta además `ejercicioId`, `criterioId`, `series`, `objetivoPorSerie` y `explicacion`; la aplicación convierte las diferencias parciales a `dias` completos validados antes del repositorio. Reorganización por ausencia sin `disponibilidadRegreso` retorna 422 `{codigo:"DATOS_PENDIENTES",mensaje:"¿Qué días podrá entrenar al regresar?",camposPendientes:["disponibilidadRegreso"]}`. Generación y reorganización usan la misma forma 422 de aclaración. 401/403/404/409/422/503 usan el mapeo de dominio. No añadir `atletaId` a rutas de GET/PATCH/aprobación/reorganización: se resuelve desde `versionId` y autorización. GET por versión es solo para entrenador asignado. La ruta de rutina usa `actor.usuarioId` como atleta.

## Ejemplo literal de flujo

Fixtures ficticios: gimnasio G1, entrenador T1, atleta A1, evaluación EV1 (fecha ISO, constancia, disponibilidad `[1,4]`, nivel observado, `publicaciones:[{dato:"observación inicial",fuente:"entrenador"}]`, mediciones vacías; ausencia de InBody declarada), catálogo con E1 y E2 y criterios aprobados ligados a cada ejercicio con procedencia explícita. `POST /atletas/A1/planes` con `{origen:"IA",evaluacionId:"EV1"}` (alias aceptado `{origen:"DeepSeek",evaluacionId:"EV1"}`) produce V1, revisión 1, estado borrador, dos días lunes/jueves, origen de salida `DeepSeek`; cada item referencia E1/E2 y explica su relación con una referencia válida del perfil.

PATCH V1 con `revisionEsperada:1` edita el descanso del banco a 60; retorna revisión 2. Aprobación explícita de revisión 2 retorna `{plan:{versionId:"V1",estado:"vigente",revision:2,aprobacion:{aprobadorId:"T1",fecha:"<instante ISO>"},...},anterior:null}`. Si ya había plan vigente, `anterior` retorna ese plan como `historica`. SE1 queda fuera del módulo y, si existe, su contexto registra V1.

T1 reorganiza V1 a días `[1,4,6]` para regreso sábado con `{motivo:"Regreso con tres días",ausencia:true,disponibilidadRegreso:[1,4,6]}`: aplicación pasa al proveedor `{motivo:"Regreso con tres días",disponibilidad:[1,4,6],ausencia:true}`; crea V2 borrador con `versionBaseId:"V1"`, motivo y diferencias, conserva V1 vigente y retorna `{mantenidos:[...],movidos:[...],agregados:[...],retirados:[...],explicacion:"..."}`. Una ausencia sin disponibilidad de regreso produce la aclaración literal anterior; con regreso `[1,4,6]` la propuesta es revisable y no compensa carga automáticamente. Aprobar V2 solo si V1 sigue vigente y revisión coincide; V2 pasa a vigente, V1 a histórica, aprobador y fecha quedan guardados. SE1 e historial ejecutado no se alteran. Si una aprobación concurrente desplaza V1 mientras una reorganización lenta termina, no se guarda ni aprueba V2: 409 `BASE_NO_VIGENTE` y `revisionActual` cuando corresponda.

## Límites de integración

No implementar esquema SQL, Supabase, autenticación común, sesión SE1, frontend ni Web Push aquí. Las rutas y cuerpos de demo hacen implementables los seis casos ahora; Alex revisa montaje/actor/persistencia y Hellen revisa presentación/diferencias antes de integrarlos con API compartida. Ante un requisito fuera de la lista de archivos asignados, detener esa pieza y pedir ajuste explícito al orquestador.
