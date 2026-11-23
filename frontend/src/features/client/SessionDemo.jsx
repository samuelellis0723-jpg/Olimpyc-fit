import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_EXERCISES } from '../../mocks/demoData.js';
import { DEMO_ARM_SESSION } from '../../mocks/demoArmSession.js';
import { UUID_DEMO_EXERCISES } from '../../mocks/uuidPlanningDemo.js';
import AnatomyGuide from './anatomy/AnatomyGuide.jsx';

function normalizeRoutineItem(item) {
  const demoExercise = DEMO_EXERCISES.find(exercise => exercise.exerciseId === item.ejercicioId || exercise.code === item.ejercicioId);
  const armExercise = DEMO_ARM_SESSION.find(exercise => exercise.exerciseId === item.ejercicioId);
  const uuidExercise = UUID_DEMO_EXERCISES[item.ejercicioId];
  const validSeries = Number.isInteger(item.series) && item.series > 0;
  const validRest = Number.isInteger(item.descansoSegundos) && item.descansoSegundos >= 0;
  return {
    itemId: item.itemId,
    exerciseId: item.ejercicioId,
    capturedExercise: typeof item.nombre === 'string' ? item.nombre.trim() : '',
    code: item.demo ? 'DEMO' : demoExercise?.code || armExercise?.code || uuidExercise?.code || item.ejercicioId || '—',
    name: item.nombre || demoExercise?.name || armExercise?.name || uuidExercise?.name || (item.ejercicioId ? `Ejercicio ${item.ejercicioId}` : 'Ejercicio pendiente'),
    group: item.grupoMuscular || demoExercise?.group || armExercise?.group || 'Grupo muscular pendiente de asignación',
    equipment: item.equipo || armExercise?.equipment || null,
    order: Number.isInteger(item.orden) ? item.orden : 0,
    seriesCount: validSeries ? item.series : null,
    restSeconds: validRest ? item.descansoSegundos : null,
    target: item.objetivoPorSerie,
    explanation: item.explicacion,
    targetText: item.objetivoPorSerie ? `${item.objetivoPorSerie.cantidad} ${item.objetivoPorSerie.unidad}` : null,
    image: item.imagePreviewUrl || armExercise?.image || null,
    imageAlt: item.imageAlt || `Imagen de demostración: ${item.nombre || demoExercise?.name || armExercise?.name || 'ejercicio'}`,
    video: item.videoPreviewUrl || null,
    imageCaption: item.imagePreviewUrl ? 'Foto de ejercicio · vista previa demo' : null,
  };
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function formatServerTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC';
}

function validateFinalSession(response, sessionId, expectedState) {
  const missing = [];
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('PATCH /sesiones no devolvió el objeto de sesión esperado.');
  if (response.sesionId !== sessionId) missing.push('sesionId coincidente');
  if (response.estado !== expectedState) missing.push(`estado "${expectedState}"`);
  if (typeof response.finUtc !== 'string' || Number.isNaN(new Date(response.finUtc).getTime())) missing.push('finUtc válido');
  if (!Array.isArray(response.series)) missing.push('series');
  if (missing.length) throw new Error(`El servidor no confirmó el cierre: falta o no coincide ${missing.join(', ')}.`);
  return response;
}

function validateAssistanceResponse(response, sentRequest) {
  const fields = ['asistenciaId', 'codigoRef', 'sesionId', 'atletaId', 'atletaNombre', 'atletaAlias', 'entrenadorId', 'ordenTurno', 'horaRecibidaUtc', 'estado', 'ejercicioCapturado', 'estacionCapturada', 'horaAtencionUtc'];
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw Object.assign(new Error('POST /asistencias respondió con un formato inesperado.'), { ambiguousSuccess: true });
  }
  const missing = fields.filter(field => !(field in response));
  if (missing.length || typeof response.asistenciaId !== 'string' || !response.asistenciaId.trim()
    || response.sesionId !== sentRequest.sesionId || !Number.isInteger(response.ordenTurno)
    || typeof response.horaRecibidaUtc !== 'string' || Number.isNaN(new Date(response.horaRecibidaUtc).getTime())
    || typeof response.estado !== 'string' || response.ejercicioCapturado !== sentRequest.ejercicioCapturado
    || response.estacionCapturada !== sentRequest.estacionCapturada) {
    const details = missing.length ? `Faltan campos: ${missing.join(', ')}.` : 'Los campos de sesión, turno, hora, estado o contexto no coinciden con la solicitud.';
    throw Object.assign(new Error(`POST /asistencias respondió, pero no se pudo validar la confirmación. ${details} No se reenviará para evitar una solicitud duplicada.`), { ambiguousSuccess: true });
  }
  if (response.horaAtencionUtc !== null && (typeof response.horaAtencionUtc !== 'string' || Number.isNaN(new Date(response.horaAtencionUtc).getTime()))) {
    throw Object.assign(new Error('POST /asistencias respondió con horaAtencionUtc inválida. No se reenviará para evitar una solicitud duplicada.'), { ambiguousSuccess: true });
  }
  return response;
}

export default function SessionDemo({ routineItems = [], itemsLoading = false, isDemo = false, demoPreset = false, canStart = true, sessionStartContext = null, onStartSession, onUpdateSession, onFinalizeSession, onRequestAssistance, setNotice, onRequestHelp, onRoutineComplete }) {
  const orderedRoutineItems = useMemo(
    () => (demoPreset ? [...routineItems] : routineItems.map(normalizeRoutineItem)).sort((a, b) => a.order - b.order),
    [routineItems, demoPreset],
  );
  const [started, setStarted] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [order, setOrder] = useState(orderedRoutineItems);
  const [seriesDone, setSeriesDone] = useState({});
  const [restState, setRestState] = useState(null);
  const [activeExerciseId, setActiveExerciseId] = useState(null);
  const [activeExerciseStarted, setActiveExerciseStarted] = useState(null);
  const [activeExerciseSeconds, setActiveExerciseSeconds] = useState(0);
  const [exerciseTimes, setExerciseTimes] = useState({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finishedWithPending, setFinishedWithPending] = useState(false);
  const [station, setStation] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [startResponseInvalid, setStartResponseInvalid] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [seriesValues, setSeriesValues] = useState({});
  const [seriesError, setSeriesError] = useState('');
  const [savingSeries, setSavingSeries] = useState(false);
  const [updatingActive, setUpdatingActive] = useState(false);
  const [finalizationStatus, setFinalizationStatus] = useState('idle');
  const [finalizationError, setFinalizationError] = useState('');
  const [finalizationResponse, setFinalizationResponse] = useState(null);
  const [assistanceStatus, setAssistanceStatus] = useState('idle');
  const [assistanceError, setAssistanceError] = useState('');
  const [assistanceResponse, setAssistanceResponse] = useState(null);
  const recordedSeries = useRef(new Set());
  const startLock = useRef(false);
  const activeUpdateLock = useRef(false);
  const finishLock = useRef(false);
  const assistanceLock = useRef(false);
  const automaticFinishAttempted = useRef(false);
  const finalizationTimestamp = useRef('');
  const restDialogRef = useRef(null);
  const continueRestRef = useRef(null);

  useEffect(() => {
    if (!started || finished) return undefined;
    const timer = window.setInterval(() => setSessionSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [started, startedAt, finished]);

  useEffect(() => {
    if (!activeExerciseStarted) return undefined;
    const timer = window.setInterval(() => setActiveExerciseSeconds(Math.floor((Date.now() - activeExerciseStarted) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [activeExerciseStarted]);

  useEffect(() => {
    if (!restState || restState.phase !== 'running') return undefined;
    const { deadline } = restState;
    function refreshRemaining() {
      setRestState(current => {
        if (!current || current.phase !== 'running' || current.deadline !== deadline) return current;
        const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        return remainingSeconds === 0
          ? { ...current, phase: 'done', remainingSeconds: 0 }
          : { ...current, remainingSeconds };
      });
    }
    const timer = window.setInterval(refreshRemaining, 250);
    document.addEventListener('visibilitychange', refreshRemaining);
    window.addEventListener('focus', refreshRemaining);
    refreshRemaining();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshRemaining);
      window.removeEventListener('focus', refreshRemaining);
    };
  }, [restState?.phase, restState?.deadline]);

  useEffect(() => {
    if (restState?.phase === 'done') continueRestRef.current?.focus();
    else if (restState?.phase === 'running' || restState?.phase === 'paused') restDialogRef.current?.focus();
  }, [restState?.phase]);

  const activeItem = order.find(item => !item.seriesCount || (seriesDone[item.itemId]?.length || 0) < item.seriesCount);
  const allExercisesComplete = order.length > 0 && !activeItem;
  const pending = order.filter(item => !item.seriesCount || (seriesDone[item.itemId]?.length || 0) < item.seriesCount);
  const sessionTime = formatClock(sessionSeconds);
  const restingItem = restState?.itemId ? order.find(item => item.itemId === restState.itemId) : null;

  async function beginSession() {
    if (starting || startLock.current || startResponseInvalid || !canStart) return;
    setStartError('');
    if (onStartSession) {
      const firstItem = order[0];
      if (!sessionStartContext?.versionId || !sessionStartContext?.diaId || !firstItem?.itemId) {
        setStartError('Faltan identificadores reales de la rutina aprobada. No se inició la sesión.');
        return;
      }
      if (!station.trim()) {
        setStartError('Indica la estación actual para iniciar la sesión.');
        return;
      }
      startLock.current = true;
      setStarting(true);
      try {
        const response = await onStartSession({
          versionId: sessionStartContext.versionId,
          diaId: sessionStartContext.diaId,
          itemActivoId: firstItem.itemId,
          estacionActual: station.trim(),
        });
        if (typeof response?.sesionId !== 'string' || !response.sesionId.trim()) {
          setStartError('POST /sesiones respondió sin un sesionId válido. La sesión no se activó y no se reintentará para evitar crear otra sesión.');
          setStartResponseInvalid(true);
          setStarting(false);
          return;
        }
        setSessionId(response.sesionId);
      } catch (error) {
        setStartError(error?.message || 'No se pudo iniciar la sesión. Inténtalo de nuevo.');
        startLock.current = false;
        setStarting(false);
        return;
      }
      startLock.current = false;
      setStarting(false);
      setNotice?.('El servidor confirmó el inicio de sesión. El cierre también se confirmará mediante el servidor; el cronómetro por ejercicio permanece local.');
    } else {
      setNotice?.('Sesión iniciada en esta experiencia del frontend.');
    }
    setStartedAt(Date.now());
    setStarted(true);
  }

  async function finalizeSession(finalState) {
    if (finishLock.current) return;
    if (!onFinalizeSession) {
      setFinishedWithPending(finalState === 'parcial');
      setFinished(true);
      return;
    }
    if (!sessionId) {
      setFinalizationStatus('error');
      setFinalizationError('No se puede cerrar la sesión: POST /sesiones debe devolver un sesionId válido.');
      return;
    }
    finishLock.current = true;
    setFinalizationStatus('sending');
    setFinalizationError('');
    if (!finalizationTimestamp.current) finalizationTimestamp.current = new Date().toISOString();
    try {
      const response = await onFinalizeSession(sessionId, { estado: finalState, finUtc: finalizationTimestamp.current });
      const confirmed = validateFinalSession(response, sessionId, finalState);
      setFinalizationResponse(confirmed);
      setFinalizationStatus('confirmed');
      if (finalState === 'parcial') {
        setFinishedWithPending(true);
        setFinished(true);
      }
    } catch (error) {
      setFinalizationStatus('error');
      setFinalizationError(error?.message || 'No se confirmó el cierre de sesión. Puedes reintentar.');
    } finally {
      finishLock.current = false;
    }
  }

  async function requestAssistance() {
    if (onRequestAssistance) {
      if (assistanceLock.current || assistanceStatus === 'success' || assistanceStatus === 'invalid-response') return;
      if (!started || !sessionId) {
        setAssistanceStatus('error');
        setAssistanceError('Inicia una sesión confirmada antes de solicitar asistencia.');
        return;
      }
      if (!activeItem?.capturedExercise) {
        setAssistanceStatus('error');
        setAssistanceError('La rutina no incluye el nombre del ejercicio actual; no se envió la solicitud.');
        return;
      }
      if (!station.trim()) {
        setAssistanceStatus('error');
        setAssistanceError('Indica la estación actual antes de solicitar asistencia.');
        return;
      }
      assistanceLock.current = true;
      setAssistanceStatus('sending');
      setAssistanceError('');
      try {
        const sentRequest = { sesionId: sessionId, ejercicioCapturado: activeItem.capturedExercise, estacionCapturada: station.trim() };
        const response = await onRequestAssistance(sentRequest);
        const confirmed = validateAssistanceResponse(response, sentRequest);
        setAssistanceResponse(confirmed);
        setAssistanceStatus('success');
        setNotice?.(`Solicitud registrada. Turno ${confirmed.ordenTurno}; estado ${confirmed.estado}.`);
      } catch (error) {
        setAssistanceStatus(error?.ambiguousSuccess ? 'invalid-response' : 'error');
        setAssistanceError(error?.message || 'No se pudo enviar la solicitud de asistencia. Inténtalo de nuevo.');
      } finally {
        assistanceLock.current = false;
      }
      return;
    }
    onRequestHelp?.();
  }

  useEffect(() => {
    if (!allExercisesComplete || !onRoutineComplete) return undefined;
    if (onFinalizeSession) {
      if (!automaticFinishAttempted.current) {
        automaticFinishAttempted.current = true;
        void finalizeSession('completa');
      }
      return undefined;
    }
    const redirectTimer = window.setTimeout(() => onRoutineComplete(), 5000);
    return () => window.clearTimeout(redirectTimer);
  }, [allExercisesComplete, onFinalizeSession]);

  useEffect(() => {
    if (!allExercisesComplete || finalizationStatus !== 'confirmed' || !onFinalizeSession || !onRoutineComplete) return undefined;
    const redirectTimer = window.setTimeout(() => onRoutineComplete(), 5000);
    return () => window.clearTimeout(redirectTimer);
  }, [allExercisesComplete, finalizationStatus, onFinalizeSession, onRoutineComplete]);

  async function persistActiveItem(itemId) {
    if (!onStartSession) return true;
    if (!sessionId || !onUpdateSession) {
      setSeriesError('No se puede cambiar el ejercicio activo sin el sesionId confirmado por el servidor.');
      return false;
    }
    if (activeUpdateLock.current) return false;
    activeUpdateLock.current = true;
    setUpdatingActive(true);
    setSeriesError('');
    try {
      await onUpdateSession(sessionId, { itemActivoId: itemId, estacionActual: station.trim(), estado: 'activa' });
      return true;
    } catch (error) {
      setSeriesError(error?.message || 'No se pudo actualizar el ejercicio activo en el servidor.');
      return false;
    } finally {
      activeUpdateLock.current = false;
      setUpdatingActive(false);
    }
  }

  async function move(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= order.length || restState) return;
    const next = [...order];
    [next[index], next[destination]] = [next[destination], next[index]];
    if (started) {
      const nextActive = next.find(item => !item.seriesCount || (seriesDone[item.itemId]?.length || 0) < item.seriesCount);
      if (nextActive && nextActive.itemId !== activeItem?.itemId && !(await persistActiveItem(nextActive.itemId))) return;
    }
    setOrder(next);
  }

  async function toggleExercise(exercise) {
    const exerciseId = exercise.exerciseId;
    if (!started || restState) return;
    if (activeExerciseId === exerciseId) {
      const elapsed = Math.max(0, Math.floor((Date.now() - activeExerciseStarted) / 1000));
      setExerciseTimes(current => ({ ...current, [exerciseId]: (current[exerciseId] || 0) + elapsed }));
      setActiveExerciseId(null);
      setActiveExerciseStarted(null);
      setActiveExerciseSeconds(0);
      return;
    }
    if (activeExerciseId) {
      const elapsed = Math.max(0, Math.floor((Date.now() - activeExerciseStarted) / 1000));
      setExerciseTimes(current => ({ ...current, [activeExerciseId]: (current[activeExerciseId] || 0) + elapsed }));
    }
    if (!(await persistActiveItem(exercise.itemId))) return;
    setActiveExerciseId(exerciseId);
    setActiveExerciseStarted(Date.now());
  }

  function markSeries(item, seriesNumber) {
    const completedForItem = seriesDone[item.itemId]?.length || 0;
    const lockKey = `${item.itemId}:${seriesNumber}`;
    if (!started || restState || item.itemId !== activeItem?.itemId || seriesNumber !== completedForItem + 1 || recordedSeries.current.has(lockKey)) return;
    if (onStartSession && (!sessionId || !onUpdateSession)) return;
    recordedSeries.current.add(lockKey);
    setSeriesError('');
    setSavingSeries(true);
    const record = async () => {
      if (onStartSession) {
        const isTimedTarget = item.target?.unidad === 'segundos';
        const value = Number(seriesValues[item.itemId]);
        if (!Number.isInteger(value) || value < 1) throw new Error(isTimedTarget ? 'Ingresa los segundos realizados antes de registrar la serie.' : 'Ingresa las repeticiones realizadas antes de registrar la serie.');
        await onUpdateSession(sessionId, {
          itemActivoId: item.itemId,
          estacionActual: station.trim(),
          estado: 'activa',
          serie: {
            itemId: item.itemId,
            numeroSerie: seriesNumber,
            repeticiones: isTimedTarget ? null : value,
            segundosRealizados: isTimedTarget ? value : null,
          },
        });
      }
      const nextCompleted = completedForItem + 1;
      setSeriesDone(current => ({ ...current, [item.itemId]: [...(current[item.itemId] || []), seriesNumber] }));
      if (nextCompleted < item.seriesCount) {
        if (item.restSeconds > 0) {
          setRestState({ phase: 'running', itemId: item.itemId, seriesNumber, durationSeconds: item.restSeconds, remainingSeconds: item.restSeconds, deadline: Date.now() + item.restSeconds * 1000 });
        } else if (item.restSeconds === null) {
          setRestState({ phase: 'pending', itemId: item.itemId, seriesNumber });
        }
      }
    };
    record().catch(error => {
      recordedSeries.current.delete(lockKey);
      setSeriesError(error?.message || 'No se pudo registrar la serie. No se marcó como completada.');
    }).finally(() => setSavingSeries(false));
  }

  function pauseRest() {
    setRestState(current => {
      if (!current || current.phase !== 'running') return current;
      const remainingSeconds = Math.max(0, Math.ceil((current.deadline - Date.now()) / 1000));
      return remainingSeconds === 0
        ? { ...current, phase: 'done', remainingSeconds: 0 }
        : { ...current, phase: 'paused', deadline: null, remainingSeconds };
    });
  }

  function resumeRest() {
    setRestState(current => current?.phase === 'paused'
      ? { ...current, phase: 'running', deadline: Date.now() + current.remainingSeconds * 1000 }
      : current);
  }

  function continueAfterRest() {
    setRestState(null);
  }

  if (itemsLoading) return <section className="session-demo surface-card" aria-live="polite"><span className="eyebrow">Sesión de hoy</span><p>Consultando series y descansos de la rutina aprobada…</p></section>;
  if (!order.length) return <section className="session-demo surface-card" aria-live="polite"><span className="eyebrow">Sesión de hoy</span><h2>Prescripción pendiente</h2><p>La rutina aprobada disponible para este día no contiene ejercicios registrados. No podemos mostrar series sin esos datos.</p><p className="rest-pending" role="status">Descanso pendiente de asignación. No se iniciará un temporizador sin una duración indicada.</p>{isDemo && <small className="demo-notice">Respuesta de demostración local. No se consultó ni guardó una sesión en el servidor.</small>}</section>;

  if (finished) return <section className="session-finished" role="status"><span className="eyebrow">{onFinalizeSession && finalizationStatus === 'confirmed' ? 'Cierre confirmado' : 'Registro local'}</span><h2>{finishedWithPending ? 'Sesión finalizada con pendientes' : 'Rutina de hoy completada'}</h2><p>{finishedWithPending ? 'La sesión terminó sin completar todas las series.' : 'La constancia también es progreso.'}</p><small>{onFinalizeSession && finalizationResponse ? `El servidor confirmó el estado ${finalizationResponse.estado} a las ${formatServerTime(finalizationResponse.finUtc)}.` : onStartSession ? 'El cierre no está confirmado por el servidor.' : 'El registro de series queda en esta experiencia y no se guardó en el servidor.'}</small>{onFinalizeSession && finalizationResponse?.series && <small>Series incluidas en la respuesta confirmada: {finalizationResponse.series.length}.</small>}<button className="button button--dark" type="button" onClick={onRoutineComplete}>Volver a Inicio</button></section>;

  return <section className="session-demo" aria-labelledby="sessionDemoTitle">
    {demoPreset && <div className="session-demo-heading"><span className="eyebrow">Rutina de ejemplo · pendiente de aprobación de Eva</span><h2>Rutina de brazos: fuerza y control</h2><p>Datos ficticios del diseño de Stitch. Esta propuesta no está aprobada ni publicada en la rutina V1. El descanso de 60 s solo aplica a esta demostración.</p></div>}
    <div className="session-top"><div><span className="eyebrow">{isDemo ? 'Demostración local' : 'Rutina aprobada'}</span><h3 id="sessionDemoTitle">{started ? 'Sesión activa' : 'Sesión de hoy'}</h3></div><strong className="timer" aria-label={`Tiempo transcurrido ${sessionTime}`}>{sessionTime}</strong></div>
    <p className="inline-note">{onStartSession ? 'Inicio, series, cierre y solicitudes de asistencia se envían al servidor. El cronómetro por ejercicio permanece local.' : 'El avance de esta sesión se mantiene en la pantalla y aún no se envía al servidor.'}</p>
    {onStartSession && <label className="session-station-field">Estación actual<input value={station} onChange={event => setStation(event.target.value)} autoComplete="off" placeholder="Identificador de la estación" /></label>}
    {startError && <p className="session-start-error" role="alert" aria-live="assertive">{startError}</p>}
    {seriesError && <p className="session-start-error" role="alert" aria-live="assertive">{seriesError}</p>}
    {!started && <button className="button button--dark" type="button" disabled={!canStart || starting || startResponseInvalid} onClick={beginSession}>{starting ? 'Confirmando inicio…' : 'Iniciar sesión'}</button>}
    {!started && !canStart && <p className="session-prerequisite">Completa primero el calentamiento para iniciar la sesión.</p>}

    {(restState?.phase === 'running' || restState?.phase === 'paused' || restState?.phase === 'done') && <div className="rest-modal-backdrop">
      <section className="rest-modal-card" ref={restDialogRef} tabIndex={-1} role={restState.phase === 'done' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="restModalTitle" aria-describedby="restModalDescription">
        {restState.phase === 'done' ? <>
          <span className="rest-modal-icon" aria-hidden="true">✓</span>
          <h2 id="restModalTitle">Descanso terminado</h2>
          <p id="restModalDescription" aria-live="assertive">Puedes continuar con la siguiente serie.</p>
          <button className="button button--dark" ref={continueRestRef} type="button" onClick={continueAfterRest}>Continuar</button>
        </> : <>
          <span className="eyebrow">Temporizador de descanso</span>
          <h2 id="restModalTitle">Recuperación entre series</h2>
          <p id="restModalDescription">{isDemo ? 'Descanso de demostración' : 'Descanso asignado'}: {restState.durationSeconds} segundos. {restingItem?.name ? `Después podrás seguir con la serie ${restState.seriesNumber + 1} de ${restingItem.name}.` : ''}</p>
          <strong className="rest-countdown" aria-live="off" aria-label={`Tiempo restante ${formatClock(restState.remainingSeconds)}`}>{formatClock(restState.remainingSeconds)}</strong>
          <button className="button button--outline" type="button" onClick={restState.phase === 'running' ? pauseRest : resumeRest}>{restState.phase === 'running' ? 'Pausar descanso' : 'Reanudar descanso'}</button>
        </>}
      </section>
    </div>}
    {restState?.phase === 'pending' && <div className="rest-pending" role="status" aria-live="polite"><strong>Descanso pendiente de asignación</strong><span>La rutina no incluye una duración de descanso para esta serie.</span><button className="button button--outline" type="button" onClick={continueAfterRest}>Continuar</button></div>}

    {allExercisesComplete ? <div className="session-finished" role={finalizationStatus === 'error' ? 'alert' : 'status'}><span className="eyebrow">{onFinalizeSession ? finalizationStatus === 'confirmed' ? 'Cierre confirmado' : finalizationStatus === 'sending' ? 'Cerrando sesión' : 'Series realizadas · cierre pendiente' : 'Registro local'}</span><h2>{onFinalizeSession ? finalizationStatus === 'confirmed' ? 'Rutina de hoy completada' : finalizationStatus === 'sending' ? 'Confirmando el cierre de tu sesión' : finalizationStatus === 'error' ? 'No se confirmó el cierre' : 'Todas las series están registradas' : 'Rutina de hoy completada'}</h2>{onFinalizeSession && finalizationStatus === 'confirmed' ? <p>¡Excelente trabajo! Nos vemos en tu próximo día de entrenamiento.</p> : onFinalizeSession ? <p>La sesión permanece abierta hasta recibir la confirmación final del servidor.</p> : <p>¡Excelente trabajo! Nos vemos en tu próximo día de entrenamiento.</p>}{finalizationStatus === 'error' && <p className="session-start-error">{finalizationError}</p>}<small>{onFinalizeSession ? finalizationStatus === 'confirmed' && finalizationResponse ? `El servidor confirmó ${finalizationResponse.estado} a las ${formatServerTime(finalizationResponse.finUtc)}; ${finalizationResponse.series.length} series en la respuesta.` : finalizationStatus === 'sending' ? 'Esperando respuesta del servidor; la rutina todavía no se considera completada.' : 'No se confirmó el cierre. La sesión permanece en pantalla.' : 'No se guardó en el servidor.'}</small>{onFinalizeSession && finalizationStatus === 'error' && <button className="button button--outline" type="button" onClick={() => finalizeSession('completa')}>Reintentar cierre</button>}{(!onFinalizeSession || finalizationStatus === 'confirmed') && <button className="button button--dark" type="button" onClick={onRoutineComplete}>Volver a Inicio</button>}{onFinalizeSession && finalizationStatus === 'confirmed' && <span className="session-return-countdown">Volverás a Inicio en unos segundos.</span>}</div> : <ol className="session-exercises">
      {order.map((exercise, index) => {
        const completedCount = seriesDone[exercise.itemId]?.length || 0;
        const exerciseComplete = Boolean(exercise.seriesCount) && completedCount >= exercise.seriesCount;
        const exerciseActive = activeItem?.itemId === exercise.itemId;
        const target = exercise.target ? `${exercise.target.cantidad} ${exercise.target.unidad}` : null;
        return <li key={exercise.itemId} className={exerciseActive ? 'is-active-exercise' : exerciseComplete ? 'is-complete-exercise' : 'is-locked-exercise'}>
          <div className="exercise-line"><span className="exercise-code">{exercise.code}</span><div><strong>{exercise.name}</strong><small>{exerciseComplete ? 'Ejercicio completado' : exerciseActive ? 'Ejercicio activo' : 'Bloqueado hasta completar el anterior'}</small></div><div className="order-controls"><button aria-label={`Mover ${exercise.name} hacia arriba`} disabled={index === 0 || !started || Boolean(restState) || updatingActive} type="button" onClick={() => move(index, -1)}>↑</button><button aria-label={`Mover ${exercise.name} hacia abajo`} disabled={index === order.length - 1 || !started || Boolean(restState) || updatingActive} type="button" onClick={() => move(index, 1)}>↓</button></div></div>
          {exercise.video ? <figure className="session-exercise-visual session-exercise-visual--video"><video src={exercise.video} controls muted loop playsInline preload="metadata" aria-label={`Video de demostración: ${exercise.name}`} /><figcaption>Video de ejercicio · vista previa demo</figcaption></figure> : exercise.image ? <figure className="session-exercise-visual"><img src={exercise.image} alt={exercise.imageAlt || `Imagen de demostración: ${exercise.name}`} onError={event => { event.currentTarget.hidden = true; }} /><figcaption>{exercise.imageCaption || 'Demostración visual · dato ficticio'}</figcaption></figure> : <p className="session-visual-pending" role="status">Guía visual pendiente</p>}
          {exercise.explanation && <p className="session-exercise-explanation">{exercise.explanation}</p>}
          <p className="session-exercise-equipment"><strong>Equipo:</strong> {exercise.equipment || 'Pendiente de registro'}</p>
          {demoPreset ? <div className="session-demo-group"><span>Grupo muscular de la demostración</span><strong>{exercise.group}</strong></div> : <AnatomyGuide exercise={exercise} />}
          {exercise.seriesCount ? <>
            <p className="prescription-summary">{exercise.seriesCount} series{target ? ` · ${target} por serie` : ''}{exercise.restSeconds !== null ? ` · ${exercise.restSeconds}s de descanso` : ''}</p>
            {exercise.restSeconds === null && <p className="rest-pending" role="status">Descanso pendiente de asignación.</p>}
            {onStartSession && exerciseActive && ['repeticiones', 'segundos'].includes(exercise.target?.unidad) && <label className="session-series-value">{exercise.target.unidad === 'segundos' ? 'Segundos realizados' : 'Repeticiones realizadas'}<input type="number" min="1" step="1" inputMode="numeric" value={seriesValues[exercise.itemId] || ''} onChange={event => setSeriesValues(current => ({ ...current, [exercise.itemId]: event.target.value }))} /></label>}
            {onStartSession && exerciseActive && !['repeticiones', 'segundos'].includes(exercise.target?.unidad) && <p className="rest-pending" role="status">No se puede registrar esta serie: el objetivo no indica si se capturan repeticiones o segundos.</p>}
            <div className="series-controls" aria-label={`Series de ${exercise.name}`}>
              {Array.from({ length: exercise.seriesCount }, (_, seriesIndex) => {
                const seriesNumber = seriesIndex + 1;
                const done = seriesNumber <= completedCount;
                const isNextSeries = seriesNumber === completedCount + 1;
                const canMark = started && exerciseActive && isNextSeries && !restState && !savingSeries && !updatingActive && (!onStartSession || Boolean(sessionId && onUpdateSession && ['repeticiones', 'segundos'].includes(exercise.target?.unidad)));
                return <button key={seriesNumber} className={`series-set-button ${done ? 'is-done' : ''}`} type="button" disabled={!canMark} aria-pressed={done} onClick={() => markSeries(exercise, seriesNumber)}>{savingSeries && exerciseActive && isNextSeries ? 'Enviando serie…' : done ? `Serie ${seriesNumber} · realizada ✓` : `Marcar serie ${seriesNumber} realizada`}</button>;
              })}
            </div>
          </> : <><p className="rest-pending">Series pendientes de asignación.</p><p className="rest-pending">Descanso pendiente de asignación.</p></>}
          {exerciseActive && <div className="exercise-timer-row"><span>{activeExerciseId === exercise.exerciseId ? `En curso · ${activeExerciseSeconds}s` : `Tiempo registrado · ${exerciseTimes[exercise.exerciseId] || 0}s`}</span><button className="mini-action" type="button" disabled={!started || Boolean(restState) || updatingActive} onClick={() => toggleExercise(exercise)}>{updatingActive ? 'Actualizando ejercicio…' : activeExerciseId === exercise.exerciseId ? 'Terminar ejercicio' : 'Iniciar ejercicio'}</button></div>}
        </li>;
      })}
    </ol>}

    <button className="button button--outline assistance-button" type="button" disabled={Boolean(onRequestAssistance && (!started || assistanceStatus === 'sending' || assistanceStatus === 'success' || assistanceStatus === 'invalid-response'))} onClick={requestAssistance}>{assistanceStatus === 'sending' ? 'Enviando solicitud…' : assistanceStatus === 'success' ? 'Solicitud registrada' : 'Necesito ayuda'} <span aria-hidden="true">♡</span></button>
    {(assistanceStatus === 'error' || assistanceStatus === 'invalid-response') && <p className="session-start-error" role="alert" aria-live="assertive">{assistanceError}</p>}
    {assistanceStatus === 'success' && assistanceResponse && <p className="session-assistance-success" role="status" aria-live="polite">Solicitud registrada · turno {assistanceResponse.ordenTurno} · estado {assistanceResponse.estado} · recibida {formatServerTime(assistanceResponse.horaRecibidaUtc)} · referencia {assistanceResponse.codigoRef}</p>}
    <div className="finish-controls"><button className="button button--dark" type="button" disabled={!started || Boolean(restState) || finalizationStatus === 'sending'} onClick={() => pending.length ? setConfirmFinish(true) : finalizeSession('completa')}>{onFinalizeSession ? finalizationStatus === 'sending' ? 'Cerrando sesión…' : 'Finalizar sesión' : onStartSession ? 'Finalizar vista (local)' : 'Finalizar sesión'}</button></div>
    {confirmFinish && <div className="modal-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finishTitle"><h3 id="finishTitle">Quedan ejercicios o series pendientes</h3><ul>{pending.map(item => <li key={item.itemId}>{item.name}{item.seriesCount ? ` · ${seriesDone[item.itemId]?.length || 0} de ${item.seriesCount} series` : ' · series pendientes'}</li>)}</ul>{finalizationError && <p className="session-start-error" role="alert">{finalizationError}</p>}<div><button className="button button--outline" type="button" onClick={() => setConfirmFinish(false)} disabled={finalizationStatus === 'sending'}>Volver a la sesión</button><button className="button button--dark" type="button" disabled={finalizationStatus === 'sending'} onClick={() => finalizeSession('parcial')}>{finalizationStatus === 'sending' ? 'Enviando…' : 'Terminar con pendientes'}</button></div></section></div>}
  </section>;
}
