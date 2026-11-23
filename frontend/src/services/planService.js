import { DEMO_APPROVED_PLAN, DEMO_REORGANIZATION } from '../mocks/demoData.js';

const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim());
const requestedApiMode = import.meta.env.VITE_API_MODE;
const apiMode = requestedApiMode === 'uuid-demo' ? 'uuid-demo' : hasSupabaseConfig ? 'live' : requestedApiMode || 'local';
const configuredApiBase = (apiMode === 'uuid-demo'
  ? import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  : import.meta.env.VITE_API_URL)?.trim() || '';
const evaDemoToken = import.meta.env.VITE_UUID_DEMO_EVA_TOKEN?.trim() || '';
const anaDemoToken = import.meta.env.VITE_UUID_DEMO_ANA_TOKEN?.trim() || '';
let accessTokenProvider = null;
let unauthorizedHandler = null;

function getApiBase() {
  if (!configuredApiBase) return '';
  try {
    const url = new URL(configuredApiBase);
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = path.endsWith('/api/v1') ? path : `${path}/api/v1`;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isUuidDemoAvailable() {
  if (!import.meta.env.DEV || apiMode !== 'uuid-demo' || !evaDemoToken || !anaDemoToken || !getApiBase()) return false;
  if (typeof window === 'undefined' || !isLoopback(window.location.hostname)) return false;
  try {
    const api = new URL(getApiBase());
    return isLoopback(api.hostname) && api.port === '3001' && api.pathname === '/api/v1';
  } catch {
    return false;
  }
}

const useLiveApi = apiMode === 'live';
const useUuidApi = apiMode === 'uuid-demo';
const apiEnabled = useLiveApi || (useUuidApi && isUuidDemoAvailable());

function apiErrorMessage(status) {
  const messages = {
    401: 'La sesión no está autenticada o expiró. Inicia sesión de nuevo.',
    403: 'No tienes permisos para realizar esta operación.',
    404: 'No se encontró el recurso solicitado.',
    409: 'El recurso cambió desde la última consulta. Actualiza la información e inténtalo de nuevo.',
    422: 'Faltan datos o hay campos que requieren corrección.',
    503: 'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.',
  };
  return messages[status] || 'No se pudo completar la operación. Inténtalo de nuevo.';
}

function tokenFor(actor) {
  if (!useUuidApi) return '';
  if (!isUuidDemoAvailable()) {
    throw new Error('La demo UUID solo está disponible en desarrollo local, con API de loopback y tokens de demostración configurados.');
  }
  if (actor === 'eva') return evaDemoToken;
  if (actor === 'ana') return anaDemoToken;
  throw new Error('Actor de demostración no reconocido.');
}

async function request(path, options = {}, { actor = 'eva', accessToken } = {}) {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error(useUuidApi
      ? 'Configura VITE_API_BASE_URL para la demo UUID local.'
      : 'Configura VITE_API_URL con la base documentada de la API.');
  }

  const demoToken = useUuidApi ? tokenFor(actor) : '';
  let sessionAccessToken = accessToken;
  if (useLiveApi && !sessionAccessToken && accessTokenProvider) {
    try {
      sessionAccessToken = await accessTokenProvider(actor);
    } catch {
      throw new Error('No se pudo consultar la sesión activa. Vuelve a iniciar sesión e inténtalo de nuevo.');
    }
  }
  if (useLiveApi && (typeof sessionAccessToken !== 'string' || !sessionAccessToken.trim())) {
    throw new Error('No se puede consultar la API real: falta la sesión verificada de Supabase y su access_token.');
  }
  if (!useLiveApi && !useUuidApi) {
    throw new Error('La API está desactivada. Selecciona el modo live o la demo UUID local.');
  }

  const token = useLiveApi ? sessionAccessToken.trim() : demoToken;
  const headers = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: 'omit',
    });
  } catch (cause) {
    throw Object.assign(new Error('No se pudo conectar con la API. Comprueba el servidor local e inténtalo de nuevo.'), { cause });
  }

  const text = await response.text();
  let body = {};
  if (text) {
    try { body = JSON.parse(text); }
    catch {
      if (response.ok) throw new Error('La API respondió con un formato inesperado.');
      body = {};
    }
  }
  if (!response.ok) {
    const allowedErrorCodes = new Set(['NO_AUTENTICADO', 'SIN_PERMISO', 'NO_ENCONTRADO', 'REVISION_CONFLICTIVA', 'SOLICITUD_INVALIDA', 'PROVEEDOR_NO_DISPONIBLE']);
    const safeBody = body && typeof body === 'object' && !Array.isArray(body)
      ? {
          ...(allowedErrorCodes.has(body.codigo) ? { codigo: body.codigo } : {}),
          ...(Array.isArray(body.camposPendientes) ? { camposPendientes: body.camposPendientes } : {}),
          ...(Number.isInteger(body.revisionActual) ? { revisionActual: body.revisionActual } : {}),
        }
      : {};
    if (response.status === 401 && useLiveApi && unauthorizedHandler) {
      Promise.resolve().then(() => unauthorizedHandler()).catch(() => {});
    }
    throw Object.assign(new Error(apiErrorMessage(response.status)), {
      status: response.status,
      ...safeBody,
    });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('La API respondió con datos inesperados. Inténtalo de nuevo.');
  }
  return body;
}

const json = value => JSON.stringify(value);
const id = value => encodeURIComponent(value);
const liveOrDemo = (livePath, demoPath = livePath) => useUuidApi ? demoPath : livePath;

export const planService = {
  isApiEnabled() { return apiEnabled; },
  isUuidDemoAvailable,
  getApiMode() { return apiMode; },
  setAccessTokenProvider(provider) {
    if (provider !== null && typeof provider !== 'function') {
      throw new TypeError('El proveedor de access_token debe ser una función o null.');
    }
    accessTokenProvider = provider;
  },
  setUnauthorizedHandler(handler) {
    if (handler !== null && typeof handler !== 'function') {
      throw new TypeError('El manejador de sesión expirada debe ser una función o null.');
    }
    unauthorizedHandler = handler;
  },

  async getIdentity(accessToken) {
    return request('/auth/me', {}, { actor: 'eva', accessToken });
  },

  async getAssignedClients(accessToken) {
    return request('/entrenador/clientes', {}, { actor: 'eva', accessToken });
  },

  async getEvaluations(atletaId, accessToken) {
    return request(`/atletas/${id(atletaId)}/evaluaciones`, {}, { actor: 'eva', accessToken });
  },

  async createEvaluation(atletaId, evaluation, accessToken) {
    return request(`/atletas/${id(atletaId)}/evaluaciones`, {
      method: 'POST', body: json(evaluation),
    }, { actor: 'eva', accessToken });
  },

  async updateEvaluation(evaluacionId, changes, accessToken) {
    return request(`/evaluaciones/${id(evaluacionId)}`, {
      method: 'PATCH', body: json(changes),
    }, { actor: 'eva', accessToken });
  },

  async addMeasurements(evaluacionId, measurement, accessToken) {
    return request(`/evaluaciones/${id(evaluacionId)}/mediciones`, {
      method: 'POST', body: json(measurement),
    }, { actor: 'eva', accessToken });
  },

  async createSession(session, accessToken) {
    return request('/sesiones', { method: 'POST', body: json(session) }, { actor: 'ana', accessToken });
  },

  async getSessions(atletaId, accessToken) {
    return request(`/atletas/${id(atletaId)}/sesiones`, {}, { actor: 'eva', accessToken });
  },

  async updateSession(sesionId, changes, accessToken) {
    return request(`/sesiones/${id(sesionId)}`, {
      method: 'PATCH', body: json(changes),
    }, { actor: 'ana', accessToken });
  },

  async requestAssistance(assistance, accessToken) {
    return request('/asistencias', { method: 'POST', body: json(assistance) }, { actor: 'ana', accessToken });
  },

  async getAssistanceQueue(accessToken) {
    return request('/entrenador/asistencias', {}, { actor: 'eva', accessToken });
  },

  async updateAssistance(asistenciaId, estado, accessToken) {
    return request(`/asistencias/${id(asistenciaId)}`, {
      method: 'PATCH', body: json({ estado }),
    }, { actor: 'eva', accessToken });
  },

  async getClientRoutine(date, approvedDays = [1, 4], approvedVersion = 'V1', approvedRoutineDays = null, accessToken) {
    if (apiEnabled) {
      const result = await request(`/me/rutina?fecha=${encodeURIComponent(date)}`, {}, { actor: 'ana', accessToken });
      if (!['sin_plan', 'sin_sesion_programada', 'disponible'].includes(result.estado)) {
        throw new Error('La API devolvió un estado de rutina inesperado. No se mostrará contenido sin confirmar.');
      }
      if (result.estado === 'disponible' && (!result.dia || !Array.isArray(result.dia.items))) {
        throw new Error('La API indicó una rutina disponible, pero faltan los datos de sesión esperados.');
      }
      return result;
    }

    const isoDay = new Date(`${date}T12:00:00`).getDay() || 7;
    const plan = {
      ...DEMO_APPROVED_PLAN,
      versionId: `DEMO-${approvedVersion}`,
      dias: approvedRoutineDays || approvedDays.map((diaSemana, index) => ({ diaId: `DEMO-D${index + 1}`, diaSemana, items: [] })),
    };
    const day = plan.dias.find(item => item.diaSemana === isoDay);
    return day
      ? { estado: 'disponible', plan, dia: day, demo: true }
      : { estado: 'sin_sesion_programada', plan, demo: true };
  },

  async createDemoReorganization() {
    if (!apiEnabled) return structuredClone(DEMO_REORGANIZATION);
    throw new Error('La generación de reorganizaciones requiere la evaluación y autorización del entrenador.');
  },

  async createManualDraft(atletaId, evaluacionId, dias, accessToken) {
    if (!apiEnabled) throw new Error('La creación por API no está disponible en la demostración local.');
    const path = liveOrDemo('/planes', `/atletas/${id(atletaId)}/planes`);
    const body = useUuidApi ? { origen: 'manual', evaluacionId, dias } : { origen: 'manual', evaluacionId, dias };
    return request(path, { method: 'POST', body: json(body) }, { actor: 'eva', accessToken });
  },

  async createAiDraft(atletaId, evaluacionId, accessToken) {
    if (!apiEnabled) throw new Error('La creación por API no está disponible en la demostración local.');
    const path = liveOrDemo('/planes', `/atletas/${id(atletaId)}/planes`);
    const body = useUuidApi ? { origen: 'IA', evaluacionId } : { origen: 'IA', evaluacionId };
    return request(path, { method: 'POST', body: json(body) }, { actor: 'eva', accessToken });
  },

  async getPlan(versionId, accessToken) {
    if (!apiEnabled) throw new Error('La consulta de planes por API no está habilitada en modo local.');
    return request(`/planes/${id(versionId)}`, {}, { actor: 'eva', accessToken });
  },

  async updateDraft(versionId, revisionEsperada, cambios, accessToken) {
    if (!apiEnabled) throw new Error('La edición por API no está disponible en la demostración local.');
    return request(`/planes/${id(versionId)}`, {
      method: 'PATCH', body: json({ revisionEsperada, cambios }),
    }, { actor: 'eva', accessToken });
  },

  async reorganizeDraft(versionId, payload, accessToken) {
    if (!apiEnabled) throw new Error('La reorganización por API no está disponible en la demostración local.');
    const { motivo, disponibilidad, ausencia, disponibilidadRegreso } = payload || {};
    const body = { motivo, disponibilidad, ausencia, disponibilidadRegreso };
    const path = liveOrDemo(`/planes/${id(versionId)}/reorganizar`, `/planes/${id(versionId)}/reorganizaciones`);
    return request(path, { method: 'POST', body: json(body) }, { actor: 'eva', accessToken });
  },

  async approvePlan(versionId, revisionEsperada, accessToken) {
    if (!apiEnabled) throw new Error('La aprobación por API no está disponible en la demostración local.');
    const path = liveOrDemo(`/planes/${id(versionId)}/aprobar`, `/planes/${id(versionId)}/aprobacion`);
    return request(path, { method: 'POST', body: json({ revisionEsperada }) }, { actor: 'eva', accessToken });
  },
};

export const attendanceService = {
  async markAttended(asistenciaId, accessToken) {
    if (apiEnabled) return planService.updateAssistance(asistenciaId, 'atendida', accessToken);
    throw new Error('La atención de solicitudes aún no está conectada en el modo local.');
  },

  async create(assistance, accessToken) {
    return planService.requestAssistance(assistance, accessToken);
  },

  async list(accessToken) {
    return planService.getAssistanceQueue(accessToken);
  },
};
