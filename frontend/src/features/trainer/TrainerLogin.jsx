import { useState } from 'react';
import Brand from '../../components/Brand.jsx';
import './trainer.css';

// Interfaz de acceso únicamente. La autenticación de entrenador aún no está integrada.
export default function TrainerLogin({ onBackToClient }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  function submitAccess(event) {
    event.preventDefault();
    setPassword('');
    setMessage('No se pudo validar el acceso. Este proyecto aún no tiene autenticación de entrenadores conectada; no se inició sesión.');
  }

  return <div className="trainer-access-shell">
    <header className="trainer-access-header"><Brand compact /><span>ACCESO DE ENTRENADOR</span></header>
    <main className="trainer-access-content">
      <section className="trainer-login-card surface-card">
        <span className="eyebrow">Portal profesional</span>
        <h1>Acceso de entrenador</h1>
        <p>Ingresa con las credenciales asignadas a tu rol.</p>
        <form onSubmit={submitAccess}>
          <label htmlFor="trainerUsername">Usuario</label>
          <input id="trainerUsername" name="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
          <label htmlFor="trainerPassword">Contraseña</label>
          <input id="trainerPassword" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          {message && <p className="trainer-access-message" role="status">{message}</p>}
          <button className="button button--dark" type="submit">Continuar</button>
        </form>
        <p className="trainer-demo-access">El panel está protegido y permanecerá cerrado hasta validar una sesión con rol de entrenador.</p>
        <button className="trainer-back-link" type="button" onClick={onBackToClient}>Volver al acceso de cliente</button>
      </section>
    </main>
  </div>;
}
