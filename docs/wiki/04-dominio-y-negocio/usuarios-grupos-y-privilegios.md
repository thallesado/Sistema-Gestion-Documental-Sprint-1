# Usuarios, grupos y privilegios

> Revisión documental: 2026-10-27. Base de código `3f80c45` más la personalización de usuarios (migración 060, sin commit al redactar); las secciones B1–B3 proceden de `855ffff` (2026-10-18). Ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

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

## Personalización de usuarios (`user:customize`)

En `/users`, cada fila muestra **Personalizar** a quien tiene `user:customize` (`*appHasPermission`). El modal (`user-customization-modal.ts`) tiene cinco pestañas. Los endpoints exigen `user:customize` **y** `user:read`:

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/users/{id}/customization` | Valores actuales, espacio usado, zona horaria del tenant y si tiene sesión activa |
| PUT | `/api/v1/users/{id}/customization` | Guarda todo; si cambia el acceso o se exige cambio de contraseña, revoca sus sesiones |
| POST | `/api/v1/users/{id}/sessions/revoke` | Cierra todas sus sesiones (no la propia) |

| Pestaña | Campos | Dónde se aplica |
|---|---|---|
| Perfil | Cargo, teléfono, biografía | Cargo en `user_customizations`; teléfono y biografía en `users` |
| Interfaz | Idioma predeterminado, pantalla de inicio | `AuthService` (frontend) los aplica una vez tras el login; la pantalla solo si el usuario tiene el permiso de esa ruta (`permittedLandingPage`) y no hay `returnUrl` |
| Notificaciones | Correo y push | Columnas existentes de `users` |
| Seguridad y acceso | Cambio de contraseña obligatorio, acceso válido hasta (fecha inclusive), días y franja horaria | `AuthService.login` y `refresh` (backend) rechazan con 403 y el motivo (`UserAccessPolicy`, zona horaria `tenants.timezone`; franja nocturna permitida). Un administrador no puede cambiar su propio acceso |
| Documentos | Máximo por archivo (1–25 MB), cuota de almacenamiento, tipos documentales permitidos | `DocumentStorageService.upload`/`adoptExistingFile` (tamaño y cuota sobre las versiones de las que es autor) y `DocumentService.create` (403 si el tipo no está permitido). La interfaz filtra el selector al crear documentos y al indexar en OCR. Los límites del plan siguen aplicándose |

Datos (migración `060_user_customizations.sql`): `user_customizations` (una fila por usuario) y `user_allowed_document_types`, ambas con FK compuesta a `users`, ENABLE/FORCE RLS, `tenant_context` restrictiva, lectura de la propia fila o con `user:customize`, escritura con `user:customize`, `trg_audit_change` y `backup_write_lock`. `app.user_storage_bytes(uuid)` (SECURITY DEFINER) devuelve el consumo del propio usuario o, con `user:customize`, el de otro. La política `customize_update` permite actualizar `users` con `user:customize`, y el trigger `users_guard_customize_update` limita esa vía a `phone`, `biography`, notificaciones, `must_change_password` y `preferred_language` cuando falta `user:update`. El permiso se concede al grupo `Administrador de tenant` existente; los tenants nuevos lo reciben porque el alta asigna todos los permisos activos.

La restricción de acceso se comprueba al iniciar sesión y al renovar el token, no en cada petición: un token emitido antes del cambio sigue siendo válido hasta que expire, salvo que se revoquen las sesiones (el PUT lo hace al cambiar el acceso). La lista de pantallas de inicio es `UserCustomizationService.LANDING_PAGES` y debe coincidir con `LANDING_PAGES` del modal (`frontend/tests/user-customization.test.mjs`). Pruebas: `UserCustomizationServiceTest` y `scripts/tests/user-customizations.sql`. La ayuda incluye el artículo `personalizar-usuarios` (archivo en `frontend/public/assets/help` y copia en `help-drawer.ts`) con una pregunta frecuente, el manual del asistente tiene la sección «Personalizar usuarios» y el paso `usuarios` del recorrido guiado (`tour-translations.ts`, cuatro idiomas) menciona la opción.

## Pendiente o no verificado

- La migración 040 no se ejecutó contra una base PostgreSQL en esta revisión; solo se revisó y se probó la lógica en pruebas unitarias.
- `GET /api/v1/clinical-histories/{id}/documents` (`ClinicalHistoryService.toDocumentResponse`) aplica la misma ocultación por componente que el listado de documentos; la prueba es `ClinicalHistoryLinkedDocumentsHiddenTest`. El orden (`sort`) de las vistas de workflow usa una lista cerrada de columnas de `WorkflowEngineService` (título, fechas, estado, prioridad, progreso) que no incluye nombre, código ni descripción del documento; cualquier otro valor ordena por fecha de creación, así que no se puede inferir un dato oculto por el orden.
- `GET /users/{id}` y `GET /users/me` (`UserService`) no se auditaron en esta revisión: solo el listado aplica `UserFormPolicy.hideComponents`.
- La migración 060 y `scripts/tests/user-customizations.sql` no se ejecutaron contra PostgreSQL al redactar (Docker no disponible); solo se probaron la lógica Java y la interfaz.
- Los permisos y estados se recalculan al iniciar sesión; un cambio de grupo afecta a la sesión abierta en el siguiente login o refresh.

Fuentes: [UserCustomizationService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserCustomizationService.java), [UserAccessPolicy.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserAccessPolicy.java), [060_user_customizations.sql](../../../database/init/060_user_customizations.sql), [user-customization-modal.ts](../../../frontend/src/app/features/users/components/user-customization-modal.ts), [ComponentFormAccess.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ComponentFormAccess.java), [ComponentFormCatalog.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ComponentFormCatalog.java), [UserFormPolicy.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserFormPolicy.java), [042_component_permissions.sql](../../../database/init/042_component_permissions.sql), [form-registry.ts](../../../frontend/src/app/core/auth/form-registry.ts), [field-permission.directive.ts](../../../frontend/src/app/core/auth/field-permission.directive.ts).
