# Módulo de planificación

- El orquestador inspecciona, acuerda contratos, asigna archivos y revisa; no crea, modifica ni elimina archivos.
- Todo ejecutor debe usar el modelo Luna disponible con esfuerzo medium. Si no puede comprobarse, informar esa limitación; no sustituirlo por iniciativa propia.
- Cada ejecutor se limita a los archivos que le asigne el orquestador. No ampliar el alcance ni tocar `frontend/`, autenticación, arranque compartido, migraciones, asistencia, Web Push, manifiestos compartidos o lockfiles ajenos.
- Mantener generación y reorganización como borradores hasta aprobación explícita del entrenador. No exponer claves ni datos personales en logs.
- `CONTRATOS.md` define las piezas propuestas y sus dependencias. Las formas físicas de persistencia y las rutas comunes requieren acuerdo con Alex; los campos de presentación requieren acuerdo con Hellen.
