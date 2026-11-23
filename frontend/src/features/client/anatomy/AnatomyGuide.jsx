import { useState } from 'react';

export default function AnatomyGuide({ exercise }) {
  const [angle, setAngle] = useState('Frente');
  return <div className="anatomy-guide">
    <div className="anatomy-placeholder" role="img" aria-label={`Guía anatómica ${angle}; grupo muscular pendiente de confirmar`}><span>Guía anatómica pendiente</span><small>{exercise.code} · {angle}</small></div>
    <div className="anatomy-tabs" aria-label="Vista anatómica">
      {['Frente', 'Perfil', '3D'].map(mode => <button key={mode} className={angle === mode ? 'is-active' : ''} onClick={() => setAngle(mode)}>{mode}</button>)}
    </div>
    <p>Grupo muscular e ilustración pendientes de confirmación profesional.</p>
  </div>;
}
