import { useEffect, useState } from 'react';
import { planService } from '../../services/planService.js';

const requiredFields = [
  'asistenciaId', 'sesionId', 'atletaId', 'atletaNombre', 'atletaAlias', 'entrenadorId',
  'ordenTurno', 'horaRecibidaUtc', 'estado', 'ejercicioCapturado', 'estacionCapturada',
  'horaAtencionUtc', 'codigoRef',
];

function assistanceList(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || !Array.isArray(response.asistencias)) {
    throw new Error('La API devolvió un formato inesperado. Se esperaba la lista "asistencias".');
  }
  const valid = response.asistencias.every(item => item && typeof item === 'object' && !Array.isArray(item)
    && requiredFields.every(field => field in item)
    && typeof item.asistenciaId === 'string' && item.asistenciaId.trim()
    && Number.isInteger(item.ordenTurno)
    && typeof item.horaRecibidaUtc === 'string' && !Number.isNaN(new Date(item.horaRecibidaUtc).getTime())
    && typeof item.estado === 'string');
  if (!valid) throw new Error('Una solicitud no contiene los campos válidos del contrato de asistencias.');
  return response.asistencias;
}

function formatReceivedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Hora no disponible';
  return `${new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`;
}

function statusError(error) {
  if (error?.status === 401) return 'La sesión Supabase expiró o no está autenticada. Vuelve a iniciar sesión.';
  if (error?.status === 403) return 'El servidor no autorizó el acceso a la cola de asistencias.';
  if (error?.status === 404) return 'No se encontró la solicitud. Actualiza la cola.';
  if (error?.status === 422) return 'El servidor rechazó la actualización de la solicitud.';
  return error?.message || 'No se pudo completar la operación.';
}

function displayValue(value) {
  return typeof value === 'string' && value.trim() ? value : 'Pendiente';
}

export default function TrainerLiveAssistanceQueue() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pendingId, setPendingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    planService.getAssistanceQueue().then(response => {
      const queue = assistanceList(response);
      if (active) {
        setRequests(queue);
        setStatus(queue.length ? 'ready' : 'empty');
      }
    }).catch(caught => {
      if (active) {
        setError(statusError(caught));
        setStatus('error');
      }
    });
    return () => { active = false; };
  }, [retry]);

  async function markAttended(asistenciaId) {
    if (pendingId) return;
    setPendingId(asistenciaId);
    setActionError('');
    setNotice('');
    try {
      await planService.updateAssistance(asistenciaId, 'atendida');
      setRequests(current => current.map(request => request.asistenciaId === asistenciaId
        ? { ...request, estado: 'atendida' }
        : request));
      setNotice('El servidor confirmó la solicitud como atendida.');
    } catch (caught) {
      setActionError(statusError(caught));
    } finally {
      setPendingId('');
    }
  }

  return <section className="trainer-live-queue" aria-labelledby="liveAssistanceTitle">
    <div className="trainer-subsection-heading"><div><span className="eyebrow">Solicitudes del servidor</span><h2 id="liveAssistanceTitle">Cola de asistencia</h2><p className="trainer-muted">Se conserva el orden entregado por la API.</p></div><button type="button" className="button button--outline" onClick={() => setRetry(value => value + 1)} disabled={status === 'loading' || Boolean(pendingId)}>{status === 'loading' ? 'Actualizando…' : 'Actualizar cola'}</button></div>
    {status === 'loading' && <div className="surface-card trainer-live-state" role="status" aria-live="polite"><h3>Cargando solicitudes</h3><p>Consultando GET /entrenador/asistencias.</p></div>}
    {status === 'error' && <div className="surface-card trainer-live-state trainer-live-state--error" role="alert"><h3>No se pudo cargar la cola</h3><p>{error}</p><button className="button button--dark" type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    {status === 'empty' && <div className="surface-card trainer-live-state" role="status"><h3>Sin solicitudes pendientes</h3><p>El servidor devolvió una cola vacía.</p></div>}
    {actionError && <p className="trainer-record-error" role="alert">{actionError}</p>}
    {notice && <p className="trainer-record-success" role="status" aria-live="polite">{notice}</p>}
    {status === 'ready' && <ol className="trainer-live-queue-list">{requests.map(request => {
      const attended = request.estado === 'atendida';
      return <li className="surface-card trainer-live-queue-card" key={request.asistenciaId}>
        <div>
          <span className="eyebrow">Turno {request.ordenTurno}</span>
          <h3>{displayValue(request.atletaNombre)}</h3>
          {request.atletaAlias && request.atletaAlias !== request.atletaNombre && <span className="trainer-live-alias">{request.atletaAlias}</span>}
          <dl className="trainer-live-assistance-details">
            <div><dt>Recibida</dt><dd>{formatReceivedAt(request.horaRecibidaUtc)}</dd></div>
            <div><dt>Ejercicio</dt><dd>{displayValue(request.ejercicioCapturado)}</dd></div>
            <div><dt>Estación</dt><dd>{displayValue(request.estacionCapturada)}</dd></div>
            <div><dt>Estado</dt><dd>{request.estado}</dd></div>
          </dl>
          {request.codigoRef && <code>{request.codigoRef}</code>}
          {attended && <strong className="trainer-live-attended">Atendida · confirmada</strong>}
        </div>
        <button className="button button--dark" type="button" onClick={() => markAttended(request.asistenciaId)} disabled={attended || Boolean(pendingId)}>{pendingId === request.asistenciaId ? 'Enviando…' : attended ? 'Atendida' : 'Marcar como atendida'}</button>
      </li>;
    })}</ol>}
  </section>;
}
