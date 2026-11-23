import express from 'express';
import {
  resolverActorDesdeToken,
  tieneAsignacion,
} from '../adapters/identidadSupabase.js';
import { crearRepositorioOperacionSupabase } from '../adapters/repositorioOperacionSupabase.js';

function errorHttp(status, codigo, mensaje) {
  const err = new Error(mensaje);
  err.status = status;
  err.codigo = codigo;
  return err;
}

async function autenticar(req) {
  const authHeader = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match ? match[1].trim() : null;

  try {
    return await resolverActorDesdeToken(token);
  } catch (err) {
    throw errorHttp(401, 'NO_AUTENTICADO', err?.message || 'No autenticado');
  }
}

function exigirEntrenador(actor) {
  if (actor.rol !== 'entrenador') {
    throw errorHttp(403, 'SIN_PERMISO', 'Esta operación es exclusiva para entrenadores');
  }
}

async function exigirAccesoAtleta(actor, atletaId) {
  if (actor.rol === 'atleta') {
    if (actor.usuarioId !== atletaId) {
      throw errorHttp(403, 'SIN_PERMISO', 'No puedes consultar o modificar datos de otro atleta');
    }
    return;
  }

  if (actor.rol === 'entrenador') {
    const asignado = await tieneAsignacion({
      gimnasioId: actor.gimnasioId,
      entrenadorId: actor.usuarioId,
      atletaId,
    });
    if (!asignado) {
      throw errorHttp(403, 'SIN_PERMISO', 'El atleta no está asignado a este entrenador');
    }
    return;
  }

  throw errorHttp(403, 'SIN_PERMISO', 'Rol sin permisos para esta operación');
}

export function crearRouterOperacion() {
  const router = express.Router();
  const repo = crearRepositorioOperacionSupabase();

  // Perfil y rol real resuelto en servidor desde JWT + miembros
  router.get('/auth/me', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      const perfil = await repo.obtenerPerfilActor(actor.usuarioId);
      res.status(200).json(perfil);
    } catch (err) {
      next(err);
    }
  });

  // Clientes asignados activos del entrenador autenticado
  router.get('/entrenador/clientes', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      exigirEntrenador(actor);
      const clientes = await repo.listarClientesAsignados({
        gimnasioId: actor.gimnasioId,
        entrenadorId: actor.usuarioId,
      });
      res.status(200).json({ clientes });
    } catch (err) {
      next(err);
    }
  });

  // Evaluaciones y mediciones
  router.get('/atletas/:atletaId/evaluaciones', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      const { atletaId } = req.params;
      await exigirAccesoAtleta(actor, atletaId);

      const evaluaciones = await repo.listarEvaluaciones({
        gimnasioId: actor.gimnasioId,
        atletaId,
        incluirPrivadas: actor.rol === 'entrenador',
      });
      res.status(200).json({ evaluaciones });
    } catch (err) {
      next(err);
    }
  });

  router.post('/atletas/:atletaId/evaluaciones', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      exigirEntrenador(actor);
      const { atletaId } = req.params;
      await exigirAccesoAtleta(actor, atletaId);

      if (!req.body?.modalidad || !req.body?.objetivo) {
        throw errorHttp(422, 'SOLICITUD_INVALIDA', 'modalidad y objetivo son obligatorios');
      }

      const evaluacion = await repo.crearEvaluacion({
        gimnasioId: actor.gimnasioId,
        atletaId,
        autorId: actor.usuarioId,
        payload: req.body,
      });
      res.status(201).json(evaluacion);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/evaluaciones/:evaluacionId', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      exigirEntrenador(actor);
      const { evaluacionId } = req.params;

      const actual = await repo.obtenerEvaluacionPorId({
        gimnasioId: actor.gimnasioId,
        evaluacionId,
        incluirPrivadas: true,
      });
      await exigirAccesoAtleta(actor, actual.atletaId);

      const actualizada = await repo.actualizarEvaluacion({
        gimnasioId: actor.gimnasioId,
        evaluacionId,
        cambios: req.body || {},
      });
      res.status(200).json(actualizada);
    } catch (err) {
      next(err);
    }
  });

  router.post('/evaluaciones/:evaluacionId/mediciones', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      exigirEntrenador(actor);
      const { evaluacionId } = req.params;

      const actual = await repo.obtenerEvaluacionPorId({
        gimnasioId: actor.gimnasioId,
        evaluacionId,
        incluirPrivadas: true,
      });
      await exigirAccesoAtleta(actor, actual.atletaId);

      const lista = Array.isArray(req.body?.mediciones)
        ? req.body.mediciones
        : req.body?.variable
          ? [req.body]
          : null;

      if (!lista || lista.length === 0) {
        throw errorHttp(422, 'SOLICITUD_INVALIDA', 'Se requiere al menos una medición');
      }

      const mediciones = await repo.registrarMediciones({
        evaluacionId,
        mediciones: lista,
      });
      res.status(201).json({ mediciones });
    } catch (err) {
      next(err);
    }
  });

  // Sesiones y series
  router.post('/sesiones', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      if (actor.rol !== 'atleta') {
        throw errorHttp(403, 'SIN_PERMISO', 'Solo el atleta puede iniciar su sesión de entrenamiento');
      }

      const { versionId, diaId, itemActivoId, estacionActual } = req.body || {};
      if (!versionId || !diaId) {
        throw errorHttp(422, 'SOLICITUD_INVALIDA', 'versionId y diaId son obligatorios');
      }

      const sesion = await repo.iniciarSesion({
        gimnasioId: actor.gimnasioId,
        atletaId: actor.usuarioId,
        versionId,
        diaId,
        itemActivoId,
        estacionActual,
      });
      res.status(201).json(sesion);
    } catch (err) {
      next(err);
    }
  });

  router.get('/atletas/:atletaId/sesiones', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      const { atletaId } = req.params;
      await exigirAccesoAtleta(actor, atletaId);

      const sesiones = await repo.listarSesionesAtleta({
        gimnasioId: actor.gimnasioId,
        atletaId,
      });
      res.status(200).json({ sesiones });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/sesiones/:sesionId', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      const { sesionId } = req.params;

      const sesion = await repo.obtenerSesionPorId({
        gimnasioId: actor.gimnasioId,
        sesionId,
      });
      await exigirAccesoAtleta(actor, sesion.atletaId);

      const actualizada = await repo.actualizarSesion({
        gimnasioId: actor.gimnasioId,
        sesionId,
        cambios: req.body || {},
      });
      res.status(200).json(actualizada);
    } catch (err) {
      next(err);
    }
  });

  // Asistencias
  router.post('/asistencias', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      if (actor.rol !== 'atleta') {
        throw errorHttp(403, 'SIN_PERMISO', 'Solo el atleta puede solicitar asistencia');
      }

      const { sesionId, ejercicioCapturado, estacionCapturada } = req.body || {};
      if (!sesionId) {
        throw errorHttp(422, 'SOLICITUD_INVALIDA', 'sesionId es obligatorio');
      }

      const sesion = await repo.obtenerSesionPorId({
        gimnasioId: actor.gimnasioId,
        sesionId,
      });
      if (sesion.atletaId !== actor.usuarioId) {
        throw errorHttp(403, 'SIN_PERMISO', 'La sesión no pertenece al atleta autenticado');
      }

      const asistencia = await repo.crearAsistencia({
        gimnasioId: actor.gimnasioId,
        atletaId: actor.usuarioId,
        sesionId,
        ejercicioCapturado,
        estacionCapturada,
      });
      res.status(201).json(asistencia);
    } catch (err) {
      next(err);
    }
  });

  router.get('/entrenador/asistencias', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      exigirEntrenador(actor);

      const asistencias = await repo.listarAsistenciasEntrenador({
        gimnasioId: actor.gimnasioId,
        entrenadorId: actor.usuarioId,
      });
      res.status(200).json({ asistencias });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/asistencias/:asistenciaId', async (req, res, next) => {
    try {
      const actor = await autenticar(req);
      exigirEntrenador(actor);

      const { estado } = req.body || {};
      if (!['pendiente', 'atendida'].includes(estado)) {
        throw errorHttp(422, 'SOLICITUD_INVALIDA', 'estado debe ser pendiente o atendida');
      }

      const asistencia = await repo.actualizarAsistencia({
        gimnasioId: actor.gimnasioId,
        asistenciaId: req.params.asistenciaId,
        entrenadorId: actor.usuarioId,
        estado,
      });
      res.status(200).json(asistencia);
    } catch (err) {
      next(err);
    }
  });

  return router;
}