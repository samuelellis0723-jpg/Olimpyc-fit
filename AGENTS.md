# Olimpyc Fit · Instrucciones para el equipo y sus asistentes

## 1. Contexto y documentos obligatorios

MVP B2B con aproximadamente 34 horas iniciales de desarrollo y continuidad después del hackathon.

Leer antes de trabajar:

- docs/Plan-de-implementacion-Olimpyc-Fit.md
- docs/01-contrato.md
- docs/02-modelo-de-datos.md
- docs/03-recorrido.md
- docs/04-asistente.md
- docs/05-tablero.md
- docs/prompts-backend.md

Verificar el estado real de Git y los archivos existentes antes de anunciar funcionalidades como completadas.

Si los documentos todavía están únicamente en main, consultarlos desde origin/main sin sobrescribir los cambios locales.

## 2. Responsabilidades del equipo

| Responsable | Rama | Propiedad |
|---|---|---|
| Hellen | feat/frontend-hellen | Frontend responsive, experiencia de atleta y entrenador, animaciones y recepción de notificaciones en la interfaz. Su estructura inicial está en su equipo local. |
| Alex | feat/backend-alex | Backend compartido de Express, configuración, dependencias compartidas, Supabase Auth/PostgreSQL, migraciones, sesiones de entrenamiento, cola privada de asistencia y Web Push. |
| Samuel | feat/ia-samuel | Módulo backend de planificación: DeepSeek, generación, edición, aprobación y reorganización de rutinas. |

Los subagentes de Samuel trabajan únicamente en el alcance de Samuel.
La existencia de un subagente de infraestructura o integración no autoriza a modificar el trabajo de Alex o Hellen.

## 3. Stack y reglas del producto

- Frontend: React y Vite, con diseño responsive.
- Backend: Node.js y Express.
- Base de datos y autenticación: PostgreSQL y Auth de Supabase.
- IA: API de DeepSeek, consumida exclusivamente desde el backend.
- Asistencia: alertas al entrenador asignado, con cola FIFO.
- Notificaciones con el teléfono bloqueado: Web Push; Realtime por sí solo no cubre este requisito.

Toda rutina generada o reorganizada por IA debe permanecer como borrador hasta que el entrenador la revise y apruebe.

El atleta solo puede consultar rutinas aprobadas y publicadas.
Una reorganización no debe sobrescribir silenciosamente la rutina publicada.

## 4. Modelos y autoridad de los agentes

### Orquestador

El orquestador usa el modelo principal configurado en la sesión (esfuerzo high). Los subagentes ejecutores deben usar el modelo ligero/rápido disponible en la instalación (esfuerzo medium) sin detenerse por diferencias en el nombre comercial del modelo.

Responsabilidades:

- Leer documentación y revisar el estado del repositorio.
- Dividir el objetivo en tareas concretas.
- Definir contratos y dependencias antes del trabajo paralelo.
- Asignar archivos y carpetas exclusivos a cada subagente.
- Coordinar el orden de ejecución y la integración.
- Revisar cambios y resultados de validación.
- Solicitar correcciones al subagente responsable.
- Informar avances, bloqueos y pendientes.

Restricción obligatoria:

El orquestador no crea, modifica ni elimina archivos del proyecto.
Esto incluye código, documentación, configuración, manifiestos,
lockfiles, migraciones y scripts.

Puede ejecutar operaciones de lectura y diagnóstico.
Las instalaciones, generación de archivos, compilaciones y demás
operaciones que escriban archivos deben delegarse.

Si encuentra un error, lo describe y delega su corrección.
No lo corrige directamente, aunque el cambio sea pequeño.

### Subagentes ejecutores

El orquestador usa el modelo principal configurado en la sesión (esfuerzo high). Los subagentes ejecutores deben usar el modelo ligero/rápido disponible en la instalación (esfuerzo medium) sin detenerse por diferencias en el nombre comercial del modelo.

Los subagentes realizan todas las modificaciones y las validaciones
que puedan escribir archivos, siempre dentro del alcance asignado.

Los nombres anteriores expresan la preferencia del equipo.
La configuración real del cliente debe utilizar los identificadores
de modelo disponibles en esa instalación.

No afirmar que un modelo está configurado solo porque aparece en este documento.
Si el modelo solicitado no está disponible, informar el bloqueo antes de sustituirlo.

## 5. Reglas de delegación y trabajo paralelo

Antes de iniciar cualquier subagente, el orquestador debe asignarle:

- Objetivo y resultado esperado.
- Lista exacta de archivos que puede crear o modificar.
- Archivos y carpetas que tiene prohibido modificar.
- Contratos de entrada y salida.
- Dependencias de otras tareas.
- Criterios de aceptación y validaciones necesarias.

Cada archivo tiene un único escritor activo.

Si dos tareas necesitan modificar el mismo archivo, deben ejecutarse
en secuencia o asignarse al mismo subagente.

Los subagentes no amplían su alcance por iniciativa propia.
Si necesitan modificar un archivo ajeno, lo comunican al orquestador.

Al finalizar, cada subagente entrega:

- Resumen de lo implementado.
- Archivos modificados.
- Validaciones realizadas y resultados.
- Dependencias, limitaciones y pendientes.

## 6. Secuencia de implementación

### Fase 0: inspección y preparación

El orquestador inspecciona el repositorio y determina qué existe.

Si hace falta scaffolding, lo delega a un subagente ejecutor.
Ese subagente termina antes de iniciar tareas que dependan de la base.

No crear una segunda estructura de Express si ya existe una base
compatible preparada por Alex.

### Fase 1: módulos independientes

El orquestador distribuye tareas que puedan ejecutarse simultáneamente
con archivos exclusivos y contratos definidos.

No iniciar consumidores de contratos que todavía no estén acordados.

### Fase 2: integración

Un subagente ejecutor realiza la integración cuando las piezas
necesarias estén terminadas.

Durante la integración, ningún otro subagente modifica los archivos
reservados al integrador.

### Fase 3: validación

Un subagente ejecutor realiza las comprobaciones acordadas:
instalación reproducible, arranque, validación de entradas, manejo de
errores y comprobación del flujo de planificación.

El orquestador revisa la evidencia y delega las correcciones necesarias.

No declarar terminada una integración con Supabase, frontend o Web Push
si solo se comprobó mediante dobles de prueba o datos en memoria.

## 7. Trabajo de Samuel antes de la incorporación de Alex

Samuel puede avanzar de forma independiente en:

backend/src/modules/planificacion/

Dentro de ese módulo puede implementar:

- Validación de solicitudes y respuestas.
- Integración con DeepSeek.
- Generación y reorganización de borradores.
- Edición y transición a aprobación.
- Interfaces de repositorio.
- Repositorio en memoria para desarrollo.
- Router exportable para su montaje posterior.
- Datos ficticios y validaciones del módulo.
- Documentación de integración.

El repositorio en memoria es temporal y no equivale a persistencia real.

Si necesita un entorno de ejecución independiente, debe quedar dentro
del módulo, documentado como temporal y sin modificar el arranque común.

Mientras Alex no se incorpore, los agentes de Samuel no modificarán:

- frontend/
- Migraciones o políticas de Supabase.
- Autenticación compartida.
- Cola de asistencia o Web Push.
- Arranque y configuración común del backend.
- Manifiestos y lockfiles compartidos.

El montaje del router y la adaptación a persistencia real se coordinarán
con Alex mediante un contrato explícito.

## 8. Convenciones técnicas

- Respetar las convenciones existentes del repositorio.
- Mantener controladores HTTP separados de la lógica de negocio.
- Aislar DeepSeek detrás de un proveedor.
- Acceder a persistencia mediante interfaces de repositorio.
- Validar la salida de la IA antes de utilizarla.
- Configurar timeout y manejo de errores del proveedor.
- Evitar registrar claves o información personal en logs.
- No inventar datos del atleta cuando falte información obligatoria.
- Mantener contratos HTTP consistentes con docs/01-contrato.md.
- No incorporar dependencias compartidas sin coordinar con su propietario.

Si existen instrucciones AGENTS.md dentro de una carpeta, leerlas antes
de trabajar en ella y resolver cualquier contradicción antes de editar.

## 9. Git y protección del trabajo

- Cada rama integra mediante PR hacia develop.
- main recibe la versión integrada y ensayada.
- Conservar los cambios locales del equipo.
- Utilizar datos ficticios para desarrollo y demostraciones.
- Mantener secretos en variables de entorno.
- Excluir .env, node_modules y .vscode del control de versiones.
- Los archivos .env.example contienen únicamente valores de ejemplo.
- No utilizar force push, reset --hard ni git clean.
- No cambiar de rama, fusionar ni publicar cambios automáticamente
  cuando eso pueda afectar trabajo pendiente.