# Contratos de Integración Backend — Olimpyc Fit (`/api/v1`)

## 1. Autenticación, Roles y Reglas de Seguridad
- **Mecanismo de sesión:** Cabecera `Authorization: Bearer <access_token>` (token JWT de sesión emitido por Supabase Auth). No se almacenan ni devuelven contraseñas en texto plano ni se usan identidades ficticias en producción.
- **Resolución de actor en servidor:** Cada petición protegida valida el token en el servidor y resuelve `usuarioId`, `gimnasioId` y `rol` (`"entrenador"` o `"atleta"`) desde `public.miembros`.
- **Autorización por rol y asignación activa:**
  - La validación del frontend es solo visual; el backend valida rol y asignación en cada petición.
  - Un atleta (`rol: "atleta"`, ej. **Ana**) solo puede operar sobre sus propios recursos y **nunca** puede acceder a rutas exclusivas de entrenador (`403 SIN_PERMISO`), aunque conozca la URL.
  - Un entrenador (`rol: "entrenador"`, ej. **Eva**) solo puede leer/modificar datos de atletas con asignación activa (`public.asignaciones` con `entrenador_id`, `atleta_id` y `fecha_fin IS NULL` dentro del mismo `gimnasio_id`). Si no existe asignación activa, responde `403 SIN_PERMISO`.
- **Variables de entorno requeridas (sin secretos en código/repo):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Identidad y Clientes Asignados

### `GET /api/v1/auth/me`
- **Acceso:** `entrenador` o `atleta` autenticado.
- **Respuesta `200 OK`:**
```json
{
  "usuarioId": "uuid-miembro",
  "gimnasioId": "uuid-gimnasio",
  "rol": "entrenador",
  "nombre": "Eva",
  "aliasVisible": "Eva"
}