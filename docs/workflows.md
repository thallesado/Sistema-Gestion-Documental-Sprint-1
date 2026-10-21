# Workflows de NexoDocs

Matriz de cierre del alcance: [cumplimiento de los puntos 1–90](workflows-compliance-1-50.md).

Alcance: puntos 1–90 del prompt maestro.
El motor es documental y también acepta expedientes y procesos independientes;
no depende del modelo clínico.

## Modelo y ejecución

Se extienden las tablas existentes: `workflow_templates`,
`workflow_template_stages`, `workflow_template_transitions`, `workflows`,
`workflow_documents`, `workflow_tasks`, `workflow_comments`, `workflow_events`
y `notifications`. El dashboard sigue leyendo las mismas tareas.

Para preservar datos existentes, activo se almacena como `IN_PROGRESS` (también
se reconoce `STARTED`), cancelado como `CANCELED`. Tarea vencida se deriva de
`due_at` o del estado histórico `OVERDUE`. Las decisiones resueltas tienen
estados independientes `COMPLETED`, `REJECTED` y `RETURNED`, junto a su resultado.
Los estados documentales son independientes. Cancelar un workflow no borra ni
cancela automáticamente el documento.

Prioridades: 1=Urgente, 2=Alta, 3=Media, 4=Baja; el valor histórico 5 también se
muestra como Baja. El progreso se calcula a partir de las tareas resueltas.

El servicio deriva tenant y actor del JWT y establece RLS con
`SET LOCAL ROLE nexodocs_app`. Las acciones bloquean primero el workflow y
después la tarea. Una segunda decisión devuelve 409; un recurso de otro tenant
devuelve 404. Eventos y comentarios son inmutables.

## Jerarquía y permisos

`roles.approval_rank`: operativo 10, supervisor 50, administrador 80,
superadministrador del tenant 100. Los roles personalizados parten de 10.
El dueño puede configurar la jerarquía desde Plantillas.

El aprobador debe estar asignado, tener `workflow:approve` y ser superior tanto
al solicitante como al autor documental. `workflow_owner` habilita la excepción
de autoaprobación. Una cuenta de plataforma no se convierte automáticamente
en dueño ni recibe acceso transversal a workflows.

Se conservan permisos `workflow:read/create/update`, `task:read/create/update`
y documentales. Se añaden `workflow:start/pause/cancel/complete/review/approve/
reject/return/assign/designer` y `workflow_template:read/create/update/delete`.
La interfaz utiliza capacidades del JWT y el servidor valida cada operación.

Escalar requiere motivo y usuario activo del mismo tenant con permiso para la
etapa. Devolver genera una tarea de corrección para el creador o usuario elegido.
Tras corregir se reenvía a la etapa actual o anterior seleccionada.

Cada aprobación verifica la versión documental asignada; si el archivo cambió,
responde 409. El endpoint manual de estado documental impide eludir un workflow
activo, incluso cuando el usuario no puede listar workflows; utiliza una función
SECURITY DEFINER restringida al tenant del contexto.

## Plantillas, diseñador e interfaz

Editar crea siempre una versión nueva. Las instancias mantienen su versión
original. Desactivar impide nuevos inicios sin afectar instancias previas.
Se puede duplicar y consultar el historial de versiones.

El diseñador incluye arrastre, conexiones por selector, propiedades, undo/redo,
zoom, vista previa, validación y diálogo al salir sin guardar. Guarda posiciones
y reglas JSONB; etapas y conexiones se almacenan en tablas normalizadas.

Nodos: Inicio, Tarea, Revisión, Aprobación, Decisión, Notificación, Archivo, Fin.
Se exige un Inicio, al menos un Fin, conectividad completa, salidas coherentes y
ausencia de ciclos. La decisión usa Sí/No según el resultado anterior; no ejecuta
scripts. Hay un aprobador por etapa: varios aprobadores se representan mediante
etapas consecutivas, sin ejecución paralela avanzada.

Asignaciones: usuario, rol, área o grupo; el wizard permite definir usuarios.
Se verifica que todas las etapas tengan un responsable elegible al iniciar.
El wizard tiene seis pasos: origen, plantilla, responsables, fechas, resumen y
confirmación. Los listados usan búsqueda, filtros combinables y paginación real.

Se conservan las ocho opciones del sidebar. Revisión utiliza lista y detalle;
aprobación dispone de lista, detalle y panel de decisión. PDF e imágenes se
descargan autenticados y se muestran con URLs Blob. Otros formatos ofrecen
descarga. El resumen de cambios usa motivos de las versiones reales, sin
inventar diferencias semánticas. No hay resumen OCR ficticio.

Activos ofrece Kanban y tabla. El Kanban clasifica la etapa real en Preparación,
Revisión, Aprobación y Pausados/otros. Es deliberadamente visual: una tarjeta no
se arrastra entre etapas, porque avanzar exige completar la acción y los
controles del servidor. Sus filtros reutilizan la búsqueda, tipo/categoría,
responsable, prioridad y área.

Finalizados es un histórico paginado con tres indicadores: completados durante
el mes, duración promedio y aprobados sin devoluciones. La tabla calcula la
duración y obtiene el aprobador final de la última tarea formal de aprobación.
El detalle se abre como drawer derecho con pestañas Detalle, Participantes,
Comentarios, Historial y Documento. Los participantes se derivan del solicitante,
las asignaciones de etapas, responsables de tareas, actores del historial y
autores de comentarios.

Las correcciones documentales requieren subir una nueva versión antes de
completar la tarea de corrección. Cada aprobación registra la versión exacta
revisada, y una modificación posterior invalida la aprobación del flujo vigente.

El catálogo de plantillas muestra categorías obtenidas del tenant, métricas de
pasos, asignaciones y duración estimada. Crear o editar abre un wizard de seis
secciones sobre el diseñador visual. Revisión y aprobación guardan reglas como
permitir devolución/rechazo; el servidor vuelve a comprobarlas al actuar.

`workflow_steps` persiste cada entrada a una etapa, incluyendo reintentos tras
corrección, y la tarea referencia su instancia concreta. Para no duplicar el
historial, `workflow_events` sigue siendo la fuente canónica inmutable y
`workflow_transitions` es una vista de compatibilidad sobre esos eventos.

Las notificaciones de esta fase son internas (`IN_APP`). Mailtrap y correo
electrónico quedan pendientes.

## API

Base: `/api/v1/workflows`.

| Método y ruta | Operación |
|---|---|
| GET `/`, `/summary`, `/options` | Listado, contadores y referencias del tenant |
| POST `/` | Iniciar desde plantilla activa |
| GET/PUT `/{id}` | Detalle / edición de información general |
| POST `/{id}/actions` | PAUSE, RESUME, CANCEL |
| GET `/templates`, `/templates/{id}` | Catálogo paginado y versión completa |
| POST `/templates`, PUT `/templates/{id}` | Crear / nueva versión |
| DELETE `/templates/{id}` | Desactivar |
| POST `/templates/validate` | Validar grafo |
| POST `/templates/{id}/instantiate` | Instanciar una plantilla activa |
| GET `/tasks`, `/tasks/my`, `/tasks/{id}` | Cola personal y detalle |
| GET `/{id}/history`, `/{id}/tasks` | Historial y tareas de un workflow |
| GET `/approvals/my` | Historial de decisiones del usuario autenticado |
| POST `/tasks/{id}/actions` | BEGIN, COMPLETE, REVIEW, APPROVE, REJECT, RETURN, ESCALATE |
| POST `/tasks/{id}/comments` | Comentario inmutable |
| PUT `/tasks/{id}/checklist` | Persistir respuestas |
| GET `/notifications`, PATCH `/notifications/{id}/read` | Avisos propios |
| PATCH `/roles/{id}/hierarchy` | Nivel de aprobación, solo dueño |

Listados: `page` base cero, `size` hasta 100, búsqueda y filtros combinables.
Se conservan `/workflows/pending-review` y `/workflows/pending-approval` y existen
alias `/workflows/review` y `/workflows/approval`.

## Despliegue y pruebas

Para bases existentes, realizar respaldo y ejecutar en orden las migraciones
`026_workflow_engine.sql`, `027_workflow_task_decisions.sql`,
`028_workflow_document_guard.sql`, `029_workflow_step_instances.sql`,
`030_workflow_approvals_deadlines.sql`, `031_workflow_status_rules.sql` y
`032_workflow_template_publication.sql`. Una base vacía ejecuta `database/init`
automáticamente. PostgreSQL 17 es la versión del Compose.

```bash
docker compose --env-file .env -p nexodocs -f infrastructure/docker-compose.yml exec -T postgres psql -U nexodocs -d nexodocs -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/026_workflow_engine.sql -f /docker-entrypoint-initdb.d/027_workflow_task_decisions.sql -f /docker-entrypoint-initdb.d/028_workflow_document_guard.sql -f /docker-entrypoint-initdb.d/029_workflow_step_instances.sql -f /docker-entrypoint-initdb.d/030_workflow_approvals_deadlines.sql -f /docker-entrypoint-initdb.d/031_workflow_status_rules.sql -f /docker-entrypoint-initdb.d/032_workflow_template_publication.sql
docker compose --env-file .env -p nexodocs -f infrastructure/docker-compose.yml up -d --build
```

Docker compila y ejecuta las pruebas Maven de forma aislada del editor.
`scripts/test-workflows.ps1` prueba revisión, checklist, comentarios, devolución,
corrección, aprobación, escalación, pausa, rechazo, paginación, RBAC, aislamiento,
autoaprobación, doble decisión y versiones documentales y de plantillas.
Usa cuentas demo locales y crea registros de prueba con sufijos aleatorios;
se conserva su historial.

`scripts/test-workflows-ui.cjs` usa Playwright y Edge para probar pantallas,
diseñador, guardado, salida con cambios, wizard y mobile. Puede localizar
Playwright con `PLAYWRIGHT_PACKAGE`.

Los puntos 91â€“121 incluyen decisiones y checklist normalizados, auditorÃ­a y
notificaciones de vencimiento, secciones de workflow en documento/expediente,
estados documentales configurables por plantilla y congelados al iniciar,
indicadores de mis tareas/revisiones/aprobaciones, actividad e historial de
aprobaciones en el perfil, cÃ³digos `WF-AAAA-NNNNNN`, y rutas paginadas de historial,
tareas anidadas y aprobaciones propias. Se conservan JWT, RLS por tenant, RBAC,
control jerÃ¡rquico de aprobaciones y transacciones con bloqueo.

Fuera de alcance: BPMN XML, scripting, subworkflows, firmas digitales, nuevo OCR,
temporizadores complejos y tareas paralelas avanzadas.
