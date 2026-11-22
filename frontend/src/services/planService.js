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
  return body;
}

export const planService = {
  async getClientRoutine(date, approvedDays = [1, 4], approvedVersion = 'V1') {
    if (!useLiveApi) {
      const isoDay = new Date(`${date}T12:00:00`).getDay() || 7;
      const plan = {
        ...DEMO_APPROVED_PLAN,
        versionId: `DEMO-${approvedVersion}`,
        dias: approvedDays.map((diaSemana, index) => ({ diaId: `DEMO-D${index + 1}`, diaSemana, items: [] })),
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
  async getPlan(versionId) {
    if (!useLiveApi) throw new Error('La consulta de planes del servidor está desactivada en la demostración.');
    return request(`/planes/${encodeURIComponent(versionId)}`);
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
  async markAttended(requestId) {
    if (!useLiveApi) return { solicitudId: requestId, estado: 'atendida', demo: true };
    return request(`/asistencias/${encodeURIComponent(requestId)}/atencion`, { method: 'POST', body: '{}' });
  },
};
