import { useState } from 'react';
import { DEMO_WARMUP_SEQUENCE } from '../../mocks/demoWarmup.js';
import './warmup.css';

export default function WarmupExperience({ dateLabel, athleteName, trainerName, routineVersion, isDemo, onBack, onContinue, onCompleted }) {
  const [completedCount, setCompletedCount] = useState(0);
  const [viewingIndex, setViewingIndex] = useState(0);
  const completed = completedCount === DEMO_WARMUP_SEQUENCE.length;
  const currentExercise = DEMO_WARMUP_SEQUENCE[viewingIndex];
  const viewingCompletedExercise = viewingIndex < completedCount;
  const showingCompletion = completed && viewingIndex === DEMO_WARMUP_SEQUENCE.length - 1;
  const progress = Math.round((completedCount / DEMO_WARMUP_SEQUENCE.length) * 100);

  function completeCurrentExercise() {
    if (viewingIndex !== completedCount || completed) return;
    const nextCount = completedCount + 1;
    setCompletedCount(nextCount);
    setViewingIndex(Math.min(nextCount, DEMO_WARMUP_SEQUENCE.length - 1));
    if (nextCount === DEMO_WARMUP_SEQUENCE.length) onCompleted?.();
  }

  return <main className="warmup-experience" aria-labelledby="warmupPageTitle">
    <header className="warmup-appbar">
      <button className="warmup-back" type="button" onClick={onBack} aria-label="Volver al día seleccionado">
        <span aria-hidden="true">←</span>
      </button>
      <div className="warmup-brand-heading">
        <span className="warmup-brand">olimpycfit</span>
        <h1 id="warmupPageTitle">Mi calentamiento</h1>
      </div>
      <span className="warmup-version">{routineVersion}</span>
    </header>

    <div className="warmup-content">
      <div className="warmup-context surface-card">
        <div className="warmup-context-top">
          <span className="eyebrow">{dateLabel} · Rutina {routineVersion}</span>
          <span className="warmup-assignment-state">{isDemo ? 'Demostración' : 'Vista previa'}</span>
        </div>
        <h2>{showingCompletion ? 'Calentamiento completado' : 'Preparación del día'}</h2>
        <p>Atleta: <strong>{athleteName || 'Perfil del cliente'}</strong>{trainerName ? <> · Entrenadora: <strong>{trainerName}</strong></> : null}</p>
      </div>

      <div className="warmup-demo-notice" role="note">
        Ejercicios de muestra tomados del diseño de Stitch. No representan una asignación aprobada ni se guardan en el servidor.
      </div>

      <section className="warmup-progress" aria-label="Progreso de la demostración">
        <div><strong>{completed ? 'Demostración finalizada' : `Ejercicio ${completedCount + 1} de ${DEMO_WARMUP_SEQUENCE.length}`}</strong><span>{progress}%</span></div>
        <div className="warmup-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} aria-label="Progreso del calentamiento de demostración">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="warmup-exercise-card surface-card" aria-live="polite">
        <div className="warmup-photo">
          <img src="/warmup-band-preview.png" alt="Imagen de referencia de una persona entrenando con una banda elástica" />
          <span className="warmup-image-caption">Imagen de referencia · no es un video asignado</span>
          <span className="warmup-video-badge">Video pendiente</span>
        </div>
        <div className="warmup-exercise-details">
          {showingCompletion ? <div className="warmup-complete-panel" role="status">
            <span className="warmup-pending-badge">Calentamiento completado · demostración local</span>
            <h2>¡Calentamiento completado!</h2>
            <p>La constancia también es progreso. Este avance solo existe durante esta experiencia y no se guardó en el servidor.</p>
          </div> : <>
            <span className={`warmup-pending-badge ${viewingCompletedExercise ? 'warmup-pending-badge--done' : ''}`}>{viewingCompletedExercise ? 'Ejercicio completado · demostración' : `Ejercicio ${completedCount + 1} en curso · demostración`}</span>
            <div className="warmup-exercise-title-row">
              <h2>{currentExercise.title}</h2>
              <span>{currentExercise.sets}</span>
            </div>
            <p className="warmup-exercise-description">{currentExercise.description}</p>
            <p className="warmup-video-note" role="status">No hay video asignado para este ejercicio. El contenido visible es una demostración de Stitch.</p>
            {!viewingCompletedExercise && <button className="button button--dark" type="button" onClick={completeCurrentExercise}>
              Ya realicé este ejercicio <span aria-hidden="true">✓</span>
            </button>}
          </>}
        </div>
      </section>

      <button className="warmup-return-link" type="button" onClick={onBack}>Volver al día seleccionado</button>

      <section className="warmup-sequence" aria-labelledby="warmupSequenceTitle">
        <div className="warmup-sequence-heading"><h2 id="warmupSequenceTitle">Secuencia de calentamiento</h2><span>Sin saltos</span></div>
        <ol>
          {DEMO_WARMUP_SEQUENCE.map((exercise, index) => {
            const isComplete = index < completedCount;
            const isCurrent = index === completedCount && !completed;
            const isLocked = index > completedCount;
            const canView = !isLocked;
            return <li key={exercise.id}>
              <button className={`warmup-sequence-item ${isComplete ? 'is-complete' : ''} ${isCurrent ? 'is-current' : ''} ${isLocked ? 'is-locked' : ''}`} type="button" disabled={!canView} aria-current={isCurrent ? 'step' : undefined} aria-label={`${exercise.title}: ${isComplete ? 'completado' : isCurrent ? 'en curso' : 'bloqueado'}`} onClick={() => setViewingIndex(index)}>
                <span className="warmup-sequence-number">{isComplete ? '✓' : isLocked ? '•' : index + 1}</span>
                <span className="warmup-sequence-copy"><strong>{exercise.title}</strong><small>{exercise.sets} · dato de demostración</small></span>
                <span className="warmup-sequence-status">{isComplete ? 'Completado' : isCurrent ? 'En curso' : 'Bloqueado'}</span>
              </button>
            </li>;
          })}
        </ol>
      </section>

      {showingCompletion && <div className="warmup-continue-wrap">
        <small>La rutina mostrará solo los ejercicios y descansos presentes en los datos disponibles.</small>
        <button className="button button--outline" type="button" onClick={onContinue}>Continuar a mi rutina</button>
      </div>}
    </div>
  </main>;
}
