# Estructura Spring Boot y contratos

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

Java 21, Spring Boot 3.2.12. Código de negocio en `backend/bootstrap/src/main/java/com/lta/gestdocum/backend/`.

| Paquete | Uso |
|---|---|
| controller | Rutas REST y autorización de métodos |
| dto | Solicitudes/respuestas; existen records y clases Lombok |
| service | Negocio, transacciones y orquestación |
| repository / model | Persistencia y entidades |
| security | JWT, contexto y sanitización |
| config | SecurityConfig, CORS e HttpAuditInterceptor |
| exception / support | Errores y utilidades como CrudTextSupport |

`backend/modules` no es implementación hexagonal funcional. El punto de arranque también existe fuera del subpaquete backend; `backend/shared` contiene utilidades.

## API existente

Base `/api/v1`. Ver controladores para métodos, DTOs y permisos exactos:

| Controlador | Origen de rutas |
|---|---|
| AuthController / PasswordRecoveryController | /auth/login, refresh, logout, me; forgot/reset-password |
| UserController / RoleController / PermissionController | /users, /roles, /permissions |
| TenantController / TenantDepartmentController | /tenants, /departments |
| DocumentController / DocumentTypeController / TagController | /documents, /document-types, /tags |
| ExpedientController / ExpedientTypeController | /expedients, /expedient-types |
| PatientController / ClinicalHistoryController / MedicalNoteController | /patients, /clinical-histories, /medical-notes |
| PatientQuickSummaryController | /patients/{id}/quick-summary |
| WorkflowController | /workflows |
| AuditController / DashboardController | /audit, /dashboard |
| OcrController | /ocr/process, jobs, stats y decisiones persistidas |

No interpretar la lista como CRUD completo. DocumentController no tiene edición general de metadatos en la base local.

## Patrón para cambios

1. Inspeccionar controlador, DTO y permisos equivalentes existentes.
2. Validar entradas, relaciones y estado; no confiar en campos ocultos del cliente.
3. Servicio transaccional con contexto tenant establecido antes de consultar.
4. Repositorio con filtros tenant/estado y paginación; RLS como defensa adicional.
5. Errores estandarizados y pruebas de autorización/integridad apropiadas.

No inyectar un `tenantId` arbitrario en un servicio de negocio para eludir contexto. Evitar exponer consultas internas. En JDBC usar parámetros; tablas dinámicas solo mediante allowlist verificada.

Fuentes: [backend/pom.xml](../../../backend/pom.xml), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/AuthenticatedUserContext.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/AuthenticatedUserContext.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/exception/GlobalExceptionHandler.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/exception/GlobalExceptionHandler.java).
