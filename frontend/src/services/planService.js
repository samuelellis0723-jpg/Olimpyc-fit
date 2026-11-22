import { DEMO_APPROVED_PLAN, DEMO_REORGANIZATION } from '../mocks/demoData.js';

const apiBase = import.meta.env.VITE_API_BASE_URL;
const useLiveApi = import.meta.env.VITE_API_MODE === 'live' && Boolean(apiBase);

async function request(path, options = {}) {
  if (!apiBase) throw new Error('La API no está configurada.');
  const response = await fetch(`${apiBase}/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.mensaje || 'No se pudo completar la operación.'), { status: response.status, body });
  // El módulo de planificación publica este encabezado en su servidor
  // aislado de demo (repo en memoria e identidades ficticias). No confundirlo
  // con una escritura persistida en la API compartida.
  const demoHeader = response.headers.get('X-Planificacion-Demo');
  return demoHeader ? { ...body, demo: true, demoMode: demoHeader } : body;
}

export const planService = {
  async getClientRoutine(date, approvedDays = [1, 4], approvedVersion = 'V1', approvedRoutineDays = null) {
    if (!useLiveApi) {
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
    }
    return request(`/me/rutina?fecha=${encodeURIComponent(date)}`);
  },
  async createDemoReorganization() {
    if (!apiBase) return structuredClone(DEMO_REORGANIZATION);
    throw new Error('La generación de reorganizaciones requiere la evaluación y autorización del entrenador.');
  },
  async createManualDraft(atletaId, evaluacionId, dias) {
    if (!useLiveApi) throw new Error('La creación por API no está disponible en la demostración local.');
    return request(`/atletas/${encodeURIComponent(atletaId)}/planes`, {
      method: 'POST',
      body: JSON.stringify({ origen: 'manual', evaluacionId, dias }),
    });
  },
  async getPlan(versionId) {
    if (!useLiveApi) throw new Error('La consulta de planes del servidor está desactivada en la demostración.');
    return request(`/planes/${encodeURIComponent(versionId)}`);
  },
  async updateDraft(versionId, revisionEsperada, cambios) {
    if (!useLiveApi) throw new Error('La edición por API no está disponible en la demostración local.');
    return request(`/planes/${encodeURIComponent(versionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ revisionEsperada, cambios }),
    });
  },
  async reorganizeDraft(versionId, { motivo, disponibilidad, ausencia, disponibilidadRegreso }) {
    if (!useLiveApi) throw new Error('La reorganización por API no está disponible en la demostración local.');
    return request(`/planes/${encodeURIComponent(versionId)}/reorganizaciones`, {
      method: 'POST',
      body: JSON.stringify({ motivo, ...(disponibilidad ? { disponibilidad } : {}), ...(ausencia !== undefined ? { ausencia } : {}), ...(disponibilidadRegreso ? { disponibilidadRegreso } : {}) }),
    });
  },
  async approvePlan(versionId, revisionEsperada) {
    if (!useLiveApi) throw new Error('La aprobación solo está simulada localmente en esta demostración.');
    return request(`/planes/${encodeURIComponent(versionId)}/aprobacion`, {
      method: 'POST',
      body: JSON.stringify({ revisionEsperada }),
    });
  },
};

export const attendanceService = {
  async markAttended() {
    // La ruta aparece en documentos generales, pero no está implementada en
    // el backend disponible. No enviar a una ruta propuesta ni fingir éxito.
    throw new Error('La atención de solicitudes aún no está conectada: falta el endpoint compartido de asistencias.');
  },
};
