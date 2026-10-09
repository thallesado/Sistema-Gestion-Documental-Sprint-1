# Workflow: cierre de los puntos 122–215

Esta matriz complementa [el alcance de los puntos 1–121](workflows-compliance-1-50.md)
y la [guía técnica de Workflows](workflows.md). “Adaptado” identifica opciones
que el prompt marcaba como opcionales o capacidades deliberadamente acotadas.

| Puntos | Estado | Implementación / alcance |
|---|---|---|
| 122–130 | Completo | Navegación, colas y métricas de workflow consumen el motor existente; permisos y tenant se validan en API/RLS, no solo en UI. |
| 131–140 | Completo | Diseñador y plantillas versionadas reutilizan el modelo normalizado; instancias conservan la versión que las creó. |
| 141–150 | Completo | Acciones de revisión, aprobación, rechazo, devolución y escalamiento usan tareas, eventos y reglas del servidor; el dueño del tenant es la única excepción de autoaprobación. |
| 151–160 | Completo | Auditoría/timeline, comentarios y notificaciones internas se alimentan de eventos y registros persistidos; historial append-only. |
| 161–169 | Completo | Integración con documentos/expedientes, filtros, detalle y perfiles respeta el aislamiento tenant y estados existentes. |
| 170 | Completo | Drawer de detalle con pestañas Detalle, Participantes, Comentarios, Historial y Documento. |
| 171–173 | Completo | Timeline muestra tipo/resultado, icono, actor, fecha, comentario y transición desde el historial inmutable. |
| 174 | Completo | Código legible `WF-AAAA-NNNNNN`, generado por el servidor. |
| 175 | Completo | Se rechaza iniciar un segundo workflow activo sobre el mismo documento. |
| 176–177 | Completo | El origen obligatorio depende del tipo de plantilla: documento o expediente; los procesos independientes no requieren origen documental. |
| 178 | Completo | Búsqueda de responsables por nombre, rol y área; se muestran rol, área e iniciales reales. |
| 179–180 | Completo | Prioridad urgente destacada y vencimientos con estados visuales, manteniendo valores persistidos y fechas reales. |
| 181–183 | Adaptado | Listas se reorganizan como tarjetas en pantallas pequeñas; Kanban conserva desplazamiento horizontal. El diseñador completo está optimizado para escritorio/tablet y permanece accesible con scroll en móvil. |
| 184 | Completo | Salir del diseñador con cambios sin guardar solicita confirmación dentro de la aplicación. |
| 185 | Opcional no aplicado | No hay autosave periódico: el guardado explícito evita publicar cambios parciales del diseñador. |
| 186–192 | Completo | Plantillas admiten borrador/publicada/inactiva; clonar crea borrador y solo versiones activas pueden iniciar instancias. Publicar una versión desactiva la anterior sin alterar instancias existentes. |
| 193–195 | Adaptado | Se conserva el diseño visual y los módulos actuales; no se agrega una segunda plataforma de workflow ni se simula funcionalidad externa. |
| 196–197 | Completo | Documento muestra el workflow asociado y sus estados; cambios manuales que eludirían un flujo activo son rechazados por backend. |
| 198 | Completo | Una corrección requiere cargar una versión nueva del documento antes de completar la tarea asignada. |
| 199 | Completo | La aprobación persiste la versión exacta aprobada; los controles detectan cambios de versión durante el flujo. |
| 200–203 | Completo | Pruebas reproducibles de API/UI y escenarios integrados cubren plantillas, tareas, permisos, orígenes y corrección documental. |
| 204–206 | Completo | Guías, matriz de cierre y README describen operación, migración y verificación. |
| 207–208 | Completo | Se verificaron interacciones entre rutas, permisos, tablas y migraciones; ajustes de compatibilidad preservan la protección de plantillas usadas. |
| 209 | Completo | Confirmaciones y mensajes se resuelven con componentes de la aplicación; no se usan `alert`, `confirm` ni `prompt` nativos para el flujo. |
| 210–215 | Completo | Se preservan arquitectura y servicios existentes, aislamiento por tenant, auditoría, validación backend, accesibilidad y estados visibles; no se conceden capacidades cross-tenant implícitas. |

## Verificación

Ejecutar `scripts/test-workflows.ps1` contra una instancia local autenticada y
`scripts/test-workflows-ui.cjs` con Playwright. Las pruebas crean datos con
sufijos aleatorios en el tenant demo. En bases existentes, aplicar también la
migración `032_workflow_template_publication.sql` según `workflows.md`.
