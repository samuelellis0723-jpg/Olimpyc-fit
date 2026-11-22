import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ErrorPlanificacion } from '../dominio/errores.mjs';
import { validarEvaluacion, validarCatalogo, validarSolicitudGenerar, validarSolicitudReorganizar, validarBorrador, copiarPlan } from '../dominio/validaciones.mjs';

const clonar = (x) => x === undefined ? undefined : structuredClone(x);
const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const err = (status, codigo, mensaje, extra = {}) => new ErrorPlanificacion({ status, codigo, mensaje, ...extra });
const noAutenticado = () => err(401, 'NO_AUTENTICADO', 'Se requiere una identidad autenticada.');
const sinPermiso = () => err(403, 'SIN_PERMISO', 'El rol no permite esta operación.');
const noEncontrado = () => err(404, 'NO_ENCONTRADO', 'El recurso no existe.');
const pendiente = (campo, mensaje) => err(422, 'DATOS_PENDIENTES', mensaje, { camposPendientes: [campo] });
const proveedorInvalido = () => err(503, 'RESPUESTA_PROVEEDOR_INVALIDA', 'No se pudo validar la propuesta recibida.');
const noDisponible = () => err(503, 'PROVEEDOR_NO_DISPONIBLE', 'No fue posible completar la operación.');

function actorValido(actor) {
  if (!esObjeto(actor) || typeof actor.usuarioId !== 'string' || !actor.usuarioId || typeof actor.gimnasioId !== 'string' || !actor.gimnasioId) throw noAutenticado();
  if (!['entrenador', 'atleta'].includes(actor.rol)) throw noAutenticado();
}
function soloEntrenador(actor) { actorValido(actor); if (actor.rol !== 'entrenador') throw sinPermiso(); }
function soloAtleta(actor) { actorValido(actor); if (actor.rol !== 'atleta') throw sinPermiso(); }
function diasUnicos(dias) { return [...new Set(dias)].sort((a, b) => a - b); }
function fechaValida(x) { return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`)) && new Date(`${x}T00:00:00Z`).toISOString().slice(0, 10) === x; }

export function crearServicioPlanificacion({ proveedor, repo, obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado, reloj = () => new Date().toISOString(), modeloProveedor = 'desconocido', informarOperacion }) {
  for (const [nombre, fn] of Object.entries({ obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado, reloj })) if (typeof fn !== 'function') throw new TypeError(`${nombre} debe ser una función`);
  if (!proveedor || typeof proveedor.generar !== 'function' || typeof proveedor.reorganizar !== 'function') throw new TypeError('proveedor requiere generar y reorganizar');
  if (!repo || ['obtenerPorId', 'obtenerVigente', 'crearBorrador', 'guardarRevision', 'aprobar'].some((m) => typeof repo[m] !== 'function')) throw new TypeError('repo no cumple el contrato');
  const claveReferencia = randomBytes(32);

  function informar(evento) { try { Promise.resolve(informarOperacion?.(clonar(evento))).catch(() => {}); } catch { /* observabilidad inocua */ } }
  async function asignacion(actor, atletaId) {
    if (await tieneAsignacion({ gimnasioId: actor.gimnasioId, entrenadorId: actor.usuarioId, atletaId }) !== true) throw noEncontrado();
  }
  async function cargarDatos(actor, atletaId, evaluacionId, catalogoVersion) {
    let e, c;
    e = await obtenerEvaluacion({ gimnasioId: actor.gimnasioId, atletaId, evaluacionId });
    if (!e || e.gimnasioId !== actor.gimnasioId || e.atletaId !== atletaId || e.evaluacionId !== evaluacionId) throw noEncontrado();
    e = validarEvaluacion(e);
    c = await obtenerCatalogo({ gimnasioId: actor.gimnasioId, ...(catalogoVersion ? { catalogoVersion } : {}) });
    if (!c || (catalogoVersion && c.catalogoVersion !== catalogoVersion)) throw err(409, 'CATALOGO_NO_DISPONIBLE', 'La versión de catálogo del borrador ya no está disponible.');
    c = validarCatalogo(c);
    return { evaluacion: e, catalogo: c };
  }
  function verificarElegibilidad(evaluacion, catalogo) {
    const compatibles = catalogo.ejercicios.filter((ex) => !evaluacion.restricciones.some((r) => ex.restriccionesIncompatibles.includes(r)) && catalogo.criterios.some((cr) => cr.ejercicioId === ex.ejercicioId && cr.estado === 'aprobado'));
    if (!compatibles.length) throw pendiente('restricciones', 'Las restricciones registradas no son compatibles con los ejercicios y criterios aprobados del catálogo. Revise las restricciones o el catálogo antes de continuar.');
  }
  function proyectar(e, historial, diasDisponibles = e.diasDisponibles) {
    const referenciaAtleta = createHmac('sha256', claveReferencia).update(`${e.gimnasioId}\0${e.atletaId}`).digest('hex');
    const mediciones = e.mediciones.map((m) => ({ variable: m.variable, estado: m.estado, ...(m.valor !== undefined ? { valor: m.valor } : {}), ...(m.unidad !== undefined ? { unidad: m.unidad } : {}), origen: m.origen, fecha: m.fecha }));
    const publicaciones = e.publicaciones.map(({ dato, fuente }) => ({ dato, fuente }));
    const perfil = { referenciaAtleta, fecha: e.fecha, modalidad: e.modalidad, objetivo: e.objetivo, diasDisponibles: clonar(diasDisponibles), ...(e.nivel ? { nivel: e.nivel } : {}), ...(e.observacion ? { observacion: e.observacion } : {}), restricciones: clonar(e.restricciones), mediciones, publicaciones };
    const resumen = (historial ?? []).map(({ fecha, estado, diaSemana, ejercicioIds }) => ({ fecha, estado, diaSemana, ejercicioIds: clonar(ejercicioIds) }));
    return { perfil, historialEjecutado: resumen };
  }
  function diasConIds(dias) {
    return dias.map((d) => ({ diaId: randomUUID(), diaSemana: d.diaSemana, items: d.items.map((it) => ({ ...clonar(it), itemId: randomUUID() })) }));
  }
  function crearPlan({ e, c, propuesta, contexto, actor, atletaId, origen, versionBaseId, motivo, diferencias }) {
    let validada;
    try { validada = validarBorrador(propuesta, contexto); }
    catch (cause) {
      if (origen === 'manual' && cause instanceof ErrorPlanificacion) throw cause;
      throw proveedorInvalido();
    }
    return { gimnasioId: actor.gimnasioId, atletaId, evaluacionId: e.evaluacionId, origen, estado: 'borrador', revision: 1, catalogoVersion: c.catalogoVersion, dias: diasConIds(validada.dias), creadoEn: reloj(), ...(versionBaseId ? { versionBaseId } : {}), ...(motivo ? { motivo } : {}), ...(diferencias ? { diferencias } : {}) };
  }
  async function obtenerPlanAsignado(actor, versionId) {
    soloEntrenador(actor);
    const p = await repo.obtenerPorId({ gimnasioId: actor.gimnasioId, versionId });
    if (!p || p.gimnasioId !== actor.gimnasioId) throw noEncontrado();
    await asignacion(actor, p.atletaId);
    return copiarPlan(p);
  }
  async function contextoParaPlan(plan) {
    const { evaluacion: e, catalogo: c } = await cargarDatos({ gimnasioId: plan.gimnasioId }, plan.atletaId, plan.evaluacionId, plan.catalogoVersion);
    const historial = await obtenerHistorialEjecutado({ gimnasioId: plan.gimnasioId, atletaId: plan.atletaId });
    return { evaluacion: e, catalogo: c, historial: proyectar(e, historial).historialEjecutado };
  }
  function validarPlanConContexto(plan, datos) {
    const efectivo = diasUnicos(plan.dias.map((d) => d.diaSemana));
    const contexto = { ...proyectar(datos.evaluacion, datos.historial, efectivo), catalogo: datos.catalogo, historialEjecutado: datos.historial };
    const propuesta = { tipo: 'propuesta', dias: plan.dias.map((d) => ({ diaSemana: d.diaSemana, items: d.items.map(({ itemId, ...it }) => clonar(it)) })), aclaraciones: [] };
    try { validarBorrador(propuesta, contexto); } catch { throw err(409, 'CATALOGO_NO_DISPONIBLE', 'El borrador ya no coincide con su catálogo o sus días efectivos.'); }
    return contexto;
  }

  return Object.freeze({
    async crearBorradorManual(actor, solicitud) {
      soloEntrenador(actor);
      if (!esObjeto(solicitud) || typeof solicitud.atletaId !== 'string' || !solicitud.atletaId || typeof solicitud.evaluacionId !== 'string' || !solicitud.evaluacionId || !Array.isArray(solicitud.dias)) throw err(422, 'SOLICITUD_INVALIDA', 'La solicitud manual requiere atletaId, evaluacionId y días.');
      await asignacion(actor, solicitud.atletaId);
      const { evaluacion: e, catalogo: c } = await cargarDatos(actor, solicitud.atletaId, solicitud.evaluacionId);
      verificarElegibilidad(e, c);
      const hist = await obtenerHistorialEjecutado({ gimnasioId: actor.gimnasioId, atletaId: solicitud.atletaId });
      const contexto = { ...proyectar(e, hist), catalogo: c };
      const propuesta = { tipo: 'propuesta', dias: clonar(solicitud.dias), aclaraciones: [] };
      let plan;
      plan = crearPlan({ e, c, propuesta, contexto, actor, atletaId: solicitud.atletaId, origen: 'manual' });
      return copiarPlan(await repo.crearBorrador({ gimnasioId: actor.gimnasioId, atletaId: solicitud.atletaId, plan }));
    },
    async generarBorrador(actor, solicitud) {
      soloEntrenador(actor);
      if (!esObjeto(solicitud) || typeof solicitud.atletaId !== 'string' || !solicitud.atletaId) throw err(422, 'SOLICITUD_INVALIDA', 'Se requiere un atleta de la ruta.');
      await asignacion(actor, solicitud.atletaId);
      const normalizada = validarSolicitudGenerar({ evaluacionId: solicitud.evaluacionId });
      const { evaluacion, catalogo } = await cargarDatos(actor, solicitud.atletaId, normalizada.evaluacionId);
      verificarElegibilidad(evaluacion, catalogo);
      const historial = await obtenerHistorialEjecutado({ gimnasioId: actor.gimnasioId, atletaId: solicitud.atletaId });
      const contexto = { ...proyectar(evaluacion, historial), catalogo };
      let resultado = 'error', codigoError;
      try {
        const respuesta = await proveedor.generar(clonar(contexto), {});
        await asignacion(actor, solicitud.atletaId);
        if (esObjeto(respuesta) && respuesta.tipo === 'aclaracion') {
          if (typeof respuesta.pregunta !== 'string' || !respuesta.pregunta.trim() || !Array.isArray(respuesta.camposPendientes) || !respuesta.camposPendientes.length || respuesta.camposPendientes.some((x) => typeof x !== 'string' || !x.trim())) throw proveedorInvalido();
          resultado = 'aclaracion'; throw err(422, 'DATOS_PENDIENTES', respuesta.pregunta, { camposPendientes: respuesta.camposPendientes });
        }
        const plan = crearPlan({ e: evaluacion, c: catalogo, propuesta: respuesta, contexto, actor, atletaId: solicitud.atletaId, origen: 'DeepSeek' });
        const guardado = await repo.crearBorrador({ gimnasioId: actor.gimnasioId, atletaId: solicitud.atletaId, plan });
        resultado = 'borrador'; return copiarPlan(guardado);
      } catch (cause) { codigoError = cause.codigo; if (cause instanceof ErrorPlanificacion) throw cause; throw noDisponible(); }
      finally { informar({ operacion: 'generar', modeloProveedor, catalogoVersion: catalogo.catalogoVersion, versionesCriterios: [...new Set(catalogo.criterios.map((c) => c.version))], evaluacionId: evaluacion.evaluacionId, resultado, ...(codigoError ? { codigoError } : {}) }); }
    },
    async obtenerPlan(actor, { versionId }) { return obtenerPlanAsignado(actor, versionId); },
    async editarBorrador(actor, { versionId, revisionEsperada, cambios }) {
      const plan = await obtenerPlanAsignado(actor, versionId);
      if (plan.estado !== 'borrador') throw err(409, 'REVISION_CONFLICTIVA', 'Solo se puede editar un borrador.', { revisionActual: plan.revision });
      if (!Number.isInteger(revisionEsperada) || revisionEsperada < 1) throw err(422, 'SOLICITUD_INVALIDA', 'revisionEsperada debe ser un entero positivo.');
      if (plan.revision !== revisionEsperada) throw err(409, 'REVISION_CONFLICTIVA', 'El plan cambió; recarga la revisión actual.', { revisionActual: plan.revision });
      if (!esObjeto(cambios) || Object.keys(cambios).some((k) => !['items', 'proximaRevision'].includes(k)) || !Object.keys(cambios).length) throw err(422, 'SOLICITUD_INVALIDA', 'Los cambios contienen campos no permitidos o están vacíos.');
      if (cambios.items !== undefined && (!Array.isArray(cambios.items) || cambios.items.length === 0) && cambios.proximaRevision === undefined) throw err(422, 'SOLICITUD_INVALIDA', 'PATCH no contiene cambios.');
      const datosPlan = await contextoParaPlan(plan);
      const dias = clonar(plan.dias);
      if (cambios.items !== undefined) {
        if (!Array.isArray(cambios.items)) throw err(422, 'SOLICITUD_INVALIDA', 'items debe ser una lista.');
        const vistos = new Set();
        for (const patch of cambios.items) {
          if (!esObjeto(patch) || typeof patch.itemId !== 'string' || vistos.has(patch.itemId)) throw err(422, 'SOLICITUD_INVALIDA', 'Cada cambio debe identificar un ítem único.');
          if (!Object.keys(patch).every((k) => ['itemId', 'ejercicioId', 'criterioId', 'series', 'objetivoPorSerie', 'descansoSegundos', 'explicacion'].includes(k)) || Object.keys(patch).length < 2) throw err(422, 'SOLICITUD_INVALIDA', 'El cambio de ítem contiene campos no permitidos o está vacío.');
          vistos.add(patch.itemId);
          const encontrado = dias.flatMap((d) => d.items).find((i) => i.itemId === patch.itemId);
          if (!encontrado) throw err(422, 'SOLICITUD_INVALIDA', 'El ítem indicado no pertenece al borrador.');
          for (const [k, v] of Object.entries(patch)) if (k !== 'itemId') encontrado[k] = clonar(v);
        }
      }
      const { evaluacion: e, catalogo: c, historial } = datosPlan;
      const efectivo = diasUnicos(dias.map((d) => d.diaSemana));
      const contexto = { ...proyectar(e, historial, efectivo), catalogo: c };
      const propuesta = { tipo: 'propuesta', dias: dias.map((d) => ({ diaSemana: d.diaSemana, items: d.items.map(({ itemId, ...it }) => clonar(it)) })), aclaraciones: [] };
      try { validarBorrador(propuesta, contexto); } catch (cause) { if (cause instanceof ErrorPlanificacion) throw cause; throw err(422, 'SOLICITUD_INVALIDA', 'Los cambios no cumplen el catálogo.'); }
      if (cambios.proximaRevision !== undefined && !fechaValida(cambios.proximaRevision)) throw err(422, 'SOLICITUD_INVALIDA', 'proximaRevision debe ser una fecha YYYY-MM-DD válida.');
      await asignacion(actor, plan.atletaId);
      return copiarPlan(await repo.guardarRevision({ gimnasioId: actor.gimnasioId, versionId, revisionEsperada, cambios: { dias, ...(cambios.proximaRevision !== undefined ? { proximaRevision: cambios.proximaRevision } : {}) } }));
    },
    async aprobarBorrador(actor, { versionId, revisionEsperada }) {
      const plan = await obtenerPlanAsignado(actor, versionId);
      if (plan.estado !== 'borrador') throw err(409, 'REVISION_CONFLICTIVA', 'Solo se puede aprobar un borrador.', { revisionActual: plan.revision });
      if (!Number.isInteger(revisionEsperada) || revisionEsperada < 1) throw err(422, 'SOLICITUD_INVALIDA', 'revisionEsperada debe ser un entero positivo.');
      validarPlanConContexto(plan, await contextoParaPlan(plan));
      await asignacion(actor, plan.atletaId);
      return clonar(await repo.aprobar({ gimnasioId: actor.gimnasioId, versionId, revisionEsperada, aprobadorId: actor.usuarioId, fecha: reloj() }));
    },
    async reorganizarBorrador(actor, solicitud) {
      const { versionId } = solicitud ?? {};
      const plan = await obtenerPlanAsignado(actor, versionId);
      if (plan.estado !== 'vigente') throw err(409, 'BASE_NO_VIGENTE', 'Solo se puede reorganizar la versión vigente.');
      if (!esObjeto(solicitud) || Object.keys(solicitud).some((k) => !['versionId', 'motivo', 'disponibilidad', 'ausencia', 'disponibilidadRegreso'].includes(k))) throw err(422, 'SOLICITUD_INVALIDA', 'La solicitud contiene campos no permitidos.');
      const { versionId: _versionId, ...camposReorganizacion } = solicitud;
      const normalizada = validarSolicitudReorganizar(camposReorganizacion);
      const { evaluacion: e, catalogo: c } = await cargarDatos(actor, plan.atletaId, plan.evaluacionId, plan.catalogoVersion);
      const disponibilidad = normalizada.ausencia ? normalizada.disponibilidadRegreso : (normalizada.disponibilidad ?? e.diasDisponibles);
      verificarElegibilidad(e, c);
      const historial = await obtenerHistorialEjecutado({ gimnasioId: actor.gimnasioId, atletaId: plan.atletaId });
      const contexto = { ...proyectar(e, historial, disponibilidad), catalogo: c, versionBase: { versionId: plan.versionId, dias: plan.dias.map((d) => ({ diaId: d.diaId, diaSemana: d.diaSemana, items: d.items.map((it) => ({ itemId: it.itemId, ejercicioId: it.ejercicioId, orden: it.orden, series: it.series, objetivoPorSerie: clonar(it.objetivoPorSerie), descansoSegundos: it.descansoSegundos, explicacion: it.explicacion, criterioId: it.criterioId, datosUtilizados: clonar(it.datosUtilizados) })) })) } };
      let resultado = 'error', codigoError;
      try {
        const solicitudProveedor = { motivo: normalizada.motivo, disponibilidad: clonar(disponibilidad), ...(normalizada.ausencia !== undefined ? { ausencia: normalizada.ausencia } : {}) };
        const respuesta = await proveedor.reorganizar(clonar(contexto), solicitudProveedor);
        await asignacion(actor, plan.atletaId);
        const vigente = await repo.obtenerPorId({ gimnasioId: actor.gimnasioId, versionId: plan.versionId });
        if (!vigente || vigente.estado !== 'vigente' || vigente.revision !== plan.revision) throw err(409, 'BASE_NO_VIGENTE', 'La versión base cambió mientras se preparaba la reorganización.', { revisionActual: vigente?.revision });
        if (esObjeto(respuesta) && respuesta.tipo === 'aclaracion') {
          if (typeof respuesta.pregunta !== 'string' || !respuesta.pregunta.trim() || !Array.isArray(respuesta.camposPendientes) || !respuesta.camposPendientes.length || respuesta.camposPendientes.some((x) => typeof x !== 'string' || !x.trim())) throw proveedorInvalido();
          resultado = 'aclaracion'; throw err(422, 'DATOS_PENDIENTES', respuesta.pregunta, { camposPendientes: respuesta.camposPendientes });
        }
        const propuesta = respuesta;
        let diasValidados;
        try { diasValidados = validarBorrador(propuesta, contexto).dias; } catch { throw proveedorInvalido(); }
        if (!esObjeto(respuesta) || respuesta.tipo !== 'propuesta' || typeof respuesta.explicacion !== 'string' || !respuesta.explicacion.trim()) throw proveedorInvalido();
        const diasNuevos = diasConIds(diasValidados);
        const diferencias = calcularDiferencias(plan.dias, diasNuevos, respuesta.explicacion);
        const borrador = { gimnasioId: actor.gimnasioId, atletaId: plan.atletaId, evaluacionId: plan.evaluacionId, origen: 'DeepSeek', estado: 'borrador', revision: 1, catalogoVersion: c.catalogoVersion, dias: diasNuevos, creadoEn: reloj(), versionBaseId: plan.versionId, motivo: normalizada.motivo, diferencias };
        const guardado = await repo.crearBorrador({ gimnasioId: actor.gimnasioId, atletaId: plan.atletaId, plan: borrador });
        resultado = 'borrador'; return { plan: copiarPlan(guardado), diferencias: clonar(diferencias) };
      } catch (cause) { codigoError = cause.codigo; if (cause instanceof ErrorPlanificacion) throw cause; throw noDisponible(); }
      finally { informar({ operacion: 'reorganizar', modeloProveedor, catalogoVersion: c.catalogoVersion, versionesCriterios: [...new Set(c.criterios.map((cr) => cr.version))], evaluacionId: e.evaluacionId, versionBaseId: plan.versionId, resultado, ...(codigoError ? { codigoError } : {}) }); }
    },
    async obtenerRutina(actor, { fecha }) {
      soloAtleta(actor);
      if (!fechaValida(fecha)) throw err(422, 'SOLICITUD_INVALIDA', 'fecha debe ser YYYY-MM-DD válida.');
      const plan = await repo.obtenerVigente({ gimnasioId: actor.gimnasioId, atletaId: actor.usuarioId });
      if (!plan) return { estado: 'sin_plan' };
      if (plan.estado !== 'vigente' || plan.atletaId !== actor.usuarioId || plan.gimnasioId !== actor.gimnasioId) throw noEncontrado();
      const diaSemana = ((new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
      const dia = plan.dias.find((d) => d.diaSemana === diaSemana);
      return dia ? { estado: 'disponible', plan: copiarPlan(plan), dia: clonar(dia) } : { estado: 'sin_sesion_programada' };
    },
  });
}

function calcularDiferencias(base, propuesta, explicacion) {
  const anteriores = base.flatMap((d) => d.items.map((it) => ({ ...it, dia: d.diaSemana })));
  const nuevos = propuesta.flatMap((d) => d.items.map((it) => ({ ...it, dia: d.diaSemana })));
  const usados = new Set(); const mantenidos = []; const movidos = []; const agregados = []; const retirados = [];
  const parejas = [];
  for (const mismoDia of [true, false]) {
    for (const viejo of anteriores) {
      if (parejas.some(([a]) => a === viejo)) continue;
      const idx = nuevos.findIndex((n, i) => !usados.has(i)
        && n.ejercicioId === viejo.ejercicioId && n.criterioId === viejo.criterioId
        && (!mismoDia || n.dia === viejo.dia));
      if (idx < 0) continue;
      usados.add(idx); parejas.push([viejo, nuevos[idx]]);
      if (viejo.dia === nuevos[idx].dia) mantenidos.push(viejo.itemId);
      else movidos.push({ itemId: viejo.itemId, deDia: viejo.dia, aDia: nuevos[idx].dia });
    }
  }
  anteriores.filter((viejo) => !parejas.some(([a]) => a === viejo)).forEach((viejo) => retirados.push(viejo.itemId));
  nuevos.forEach((n, i) => { if (!usados.has(i)) agregados.push(n.itemId); });
  const cambiosDosis = [];
  for (const [viejo, nuevo] of parejas) {
    if (viejo.series !== nuevo.series || viejo.descansoSegundos !== nuevo.descansoSegundos
      || viejo.objetivoPorSerie?.cantidad !== nuevo.objetivoPorSerie?.cantidad
      || viejo.objetivoPorSerie?.unidad !== nuevo.objetivoPorSerie?.unidad) cambiosDosis.push(`${viejo.ejercicioId}: dosis/descanso ${viejo.series} series, ${viejo.objetivoPorSerie.cantidad} ${viejo.objetivoPorSerie.unidad}, ${viejo.descansoSegundos}s → ${nuevo.series} series, ${nuevo.objetivoPorSerie.cantidad} ${nuevo.objetivoPorSerie.unidad}, ${nuevo.descansoSegundos}s`);
  }
  const resumen = [explicacion, ...cambiosDosis].filter(Boolean).join(' ');
  return { mantenidos, movidos, agregados, retirados, explicacion: resumen };
}
