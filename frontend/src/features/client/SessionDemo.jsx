import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_EXERCISES } from '../../mocks/demoData.js';
import { DEMO_ARM_SESSION } from '../../mocks/demoArmSession.js';
import AnatomyGuide from './anatomy/AnatomyGuide.jsx';

function normalizeRoutineItem(item) {
  const demoExercise = DEMO_EXERCISES.find(exercise => exercise.exerciseId === item.ejercicioId || exercise.code === item.ejercicioId);
  const armExercise = DEMO_ARM_SESSION.find(exercise => exercise.exerciseId === item.ejercicioId);
  const validSeries = Number.isInteger(item.series) && item.series > 0;
  const validRest = Number.isInteger(item.descansoSegundos) && item.descansoSegundos >= 0;
  return {
    itemId: item.itemId,
    exerciseId: item.ejercicioId,
    code: item.demo ? 'DEMO' : demoExercise?.code || armExercise?.code || item.ejercicioId || '—',
    name: item.nombre || demoExercise?.name || armExercise?.name || (item.ejercicioId ? `Ejercicio ${item.ejercicioId}` : 'Ejercicio pendiente'),
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

export default function SessionDemo({ routineItems = [], itemsLoading = false, isDemo = false, demoPreset = false, canStart = true, setNotice, onRequestHelp, onRoutineComplete }) {
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
  const recordedSeries = useRef(new Set());
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

  useEffect(() => {
    if (!allExercisesComplete || !onRoutineComplete) return undefined;
    const redirectTimer = window.setTimeout(() => onRoutineComplete(), 5000);
    return () => window.clearTimeout(redirectTimer);
  }, [allExercisesComplete]);

  function move(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= order.length || restState) return;
    const next = [...order];
    [next[index], next[destination]] = [next[destination], next[index]];
    setOrder(next);
  }

  function toggleExercise(exerciseId) {
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
    setActiveExerciseId(exerciseId);
    setActiveExerciseStarted(Date.now());
  }

  function markSeries(item, seriesNumber) {
    const completedForItem = seriesDone[item.itemId]?.length || 0;
    const lockKey = `${item.itemId}:${seriesNumber}`;
    if (!started || restState || item.itemId !== activeItem?.itemId || seriesNumber !== completedForItem + 1 || recordedSeries.current.has(lockKey)) return;
    recordedSeries.current.add(lockKey);
    const nextCompleted = completedForItem + 1;
    setSeriesDone(current => ({ ...current, [item.itemId]: [...(current[item.itemId] || []), seriesNumber] }));

    if (nextCompleted < item.seriesCount) {
      if (item.restSeconds > 0) {
        setRestState({ phase: 'running', itemId: item.itemId, seriesNumber, durationSeconds: item.restSeconds, remainingSeconds: item.restSeconds, deadline: Date.now() + item.restSeconds * 1000 });
      } else if (item.restSeconds === null) {
        setRestState({ phase: 'pending', itemId: item.itemId, seriesNumber });
      }
    }
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

  if (finished) return <section className="session-finished" role="status"><span className="eyebrow">Registro local</span><h2>{finishedWithPending ? 'Sesión finalizada con pendientes' : 'Rutina de hoy completada'}</h2><p>{finishedWithPending ? 'La sesión terminó sin completar todas las series.' : 'La constancia también es progreso.'}</p><small>El registro de series queda en esta experiencia y no se guardó en el servidor.</small></section>;

  return <section className="session-demo" aria-labelledby="sessionDemoTitle">
    {demoPreset && <div className="session-demo-heading"><span className="eyebrow">Rutina de ejemplo · pendiente de aprobación de Eva</span><h2>Rutina de brazos: fuerza y control</h2><p>Datos ficticios del diseño de Stitch. Esta propuesta no está aprobada ni publicada en la rutina V1. El descanso de 60 s solo aplica a esta demostración.</p></div>}
    <div className="session-top"><div><span className="eyebrow">{isDemo ? 'Demostración local' : 'Rutina aprobada'}</span><h3 id="sessionDemoTitle">{started ? 'Sesión activa' : 'Sesión de hoy'}</h3></div><strong className="timer" aria-label={`Tiempo transcurrido ${sessionTime}`}>{sessionTime}</strong></div>
    <p className="inline-note">Las series se registran solo en esta pantalla. No existe un endpoint documentado para guardarlas.</p>
    {!started && <button className="button button--dark" type="button" disabled={!canStart} onClick={() => { setStartedAt(Date.now()); setStarted(true); setNotice?.('Sesión iniciada en esta experiencia del frontend.'); }}>Iniciar sesión</button>}
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

    {allExercisesComplete ? <div className="session-finished" role="status"><span className="eyebrow">Registro local</span><h2>Rutina de hoy completada</h2><p>¡Excelente trabajo! Nos vemos en tu próximo día de entrenamiento.</p><small>No se guardó en el servidor.</small><button className="button button--dark" type="button" onClick={onRoutineComplete}>Volver a Inicio ahora</button><span className="session-return-countdown">Volverás a Inicio en unos segundos.</span></div> : <ol className="session-exercises">
      {order.map((exercise, index) => {
        const completedCount = seriesDone[exercise.itemId]?.length || 0;
        const exerciseComplete = Boolean(exercise.seriesCount) && completedCount >= exercise.seriesCount;
        const exerciseActive = activeItem?.itemId === exercise.itemId;
        const target = exercise.target ? `${exercise.target.cantidad} ${exercise.target.unidad}` : null;
        return <li key={exercise.itemId} className={exerciseActive ? 'is-active-exercise' : exerciseComplete ? 'is-complete-exercise' : 'is-locked-exercise'}>
          <div className="exercise-line"><span className="exercise-code">{exercise.code}</span><div><strong>{exercise.name}</strong><small>{exerciseComplete ? 'Ejercicio completado' : exerciseActive ? 'Ejercicio activo' : 'Bloqueado hasta completar el anterior'}</small></div><div className="order-controls"><button aria-label={`Mover ${exercise.name} hacia arriba`} disabled={index === 0 || !started || Boolean(restState)} type="button" onClick={() => move(index, -1)}>↑</button><button aria-label={`Mover ${exercise.name} hacia abajo`} disabled={index === order.length - 1 || !started || Boolean(restState)} type="button" onClick={() => move(index, 1)}>↓</button></div></div>
          {exercise.video ? <figure className="session-exercise-visual session-exercise-visual--video"><video src={exercise.video} controls muted loop playsInline preload="metadata" aria-label={`Video de demostración: ${exercise.name}`} /><figcaption>Video de ejercicio · vista previa demo</figcaption></figure> : exercise.image ? <figure className="session-exercise-visual"><img src={exercise.image} alt={exercise.imageAlt || `Imagen de demostración: ${exercise.name}`} onError={event => { event.currentTarget.hidden = true; }} /><figcaption>{exercise.imageCaption || 'Demostración visual · dato ficticio'}</figcaption></figure> : <p className="session-visual-pending" role="status">Guía visual pendiente</p>}
          {exercise.explanation && <p className="session-exercise-explanation">{exercise.explanation}</p>}
          <p className="session-exercise-equipment"><strong>Equipo:</strong> {exercise.equipment || 'Pendiente de registro'}</p>
          {demoPreset ? <div className="session-demo-group"><span>Grupo muscular de la demostración</span><strong>{exercise.group}</strong></div> : <AnatomyGuide exercise={exercise} />}
          {exercise.seriesCount ? <>
            <p className="prescription-summary">{exercise.seriesCount} series{target ? ` · ${target} por serie` : ''}{exercise.restSeconds !== null ? ` · ${exercise.restSeconds}s de descanso` : ''}</p>
            {exercise.restSeconds === null && <p className="rest-pending" role="status">Descanso pendiente de asignación.</p>}
            <div className="series-controls" aria-label={`Series de ${exercise.name}`}>
              {Array.from({ length: exercise.seriesCount }, (_, seriesIndex) => {
                const seriesNumber = seriesIndex + 1;
                const done = seriesNumber <= completedCount;
                const isNextSeries = seriesNumber === completedCount + 1;
                const canMark = started && exerciseActive && isNextSeries && !restState;
                return <button key={seriesNumber} className={`series-set-button ${done ? 'is-done' : ''}`} type="button" disabled={!canMark} aria-pressed={done} onClick={() => markSeries(exercise, seriesNumber)}>{done ? `Serie ${seriesNumber} · realizada ✓` : `Marcar serie ${seriesNumber} realizada`}</button>;
              })}
            </div>
          </> : <><p className="rest-pending">Series pendientes de asignación.</p><p className="rest-pending">Descanso pendiente de asignación.</p></>}
          {exerciseActive && <div className="exercise-timer-row"><span>{activeExerciseId === exercise.exerciseId ? `En curso · ${activeExerciseSeconds}s` : `Tiempo registrado · ${exerciseTimes[exercise.exerciseId] || 0}s`}</span><button className="mini-action" type="button" disabled={!started || Boolean(restState)} onClick={() => toggleExercise(exercise.exerciseId)}>{activeExerciseId === exercise.exerciseId ? 'Terminar ejercicio' : 'Iniciar ejercicio'}</button></div>}
        </li>;
      })}
    </ol>}

    <button className="button button--outline assistance-button" type="button" onClick={() => onRequestHelp ? onRequestHelp() : setNotice?.('Necesito ayuda. La solicitud de demostración no se envió al servidor.')}>Necesito ayuda <span aria-hidden="true">♡</span></button>
    <div className="finish-controls"><button className="button button--dark" type="button" disabled={!started || Boolean(restState)} onClick={() => pending.length ? setConfirmFinish(true) : setFinished(true)}>Finalizar sesión</button></div>
    {confirmFinish && <div className="modal-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finishTitle"><h3 id="finishTitle">Quedan ejercicios o series pendientes</h3><ul>{pending.map(item => <li key={item.itemId}>{item.name}{item.seriesCount ? ` · ${seriesDone[item.itemId]?.length || 0} de ${item.seriesCount} series` : ' · series pendientes'}</li>)}</ul><div><button className="button button--outline" type="button" onClick={() => setConfirmFinish(false)}>Volver a la sesión</button><button className="button button--dark" type="button" onClick={() => { setConfirmFinish(false); setFinishedWithPending(true); setFinished(true); }}>Terminar con pendientes</button></div></section></div>}
  </section>;
}
