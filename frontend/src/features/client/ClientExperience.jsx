import { useEffect, useMemo, useState } from 'react';
import { DEMO_CLIENT, SIMULATED_MONDAY_FOCUS } from '../../mocks/demoData.js';
import { DEMO_CLIENT_PROFILE_DETAILS } from '../../mocks/demoClientProfileDetails.js';
import { DEMO_ARM_SESSION } from '../../mocks/demoArmSession.js';
import { planService } from '../../services/planService.js';
import SessionDemo from './SessionDemo.jsx';
import WarmupExperience from './WarmupExperience.jsx';
import './client.css';

const WEEK = [
  { iso: 1, name: 'Lunes', short: 'Lun' }, { iso: 2, name: 'Martes', short: 'Mar' },
  { iso: 3, name: 'Miércoles', short: 'Mié' }, { iso: 4, name: 'Jueves', short: 'Jue' },
  { iso: 5, name: 'Viernes', short: 'Vie' }, { iso: 6, name: 'Sábado', short: 'Sáb' },
  { iso: 7, name: 'Domingo', short: 'Dom' },
];

function mondayOf(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

export default function ClientExperience({ clientProfile = DEMO_CLIENT, approvedDays, approvedVersion, setNotice, onRequestHelp }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState('home');
  const [page, setPage] = useState('tabs');
  const [routineResult, setRoutineResult] = useState(null);
  const [warmupCompletedDates, setWarmupCompletedDates] = useState({});
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [helpConfirmation, setHelpConfirmation] = useState('');
  const [reportChatOpen, setReportChatOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('Comentario para la empresa');
  const [reportDraft, setReportDraft] = useState('');
  const [demoReports, setDemoReports] = useState([]);
  const liveApiConfigured = import.meta.env.VITE_API_MODE === 'live' && Boolean(import.meta.env.VITE_API_BASE_URL);
  const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  useEffect(() => {
    let current = true;
    planService.getClientRoutine(dateKey, approvedDays, approvedVersion)
      .then(response => { if (current) setRoutineResult({ dateKey, response }); })
      .catch(error => { if (current) setRoutineResult({ dateKey, error }); });
    return () => { current = false; };
  }, [dateKey, approvedDays, approvedVersion]);
  const start = mondayOf(today);
  const days = useMemo(() => WEEK.map((day, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isToday = date.getTime() === today.getTime();
    return { ...day, date, isToday, selected: date.toDateString() === selectedDate.toDateString() };
  }), [selectedDate]);
  const selectedIso = days.find(day => day.selected)?.iso || 1;
  const currentRoutine = routineResult?.dateKey === dateKey ? routineResult : null;
  const stateFromApi = currentRoutine?.response?.estado;
  const isTrainingDay = stateFromApi ? stateFromApi === 'disponible' : (!liveApiConfigured && approvedDays.includes(selectedIso));
  const isRestDay = stateFromApi ? stateFromApi === 'sin_sesion_programada' : (!liveApiConfigured && !approvedDays.includes(selectedIso));
  const isPending = stateFromApi === 'sin_plan' || Boolean(currentRoutine?.error) || (!stateFromApi && liveApiConfigured);
  const isDemoMonday = !liveApiConfigured && clientProfile?.isDemo === true && selectedIso === 1 && isTrainingDay;
  const useDemoArmSession = isDemoMonday;
  const sessionRoutineItems = useDemoArmSession ? DEMO_ARM_SESSION : currentRoutine?.response?.dia?.items || [];
  const warmupCompletedForDay = Boolean(warmupCompletedDates[dateKey]);
  const selectedDay = days.find(day => day.selected) || days[0];
  const routineVersion = currentRoutine?.response?.plan?.versionId?.replace('DEMO-', '') || approvedVersion;
  const profileDetails = clientProfile?.id === DEMO_CLIENT_PROFILE_DETAILS.clientId
    ? DEMO_CLIENT_PROFILE_DETAILS
    : null;
  const dateLabel = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate);
  const niceDateLabel = dateLabel.charAt(0).toLocaleUpperCase('es') + dateLabel.slice(1);
  const workSummary = isPending
    ? { status: currentRoutine?.error ? 'No se pudo consultar el plan' : 'Consultando rutina', title: currentRoutine?.error ? 'Rutina pendiente de conexión' : 'Cargando tu plan', description: currentRoutine?.error ? 'La consulta no confirmó el estado del día. Revisa la conexión e inténtalo de nuevo.' : 'Estamos consultando el día seleccionado.' }
    : isDemoMonday
      ? { status: 'Demo · dato simulado', title: SIMULATED_MONDAY_FOCUS.title, description: SIMULATED_MONDAY_FOCUS.note }
      : isTrainingDay
        ? { status: 'Día de entrenamiento', title: 'Entrenamiento asignado', description: `La rutina aprobada ${currentRoutine?.response?.plan?.versionId?.replace('DEMO-', '') || approvedVersion} contempla entrenamiento este día. El detalle de los ejercicios está pendiente de registro.` }
        : { status: 'Día de descanso', title: selectedDay?.isToday ? 'Hoy toca descansar' : 'Día de descanso', description: `Según la rutina aprobada ${currentRoutine?.response?.plan?.versionId?.replace('DEMO-', '') || approvedVersion}, este día no hay entrenamiento programado.` };

  function submitHelpRequest() {
    const turnNumber = onRequestHelp?.() || 1;
    const confirmation = `Necesito ayuda. Estás en el turno de espera #${turnNumber}. En esta demostración, la entrenadora llegará en un momento. Aviso local; no se envió al servidor.`;
    setHelpConfirmation(confirmation);
    setNotice?.(confirmation);
  }

  function requestHelp() {
    setProfileMenuOpen(false);
    setReportChatOpen(false);
    submitHelpRequest();
  }

  function addDemoReport(event) {
    event.preventDefault();
    const message = reportDraft.trim();
    if (!message) return;
    setDemoReports(current => [...current, { id: `${Date.now()}-${current.length}`, category: reportCategory, message }]);
    setReportDraft('');
  }

  useEffect(() => {
    if (!profileMenuOpen && !reportChatOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        setReportChatOpen(false);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [profileMenuOpen, reportChatOpen]);

  if (page === 'warmup' || page === 'routine') {
    return <div className="client-app">
      <div hidden={page !== 'warmup'}>
        <WarmupExperience dateLabel={niceDateLabel} athleteName={clientProfile?.fullName} trainerName={clientProfile?.trainerName} routineVersion={routineVersion} isDemo={clientProfile?.isDemo || currentRoutine?.response?.demo} onBack={() => setPage('tabs')} onContinue={() => { setWarmupCompletedDates(current => ({ ...current, [dateKey]: true })); setPage('routine'); }} />
      </div>
      <section className="routine-experience" aria-labelledby="routineExperienceTitle" hidden={page !== 'routine'}>
        <header className="view-title">
          <button className="warmup-back" type="button" onClick={() => setPage('warmup')} aria-label="Volver al calentamiento">← Volver al calentamiento</button>
          <span className="eyebrow">{niceDateLabel} · Rutina {routineVersion}</span>
          <h1 id="routineExperienceTitle">Mi entrenamiento</h1>
          {(clientProfile?.fullName || clientProfile?.trainerName) && <p>{clientProfile?.fullName ? `Atleta: ${clientProfile.fullName}` : ''}{clientProfile?.fullName && clientProfile?.trainerName ? ' · ' : ''}{clientProfile?.trainerName ? `Entrenadora: ${clientProfile.trainerName}` : ''}</p>}
          <p>{useDemoArmSession ? 'Vista de demostraci\u00f3n: propuesta no aprobada, separada del plan vigente.' : 'Series y descansos seg\u00fan la rutina aprobada disponible.'}</p>
        </header>
        {currentRoutine?.error
          ? <section className="surface-card rest-card" role="status"><h2>Rutina pendiente de consulta</h2><p>No se pudo consultar la rutina aprobada para este día.</p></section>
          : currentRoutine?.response
            ? <SessionDemo routineItems={sessionRoutineItems} isDemo={Boolean(currentRoutine.response.demo) || useDemoArmSession} demoPreset={useDemoArmSession} setNotice={setNotice} onRequestHelp={submitHelpRequest} onRoutineComplete={() => { setTab('home'); setPage('tabs'); }} />
            : <section className="surface-card rest-card" role="status"><h2>Consultando rutina aprobada</h2><p>Espera la respuesta del plan para mostrar los ejercicios y sus descansos.</p></section>}
      </section>
    </div>;
  }

  function chooseDate(date) {
    setSelectedDate(date);
  }

  return <div className={`client-app ${tab === 'profile' ? 'client-app--profile' : ''}`}>
    <div className="client-page">
      {tab === 'home' && <>
        <header className="client-greeting"><span className="eyebrow">Tu proceso, con propósito</span><h1>Hola, Ana.</h1><p>Tu entrenadora: <strong>Eva</strong><span className="demo-pill">Caso de demostración</span></p></header>
        <section className="surface-card week-card" aria-labelledby="weekTitle">
          <div className="card-heading"><h2 id="weekTitle">Semana de entrenamiento</h2><span>{approvedVersion} · {approvedDays.length} días</span></div>
          <div className="week-strip" aria-label="Seleccionar día de la semana">
            {days.map(day => <button key={day.iso} type="button" className={`week-button ${day.selected ? 'is-selected' : ''} ${approvedDays.includes(day.iso) ? 'has-workout' : ''}`} aria-pressed={day.selected} onClick={() => chooseDate(day.date)}>
              <span>{day.short}</span><strong>{day.date.getDate()}</strong>{approvedDays.includes(day.iso) && <i aria-label="Día de entrenamiento" />}
            </button>)}
          </div>
          <div className="calendar-key"><span><i className="dot dot--terra" /> Entrenamiento</span><span><i className="dot" /> Descanso</span></div>
        </section>
        <section className="surface-card today-card" aria-live="polite">
          <div className="today-card__meta"><span className="eyebrow">Lo que toca {selectedDay.isToday ? 'hoy' : selectedDay.name.toLocaleLowerCase('es')}</span><span>{niceDateLabel}</span></div>
          <span className={`status-chip ${isPending ? '' : isTrainingDay ? 'status-chip--training' : 'status-chip--rest'}`}>{workSummary.status}</span>
          <h2>{workSummary.title}</h2>
          <p>{workSummary.description}</p>
          <button className="text-link" type="button" onClick={() => setTab('training')}>Ver detalle del día <span aria-hidden="true">→</span></button>
        </section>
        <blockquote className="motivation-quote">“La constancia también es progreso.”</blockquote>
      </>}

      {tab === 'training' && <>
        <div className="view-title"><span className="eyebrow">{niceDateLabel}</span><h1>Entrenamiento</h1><p>La información corresponde al día seleccionado en el calendario.</p></div>
        <section className="surface-card selected-day-card" aria-live="polite">
          <div className="card-heading"><h2>{isPending ? 'Rutina pendiente' : isTrainingDay && isDemoMonday ? 'Rutina de brazos · demo' : isTrainingDay ? 'Entrenamiento asignado' : 'Día de descanso'}</h2><span className="status-chip">{isTrainingDay ? `${currentRoutine?.response?.plan?.versionId?.replace('DEMO-', '') || approvedVersion} · aprobada` : isPending ? 'Pendiente' : 'Sin sesión'}</span></div>
          <p>{isPending
            ? workSummary.description
            : isTrainingDay && isDemoMonday
            ? SIMULATED_MONDAY_FOCUS.note
            : isTrainingDay
              ? `La rutina aprobada ${currentRoutine?.response?.plan?.versionId?.replace('DEMO-', '') || approvedVersion} indica entrenamiento este día. Los ejercicios específicos están pendientes de registro.`
              : `Este día está marcado como descanso en la rutina aprobada ${currentRoutine?.response?.plan?.versionId?.replace('DEMO-', '') || approvedVersion}.`}</p>
        </section>
        {isPending ? <section className="surface-card rest-card"><h2>Plan pendiente de consulta</h2><p>No mostramos una prescripción sin confirmación del plan.</p></section> : isTrainingDay ? <>
          <section className="surface-card warmup-card">
          <span className="eyebrow">Preparación</span><h2>Iniciemos con el calentamiento</h2>
          <p>Consulta únicamente el contenido que tu entrenadora haya asignado.</p>
          <div className="warmup-image-wrap"><img src="/authentic_high_end_professional_fitness_photography_in_a_modern_aesthetic.png" alt="Vista ilustrativa de una pareja realizando movilidad en el gimnasio" /><span>Vista previa · demostración</span></div>
          <p className="inline-note">No hay archivo de video ni guía real asignados.</p>
          <button className="button button--dark" type="button" onClick={() => setPage('warmup')}>Iniciar mi calentamiento <span aria-hidden="true">↗</span></button>
          <div className="routine-pending-note" role="status">
            <strong>Rutina del día</strong>
            <span>Las series y descansos aparecen abajo cuando están incluidos en la rutina aprobada.</span>
          </div>
          </section>
          {currentRoutine?.response && <SessionDemo key={dateKey} routineItems={sessionRoutineItems} isDemo={Boolean(currentRoutine.response.demo) || useDemoArmSession} demoPreset={useDemoArmSession} canStart={warmupCompletedForDay} setNotice={setNotice} onRequestHelp={submitHelpRequest} onRoutineComplete={() => setTab('home')} />}
        </> : <section className="surface-card rest-card"><span aria-hidden="true">✳</span><h2>Día de descanso</h2><p>No hay calentamiento ni sesión asignados para este día.</p></section>}
      </>}

      {tab === 'profile' && <>
        <div className="view-title profile-view-title"><span className="eyebrow">{clientProfile?.isDemo ? 'Caso de demostración' : 'Tu espacio personal'}</span><div className="profile-title-row"><h1>Mi perfil / Mi proceso</h1><div className="profile-menu-wrap"><button className="profile-more-button" type="button" aria-label="Más opciones del perfil" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(open => !open)}>•••</button>{profileMenuOpen && <div className="profile-more-menu" role="menu" aria-label="Ayuda y reportes"><button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setReportChatOpen(true); }}>Abrir chat de reportes</button><button type="button" role="menuitem" onClick={requestHelp}>Necesito ayuda</button><p>Solicitud de asistencia presencial</p></div>}</div></div><p>Información de solo lectura registrada por tu entrenadora.</p></div>
        <button className="profile-help-action" type="button" onClick={requestHelp}>Necesito ayuda</button>
        {helpConfirmation && <p className="profile-help-confirmation" role="status" aria-live="polite">{helpConfirmation}</p>}
        <section className="surface-card profile-card"><div className="avatar" aria-hidden="true">{clientProfile?.fullName?.trim()?.charAt(0) || '•'}</div><div><h2>{clientProfile?.fullName || 'Mi perfil'}</h2><p>{clientProfile?.isDemo ? 'Atleta · datos ficticios de demostración' : 'Atleta'}</p></div></section>
        <section className="surface-card profile-info"><div><span>Entrenadora asignada</span><strong>{clientProfile?.trainerName || 'Pendiente de asignación'}</strong></div><div><span>Objetivo de entrenamiento</span><strong>{profileDetails?.goal || 'Pendiente de registro'}</strong></div><div><span>Tiempo entrenando</span><strong>{profileDetails?.trainingDuration || 'Pendiente de registro'}</strong></div><div><span>Rutina vigente</span><strong>{approvedVersion} · {approvedDays.length} días por semana</strong></div><div><span>Días de entrenamiento</span><strong>{approvedDays.map(day => WEEK[day - 1].name).join(' y ')}</strong></div></section>
        <section className="surface-card profile-cycle" aria-labelledby="profileCycleTitle">
          <div className="profile-section-heading"><div><span className="eyebrow">Seguimiento</span><h2 id="profileCycleTitle">Progreso del ciclo</h2></div><span className="status-chip">{profileDetails?.cycleProgress || 'Pendiente de registro'}</span></div>
          <p>El avance se mostrará cuando tu entrenadora registre el ciclo y sus revisiones.</p>
          <div className="profile-cycle-track" aria-hidden="true"><span /></div>
        </section>
        <section className="profile-assessments" aria-labelledby="profileAssessmentsTitle">
          <div className="profile-section-heading profile-assessments-heading"><div><span className="eyebrow">Registro de tu entrenadora</span><h2 id="profileAssessmentsTitle">Evaluaciones y medidas</h2></div><span className="profile-readonly-note">Solo lectura</span></div>
          <p className="profile-section-intro">Cada dato conserva su historial. Las mediciones anteriores aparecerán aquí cuando estén registradas.</p>
          <div className="profile-assessment-grid">
            {(profileDetails?.assessments || [
              { id: 'mobility', title: 'Flexibilidad y movilidad', records: [] },
              { id: 'stability', title: 'Estabilidad y fuerza base', records: [] },
              { id: 'proportions', title: 'Proporciones y longitudes corporales', records: [] },
              { id: 'neck', title: 'Características del cuello', records: [] },
              { id: 'body-composition', title: 'Composición corporal e InBody', records: [] },
            ]).map(assessment => <article className="surface-card profile-assessment-card" key={assessment.id}>
              <h3>{assessment.title}</h3>
              {assessment.records?.length ? <ol className="profile-record-list">{assessment.records.map((record, index) => <li key={`${assessment.id}-${record.date || index}`}>
                <strong>{record.value ?? 'Pendiente de medición'}{record.unit ? ` ${record.unit}` : ''}</strong>
                <span>Fecha: {record.date || 'Pendiente de registro'}</span>
                <span>Origen: {record.source || 'Pendiente de registro'}</span>
              </li>)}</ol> : <div className="profile-pending-measurement"><strong>Pendiente de medición</strong><span>Valor, unidad, fecha y origen aparecerán al registrarse.</span></div>}
            </article>)}
          </div>
          <p className="profile-history-note">Historial de mediciones: pendiente de registro.</p>
        </section>
        <section className="surface-card week-card" aria-labelledby="profileWeekTitle">
          <div className="card-heading"><h2 id="profileWeekTitle">Semana de entrenamiento</h2><span>{approvedVersion} · {approvedDays.length} días</span></div>
          <div className="week-strip" aria-label="Seleccionar día de la semana">
            {days.map(day => <button key={day.iso} type="button" className={`week-button ${day.selected ? 'is-selected' : ''} ${approvedDays.includes(day.iso) ? 'has-workout' : ''}`} aria-pressed={day.selected} onClick={() => chooseDate(day.date)}>
              <span>{day.short}</span><strong>{day.date.getDate()}</strong>{approvedDays.includes(day.iso) && <i aria-label="Día de entrenamiento" />}
            </button>)}
          </div>
          {isTrainingDay && <div className="profile-warmup-entry">
            <span className="status-chip status-chip--training">Día de entrenamiento · {niceDateLabel}</span>
            <h2>Iniciemos con el calentamiento</h2>
            <p>El calentamiento asignado aparecerá cuando esté disponible en la rutina aprobada.</p>
            <button className="button button--dark" type="button" onClick={() => setPage('warmup')}>Iniciar mi calentamiento <span aria-hidden="true">↗</span></button>
          </div>}
          {isRestDay && <p className="profile-rest-note">Día de descanso · no hay calentamiento ni sesión asignados para este día.</p>}
          {isPending && <p className="profile-rest-note">El estado del día está pendiente de confirmación del plan.</p>}
        </section>
        <p className="demo-notice">La información de esta vista es ficticia y solo sirve para revisar la interfaz.</p>
      </>}
    </div>
    {reportChatOpen && <div className="profile-chat-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setReportChatOpen(false); }}>
      <section className="profile-chat-dialog" role="dialog" aria-modal="true" aria-labelledby="profileChatTitle">
        <div className="profile-chat-heading"><div><span className="eyebrow">Ayuda y reportes</span><h2 id="profileChatTitle">Chat de reportes</h2></div><button className="profile-chat-close" type="button" aria-label="Cerrar chat" autoFocus onClick={() => setReportChatOpen(false)}>×</button></div>
        <p className="profile-chat-notice">Este chat es para reportes a la empresa; no contacta a la entrenadora. Demostración local: los mensajes no se envían ni guardan en el servidor.</p>
        <div className="profile-chat-messages" aria-live="polite">
          {demoReports.length === 0 ? <p className="profile-chat-empty">Aquí aparecerán los mensajes que agregues a esta demostración.</p> : demoReports.map(report => <article className="profile-chat-message" key={report.id}><span>{report.category} · borrador local</span><p>{report.message}</p><small>No enviado</small></article>)}
        </div>
        <form className="profile-chat-form" onSubmit={addDemoReport}>
          <label htmlFor="profileReportCategory">Tipo de reporte</label>
          <select id="profileReportCategory" value={reportCategory} onChange={event => setReportCategory(event.target.value)}><option>Comentario para la empresa</option><option>Reportar equipo en mal estado</option></select>
          <label htmlFor="profileReportMessage">Mensaje</label>
          <textarea id="profileReportMessage" rows="3" maxLength="500" value={reportDraft} onChange={event => setReportDraft(event.target.value)} placeholder="Escribe tu reporte" required />
          <button className="button button--dark" type="submit">Agregar al chat de demostración</button>
        </form>
        <button className="profile-chat-call" type="button" onClick={requestHelp}>Necesito ayuda<span>Solicitar asistencia presencial a {clientProfile?.trainerName || 'la entrenadora'}</span></button>
      </section>
    </div>}
    <nav className="bottom-nav" aria-label="Navegación principal del cliente">
      {[['home', '⌂', 'Inicio'], ['training', '↗', 'Entrenamiento'], ['profile', '◉', 'Mi perfil']].map(([key, icon, label]) => <button key={key} className={tab === key ? 'is-active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><span aria-hidden="true">{icon}</span>{label}</button>)}
    </nav>
  </div>;
}
