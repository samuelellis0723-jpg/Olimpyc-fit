# Olimpyc Fit · instrucciones para el equipo y sus asistentes
MVP B2B de 34 horas. Leer el [plan y reparto por horas](docs/Plan-de-implementacion-Olimpyc-Fit.md), el [contrato](docs/01-contrato.md) y el [tablero](docs/05-tablero.md) antes de editar. Las rutas del contrato describen objetivos de implementación. Verificar en Git qué existe antes de anunciarlo como completado.

| Responsable | Rama | Propiedad |
|---|---|---|
| Hellen | feat/frontend-hellen | Frontend responsive y animaciones. La estructura inicial está en su equipo local. Consultar el [recorrido](docs/03-recorrido.md). |
| Alex | feat/backend-alex | Arranque común de Express, configuración y paquetes compartidos, Supabase Auth/PostgreSQL, migraciones, sesiones, cola privada y Web Push. Consultar el [modelo](docs/02-modelo-de-datos.md). |
| Samuel | feat/ia-samuel | Módulo backend de planificación, DeepSeek, edición, aprobación y reorganización. Consultar la [especificación](docs/04-asistente.md). |

Cada rama de trabajo integra mediante PR hacia develop. El equipo promueve a main la versión ensayada. Si los documentos aún están solo en main, leerlos desde origin/main. Coordinar con el propietario antes de cambiar contratos, dependencias compartidas o migraciones. Conservar cambios locales, utilizar datos ficticios, mantener claves en variables de entorno y excluir .env y .vscode del control de versiones. No usar force push, reset --hard ni git clean para sincronizar ramas.

Para el andamiaje inicial, Alex ejecuta el [prompt de base](docs/prompts-backend.md) una sola vez. Samuel parte de la base integrada. Hellen continúa en su estructura local.
