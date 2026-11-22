const STATUS_VALIDOS = new Set([401, 403, 404, 409, 422, 503]);

/** Error estable del dominio de planificación, serializable por adaptadores HTTP. */
export class ErrorPlanificacion extends Error {
  constructor({ status, codigo, mensaje, camposPendientes, revisionActual } = {}) {
    if (!STATUS_VALIDOS.has(status)) throw new TypeError('status debe ser 401, 403, 404, 409, 422 o 503');
    if (typeof codigo !== 'string' || !codigo.trim()) throw new TypeError('codigo debe ser un texto no vacío');
    if (typeof mensaje !== 'string' || !mensaje.trim()) throw new TypeError('mensaje debe ser un texto no vacío');
    super(mensaje);
    this.name = 'ErrorPlanificacion';
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;
    if (camposPendientes !== undefined) {
      if (!Array.isArray(camposPendientes)) throw new TypeError('camposPendientes debe ser un array');
      this.camposPendientes = structuredClone(camposPendientes);
    }
    if (revisionActual !== undefined) this.revisionActual = structuredClone(revisionActual);
  }
}
