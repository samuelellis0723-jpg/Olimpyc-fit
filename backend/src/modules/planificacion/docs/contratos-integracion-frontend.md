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
