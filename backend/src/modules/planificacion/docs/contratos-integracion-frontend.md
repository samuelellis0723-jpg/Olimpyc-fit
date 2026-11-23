# Contratos de Integración Backend — Olimpyc Fit (`/api/v1`)

## 1. Configuración Local y Sesión Supabase (sin secretos)

### Variables de entorno locales
* **Backend (`backend/.env`):**
  * `PORT=3000` (opcional; arranque con `npm start` desde `backend/`).
  * `SUPABASE_URL=<url_del_proyecto_supabase>`
  * `SUPABASE_ANON_KEY=<anon_key_publica>`
  * `SUPABASE_SERVICE_ROLE_KEY=<service_role_key_solo_servidor>`
  * `DEEPSEEK_API_KEY=<api_key_opcional>` (si no se define, arranca con proveedor simulado por defecto).
* **Frontend (`frontend/.env`):**
  * `VITE_API_URL=http://localhost:3000/api/v1`
  * `VITE_SUPABASE_URL=<url_del_proyecto_supabase>`
  * `VITE_SUPABASE_ANON_KEY=<anon_key_publica>`
  *(Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` en el frontend ni subir archivos `.env` al repositorio).*

### Cómo obtiene el frontend la sesión y el `access_token`
1. El frontend mantiene intacto su flujo actual de inicio de sesión.
2. Cuando un usuario (entrenador o atleta) inicia sesión con Supabase Auth (`supabase.auth.signInWithPassword({ email, password })`) o ya tiene sesión activa (`const { data: { session } } = await supabase.auth.getSession()`), obtiene `session.access_token` (JWT).
3. En cada llamada al backend (`/api/v1/...`), el frontend envía la cabecera:
   ```http
   Authorization: Bearer <session.access_token>

{
  "usuarioId": "uuid-miembro",
  "gimnasioId": "uuid-gimnasio",
  "rol": "entrenador",
  "nombre": "Eva",
  "aliasVisible": "Eva"
}

{
  "clientes": [
    {
      "asignacionId": "uuid-asignacion",
      "fechaInicio": "2026-11-01T00:00:00.000Z",
      "atletaId": "uuid-atleta",
      "nombre": "Ana",
      "aliasVisible": "Ana"
    }
  ]
}

{
  "evaluaciones": [
    {
      "evaluacionId": "uuid-evaluacion",
      "codigoRef": null,
      "atletaId": "uuid-atleta",
      "autorId": "uuid-entrenador",
      "fecha": "2026-11-22T18:00:00.000Z",
      "modalidad": "presencial",
      "objetivo": "Fuerza base y estabilidad",
      "disponibilidadSemanal": 4,
      "nivelObservado": "intermedio",
      "estadoNivel": "observado",
      "restricciones": null,
      "notas": "Buena técnica inicial",
      "proximaRevision": "2026-12-06",
      "observacionesPrivadas": "Nota interna solo visible para entrenador",
      "mediciones": [
        {
          "medicionId": "uuid-medicion",
          "evaluacionId": "uuid-evaluacion",
          "variable": "peso_corporal",
          "origen": "observado",
          "fecha": "2026-11-22T18:00:00.000Z",
          "estado": "medido",
          "valor": 62.5,
          "unidad": "kg",
          "fuente": "balanza_gimnasio"
        }
      ]
    }
  ]
}

{
  "modalidad": "presencial",
  "objetivo": "Fuerza base y estabilidad",
  "disponibilidadSemanal": 4,
  "nivelObservado": "intermedio",
  "estadoNivel": "observado",
  "restricciones": null,
  "observacionesPrivadas": "Nota interna",
  "notas": "Evaluación inicial",
  "proximaRevision": "2026-12-06",
  "mediciones": [
    {
      "variable": "peso_corporal",
      "origen": "observado",
      "estado": "medido",
      "valor": 62.5,
      "unidad": "kg",
      "fuente": "balanza"
    }
  ]
}

{
  "mediciones": [
    {
      "variable": "sentadilla_estimada",
      "origen": "observado",
      "estado": "medido",
      "valor": 70,
      "unidad": "kg",
      "fuente": "observacion_coach"
    }
  ]
}

{
  "versionId": "uuid-version-plan",
  "diaId": "uuid-dia-plan",
  "itemActivoId": "uuid-item-plan",
  "estacionActual": "rack-1"
}

{
  "sesiones": [
    {
      "sesionId": "uuid-sesion",
      "codigoRef": null,
      "atletaId": "uuid-atleta",
      "versionId": "uuid-version-plan",
      "diaId": "uuid-dia-plan",
      "inicioUtc": "2026-11-22T18:30:00.000Z",
      "finUtc": null,
      "estado": "activa",
      "itemActivoId": "uuid-item-plan",
      "estacionActual": "rack-1",
      "series": []
    }
  ]
}

{
  "itemActivoId": "uuid-item-plan",
  "estacionActual": "rack-1",
  "estado": "activa",
  "serie": {
    "itemId": "uuid-item-plan",
    "numeroSerie": 1,
    "repeticiones": 10,
    "segundosRealizados": null
  }
}

{
  "sesionId": "uuid-sesion",
  "ejercicioCapturado": "Sentadilla trasera",
  "estacionCapturada": "rack-1"
}

{
  "asistencias": [
    {
      "asistenciaId": "uuid-asistencia",
      "codigoRef": null,
      "sesionId": "uuid-sesion",
      "atletaId": "uuid-atleta",
      "atletaNombre": "Ana",
      "atletaAlias": "Ana",
      "entrenadorId": "uuid-entrenador",
      "ordenTurno": 1,
      "horaRecibidaUtc": "2026-11-22T18:35:00.000Z",
      "estado": "pendiente",
      "ejercicioCapturado": "Sentadilla trasera",
      "estacionCapturada": "rack-1",
      "horaAtencionUtc": null
    }
  ]
}

{
  "estado": "atendida"
}

