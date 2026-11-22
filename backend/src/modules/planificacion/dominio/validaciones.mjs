import { ErrorPlanificacion } from './errores.mjs';

const CAMPOS_DATOS = new Set(['objetivo', 'nivel', 'observacion', 'restricciones', 'mediciones', 'historialEjecutado']);
const UMBRAL = (codigo, mensaje, camposPendientes) => new ErrorPlanificacion({
  status: 422, codigo, mensaje, ...(camposPendientes ? { camposPendientes } : {}),
});
const invalido = (mensaje) => { throw UMBRAL('SOLICITUD_INVALIDA', mensaje); };
const pendiente = (campo, pregunta) => { throw UMBRAL('DATOS_PENDIENTES', pregunta, [campo]); };
const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const texto = (v) => typeof v === 'string' && v.trim().length > 0;
const numero = (v) => typeof v === 'number' && Number.isFinite(v);
const exactas = (v, permitidas, nombre) => {
  if (!obj(v)) invalido(`${nombre} debe ser un objeto`);
  const extras = Object.keys(v).filter((k) => !permitidas.includes(k));
  if (extras.length) invalido(`${nombre} contiene campos no permitidos`);
};
function fechaISO(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}
function dias(v, nombre, { noVacio = true } = {}) {
  if (!Array.isArray(v) || (noVacio && v.length === 0) || v.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) invalido(`${nombre} debe contener días ISO entre 1 y 7`);
  if (new Set(v).size !== v.length) invalido(`${nombre} no puede repetir días`);
  return v;
}
function obligatorioTexto(v, campo) { if (!texto(v)) invalido(`${campo} debe ser un texto no vacío`); }
function rango(v, campo) {
  if (!obj(v) || !numero(v.min) || !numero(v.max) || v.min < 0 || v.max < v.min) invalido(`${campo} debe declarar límites min/max válidos`);
}

export function validarEvaluacion(e) {
  if (!obj(e)) invalido('La evaluación debe ser un objeto');
  for (const k of ['evaluacionId', 'gimnasioId', 'atletaId', 'autorId', 'modalidad']) obligatorioTexto(e[k], k);
  if (!fechaISO(e.fecha)) invalido('fecha debe ser una fecha ISO válida YYYY-MM-DD');
  if (e.diasDisponibles === undefined || e.diasDisponibles === null || (Array.isArray(e.diasDisponibles) && e.diasDisponibles.length === 0)) pendiente('diasDisponibles', '¿Qué días está disponible para entrenar?');
  dias(e.diasDisponibles, 'diasDisponibles');
  if (!texto(e.objetivo)) pendiente('objetivo', '¿Cuál es el objetivo de entrenamiento?');
  if (!texto(e.nivel) && !texto(e.observacion)) pendiente('nivel', '¿Cuál es el nivel observado o qué observación inicial registró el entrenador?');
  if (e.nivel !== undefined) obligatorioTexto(e.nivel, 'nivel');
  if (e.observacion !== undefined) obligatorioTexto(e.observacion, 'observacion');
  if (!Array.isArray(e.restricciones) || e.restricciones.some((r) => !texto(r))) invalido('restricciones debe ser una lista de textos');
  if (!Array.isArray(e.publicaciones) || e.publicaciones.some((p) => !obj(p) || !texto(p.dato) || !['atleta', 'entrenador', 'otra'].includes(p.fuente))) invalido('publicaciones debe incluir dato y fuente válida');
  if (!Array.isArray(e.mediciones)) invalido('mediciones debe ser una lista; puede estar vacía si no hay mediciones');
  for (const m of e.mediciones) {
    if (!obj(m) || !texto(m.variable) || !['medida', 'pendiente'].includes(m.estado) || !texto(m.origen) || !fechaISO(m.fecha)) invalido('Cada medición requiere variable, estado, origen y fecha ISO válidos');
    if (m.estado === 'medida' && (!numero(m.valor) || !texto(m.unidad))) invalido(`La medición ${m.variable} requiere valor y unidad`);
    if (m.estado === 'pendiente' && (m.valor !== undefined || m.unidad !== undefined)) invalido(`La medición pendiente ${m.variable} no debe declarar valor o unidad`);
  }
  return structuredClone(e);
}

export function validarCatalogo(c) {
  if (!obj(c)) invalido('El catálogo debe ser un objeto');
  obligatorioTexto(c.catalogoVersion, 'catalogoVersion');
  if (!Array.isArray(c.ejercicios) || !Array.isArray(c.criterios)) invalido('El catálogo requiere ejercicios y criterios');
  const ids = new Set();
  for (const e of c.ejercicios) {
    if (!obj(e)) invalido('Cada ejercicio debe ser un objeto');
    for (const k of ['ejercicioId', 'nombre', 'grupoMuscular']) obligatorioTexto(e[k], k);
    if (ids.has(e.ejercicioId)) invalido(`ejercicioId duplicado: ${e.ejercicioId}`);
    ids.add(e.ejercicioId);
    if (!Array.isArray(e.estaciones) || e.estaciones.some((x) => !texto(x)) || !Array.isArray(e.restriccionesIncompatibles) || e.restriccionesIncompatibles.some((x) => !texto(x))) invalido(`El ejercicio ${e.ejercicioId} requiere estaciones y restricciones válidas`);
    const d = e.dosis;
    if (!obj(d)) invalido(`El ejercicio ${e.ejercicioId} requiere límites de dosis`);
    rango(d.series, `${e.ejercicioId}.dosis.series`);
    rango(d.objetivoPorSerie, `${e.ejercicioId}.dosis.objetivoPorSerie`);
    rango(d.descansoSegundos, `${e.ejercicioId}.dosis.descansoSegundos`);
    if (!['repeticiones', 'segundos'].includes(d.objetivoPorSerie.unidad)) invalido(`Unidad de dosis inválida para ${e.ejercicioId}`);
  }
  const criterios = new Set();
  for (const cr of c.criterios) {
    if (!obj(cr)) invalido('Cada criterio debe ser un objeto');
    for (const k of ['criterioId', 'ejercicioId', 'version', 'texto', 'procedencia', 'revisorId', 'revisadoEn']) obligatorioTexto(cr[k], k);
    if (!ids.has(cr.ejercicioId)) invalido(`El criterio ${cr.criterioId} referencia un ejercicio inexistente`);
    if (cr.estado !== 'aprobado') invalido(`El criterio ${cr.criterioId} no está aprobado`);
    if (criterios.has(cr.criterioId)) invalido(`criterioId duplicado: ${cr.criterioId}`);
    criterios.add(cr.criterioId);
    if (!Number.isFinite(Date.parse(cr.revisadoEn)) || !/(Z|[+-]\d{2}:\d{2})$/.test(cr.revisadoEn)) invalido(`revisadoEn de ${cr.criterioId} debe ser ISO 8601 con zona`);
  }
  return structuredClone(c);
}

export function validarSolicitudGenerar(x) {
  exactas(x, ['evaluacionId'], 'La solicitud');
  obligatorioTexto(x.evaluacionId, 'evaluacionId');
  return { evaluacionId: x.evaluacionId };
}

export function validarSolicitudReorganizar(x) {
  exactas(x, ['motivo', 'disponibilidad', 'ausencia', 'disponibilidadRegreso'], 'La solicitud');
  obligatorioTexto(x.motivo, 'motivo');
  if (x.disponibilidad !== undefined) dias(x.disponibilidad, 'disponibilidad');
  if (x.ausencia !== undefined && typeof x.ausencia !== 'boolean') invalido('ausencia debe ser booleano');
  if (x.disponibilidadRegreso !== undefined) dias(x.disponibilidadRegreso, 'disponibilidadRegreso');
  if (x.ausencia === true && x.disponibilidadRegreso === undefined) pendiente('disponibilidadRegreso', '¿Qué días podrá entrenar al regresar?');
  return structuredClone(x);
}

export function validarBorrador(b, contexto) {
  if (!obj(b) || !obj(contexto)) invalido('La propuesta y el contexto deben ser objetos');
  const esReorganizacion = Object.hasOwn(b, 'explicacion');
  exactas(b, esReorganizacion ? ['tipo', 'dias', 'explicacion'] : ['tipo', 'dias', 'aclaraciones'], 'La propuesta');
  if (b.tipo !== 'propuesta') invalido('Solo una propuesta puede validarse como borrador');
  if (esReorganizacion) obligatorioTexto(b.explicacion, 'explicacion');
  else if (!Array.isArray(b.aclaraciones) || b.aclaraciones.length !== 0) invalido('La generación propuesta debe incluir aclaraciones vacías');
  const perfil = contexto.perfil;
  if (!obj(perfil)) invalido('contexto.perfil es obligatorio');
  const catalogo = validarCatalogo(contexto.catalogo);
  if (perfil.diasDisponibles === undefined || perfil.diasDisponibles === null || (Array.isArray(perfil.diasDisponibles) && perfil.diasDisponibles.length === 0)) pendiente('diasDisponibles', '¿Qué días está disponible para entrenar?');
  const esperados = dias(perfil.diasDisponibles, 'perfil.diasDisponibles');
  if (!texto(perfil.objetivo)) pendiente('objetivo', '¿Cuál es el objetivo de entrenamiento?');
  if (!texto(perfil.nivel) && !texto(perfil.observacion)) pendiente('nivel', '¿Cuál es el nivel observado o qué observación inicial registró el entrenador?');
  if (!Array.isArray(perfil.restricciones) || perfil.restricciones.some((r) => !texto(r))) invalido('perfil.restricciones debe ser una lista de textos');
  if (!Array.isArray(perfil.mediciones) || !Array.isArray(perfil.publicaciones)) invalido('El perfil requiere mediciones y publicaciones, aunque estén vacías');
  if (perfil.publicaciones.some((p) => !obj(p) || !texto(p.dato) || !['atleta', 'entrenador', 'otra'].includes(p.fuente))) invalido('publicaciones del perfil debe incluir dato y fuente válida');
  for (const m of perfil.mediciones) {
    if (!obj(m) || !texto(m.variable) || !['medida', 'pendiente'].includes(m.estado) || !texto(m.origen) || !fechaISO(m.fecha)) invalido('Cada medición del perfil requiere variable, estado, origen y fecha ISO válidos');
    if (m.estado === 'medida' && (!numero(m.valor) || !texto(m.unidad))) invalido(`La medición ${m.variable} requiere valor y unidad`);
    if (m.estado === 'pendiente' && (m.valor !== undefined || m.unidad !== undefined)) invalido(`La medición pendiente ${m.variable} no debe declarar valor o unidad`);
  }
  if (contexto.historialEjecutado !== undefined) {
    if (!Array.isArray(contexto.historialEjecutado)) invalido('historialEjecutado debe ser una lista');
    for (const s of contexto.historialEjecutado) {
      if (!obj(s) || !fechaISO(s.fecha) || !['activa', 'completa', 'parcial'].includes(s.estado) || !Number.isInteger(s.diaSemana) || s.diaSemana < 1 || s.diaSemana > 7 || !Array.isArray(s.ejercicioIds) || s.ejercicioIds.some((id) => !texto(id))) invalido('Cada sesión del historial requiere fecha, estado, día ISO y ejercicios válidos');
    }
  }
  if (!Array.isArray(b.dias) || b.dias.length !== esperados.length) invalido('La propuesta debe incluir todos los días ISO esperados');
  const propuestos = new Set();
  const ejercicios = new Map(catalogo.ejercicios.map((e) => [e.ejercicioId, e]));
  const criterios = new Map(catalogo.criterios.map((c) => [c.criterioId, c]));
  for (const dia of b.dias) {
    exactas(dia, ['diaSemana', 'items'], 'El día');
    if (!obj(dia) || !Number.isInteger(dia.diaSemana) || dia.diaSemana < 1 || dia.diaSemana > 7) invalido('Cada día debe tener diaSemana ISO entre 1 y 7');
    if (propuestos.has(dia.diaSemana)) invalido(`día ISO duplicado: ${dia.diaSemana}`);
    propuestos.add(dia.diaSemana);
    if (!Array.isArray(dia.items) || dia.items.length === 0) invalido(`El día ${dia.diaSemana} debe contener al menos un ejercicio`);
    const ordenes = new Set();
    for (const it of dia.items) {
      exactas(it, ['ejercicioId', 'orden', 'series', 'objetivoPorSerie', 'descansoSegundos', 'explicacion', 'criterioId', 'datosUtilizados'], 'El item');
      if (!obj(it)) invalido('Cada item debe ser un objeto');
      const ex = ejercicios.get(it.ejercicioId);
      if (!ex) invalido(`ejercicioId inexistente: ${it.ejercicioId}`);
      const criterio = criterios.get(it.criterioId);
      if (!criterio || criterio.ejercicioId !== ex.ejercicioId || criterio.estado !== 'aprobado') invalido(`criterioId inválido o no aprobado para ${ex.ejercicioId}`);
      if (perfil.restricciones.some((r) => ex.restriccionesIncompatibles.includes(r))) invalido(`El ejercicio ${ex.ejercicioId} es incompatible con una restricción registrada`);
      if (!Number.isInteger(it.orden) || it.orden < 1 || ordenes.has(it.orden)) invalido(`orden inválido o repetido en el día ${dia.diaSemana}`);
      ordenes.add(it.orden);
      if (!Number.isInteger(it.series) || it.series < ex.dosis.series.min || it.series > ex.dosis.series.max) invalido(`series fuera de límites para ${ex.ejercicioId}`);
      exactas(it.objetivoPorSerie, ['cantidad', 'unidad'], 'objetivoPorSerie');
      const cantidadValida = ex.dosis.objetivoPorSerie.unidad === 'repeticiones' ? Number.isInteger(it.objetivoPorSerie?.cantidad) && it.objetivoPorSerie.cantidad > 0 : Number.isFinite(it.objetivoPorSerie?.cantidad) && it.objetivoPorSerie.cantidad > 0;
      if (!obj(it.objetivoPorSerie) || !cantidadValida || it.objetivoPorSerie.unidad !== ex.dosis.objetivoPorSerie.unidad || it.objetivoPorSerie.cantidad < ex.dosis.objetivoPorSerie.min || it.objetivoPorSerie.cantidad > ex.dosis.objetivoPorSerie.max) invalido(`objetivoPorSerie o unidad fuera de límites para ${ex.ejercicioId}`);
      if (!Number.isInteger(it.descansoSegundos) || it.descansoSegundos < ex.dosis.descansoSegundos.min || it.descansoSegundos > ex.dosis.descansoSegundos.max) invalido(`descansoSegundos fuera de límites para ${ex.ejercicioId}`);
      obligatorioTexto(it.explicacion, 'explicacion');
      if (!Array.isArray(it.datosUtilizados) || it.datosUtilizados.length === 0 || it.datosUtilizados.some((d) => !CAMPOS_DATOS.has(d)) || new Set(it.datosUtilizados).size !== it.datosUtilizados.length) invalido('datosUtilizados debe referenciar datos permitidos sin duplicados');
      for (const dato of it.datosUtilizados) {
        if (dato === 'objetivo' && !texto(perfil.objetivo)) pendiente('objetivo', '¿Cuál es el objetivo de entrenamiento?');
        if (dato === 'nivel' && !texto(perfil.nivel)) pendiente('nivel', '¿Cuál es el nivel observado?');
        if (dato === 'observacion' && !texto(perfil.observacion)) pendiente('observacion', '¿Qué observación inicial registró el entrenador?');
        if (dato === 'restricciones' && (!perfil.restricciones.length || perfil.restricciones.every((r) => !r))) pendiente('restricciones', '¿Qué restricciones conocidas deben considerarse?');
        if (dato === 'mediciones' && !perfil.mediciones.some((m) => m?.estado === 'medida')) pendiente('mediciones', '¿Qué medición registrada debe utilizarse?');
        if (dato === 'historialEjecutado' && (!Array.isArray(contexto.historialEjecutado) || contexto.historialEjecutado.length === 0)) pendiente('historialEjecutado', '¿Qué sesiones ejecutadas deben considerarse?');
      }
    }
  }
  if (esperados.some((d) => !propuestos.has(d))) invalido('La propuesta no contiene todos los días ISO esperados');
  return structuredClone(b);
}

export function copiarPlan(p) {
  if (!obj(p)) invalido('El plan debe ser un objeto');
  return structuredClone(p);
}
