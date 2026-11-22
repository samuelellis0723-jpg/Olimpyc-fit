import express from 'express';
import { ErrorPlanificacion } from '../dominio/errores.mjs';

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const tieneSolo = (x, keys) => esObjeto(x) && Object.keys(x).every((k) => keys.includes(k));
const errorSolicitud = () => new ErrorPlanificacion({ status: 422, codigo: 'SOLICITUD_INVALIDA', mensaje: 'El cuerpo de la solicitud no cumple el contrato.' });

function respuestaError(res, error) {
  if (error instanceof ErrorPlanificacion) {
    const cuerpo = { codigo: error.codigo, mensaje: error.mensaje };
    if (error.camposPendientes !== undefined) cuerpo.camposPendientes = error.camposPendientes;
    if (error.revisionActual !== undefined) cuerpo.revisionActual = error.revisionActual;
    return res.status(error.status).json(cuerpo);
  }
  return res.status(503).json({ codigo: 'PROVEEDOR_NO_DISPONIBLE', mensaje: 'No fue posible completar la operación.' });
}

function parsear(body, modo) {
  if (modo === 'none') return {};
  if (!esObjeto(body)) throw errorSolicitud();
  if (modo === 'crear') {
    if (!tieneSolo(body, ['origen', 'evaluacionId', 'dias']) || !['IA', 'DeepSeek', 'manual'].includes(body.origen) || typeof body.evaluacionId !== 'string' || !body.evaluacionId.trim()) throw errorSolicitud();
    if (body.origen === 'manual' ? !Array.isArray(body.dias) : Object.hasOwn(body, 'dias')) throw errorSolicitud();
    return body;
  }
  if (modo === 'editar') {
    if (!tieneSolo(body, ['revisionEsperada', 'cambios']) || !Number.isInteger(body.revisionEsperada) || body.revisionEsperada < 1 || !esObjeto(body.cambios)) throw errorSolicitud();
    return body;
  }
  if (modo === 'aprobar') {
    if (!tieneSolo(body, ['revisionEsperada']) || !Number.isInteger(body.revisionEsperada) || body.revisionEsperada < 1) throw errorSolicitud();
    return body;
  }
  if (modo === 'reorganizar') {
    if (!tieneSolo(body, ['motivo', 'disponibilidad', 'ausencia', 'disponibilidadRegreso']) || typeof body.motivo !== 'string' || !body.motivo.trim()) throw errorSolicitud();
    if (body.disponibilidad !== undefined && !Array.isArray(body.disponibilidad)) throw errorSolicitud();
    if (body.disponibilidadRegreso !== undefined && !Array.isArray(body.disponibilidadRegreso)) throw errorSolicitud();
    if (body.ausencia !== undefined && typeof body.ausencia !== 'boolean') throw errorSolicitud();
    return body;
  }
  return body;
}

/** Router aislado: solo resuelve actor y parsea JSON para sus seis endpoints. */
export function crearRouterPlanificacion({ servicio, resolverActor }) {
  if (!servicio || typeof resolverActor !== 'function') throw new TypeError('servicio y resolverActor son obligatorios.');
  const router = express.Router();
  const json = express.json({ limit: '64kb', strict: true });

  function endpoint(modo, operacion, status = 200) {
    return [async (req, res, next) => {
      try {
        const actor = await resolverActor(req);
        if (!actor || typeof actor.usuarioId !== 'string' || !actor.usuarioId || typeof actor.gimnasioId !== 'string' || !actor.gimnasioId || !['entrenador', 'atleta'].includes(actor.rol)) {
          throw new ErrorPlanificacion({ status: 401, codigo: 'NO_AUTENTICADO', mensaje: 'Se requiere una identidad autenticada.' });
        }
        req.planificacionActor = actor;
        return next();
      } catch (error) { return respuestaError(res, error); }
    }, ...(modo === 'none' ? [] : [(req, res, next) => json(req, res, (error) => {
      if (!error) return next();
      return res.status(422).json({ codigo: 'SOLICITUD_INVALIDA', mensaje: error.type === 'entity.too.large' ? 'El cuerpo excede el límite permitido.' : 'El cuerpo JSON no es válido.' });
    })]), async (req, res) => {
      try {
        const actor = req.planificacionActor;
        const body = parsear(req.body, modo);
        const resultado = await operacion({ req, actor, body });
        return res.status(status).json(resultado);
      } catch (error) { return respuestaError(res, error); }
    }];
  }

  router.post('/atletas/:atletaId/planes', ...endpoint('crear', ({ req, actor, body }) => body.origen === 'manual'
    ? servicio.crearBorradorManual(actor, { atletaId: req.params.atletaId, evaluacionId: body.evaluacionId, dias: body.dias })
    : servicio.generarBorrador(actor, { atletaId: req.params.atletaId, evaluacionId: body.evaluacionId }), 201));
  router.get('/planes/:versionId', ...endpoint('none', ({ req, actor }) => servicio.obtenerPlan(actor, { versionId: req.params.versionId })));
  router.patch('/planes/:versionId', ...endpoint('editar', ({ req, actor, body }) => servicio.editarBorrador(actor, { versionId: req.params.versionId, revisionEsperada: body.revisionEsperada, cambios: body.cambios })));
  router.post('/planes/:versionId/aprobacion', ...endpoint('aprobar', ({ req, actor, body }) => servicio.aprobarBorrador(actor, { versionId: req.params.versionId, revisionEsperada: body.revisionEsperada })));
  router.post('/planes/:versionId/reorganizaciones', ...endpoint('reorganizar', ({ req, actor, body }) => servicio.reorganizarBorrador(actor, { versionId: req.params.versionId, ...body }), 201));
  router.get('/me/rutina', ...endpoint('none', ({ req, actor }) => servicio.obtenerRutina(actor, { fecha: req.query.fecha })));
  return router;
}
