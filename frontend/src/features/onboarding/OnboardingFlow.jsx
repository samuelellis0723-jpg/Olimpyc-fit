import { useState } from 'react';
import Brand from '../../components/Brand.jsx';
import { DEMO_CLIENT, DEMO_WARNING } from '../../mocks/demoData.js';

const STORAGE_KEY = 'olimpyc-fit:onboarding:DEMO-A1';

export default function OnboardingFlow({ onAuthenticated }) {
  const alreadyWelcomed = localStorage.getItem(STORAGE_KEY) === 'true';
  const pendingSession = Boolean(localStorage.getItem('olimpyc-fit:demo-session') || sessionStorage.getItem('olimpyc-fit:demo-session'));
  const [step, setStep] = useState(!alreadyWelcomed && pendingSession ? 'welcome' : 'login');
  const [name, setName] = useState(DEMO_CLIENT.fullName);
  const [id, setId] = useState(DEMO_CLIENT.nationalId);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('client');
  const [trainerUsername, setTrainerUsername] = useState('');
  const [trainerPassword, setTrainerPassword] = useState('');

  function submitAccess(event) {
    event.preventDefault();
    if (role === 'trainer') {
      setTrainerPassword('');
      setError('No se pudo validar el acceso. Este proyecto aún no tiene autenticación de entrenadores conectada; no se inició sesión.');
      return;
    }
    if (name.trim().toLocaleLowerCase('es') !== DEMO_CLIENT.fullName.toLocaleLowerCase('es') || id.replace(/\D/g, '') !== DEMO_CLIENT.nationalId) {
      setError('No coincide con el perfil ficticio de demostración.');
      return;
    }
    setError('');
    const store = remember ? localStorage : sessionStorage;
    store.setItem('olimpyc-fit:demo-session', JSON.stringify({ profileId: DEMO_CLIENT.id, remember }));
    if (localStorage.getItem(STORAGE_KEY) === 'true') onAuthenticated(DEMO_CLIENT);
    else setStep('welcome');
  }

  function finishGuide() {
    localStorage.setItem(STORAGE_KEY, 'true');
    onAuthenticated(DEMO_CLIENT);
  }

  return (
    <div className="onboarding-shell">
      <header className="app-header"><Brand /><span className="header-kicker">TU PROCESO, CON PROPÓSITO</span><span className="header-help" aria-hidden="true">?</span></header>
      <main className="onboarding-content">
        {step === 'login' && <>
          <p className="eyebrow">{role === 'client' ? 'Cada cuerpo, su propio camino' : 'Acceso de entrenador'}</p>
          <h1>{role === 'client' ? 'Entrar a mi espacio.' : 'Entrar al panel de entrenador.'}</h1>
          <p className="lead">{role === 'client' ? 'Ingresa con los datos asociados al registro del gimnasio.' : 'El acceso de entrenador requiere una sesión validada por el servicio de autenticación.'}</p>
          <div className="onboarding-role-toggle" role="group" aria-label="Seleccionar tipo de acceso">
            <button type="button" className={role === 'client' ? 'is-active' : ''} aria-pressed={role === 'client'} onClick={() => { setRole('client'); setError(''); }}>Cliente</button>
            <button type="button" className={role === 'trainer' ? 'is-active' : ''} aria-pressed={role === 'trainer'} onClick={() => { setRole('trainer'); setError(''); }}>Entrenador</button>
          </div>
          <form className="surface-card onboarding-form" onSubmit={submitAccess}>
            <h2>{role === 'client' ? 'Acceso de demostración' : 'Acceso de entrenador'}</h2>
            {role === 'client' ? <>
              <label>Nombre y apellidos<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
              <label>Cédula<input inputMode="numeric" value={id} onChange={e => setId(e.target.value)} /></label>
              <label className="remember-row"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Mantener sesión iniciada en este dispositivo</label>
            </> : <>
              <label>Usuario de entrenador<input autoComplete="username" value={trainerUsername} onChange={e => setTrainerUsername(e.target.value)} required /></label>
              <label>Contraseña de entrenador<input type="password" autoComplete="current-password" value={trainerPassword} onChange={e => setTrainerPassword(e.target.value)} required /></label>
              <p className="demo-notice">Las credenciales no se guardan. El panel permanecerá cerrado hasta que el sistema pueda validar que la sesión pertenece a un entrenador.</p>
            </>}
            {error && <p className="form-error" role="alert">{error}</p>}
            {role === 'client' && <p className="demo-notice">{DEMO_WARNING} Ana y Eva son perfiles ficticios.</p>}
            <button className="button button--dark" type="submit">{role === 'client' ? 'Continuar' : 'Iniciar sesión como entrenador'} <span aria-hidden="true">→</span></button>
          </form>
        </>}
        {step === 'welcome' && <section className="welcome-grid">
          <div><p className="eyebrow">Qué bueno tenerte aquí</p><h1>Ana, bienvenida a una vida fit.</h1><p className="lead">Este espacio acompaña tu proceso personal. Puedes avanzar a tu ritmo y revisar lo que tu equipo haya registrado.</p><blockquote>“La constancia también es progreso.”</blockquote><button className="button button--dark" onClick={() => setStep('guide')}>Continuar <span aria-hidden="true">→</span></button></div>
          <img src="/authentic_professional_editorial_photography_in_a_modern_strength_training_gym..png" alt="Personas entrenando con pesas en un gimnasio" />
        </section>}
        {step === 'guide' && <section className="guide-content"><p className="eyebrow">Antes de comenzar</p><h1>Confirma tu recorrido.</h1><p className="lead">Revisa el plan aprobado, sigue las indicaciones disponibles y consulta únicamente el progreso registrado.</p><div className="guide-steps"><article><span>01</span><h2>Tu plan</h2><p>Consulta la rutina vigente que haya aprobado tu entrenadora.</p></article><article><span>02</span><h2>Tu entrenamiento</h2><p>Registra el avance de la sesión siguiendo la prescripción disponible.</p></article><article><span>03</span><h2>Tu progreso</h2><p>Revisa la información que se haya registrado para tu perfil.</p></article></div><button className="button button--dark" onClick={finishGuide}>Iniciar mi recorrido <span aria-hidden="true">→</span></button></section>}
      </main>
      <footer className="onboarding-footer">Demostración local · Olimpyc Fit <a href="/entrenador">Acceso de entrenador</a></footer>
    </div>
  );
}
