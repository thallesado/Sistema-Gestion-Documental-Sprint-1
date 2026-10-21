# Cumplimiento del prompt maestro: puntos 1–121

Fecha de verificación: 8 de octubre de 2026.

Este documento registra el alcance aplicado del prompt maestro, incluido el
editor visual adelantado por autorización expresa y la ampliación de los puntos
91–121.

| Puntos | Estado | Evidencia / adaptación |
|---|---|---|
| 1–3 | Completo | Motor documental transversal; documento, workflow y tarea conservan estados independientes. |
| 4–7 | Completo con compatibilidad | Se preservan los enums históricos: workflow activo usa `IN_PROGRESS` y cancelado `CANCELED`; vencimiento también se deriva de la fecha. Las cuatro prioridades están implementadas. |
| 8 | Completo | Tenant y usuario se obtienen del JWT; consultas y mutaciones aplican RLS y validación de tenant. Una identidad global no recibe acceso transversal implícito. |
| 9 | Completo | RBAC se valida en backend y la interfaz utiliza las mismas capacidades para presentar acciones. |
| 10 | Completo | Sidebar con Todos, Mis tareas, Revisión, Aprobación, Activos, Finalizados, Plantillas y Diseñador. |
| 11–15 | Completo | Tokens existentes, cards, badges, formularios y layouts responsive reutilizados; visor y paginación son componentes compartidos. |
| 16–24 | Completo | Listado del tenant, contadores, búsqueda, filtros combinables, tabla, menú funcional, progreso calculado, paginación API y ordenamiento. |
| 25–26 | Completo | Wizard propio de seis pasos, sin `prompt` nativo, para documento, expediente o proceso independiente. |
| 27–34 | Completo | Cola personal en dos columnas, tabs, detalle, preview autenticado, expediente, comentarios inmutables y acciones condicionadas por tipo y permiso. |
| 35–37 | Completo | Diálogos de confirmación; aprobación, rechazo y devolución registran evento/auditoría y notifican. Motivos obligatorios donde corresponde. |
| 38–44 | Completo | Vista de revisión diferenciada, filtros dinámicos, preview, checklist persistente, comentarios e historial. El resumen OCR se oculta porque no existe extracción configurada. |
| 45–50 | Completo | Aprobación en tres columnas, recepción y prioridad, información documental, trazabilidad, stepper con completado/actual/futuro, cambios por versión y panel de decisión con observaciones. |
| 51–55 | Completo | Activos alterna Kanban/lista, muestra tarjetas completas y filtros combinables. No permite drag & drop manual porque las transiciones deben validar tareas y aprobaciones. |
| 56–60 | Completo | Histórico paginado, tres indicadores calculados, tabla específica y drawer derecho con Detalle/Documento. |
| 61 | Completo | El drawer finalizado muestra el timeline inmutable con usuario, fecha, comentario y resultado. |
| 62–66 | Completo | Catálogo de plantillas con categorías dinámicas, icono, pasos, asignaciones, duración, acciones y versiones. Los nombres del punto 66 se consideran ejemplos, no datos obligatorios para todos los tenants. |
| 67–82 | Completo | Wizard de seis secciones y diseñador real de tres columnas, nodos tipados, drag & drop, conexiones, undo/redo, zoom, fit, propiedades, preview y validación. |
| 83–85 | Completo con adaptación | `workflow_templates`, `workflow_template_stages` y `workflow_template_transitions` son el modelo normalizado y versionado ya existente. Configuración específica se conserva en JSONB. |
| 86–89 | Completo con adaptación | `workflows`, `workflow_steps` y `workflow_tasks` persisten instancia, pasos y tareas. `workflow_transitions` es una vista de compatibilidad sobre `workflow_events`, que es el historial inmutable canónico. |
| 90 | Completo con adaptación | `workflow_comments` usa `author_id` y `comment_text`, equivalentes a `user_id` y `comment`; sus registros son inmutables. |
| 91–92 | Completo | Decisiones de aprobación y checklist tienen persistencia normalizada por tenant, actor y fecha; las decisiones son append-only. |
| 93–95 | Completo | Eventos generan notificaciones y auditoría compartida con tenant, workflow, tarea/etapa, documento/expediente, transición, actor y tiempo. |
| 96–97 | Completo | El detalle documental muestra workflow, estado, etapa, responsable, progreso y vencimiento, y permite iniciar un workflow con permiso. |
| 98 | Completo con adaptación | La plantilla configura eventos de inicio, revisión, aprobación, rechazo, devolución, archivo y finalización; la instancia congela sus reglas. El estado `CURRENT` representa “vigente/VALID” según el enum documental existente. |
| 99 | Completo | El detalle del expediente muestra workflows asociados con estado, progreso, responsable y vencimiento, y permite iniciar uno. |
| 100 | Completo con adaptación | Indicadores del espacio de workflows muestran tareas, revisiones, aprobaciones y vencimientos cercanos del usuario autenticado. |
| 101 | Completo con adaptación | El perfil carga tareas, workflows activos y decisiones del usuario desde API autenticada. |
| 102–108 | Completo | Selectores de usuarios/roles/áreas y asignaciones dinámicas aplican permisos, jerarquía y reglas del motor existentes. |
| 109–112 | Completo | Plazos por etapa, scheduler de vencimientos/SLA y códigos visibles `WF-AAAA-NNNNNN`. |
| 113–121 | Completo con adaptación | API REST con páginas/filtros, JWT, tenant/RLS, RBAC, ownership, bloqueos y transacciones. Respuestas tienen código estable y operaciones duplicadas devuelven conflicto. |

## Reglas adicionales acordadas

- Un usuario común no puede aprobar su propia solicitud ni un documento de un
  autor de igual o mayor jerarquía.
- El superadministrador dueño del tenant puede autoaprobar.
- Escalar reasigna a un usuario activo y autorizado del mismo tenant.
- La aprobación se bloquea si el documento cambió de versión después de llegar
  a la etapa.
- Una plantilla editada genera una versión nueva; los workflows iniciados
  mantienen la versión original.

## Verificación ejecutada

- Build Angular de producción: correcto.
- Suite Java en Docker: 30 pruebas, 0 fallos.
- Suite API de workflows: circuito completo, aislamiento, RBAC, paginación,
  checklist, comentarios, rechazo, corrección, escalado, pausa y versiones.
- Suite UI real con navegador: ocho rutas, diseñador, salida con cambios,
  wizard de seis pasos y viewport móvil.

Los avisos actuales del build Angular son de presupuesto del bundle y
dependencias CommonJS de generación PDF; no impiden compilar ni ejecutar. Su
optimización es una tarea técnica separada y no representa una función faltante
de los puntos 1–50.
