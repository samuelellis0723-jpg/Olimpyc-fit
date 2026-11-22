import { useState } from 'react';
import './trainer.css';

export default function TrainerMobile({ queue, onAttend }) {
  const [permissionState, setPermissionState] = useState('Pendiente de configuración');
  const pending = queue.filter(item => item.estado === 'pendiente');
  return <main className="trainer-mobile-page">
    <header className="trainer-mobile-heading"><span className="eyebrow">Atención en sala · demostración</span><h1>Hola, Eva.</h1><p>Solicitudes ordenadas por llegada.</p></header>
    <section className="surface-card notification-card"><div><strong>Avisos en este dispositivo</strong><span>{permissionState}</span></div><button className="button button--outline" onClick={() => setPermissionState('Configuración pendiente de integración con Alex')}>Configurar</button><small>No se solicitó permiso ni se registró una suscripción push.</small></section>
    <div className="queue-heading"><div><span className="eyebrow">Tu cola</span><h2>Solicitudes pendientes</h2></div><span className="queue-count">{pending.length}</span></div>
    {pending.length ? <ol className="request-queue">{pending.map((request, index) => <li className="surface-card request-card" key={request.solicitudId}>
      <div className="request-order"><span>Turno</span><strong>{index + 1}</strong></div>
      <div className="request-body"><span className="pending-chip">Pendiente · demo</span><h3>{request.atleta} necesita asistencia</h3><dl><div><dt>Ejercicio</dt><dd>{request.ejercicio}</dd></div><div><dt>Estación</dt><dd>{request.estacion}</dd></div><div><dt>Recibida</dt><dd>{request.receivedAt} · hora de ejemplo</dd></div></dl><button className="button button--dark" onClick={() => onAttend(request.solicitudId)}>Marcar como atendida</button><p className="inline-note">Esta acción solo cambia el estado local de demostración.</p></div>
    </li>)}</ol> : <section className="surface-card queue-empty"><span aria-hidden="true">✓</span><h3>Sin solicitudes pendientes</h3><p>La cola está al día en esta demostración.</p></section>}
    {queue.some(item => item.estado === 'atendida') && <section className="surface-card attended-summary"><h3>Atendidas en esta demo</h3>{queue.filter(item => item.estado === 'atendida').map(item => <p key={item.solicitudId}>{item.atleta} · solicitud marcada localmente como atendida</p>)}</section>}
    <p className="demo-notice">Una solicitud no equivale a una llamada. La confirmación de recepción requiere conexión real con el servidor.</p>
  </main>;
}
