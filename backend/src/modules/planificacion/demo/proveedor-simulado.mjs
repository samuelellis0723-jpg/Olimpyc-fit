const objeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const texto = (x) => typeof x === 'string' && x.trim().length > 0;
const clon = (x) => structuredClone(x);

function aclaracion(pendiente) {
  const preguntas = { objetivo: '¿Cuál es el objetivo de entrenamiento?', nivel: '¿Cuál es el nivel observado por la entrenadora?' };
  return { tipo: 'aclaracion', pregunta: preguntas[pendiente] ?? '¿Qué dato falta para continuar?', camposPendientes: [pendiente] };
}

function ajustarEnRango(valor, { min, max }) {
  return Math.min(Math.max(valor, min), max);
}

function seleccionarEjercicios(contexto) {
  const ejercicios = Array.isArray(contexto.catalogo?.ejercicios) ? contexto.catalogo.ejercicios : [];
  const criterios = Array.isArray(contexto.catalogo?.criterios) ? contexto.catalogo.criterios : [];
  const restricciones = Array.isArray(contexto.perfil?.restricciones) ? contexto.perfil.restricciones : [];

  const elegibles = [];
  for (const ejercicio of ejercicios) {
    if (restricciones.some((r) => ejercicio.restriccionesIncompatibles?.includes(r))) continue;
    const aprobados = criterios.filter((c) => c.ejercicioId === ejercicio.ejercicioId && c.estado === 'aprobado');
    if (!aprobados.length) continue;
    const preferidoId = ejercicio.ejercicioId === 'E1' ? 'CR1' : ejercicio.ejercicioId === 'E2' ? 'CR2' : null;
    const criterio = (preferidoId && aprobados.find((c) => c.criterioId === preferidoId)) || aprobados[0];
    elegibles.push({ ejercicio, criterio });
  }
  if (!elegibles.length) return null;

  const primero = elegibles.find((x) => x.ejercicio.ejercicioId === 'E1') ?? elegibles[0];
  const segundo = elegibles.find((x) => x.ejercicio.ejercicioId === 'E2')
    ?? elegibles.find((x) => x.ejercicio.ejercicioId !== primero.ejercicio.ejercicioId)
    ?? primero;
  return { primero, segundo };
}

function construirItem({ ejercicio, criterio }, orden, descansoPreferido, referenciaDato, explicacion) {
  const { dosis } = ejercicio;
  const unidad = dosis.objetivoPorSerie.unidad;
  const cantidadBase = unidad === 'segundos' ? 30 : 10;
  return {
    ejercicioId: ejercicio.ejercicioId,
    orden,
    series: Math.round(ajustarEnRango(2, dosis.series)),
    objetivoPorSerie: {
      cantidad: unidad === 'repeticiones'
        ? Math.round(ajustarEnRango(cantidadBase, dosis.objetivoPorSerie))
        : ajustarEnRango(cantidadBase, dosis.objetivoPorSerie),
      unidad,
    },
    descansoSegundos: Math.round(ajustarEnRango(descansoPreferido, dosis.descansoSegundos)),
    explicacion,
    criterioId: criterio.criterioId,
    datosUtilizados: [referenciaDato],
  };
}

function generarPorDefecto(contexto) {
  const { diasDisponibles, nivel, observacion } = contexto.perfil;
  if (!texto(contexto.perfil.objetivo) || (!texto(nivel) && !texto(observacion))) return aclaracion(!texto(contexto.perfil.objetivo) ? 'objetivo' : 'nivel');
  const seleccionados = seleccionarEjercicios(contexto);
  if (!seleccionados) {
    return {
      tipo: 'aclaracion',
      pregunta: 'Las restricciones registradas no permiten seleccionar ejercicios del catálogo.',
      camposPendientes: ['restricciones'],
    };
  }
  const dosDias = diasDisponibles.length === 2;
  const referenciaDato = nivel ? 'nivel' : 'observacion';
  const etiquetaNivel = nivel ?? observacion;
  const explicacionNivel = `Dosis inicial basada en el nivel observado (${etiquetaNivel}); no se recibió InBody.`;
  const nombreSegundo = seleccionados.segundo.ejercicio.ejercicioId === 'E2'
    ? 'E2'
    : (seleccionados.segundo.ejercicio.nombre ?? seleccionados.segundo.ejercicio.ejercicioId);
  const explicacionSegundo = `El catálogo vincula ${nombreSegundo} con su criterio aprobado; dosis inicial acorde al nivel observado (${etiquetaNivel}); no se recibió InBody.`;
  const e1 = construirItem(seleccionados.primero, 1, 60, referenciaDato, explicacionNivel);
  const e2 = construirItem(seleccionados.segundo, 2, 90, referenciaDato, explicacionSegundo);
  return {
    tipo: 'propuesta',
    dias: dosDias
      ? [{ diaSemana: diasDisponibles[0], items: [e1, e2] }, { diaSemana: diasDisponibles[1], items: [{ ...e1, orden: 1 }] }]
      : diasDisponibles.map((dia, i) => ({ diaSemana: dia, items: [i === 1 ? { ...e2, orden: 1 } : { ...e1, orden: 1 }] })),
    aclaraciones: [],
  };
}

function reorganizarPorDefecto(contexto, solicitud) {
  const diasBase = contexto.versionBase?.dias;
  if (!Array.isArray(diasBase) || !diasBase.length) {
    return { tipo: 'aclaracion', pregunta: 'Hace falta una versión base para reorganizar.', camposPendientes: ['versionBase'] };
  }
  const disponibilidad = solicitud.disponibilidad;
  const dias = diasBase.map((dia) => ({
    diaSemana: dia.diaSemana,
    items: dia.items.map(({ itemId: _itemId, ...item }) => clon(item)),
  }));
  const diasBaseISO = dias.map((dia) => dia.diaSemana);
  const diaNuevo = disponibilidad.find((dia) => !dias.some((actual) => actual.diaSemana === dia));
  let bloqueTrasladado;
  let diaOrigen;
  if (diaNuevo === undefined && (disponibilidad.length !== diasBaseISO.length || diasBaseISO.some((dia) => !disponibilidad.includes(dia)))) {
    return { tipo: 'aclaracion', pregunta: 'El escenario simulado no puede retirar días ni bloques de la versión base.', camposPendientes: ['disponibilidad'] };
  }
  if (diaNuevo !== undefined) {
    // El escenario de demo modela el regreso sábado y mueve un bloque existente íntegro.
    if (diaNuevo !== 6 || disponibilidad.length !== dias.length + 1) {
      return { tipo: 'aclaracion', pregunta: 'El escenario simulado solo demuestra el traslado de un bloque existente al sábado; no se creó una sesión nueva.', camposPendientes: ['disponibilidad'] };
    }
    const origen = dias.find((dia) => dia.items.length > 1 && dia.diaSemana !== diaNuevo);
    if (!origen) return { tipo: 'aclaracion', pregunta: 'No hay un bloque adicional en la versión base que pueda trasladarse sin inventar volumen.', camposPendientes: ['versionBase'] };
    const segundoCatalogoId = contexto.catalogo?.ejercicios?.[1]?.ejercicioId;
    let indice = origen.items.findIndex((item) => item.ejercicioId === 'E2');
    if (indice < 0 && segundoCatalogoId) indice = origen.items.findIndex((item) => item.ejercicioId === segundoCatalogoId);
    [bloqueTrasladado] = origen.items.splice(indice >= 0 ? indice : origen.items.length - 1, 1);
    diaOrigen = origen.diaSemana;
    dias.push({ diaSemana: diaNuevo, items: [{ ...bloqueTrasladado, orden: 1 }] });
  }
  const diasOrdenados = dias.filter((dia) => disponibilidad.includes(dia.diaSemana)).sort((a, b) => a.diaSemana - b.diaSemana);
  for (const dia of diasOrdenados) dia.items.forEach((item, index) => { item.orden = index + 1; });
  const ejercicio = contexto.catalogo.ejercicios.find((e) => e.ejercicioId === bloqueTrasladado?.ejercicioId);
  const descanso = bloqueTrasladado?.descansoSegundos;
  const explicacion = diaNuevo === undefined
    ? 'La disponibilidad coincide con la versión base; se conservan los bloques, dosis y descanso. El total semanal no cambia y no se agregan compensaciones.'
    : `Se trasladó el bloque existente de ${ejercicio?.nombre ?? bloqueTrasladado.ejercicioId} del día ${diaOrigen} al sábado. Se conserva el descanso de la versión base (${descanso} segundos) y las series y repeticiones del bloque; el total semanal no cambia y no se agregan compensaciones.`;
  return { tipo: 'propuesta', dias: diasOrdenados, explicacion };
}

function validarSolicitudGenerar(solicitud) {
  return objeto(solicitud) && Object.keys(solicitud).length === 0;
}

function validarSolicitudReorganizar(solicitud) {
  if (!objeto(solicitud) || !texto(solicitud.motivo) || !Array.isArray(solicitud.disponibilidad)
    || solicitud.disponibilidad.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
    || (solicitud.ausencia !== undefined && typeof solicitud.ausencia !== 'boolean')
    || Object.keys(solicitud).some((k) => !['motivo', 'disponibilidad', 'ausencia'].includes(k))) return false;
  return new Set(solicitud.disponibilidad).size === solicitud.disponibilidad.length;
}

/** Proveedor local y determinista para demos/pruebas; nunca realiza llamadas de red. */
export function crearProveedorSimulado(fixtures = {}) {
  if (!objeto(fixtures)) throw new TypeError('fixtures debe ser un objeto.');
  return Object.freeze({
    async generar(contexto, solicitud, opciones) {
      if (!validarSolicitudGenerar(solicitud)) throw new TypeError('La solicitud de generación debe ser un objeto vacío.');
      if (opciones?.signal?.aborted) throw opciones.signal.reason ?? new Error('Operación cancelada.');
      const respuesta = typeof fixtures.generar === 'function'
        ? await fixtures.generar(clon(contexto), clon(solicitud))
        : fixtures.respuestaGenerar ?? generarPorDefecto(contexto);
      return clon(respuesta);
    },
    async reorganizar(contexto, solicitud, opciones) {
      if (!validarSolicitudReorganizar(solicitud)) throw new TypeError('La solicitud de reorganización no cumple el contrato.');
      if (opciones?.signal?.aborted) throw opciones.signal.reason ?? new Error('Operación cancelada.');
      const respuesta = typeof fixtures.reorganizar === 'function'
        ? await fixtures.reorganizar(clon(contexto), clon(solicitud))
        : fixtures.respuestaReorganizar ?? reorganizarPorDefecto(contexto, solicitud);
      return clon(respuesta);
    },
  });
}
