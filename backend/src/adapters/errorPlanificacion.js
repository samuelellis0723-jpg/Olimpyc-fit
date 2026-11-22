export class ErrorPlanificacion extends Error {
  constructor({
    status = 503,
    codigo = 'PROVEEDOR_NO_DISPONIBLE',
    mensaje = 'Error en planificación',
    camposPendientes,
    revisionActual,
  } = {}) {
    super(mensaje);
    this.name = 'ErrorPlanificacion';
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;

    if (Array.isArray(camposPendientes)) {
      this.camposPendientes = [...camposPendientes];
    }
    if (revisionActual !== undefined) {
      this.revisionActual =
        typeof revisionActual === 'object' && revisionActual !== null
          ? structuredClone(revisionActual)
          : revisionActual;
    }
  }
}