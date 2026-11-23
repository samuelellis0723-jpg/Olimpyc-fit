Markdown# Contratos de Integración Backend — Olimpyc Fit (`/api/v1`)

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
El servidor valida ese JWT contra Supabase Auth y resuelve en public.miembros el usuarioId, gimnasioId y rol ("entrenador" o "atleta"). La validación de rol y de asignación activa (entrenador_id ↔ atleta_id, fecha_fin IS NULL) ocurre siempre en el servidor.2. Identidad y Clientes AsignadosGET /api/v1/auth/meAcceso: entrenador o atleta autenticado.Respuesta 200 OK:JSON{
  "usuarioId": "uuid-miembro",
  "gimnasioId": "uuid-gimnasio",
  "rol": "entrenador",
  "nombre": "Eva",
  "aliasVisible": "Eva"
}
GET /api/v1/entrenador/clientesAcceso: Exclusivo entrenador autenticado. Lista únicamente atletas con asignación activa (fecha_fin IS NULL) en su gimnasio.Respuesta 200 OK:JSON{
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
3. Evaluaciones y MedicionesGET /api/v1/atletas/:atletaId/evaluacionesAcceso: entrenador con asignación activa al atletaId (incluye observacionesPrivadas), o atleta con usuarioId === atletaId (omite observacionesPrivadas).Respuesta 200 OK:JSON{
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
POST /api/v1/atletas/:atletaId/evaluacionesAcceso: Exclusivo entrenador con asignación activa al atletaId.Reglas de campos: modalidad y objetivo obligatorios; disponibilidadSemanal entero 1..7 o null; estadoNivel: "observado" | "pendiente"; en mediciones, origen: "observado" | "autorreportado" | "externo" | "sin_evaluar", estado: "medido" | "pendiente" (si es "medido", valor y unidad son obligatorios).Body (201 Created):JSON{
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
PATCH /api/v1/evaluaciones/:evaluacionIdAcceso: Exclusivo entrenador con asignación activa al atleta de la evaluación.Body (200 OK): Campos parciales (modalidad, objetivo, disponibilidadSemanal, nivelObservado, estadoNivel, restricciones, observacionesPrivadas, notas, proximaRevision).POST /api/v1/evaluaciones/:evaluacionId/medicionesAcceso: Exclusivo entrenador con asignación activa al atleta de la evaluación.Body (201 Created):JSON{
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
4. Sesiones, Series y AsistenciasPOST /api/v1/sesionesAcceso: atleta autenticado (sobre una versión de plan en estado "vigente").Body (201 Created):JSON{
  "versionId": "uuid-version-plan",
  "diaId": "uuid-dia-plan",
  "itemActivoId": "uuid-item-plan",
  "estacionActual": "rack-1"
}
GET /api/v1/atletas/:atletaId/sesionesAcceso: atleta propio o entrenador con asignación activa al atletaId.Respuesta 200 OK:JSON{
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
PATCH /api/v1/sesiones/:sesionIdAcceso: atleta dueño de la sesión o entrenador con asignación activa al atleta.Body (200 OK): Permite actualizar estado ("activa" | "completa" | "parcial"), itemActivoId, estacionActual, finUtc y/o registrar una serie ejecutada (numeroSerie >= 1, repeticiones >= 0 o segundosRealizados >= 0):JSON{
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
POST /api/v1/asistenciasAcceso: atleta autenticado sobre su propia sesión activa. Asigna turno al entrenador activo.Body (201 Created):JSON{
  "sesionId": "uuid-sesion",
  "ejercicioCapturado": "Sentadilla trasera",
  "estacionCapturada": "rack-1"
}
GET /api/v1/entrenador/asistenciasAcceso: Exclusivo entrenador autenticado. Devuelve cola de asistencias ordenadas por estado y turno.Respuesta 200 OK:JSON{
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
PATCH /api/v1/asistencias/:asistenciaIdAcceso: Exclusivo entrenador asignado a esa asistencia (estado: "pendiente" | "atendida").Body (200 OK):JSON{
  "estado": "atendida"
}
5. Contratos de Planificación Real y Diferencia con la Demo UUIDLas rutas base definidas en backend/src/modules/planificacion/CONTRATOS.md se mantienen montadas exactamente bajo /api/v1, pero con persistencia real en Supabase:POST /api/v1/planes — Crea borrador (origen: "IA" | "DeepSeek" | "manual", evaluacionId UUID real, y dias si es "manual"). Devuelve 201 Created.GET /api/v1/planes/:versionId — Consulta borrador o versión aprobada (200 OK).PATCH /api/v1/planes/:versionId — Edita borrador enviando { "revisionEsperada": 1, "cambios": { ... } } (200 OK, incrementa revision y conserva los UUIDs reales de diaId e itemId). Si revisionEsperada no coincide, responde 409 REVISION_CONFLICTIVA con revisionActual.POST /api/v1/planes/:versionId/aprobar — Aprueba el borrador enviando { "revisionEsperada": <numero> } (200 OK), pasa la versión a "vigente" y archiva la anterior.POST /api/v1/planes/:versionId/reorganizar — Crea propuesta/borrador V2 sobre una versión vigente (201 Created).GET /api/v1/me/rutina?fecha=YYYY-MM-DD — Consulta la rutina vigente del atleta autenticado para esa fecha (200 OK).Diferencias clave entre la Demo y Supabase RealIdentificadores reales (UUID v4) vs códigos de fixture (T1, A1, EV1, E1, E2): En Supabase todos los IDs (evaluacionId, versionId, diaId, itemId, ejercicioId, criterioId) son UUIDs reales generados en PostgreSQL (codigo_demo / codigo_ref se usan solo como referencia interna, nunca como id en las peticiones HTTP).Estabilidad de diaId e itemId al editar: Al hacer PATCH /api/v1/planes/:versionId, los UUIDs de diaId e itemId se preservan intactos entre revisiones para que el frontend pueda hacer diff y actualizar sin perder referencias.Identidad por JWT real: Se elimina la cabecera/identidad simulada del servidor demo; cada llamada exige Authorization: Bearer <access_token> válido de Supabase Auth.6. Errores Estándar de /api/v1HTTPcodigoCuándo ocurre401NO_AUTENTICADOFalta Authorization: Bearer <token>, formato inválido o token expirado.403SIN_PERMISORol sin permiso (ej. atleta en ruta de entrenador) o entrenador sin asignación activa con el atleta.404NO_ENCONTRADOEl recurso (evaluacionId, sesionId, versionId, etc.) no existe en el gimnasio.409REVISION_CONFLICTIVArevisionEsperada desactualizada en planificación (incluye revisionActual).422SOLICITUD_INVALIDACampos obligatorios faltantes, tipos inválidos o incumplimiento de reglas de negocio.503PROVEEDOR_NO_DISPONIBLEFallo temporal con Supabase o proveedor de IA.7. Resumen de EstadoImplementado en develop: Arranque único (npm start en backend/), montaje de /api/v1, validación de JWT y asignaciones activas, persistencia real de planificación, perfil/clientes, evaluaciones, mediciones, sesiones, series y asistencias.Conecta frontend: Leer session.access_token de Supabase Auth, enviarlo en Authorization: Bearer <token> y conectar los formularios/vistas de Eva y Ana sin modificar el flujo actual de login de clientes.Pendiente: Pruebas end-to-end entre frontend y backend sobre develop.
