# Usuarios, grupos y privilegios

> Revisión documental: 2026-10-18. Base de código `855ffff` más los cambios de las tareas B3, B1 y B2 (rama `oscar`); ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Tres niveles de usuario

| Nivel | Implementación |
|---|---|
| Superadministrador | Cuenta de plataforma (`users.is_platform_admin`, sin tenant). Authorities fijas de `PlatformAuthorities`. |
| Administrador | Grupo `Administrador de tenant` creado por el alta pública (`PublicOnboardingService`) con todos los permisos activos. |
| Grupos o perfiles | **Grupo = perfil = rol del tenant** (`roles`). El administrador los crea, les asigna funciones y les añade usuarios. |

Decisión: no se creó una entidad nueva ni se tocaron `app.has_permission` ni las políticas RLS. `user_groups` y `user_group_members` siguen sin uso. Pendiente confirmar con el docente que "grupo" no es una entidad distinta del rol.

Reglas de B1:

- `UserFormPolicy` (una llamada desde `UserService` al crear y otra al editar) exige al menos un grupo. Editar sin `roleIds` conserva los grupos actuales; una lista vacía devuelve 400.
- El alta pública crea solo el grupo administrador. Los grupos de demostración de `003_seed.sql` y `018_*` se conservan; 018 solo recorrió los tenants que existían al migrar.
- El alta de tenants por superadministrador (`TenantService`) no crea grupos ni administrador: queda para la tarea A1.

## Permisos por función en la interfaz (B3)

`AuthResponse` y `GET /auth/me` devuelven `permissions`. El frontend filtra el menú por el campo `permission` de cada entrada, protege rutas con `hasPermissionGuard` y botones con `*appHasPermission`. Detalle en [arquitectura Angular](../03-frontend/arquitectura-angular.md) y [sesiones](../02-backend/autenticacion-y-sesiones.md).

## Privilegios por componente (B2)

Cada componente de un formulario tiene, por grupo, uno de tres estados: `VISIBLE_EDITABLE`, `VISIBLE_READONLY` o `HIDDEN`. Se configura sobre el mismo formulario para todos los grupos.

- **Datos:** migración `042_component_permissions.sql`. Tabla `component_permissions(tenant_id, role_id, form_key, component_key, state)` con PK compuesta, FK `(tenant_id, role_id)` a `roles`, RLS (`tenant_context` restrictiva, lectura para cualquier usuario válido del tenant, escritura con `component_permission:manage`) y auditoría `trg_audit_change`. La función `app.current_role_ids()` (SECURITY DEFINER) devuelve los grupos activos del usuario del contexto.
- **Regla:** sin fila, `VISIBLE_EDITABLE`. Con varios grupos gana el estado más permisivo; un grupo sin fila aporta `VISIBLE_EDITABLE`. Implementada en `ComponentFormAccess.resolve`.
- **Catálogo:** `ComponentFormCatalog.java` (allowlist del servidor) y `frontend/src/app/core/auth/form-registry.ts` deben coincidir; `frontend/tests/component-permissions.test.mjs` lo comprueba.
- **API** (`ComponentPermissionController`): `GET /api/v1/component-permissions/me?form=` (autenticado); `GET /forms`, `GET /roles/{roleId}?form=` y `PUT /roles/{roleId}?form=` con `component_permission:manage`.
- **Interfaz:** directiva `[appField]="'documento.nuevo.codigo'"` y pantalla `/users/form-permissions` (`form-permissions-page.ts`, el hueco que dejó el PR 0 de andamiaje).

### Aplicación en el servidor

| Formulario | Alta | Edición | Lectura |
|---|---|---|---|
| `usuario` | Rechaza componentes no editables informados | Rechaza cambios en componentes no editables | `GET /users` no devuelve los ocultos |
| `documento.nuevo` | Rechaza componentes no editables informados; si `codigo` o `nombre` no son editables, el servidor asigna un código `DOC-<fecha>-<aleatorio>` y el nombre del tipo documental | No existe edición general de metadatos | Listados y detalle no devuelven los ocultos |
| `nota_medica` | `tipo` y `estado` no editables solo aceptan `EVOLUTION` y `DRAFT`; `contenido` no editable impide crear | El cambio de estado se rechaza si `estado` no es editable | El listado no devuelve los ocultos |

El rechazo es `AccessDeniedException` (403) con el nombre del componente. Un componente obligatorio que no sea editable (por ejemplo `nombre` en el alta de usuarios o `contenido` en notas) impide esa operación para el grupo: es una consecuencia buscada de la configuración.

### Vías de lectura de documentos con ocultación (formulario `documento.nuevo`)

Todas reutilizan `ComponentFormAccess` (gana el grupo más permisivo; sin configuración, visible).

| Vía | Qué oculta | Prueba |
|---|---|---|
| `GET /documents`, `/mine`, `/shared`, `/{id}`; `DocumentService.toResponse` | Componentes ocultos y, en `metadata`, `patientName`/`patientDocumentNumber` (paciente), `doctorName` (responsable) e `issueDate` (emisión) | `DocumentComponentPermissionTest`, `HiddenComponentsReadPathsTest` |
| `GET /dashboard` (documentos recientes) | `code` (codigo) y `name` (nombre) | `DashboardServiceTest` |
| `DocumentSearchService` (búsqueda para el asistente) | Código y descripción; si `nombre` está oculto no busca por nombre | `HiddenComponentsReadPathsTest` |
| `/workflows`, `/workflows/{id}`, `/workflows/tasks`, `/tasks/my`, `/tasks/{id}`, `/{id}/tasks` | `document_name`, `document_code`, `document_description`; la búsqueda no usa nombre/código ocultos | `HiddenComponentsReadPathsTest` |

No aplican ocultación, tras revisar el código: expedientes (`ExpedientService` no incrusta datos de documentos), versiones y descarga (`DocumentStorageService`: nombre de archivo y motivo de versión no son componentes del formulario) y cuentas de plataforma sin tenant (`ComponentFormAccess.unrestricted`). No existe un endpoint de edición de documentos: las escrituras de solo lectura se rechazan en el alta (`requireEditableIfProvided`). La metadata del alta no se valida contra los componentes para no romper el flujo OCR.

## Pendiente o no verificado

- La migración 040 no se ejecutó contra una base PostgreSQL en esta revisión; solo se revisó y se probó la lógica en pruebas unitarias.
- `GET /api/v1/clinical-histories/{id}/documents` (`ClinicalHistoryService.toDocumentResponse`) aplica la misma ocultación por componente que el listado de documentos; la prueba es `ClinicalHistoryLinkedDocumentsHiddenTest`. Pendiente conocido: el orden (`sort`) de las vistas de workflow no valida que la columna no esté oculta, así que podría inferirse el orden de un dato oculto.
- `GET /users/{id}` y `GET /users/me` (`UserService`) no se auditaron en esta revisión: solo el listado aplica `UserFormPolicy.hideComponents`.
- Los permisos y estados se recalculan al iniciar sesión; un cambio de grupo afecta a la sesión abierta en el siguiente login o refresh.

Fuentes: [ComponentFormAccess.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ComponentFormAccess.java), [ComponentFormCatalog.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ComponentFormCatalog.java), [UserFormPolicy.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserFormPolicy.java), [042_component_permissions.sql](../../../database/init/042_component_permissions.sql), [form-registry.ts](../../../frontend/src/app/core/auth/form-registry.ts), [field-permission.directive.ts](../../../frontend/src/app/core/auth/field-permission.directive.ts).
