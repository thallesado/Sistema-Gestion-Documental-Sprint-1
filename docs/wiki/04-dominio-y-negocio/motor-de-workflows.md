# Motor de workflows y aprobaciones

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Persistencia y vocabulario real

| Concepto | Tabla/campos |
|---|---|
| Plantilla | workflow_templates: familia, versión, publication_status |
| Nodos y conexiones | workflow_template_stages / workflow_template_transitions |
| Proceso en ejecución | workflows |
| Documentos de proceso | workflow_documents |
| Tareas | workflow_tasks |
| Entradas a etapas | workflow_steps |
| Decisiones de aprobación | workflow_approvals |
| Comentarios/eventos | workflow_comments / workflow_events |
| Avisos | notifications, canal IN_APP |

No usar nombres inventados como workflow_instances o workflow_template_steps. Consultar las migraciones 026-032 y el motor.

Plantillas: publicación DRAFT, ACTIVE, INACTIVE. Procesos: IN_PROGRESS (compatibilidad STARTED), PAUSED, COMPLETED, REJECTED, CANCELED y estados históricos admitidos por las consultas. No confundir fin del proceso con estado documental.

## Reglas

- Origen DOCUMENT, EXPEDIENT o INDEPENDENT según plantilla; ANY permite compatibilidad. No se limita a pacientes ni documentos clínicos.
- Acciones de tarea: BEGIN, COMPLETE, REVIEW, APPROVE, REJECT, RETURN, ESCALATE. No usar REQUEST_CHANGES.
- Asignación a usuario/rol/área/grupo; responsable elegible y permisos verificados al iniciar y actuar.
- Plazos de etapas en due_days; vencimientos en timestamps, no deadline_hours inventado.
- Solo superior a solicitante y autor puede aprobar; excepción workflow_owner. Administrador de plataforma no obtiene acceso transversal.
- Bloqueo de workflow/tarea y validación de tarea no resuelta; nueva versión antes de completar corrección y versión exacta al aprobar.
- Edición crea versión nueva; procesos existentes conservan su versión.
- Comentarios/eventos inmutables. Notificaciones internas; correo de recuperación no equivale a correo de workflows.

Diseñador: nodos Inicio/Tarea/Revisión/Aprobación/Decisión/Notificación/Archivo/Fin, conexiones, reglas, undo/redo, zoom, preview y validación. No añadir scripts/BPMN/paralelismo avanzado fuera del alcance acordado.

## Discrepancias conocidas

Guardar nueva versión DRAFT desactiva la publicada anterior en el motor local; no presentarlo como comportamiento deseado. dueSoon usa ventanas distintas en lista y widget. Ver estado y probar antes de garantizar corrección.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/WorkflowRequests.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/WorkflowRequests.java), [database/init/032_workflow_template_publication.sql](../../../database/init/032_workflow_template_publication.sql). Guías detalladas existentes: [workflows](../../workflows.md), [historias](../../workflows-user-stories.md), [matriz 1-121](../../workflows-compliance-1-50.md), [matriz 122-215](../../workflows-compliance-122-215.md). Sus resultados son históricos, no pruebas ejecutadas hoy.
