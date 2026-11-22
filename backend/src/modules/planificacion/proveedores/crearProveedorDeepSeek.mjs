import { ErrorPlanificacion } from '../dominio/errores.mjs';

const ENDPOINT = 'https://api.deepseek.com/chat/completions';
const RESPUESTA_INVALIDA = 'RESPUESTA_PROVEEDOR_INVALIDA';
const CAMPOS_DATOS = [
  'objetivo',
  'nivel',
  'observacion',
  'restricciones',
  'mediciones',
  'historialEjecutado',
];

const EJEMPLO_GENERAR = {
  tipo: 'propuesta',
  dias: [{
    diaSemana: 1,
    items: [{
      ejercicioId: 'E1',
      orden: 1,
      series: 3,
      objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' },
      descansoSegundos: 60,
      explicacion: 'Se ajusta al objetivo declarado.',
      criterioId: 'CR1',
      datosUtilizados: ['objetivo'],
    }],
  }],
  aclaraciones: [],
};

const EJEMPLO_REORGANIZAR = {
  tipo: 'propuesta',
  dias: EJEMPLO_GENERAR.dias,
  explicacion: 'Se redistribuyeron las sesiones según la disponibilidad.',
};

function errorRespuestaInvalida() {
  return new ErrorPlanificacion({
    status: 503,
    codigo: RESPUESTA_INVALIDA,
    mensaje: 'El proveedor de planificación devolvió una respuesta inválida.',
  });
}

function errorProveedorNoDisponible() {
  return new ErrorPlanificacion({
    status: 503,
    codigo: 'PROVEEDOR_NO_DISPONIBLE',
    mensaje: 'El proveedor de planificación no está disponible.',
  });
}

function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function sinCamposExtra(valor, campos) {
  return objeto(valor) && Object.keys(valor).length === campos.length
    && campos.every((campo) => Object.hasOwn(valor, campo));
}

function texto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function proyectarCatalogo(catalogo) {
  if (!objeto(catalogo)) return catalogo;
  return {
    catalogoVersion: catalogo.catalogoVersion,
    ejercicios: Array.isArray(catalogo.ejercicios) ? catalogo.ejercicios.map((ejercicio) => ({
      ejercicioId: ejercicio?.ejercicioId,
      nombre: ejercicio?.nombre,
      grupoMuscular: ejercicio?.grupoMuscular,
      estaciones: Array.isArray(ejercicio?.estaciones) ? [...ejercicio.estaciones] : ejercicio?.estaciones,
      restriccionesIncompatibles: Array.isArray(ejercicio?.restriccionesIncompatibles)
        ? [...ejercicio.restriccionesIncompatibles]
        : ejercicio?.restriccionesIncompatibles,
      dosis: objeto(ejercicio?.dosis) ? {
        series: objeto(ejercicio.dosis.series) ? { min: ejercicio.dosis.series.min, max: ejercicio.dosis.series.max } : ejercicio.dosis.series,
        objetivoPorSerie: objeto(ejercicio.dosis.objetivoPorSerie) ? {
          unidad: ejercicio.dosis.objetivoPorSerie.unidad,
          min: ejercicio.dosis.objetivoPorSerie.min,
          max: ejercicio.dosis.objetivoPorSerie.max,
        } : ejercicio.dosis.objetivoPorSerie,
        descansoSegundos: objeto(ejercicio.dosis.descansoSegundos)
          ? { min: ejercicio.dosis.descansoSegundos.min, max: ejercicio.dosis.descansoSegundos.max }
          : ejercicio.dosis.descansoSegundos,
      } : ejercicio?.dosis,
    })) : catalogo.ejercicios,
    criterios: Array.isArray(catalogo.criterios) ? catalogo.criterios.map((criterio) => ({
      criterioId: criterio?.criterioId,
      ejercicioId: criterio?.ejercicioId,
      version: criterio?.version,
      texto: criterio?.texto,
      procedencia: criterio?.procedencia,
      estado: criterio?.estado,
      revisadoEn: criterio?.revisadoEn,
    })) : catalogo.criterios,
  };
}

function proyectarPerfil(perfil) {
  if (!objeto(perfil)) return perfil;
  return {
    referenciaAtleta: perfil.referenciaAtleta,
    fecha: perfil.fecha,
    modalidad: perfil.modalidad,
    objetivo: perfil.objetivo,
    diasDisponibles: Array.isArray(perfil.diasDisponibles) ? [...perfil.diasDisponibles] : perfil.diasDisponibles,
    ...(perfil.nivel === undefined ? {} : { nivel: perfil.nivel }),
    ...(perfil.observacion === undefined ? {} : { observacion: perfil.observacion }),
    restricciones: Array.isArray(perfil.restricciones) ? [...perfil.restricciones] : perfil.restricciones,
    mediciones: Array.isArray(perfil.mediciones) ? perfil.mediciones.map((medicion) => ({
      variable: medicion?.variable,
      estado: medicion?.estado,
      ...(medicion?.valor === undefined ? {} : { valor: medicion.valor }),
      ...(medicion?.unidad === undefined ? {} : { unidad: medicion.unidad }),
      origen: medicion?.origen,
      fecha: medicion?.fecha,
    })) : perfil.mediciones,
    publicaciones: Array.isArray(perfil.publicaciones) ? perfil.publicaciones.map((publicacion) => ({
      dato: publicacion?.dato,
      fuente: publicacion?.fuente,
    })) : perfil.publicaciones,
  };
}

function proyectarSesion(sesion) {
  return {
    fecha: sesion?.fecha,
    estado: sesion?.estado,
    diaSemana: sesion?.diaSemana,
    ejercicioIds: Array.isArray(sesion?.ejercicioIds) ? [...sesion.ejercicioIds] : sesion?.ejercicioIds,
  };
}

function proyectarDiaBase(dia) {
  return {
    diaId: dia?.diaId,
    diaSemana: dia?.diaSemana,
    items: Array.isArray(dia?.items) ? dia.items.map((item) => ({
      itemId: item?.itemId,
      ejercicioId: item?.ejercicioId,
      orden: item?.orden,
      series: item?.series,
      objetivoPorSerie: objeto(item?.objetivoPorSerie)
        ? { cantidad: item.objetivoPorSerie.cantidad, unidad: item.objetivoPorSerie.unidad }
        : item?.objetivoPorSerie,
      descansoSegundos: item?.descansoSegundos,
      explicacion: item?.explicacion,
      criterioId: item?.criterioId,
      datosUtilizados: Array.isArray(item?.datosUtilizados) ? [...item.datosUtilizados] : item?.datosUtilizados,
    })) : dia?.items,
  };
}

function proyectarContexto(contexto) {
  if (!objeto(contexto)) return contexto;
  const versionBase = contexto.versionBase;
  return {
    perfil: proyectarPerfil(contexto.perfil),
    catalogo: proyectarCatalogo(contexto.catalogo),
    historialEjecutado: Array.isArray(contexto.historialEjecutado)
      ? contexto.historialEjecutado.map(proyectarSesion)
      : contexto.historialEjecutado,
    ...(versionBase === undefined ? {} : {
      versionBase: {
        versionId: versionBase?.versionId,
        dias: Array.isArray(versionBase?.dias) ? versionBase.dias.map(proyectarDiaBase) : versionBase?.dias,
      },
    }),
  };
}

function validarAclaracion(respuesta) {
  return sinCamposExtra(respuesta, ['tipo', 'pregunta', 'camposPendientes'])
    && respuesta.tipo === 'aclaracion'
    && texto(respuesta.pregunta)
    && Array.isArray(respuesta.camposPendientes)
    && respuesta.camposPendientes.length > 0
    && respuesta.camposPendientes.every(texto);
}

function referenciasDisponibles(contexto) {
  const perfil = contexto?.perfil;
  const referencias = [];
  if (typeof perfil?.objetivo === 'string' && perfil.objetivo.trim()) referencias.push('objetivo');
  if (typeof perfil?.nivel === 'string' && perfil.nivel.trim()) referencias.push('nivel');
  if (typeof perfil?.observacion === 'string' && perfil.observacion.trim()) referencias.push('observacion');
  if (Array.isArray(perfil?.restricciones) && perfil.restricciones.length > 0) referencias.push('restricciones');
  if (Array.isArray(perfil?.mediciones) && perfil.mediciones.some((medicion) => medicion?.estado === 'medida')) {
    referencias.push('mediciones');
  }
  if (Array.isArray(contexto?.historialEjecutado) && contexto.historialEjecutado.length > 0) {
    referencias.push('historialEjecutado');
  }
  return referencias;
}

function validarPropuesta(respuesta, reorganizacion, referenciasElegibles) {
  const campos = reorganizacion ? ['tipo', 'dias', 'explicacion'] : ['tipo', 'dias', 'aclaraciones'];
  if (!sinCamposExtra(respuesta, campos) || respuesta.tipo !== 'propuesta' || !Array.isArray(respuesta.dias)) return false;
  if (reorganizacion && !texto(respuesta.explicacion)) return false;
  if (!reorganizacion && (!Array.isArray(respuesta.aclaraciones) || respuesta.aclaraciones.length !== 0)) return false;

  return respuesta.dias.every((dia) => sinCamposExtra(dia, ['diaSemana', 'items'])
    && Number.isInteger(dia.diaSemana) && dia.diaSemana >= 1 && dia.diaSemana <= 7
    && Array.isArray(dia.items)
    && dia.items.every((item) => sinCamposExtra(item, [
      'ejercicioId', 'orden', 'series', 'objetivoPorSerie', 'descansoSegundos',
      'explicacion', 'criterioId', 'datosUtilizados',
    ])
      && texto(item.ejercicioId)
      && Number.isInteger(item.orden) && item.orden >= 1
      && Number.isInteger(item.series) && item.series >= 1
      && sinCamposExtra(item.objetivoPorSerie, ['cantidad', 'unidad'])
      && Number.isFinite(item.objetivoPorSerie.cantidad) && item.objetivoPorSerie.cantidad > 0
      && ['repeticiones', 'segundos'].includes(item.objetivoPorSerie.unidad)
      && Number.isInteger(item.descansoSegundos) && item.descansoSegundos >= 0
      && texto(item.explicacion)
      && texto(item.criterioId)
      && Array.isArray(item.datosUtilizados)
      && item.datosUtilizados.length > 0
      && new Set(item.datosUtilizados).size === item.datosUtilizados.length
      && item.datosUtilizados.every((dato) => CAMPOS_DATOS.includes(dato) && referenciasElegibles.includes(dato))));
}

function analizarRespuesta(contenido, reorganizacion, finishReason, referenciasElegibles) {
  if (finishReason === 'length' || typeof contenido !== 'string' || !contenido.trim()) throw errorRespuestaInvalida();
  let parsed;
  try {
    parsed = JSON.parse(contenido);
  } catch {
    throw errorRespuestaInvalida();
  }

  if (validarAclaracion(parsed) || validarPropuesta(parsed, reorganizacion, referenciasElegibles)) return parsed;
  throw errorRespuestaInvalida();
}

function analizarEnvelopeHttp(respuesta) {
  if (!objeto(respuesta) || !Array.isArray(respuesta.choices) || !objeto(respuesta.choices[0])
    || !objeto(respuesta.choices[0].message)
    || typeof respuesta.choices[0].message.content !== 'string') {
    throw errorRespuestaInvalida();
  }
  return respuesta.choices[0];
}

function crearTimeout(timeoutMs, signalExterno) {
  const controller = new AbortController();
  let vencido = false;
  let timer;
  const propagarAbort = () => controller.abort(signalExterno?.reason);
  if (signalExterno?.aborted) propagarAbort();
  else signalExterno?.addEventListener('abort', propagarAbort, { once: true });

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      vencido = true;
      controller.abort();
      reject(errorProveedorNoDisponible());
    }, timeoutMs);
  });

  return {
    controller,
    timeout,
    fueTimeout: () => vencido,
    limpiar: () => {
      clearTimeout(timer);
      signalExterno?.removeEventListener('abort', propagarAbort);
    },
  };
}

function validarSolicitudReorganizar(solicitud) {
  return sinCamposExtra(solicitud, solicitud?.ausencia === undefined
    ? ['motivo', 'disponibilidad']
    : ['motivo', 'disponibilidad', 'ausencia'])
    && texto(solicitud.motivo)
    && Array.isArray(solicitud.disponibilidad)
    && solicitud.disponibilidad.every((dia) => Number.isInteger(dia) && dia >= 1 && dia <= 7)
    && (solicitud.ausencia === undefined || typeof solicitud.ausencia === 'boolean');
}

export function crearProveedorDeepSeek({ apiKey, model, fetchImpl = fetch, timeoutMs = 20000 }) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || typeof model !== 'string' || !model.trim()
    || typeof fetchImpl !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Configuración inválida para el proveedor DeepSeek.');
  }

  async function solicitar(tipo, contexto, solicitud, opciones = {}) {
    if (tipo === 'generar' && !sinCamposExtra(solicitud, [])) {
      throw new TypeError('La solicitud de generación debe ser un objeto vacío.');
    }
    if (tipo === 'reorganizar' && !validarSolicitudReorganizar(solicitud)) {
      throw new TypeError('La solicitud de reorganización no cumple el contrato.');
    }

    const reorganizacion = tipo === 'reorganizar';
    const contextoProyectado = proyectarContexto(contexto);
    const referenciasElegibles = referenciasDisponibles(contextoProyectado);
    const ejemplo = reorganizacion ? EJEMPLO_REORGANIZAR : EJEMPLO_GENERAR;
    const system = [
      'Eres un asistente de planificación de entrenamiento para un entrenador profesional.',
      'Responde exclusivamente en json válido, sin Markdown ni texto adicional.',
      'Usa solamente ejercicios y criterios aprobados del catálogo recibido.',
      'Incluye todos los días efectivos de disponibilidad exactamente una vez y no agregues días no solicitados.',
      `Para datosUtilizados usa solo estas referencias elegibles del contexto proyectado: ${JSON.stringify(referenciasElegibles)}.`,
      'Cada ítem debe incluir al menos una referencia elegible en datosUtilizados, sin duplicados y escrita exactamente como aparece en la lista.',
      'Disponibilidad, ausencia, motivo, versionBase y cualquier otro dato pueden explicarse en texto, pero nunca deben aparecer en datosUtilizados.',
      'Cada ejercicio debe respetar su criterio aprobado, dosis y restricciones incompatibles.',
      'No inventes mediciones, capacidades, restricciones ni datos del atleta.',
      'Si falta información crítica, devuelve exactamente una aclaración y sus campos pendientes.',
      'Las propuestas son borradores para revisión humana; nunca las declares aprobadas o publicadas.',
      ...(reorganizacion ? [
        'Al reorganizar, conserva ejercicios, ediciones y dosis aprobadas cuando sea posible.',
        'Explica cualquier cambio de ejercicios o dosis y nunca compenses la carga por una ausencia.',
      ] : []),
      `Ejemplo exacto del contrato de salida json: ${JSON.stringify(ejemplo)}`,
    ].join('\n');
    const userPayload = {
      operacion: tipo,
      contexto: contextoProyectado,
      solicitud,
      contratoSalida: reorganizacion
        ? 'Propuesta: {tipo:"propuesta",dias,explicacion}; aclaración: {tipo:"aclaracion",pregunta,camposPendientes}.'
        : 'Propuesta: {tipo:"propuesta",dias,aclaraciones:[]}; aclaración: {tipo:"aclaracion",pregunta,camposPendientes}.',
    };
    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      stream: false,
    };
    const control = crearTimeout(timeoutMs, opciones?.signal);

    try {
      const response = await Promise.race([
        Promise.resolve().then(() => fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: control.controller.signal,
        })),
        control.timeout,
      ]);

      if (!response?.ok) throw errorProveedorNoDisponible();
      let responseBody;
      try {
        responseBody = await Promise.race([response.json(), control.timeout]);
      } catch (error) {
        if (error instanceof ErrorPlanificacion) throw error;
        if (control.fueTimeout()) throw errorProveedorNoDisponible();
        throw errorRespuestaInvalida();
      }
      if (control.fueTimeout()) throw errorProveedorNoDisponible();
      const choice = analizarEnvelopeHttp(responseBody);
      const contenido = choice.message.content;
      return analizarRespuesta(contenido, reorganizacion, choice?.finish_reason, referenciasElegibles);
    } catch (error) {
      if (error instanceof ErrorPlanificacion) throw error;
      if (control.fueTimeout() || opciones?.signal?.aborted) throw errorProveedorNoDisponible();
      throw errorProveedorNoDisponible();
    } finally {
      control.limpiar();
    }
  }

  return Object.freeze({
    generar(contexto, solicitud, opciones) {
      return solicitar('generar', contexto, solicitud, opciones);
    },
    reorganizar(contexto, solicitud, opciones) {
      return solicitar('reorganizar', contexto, solicitud, opciones);
    },
  });
}
