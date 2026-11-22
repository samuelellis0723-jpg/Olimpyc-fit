const objeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const texto = (x) => typeof x === 'string' && x.trim().length > 0;
const clon = (x) => structuredClone(x);

function aclaracion(pendiente) {
  const preguntas = { objetivo: '¿Cuál es el objetivo de entrenamiento?', nivel: '¿Cuál es el nivel observado por la entrenadora?' };
  return { tipo: 'aclaracion', pregunta: preguntas[pendiente] ?? '¿Qué dato falta para continuar?', camposPendientes: [pendiente] };
}

function generarPorDefecto(contexto) {
  const { diasDisponibles, nivel, observacion } = contexto.perfil;
  if (!texto(contexto.perfil.objetivo) || (!texto(nivel) && !texto(observacion))) return aclaracion(!texto(contexto.perfil.objetivo) ? 'objetivo' : 'nivel');
  const dosDias = diasDisponibles.length === 2;
  const explicacionNivel = `Dosis inicial basada en el nivel observado (${nivel ?? observacion}); no se recibió InBody.`;
  const e1 = { ejercicioId: 'E1', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: explicacionNivel, criterioId: 'CR1', datosUtilizados: [nivel ? 'nivel' : 'observacion'] };
  const e2 = { ejercicioId: 'E2', orden: 2, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 90, explicacion: `El catálogo vincula E2 con su criterio aprobado; dosis inicial acorde al nivel observado (${nivel ?? observacion}); no se recibió InBody.`, criterioId: 'CR2', datosUtilizados: [nivel ? 'nivel' : 'observacion'] };
  return {
    tipo: 'propuesta',
    dias: dosDias
      ? [{ diaSemana: diasDisponibles[0], items: [e1, e2] }, { diaSemana: diasDisponibles[1], items: [{ ...e1, orden: 1 }] }]
      : diasDisponibles.map((dia, i) => ({ diaSemana: dia, items: [i === 1 ? e2 : { ...e1, orden: 1 }] })),
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
    const indice = origen.items.findIndex((item) => item.ejercicioId === 'E2');
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
