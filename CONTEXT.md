# CONTEXT.md — NexoDocs (Sistema de Gestión Documental)

> Documento de contexto para retomar el trabajo en este proyecto sin necesidad de re-explorar todo el repo. Generado el 2026-09-29 a partir de una auditoría del código real (no solo del README, que en varios puntos está desactualizado respecto al código).

---

## 1. Qué es el proyecto

**NexoDocs** es una plataforma SaaS multi-tenant de gestión documental clínica/organizacional: control y trazabilidad de documentos, expedientes, historias clínicas, usuarios, auditoría y reportes. Es un monorepo con:

- **Backend**: Spring Boot 3.2.4 / Java 21 (Maven multi-módulo, pero ver advertencia abajo).
- **Frontend**: Angular 20.3, standalone components.
- **Mobile**: Flutter (MVP simple, ver advertencia abajo).
- **Base de datos**: PostgreSQL 17 con Row-Level Security (RLS) multi-tenant.
- **Paquete compartido**: `packages/shared` (TypeScript, DTOs/tipos compartidos con el frontend).
- Orquestación con Docker Compose, CI en GitHub Actions.

**Gestor de dependencias JS**: pnpm (workspace con `pnpm-workspace.yaml`).

### ⚠️ Discrepancias importantes entre README y código real

1. **Backend "hexagonal multi-módulo" es en gran parte scaffold vacío.** `backend/pom.xml` declara módulos Maven (`autenticacion`, `usuarios`, `documentos`, `expedientes`, `clinico`, `auditoria`, `tablero`, `reportes`) con paquetes `application/{dto,mapper,usecase}`, `domain/{model,repository,service}`, `infrastructure/persistence`, `presentation/controller` — pero **todas esas carpetas solo contienen `.gitkeep`, sin código real**. Toda la implementación de Sprint 1 vive de forma plana en `backend/bootstrap/src/main/java/com/lta/gestdocum/backend/` con paquetes clásicos por capa (`controller/`, `service/`, `model/`, `repository/`, `dto/`, `exception/`, `config/`, `security/`). Es decir: hoy es un **monolito Spring Boot por capas**, no una arquitectura hexagonal modular real. El scaffold está preparado para una futura migración.
2. **Mobile "Clean Architecture + BLoC + GetIt" tampoco está implementado.** `mobile/lib/features/{auditoria,auth,clinico,documentos,expedientes,reportes,tablero,user}/{data,domain,presentation}` son carpetas vacías (`.gitkeep`). `pubspec.yaml` **no** declara `flutter_bloc`, `get_it`, `dio` ni `equatable`. `injection/injection_container.dart` es un stub vacío. La app real y funcional vive en `mobile/lib/screens/*` (estructura plana, sin separación de capas) más `mobile/lib/core/api/auth_api.dart` para las llamadas HTTP.
3. **El tenant demo "Acme" fue renombrado a "FinoCode"** en la migración SQL 016, aunque las credenciales `@acme.com` del README siguen funcionando (el slug/id no cambió, solo el nombre visible).
4. El README dice Angular 19+; el código usa **Angular 20.3**.
5. `application.yml` del backend apunta a `jdbc:postgresql://127.0.0.1:5434/nexodocs` (puerto 5434) mientras `docker-compose.yml` usa el 5432 estándar internamente — revisar mapeo de puertos si hay problemas de conexión en desarrollo local.

---

## 2. Backend (`backend/`)

### Estructura real
- `backend/bootstrap/` — **aquí vive todo el código real**: `controller/`, `service/`, `model/`, `repository/`, `dto/`, `exception/`, `config/`, `security/`. Punto de entrada Spring Boot.
- `backend/shared/` — utilidades comunes: `JwtUtils` (HMAC-SHA, claims, expiración), excepciones y DTOs compartidos.
- `backend/modules/*` — scaffold vacío (ver advertencia arriba), preparado para una futura migración a hexagonal real por módulo.
- Sin Flyway/Liquibase: `hibernate.ddl-auto: update` + esquema gestionado a mano vía `database/init/*.sql`.
- Documentación interactiva: Swagger/OpenAPI (springdoc 2.5.0) en la raíz (`/`).

### Endpoints REST principales (todos bajo `/api/v1`)

| Controller | Rutas |
|---|---|
| `AuthController` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| `PasswordRecoveryController` | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| `UserController` | CRUD `/users` + `GET /users/responsible` |
| `RoleController` | `GET /roles` |
| `TenantController` | `GET/POST /tenants`, `PATCH /tenants/{id}/status` (protegido con `@PreAuthorize("hasAuthority('platform:tenant:manage')")`) |
| `TenantDepartmentController` | CRUD `/departments` |
| `DocumentController` | `GET /documents`, `GET /documents/mine`, `GET /documents/{id}`, `POST /documents`, `PATCH /documents/{id}/status`, `POST /documents/{id}/versions` (multipart), `GET /documents/{id}/versions`, `GET /documents/{id}/versions/{versionId}/content` |
| `DocumentTypeController` | CRUD `/document-types` |
| `TagController` | CRUD `/tags` |
| `ExpedientController` | `GET/POST /expedients`, `GET /expedients/{id}` |
| `ClinicalHistoryController` | `GET/POST /clinical-histories`, `GET /clinical-histories/{id}`, `GET /clinical-histories/{id}/timeline`, `PUT/PATCH /clinical-histories/{id}` |
| `PatientController` | `GET/POST /patients`, `GET /patients/{id}` |
| `PatientQuickSummaryController` | `GET /patients/{id}/quick-summary` |
| `MedicalNoteController` | `GET/POST /medical-notes` |
| `AuditController` | `GET /audit` |
| `DashboardController` | `GET /dashboard` |

### Modelos de dominio principales
`Tenant`, `TenantDepartment`, `User`, `Role`, `AuthSession`, `RevokedAccessToken`, `PasswordRecoveryRequest`, `Document`, `DocumentType`, `DocumentVersion`, `Tag`, `Expedient`, `Patient`, `ClinicalHistory`, `ClinicalEpisode`, `ClinicalStaff`, `MedicalNote`, `AllergyEntry`, `MedicationEntry`, `BaseDiagnosisEntry`, `AuditEvent`.

### Servicios y lógica de negocio destacada
- **`DocumentStorageService`**: guarda archivos en disco local (`app.storage.local-path`, default `./data/storage`), calcula checksum SHA-256, restringe MIME a PDF/JPEG/PNG/DOCX.
- **`AccessTokenRevocationService` + `RevokedAccessTokenStore`/`JpaRevokedAccessTokenStore`**: blacklist persistente de JWT en BD (tabla `revoked_access_tokens`, migración 017, introducida en el commit `7a81324`).
- **`AuthSessionService`**: sesiones JWT persistentes (tabla `auth_sessions`, migración 011).
- **`HttpAuditInterceptor` + `HttpAuditService`/`HttpAuditRecorder`**: audita cada request HTTP hacia `audit_events` (migración 012).
- **`AuthenticatedUserContext`** (en `security/`): expone usuario/tenant autenticado a los servicios para scoping multi-tenant.

### Seguridad (`SecurityConfig`)
- JWT stateless vía `JwtAuthenticationFilter`.
- CORS con orígenes explícitos **obligatorios**: la app falla al arrancar si `CORS_ALLOWED_ORIGINS` está vacío o es `*` (hardening deliberado).
- Rutas públicas: login, refresh, forgot/reset-password, swagger, error. Todo lo demás requiere autenticación.
- `@EnableMethodSecurity` + `@PreAuthorize` por permiso granular (ej. `platform:tenant:manage`).

### Configuración clave (`application.yml`)
- Puerto 8080, DB `jdbc:postgresql://127.0.0.1:5434/nexodocs`.
- Mail SMTP configurable (Mailtrap por defecto).
- Multipart hasta 25MB.
- JWT: expiración access 8h / refresh 7 días.
- Nota: hay propiedades duplicadas `jwt.*` y `app.jwt.*` (probable legado a unificar).

---

## 3. Base de datos (`database/init/001` a `017`)

Migraciones SQL secuenciales versionadas manualmente (tabla `app.schema_migrations`, patrón idempotente `\gset`/`\if` desde la 004). `pgcrypto` habilitado para `gen_random_uuid()`.

| # | Contenido |
|---|---|
| 001 | Esquema base: `plans`, `plan_limits`, `plan_features`, `tenants`, `tenant_departments`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_groups`, `user_group_members`, `retention_policies`, `document_categories`, `document_types`, `metadata_definitions`, `expedient_types`, `expedients`, `expedient_participants`, `documents`, `document_versions`, `clinical_histories`, `workflows`/`workflow_templates`/`clinical_episodes`. Todo con `tenant_id uuid` y PK compuestas `(tenant_id, id)` para FKs tenant-scoped. |
| 002 | Row-Level Security (RLS) genérica: activa `ENABLE/FORCE ROW LEVEL SECURITY` y política `tenant_isolation` (`tenant_id = app.current_tenant_id()`) en todas las tablas multi-tenant automáticamente. |
| 003 | Seed inicial: planes, tenant demo Acme, departamentos, usuarios, permisos, roles, expedientes y documentos de ejemplo. |
| 004 | Hardening SaaS: constraints de integridad, separación plataforma/tenant en `users` (`ck_users_platform_separation`), asignación tipada de etapas de workflow, constraints de fechas. |
| 005 | Generación masiva de usuarios demo adicionales (`tmp_names`). |
| 006 | Tabla `password_recovery_requests`. |
| 007 | Permisos para gestión de usuarios por tenant. |
| 008 | Ajustes de compatibilidad de estado tenant/usuario (HU-02). |
| 009 | Extensión del dominio clínico: nuevas columnas en `clinical_histories`, permisos clínicos. |
| 010 | Tabla `medical_notes` (ligada a `clinical_history_id` + `episode_id` opcional, autor, tipo, contenido), con RLS propia. |
| 011 | Tabla `auth_sessions` (sesiones JWT persistentes). |
| 012 | Trigger/función de auditoría HTTP hacia `audit_events`. |
| 013 | Ajustes en `document_versions` para checksum SHA-256. |
| 014 | Ajuste de privilegios sobre `password_hash`. |
| 015 | Usuarios superadmin demo dentro del tenant Acme (`andres`, `edixon`, `oscar`, `diego`, `denilson`, `mauricio` + sufijo `.superadmin` — parecen ser el equipo de desarrollo). |
| 016 | **Renombra el tenant Acme a "FinoCode"** (id/slug/code intactos) y migra a los 6 superadmins de la 015 a usuarios de **plataforma** (`tenant_id = NULL`, `is_platform_admin = true`). |
| 017 | Tabla `revoked_access_tokens` (blacklist JWT), RLS deshabilitada (tabla de plataforma, no tenant-scoped). |

---

## 4. Frontend (`frontend/src/app/`)

Angular 20.3, standalone components, RxJS 7.8.

### `core/`
- `api/*-api.service.ts`: clientes HTTP tipados (administration, audit, clinical, document, expedient, workspace).
- `auth/`: `auth.service.ts`, `auth.guard.ts`, `auth.interceptor.ts` (inyecta JWT, maneja 401).
- `config/app.config.ts`: bootstrap providers.
- `data/nexodocs-data.ts`: navegación (`NavSection`/`NavItem`/`NavChild`, banderas `visible`/`sprintEnabled`) + bastante data demo hardcodeada (`Patient`, `ClinicalEvent`, notificaciones).
- `data/report-data.ts`: mock data de reportes.
- `state/demo-session.ts`: sesión simulada.
- `routes/app.routes.ts`: rutas reales de features + rutas dinámicas generadas desde `navigationRoutes` para módulos sin feature propia todavía.
- `components/reporting/*`, `components/pagination`, `components/user-selector` (hay duplicados también en `shared/components` — legacy a limpiar).

### `shell/app.ts`
Layout maestro (sidebar/topbar tema "Dark Forest"). Filtra navegación por `role` y por `sprintEnabled !== false` — este es el mecanismo central usado para **ocultar módulos fuera de alcance de Sprint 1**.

### `shared/`
`components/pagination`, `components/user-selector`, barrel `index.ts`.

### `features/` (con lógica de negocio real conectada a la API)
- `auth/`: login, forgot/reset password.
- `documentos/`: CRUD documental con estados (`DRAFT/PENDING/IN_REVIEW/...`).
- `expedientes/`: vistas all/active/closed/archived/new.
- `clinico/`: `clinico-page.ts`, `antecedentes-page.ts` (HU-04, commit más reciente `95b3397`).
- `users/`: `administracion-page.ts` (gestión usuarios/roles).
- `auditoria/`: página + `audit-event-drawer`, `audit-filters`, `audit-pagination`.
- `reportes/`: página + componentes (kpi-card, report-chart, report-table, tenant-selector) — **`sprintEnabled: false`**, usa mock data.
- `tablero/`: `espacio-trabajo-page.ts` (>1300 líneas) — dashboard/workspace que absorbe rutas sin feature dedicada; mezcla datos reales con **stubs explícitos** ("operación pendiente de integración con la API", "STUB · INTEGRACIÓN DE ESCRITORIO PENDIENTE") y KPIs hardcodeados.
- `no-encontrado/`: 404 y acceso denegado.

### Módulos ocultos por "fuera de alcance del Sprint 1" (commit `3d70a25`)
Confirmado en `core/data/nexodocs-data.ts` + filtro en `shell/app.ts`. Secciones completas ocultas: **Digitalización (OCR)**, **Workflows**, **Reportes**, **Notificaciones**, **Configuración**. Sub-ítems ocultos dentro de secciones visibles: indicadores del dashboard, Activos/Cerrados/Archivados de expedientes, "Compartidos conmigo" (documentos), Activos/Bloqueados/Áreas/Grupos (usuarios), varias subcategorías de auditoría (creación de documentos, modificaciones, descargas, aprobaciones, eliminaciones, cambios de permisos) — de auditoría solo quedan visibles "Registro general" y "Accesos".

---

## 5. Mobile (`mobile/lib/`)

MVP funcional simple, **sin** la arquitectura Clean/BLoC/GetIt descrita en el README (ver advertencia §1).

- `screens/auth/login_page.dart`
- `screens/shell/main_shell_page.dart` (shell con tabs)
- `screens/dashboard/dashboard_tab.dart`
- `screens/documents/documents_tab.dart`
- `screens/patients/mobile_home_page.dart`, `patients_tab.dart`, `widgets/summary_card.dart`
- `screens/profile/profile_tab.dart`
- `screens/tasks/tasks_tab.dart`
- `core/api/auth_api.dart` (HTTP directo, sin capa de dominio/data separada)
- `core/constants/api_constants.dart`, `core/errors/auth_exception.dart`, `core/theme/app_theme.dart`

`injection/injection_container.dart` es un stub vacío. `features/*` son carpetas vacías preparadas para escalar en sprints futuros.

---

## 6. `packages/shared/`

Paquete TypeScript compartido consumido por el frontend vía workspace pnpm (`pnpm run build:shared` antes de levantar el frontend, paso obligatorio en README y CI):
- `src/index.ts` (barrel)
- `src/types/{api.types.ts, clinical.types.ts, document.types.ts, user.types.ts}`
- `src/constants/roles.ts`
- `src/utils/formatters.ts`

---

## 7. Estado del Sprint 1

**✅ Completo y con backend real conectado:**
- Autenticación completa (login/refresh/logout, recuperación de contraseña, sesiones persistentes, revocación JWT).
- Gestión de usuarios/roles/departamentos/tenants, con separación plataforma vs tenant.
- Documentos: CRUD, versiones con archivo físico + checksum SHA-256, cambio de estado.
- Expedientes: CRUD básico.
- Módulo Clínico: pacientes, historias clínicas, antecedentes, notas médicas (HU-04 = último feature integrado, commit `95b3397`).
- Auditoría: registro general + accesos, con interceptor HTTP real.

**🟡 En progreso / parcialmente mock:**
- Tablero/Dashboard: mezcla datos reales (documentos/expedientes vía API) con contenido hardcodeado y literales "pendiente de integración".
- Reportes: construido en frontend pero 100% mock data, navegación deshabilitada.

**⛔ Explícitamente fuera de alcance del Sprint 1** (ocultado en UI, no eliminado — código disponible para sprints futuros):
- Digitalización/OCR.
- Workflows (motor de aprobación — ya tiene tablas en BD `workflow_templates`/`workflow_tasks` desde migración 004, sin UI/controller activos).
- Reportes, Notificaciones, Configuración.
- Subfunciones específicas listadas en §4 (expedientes, documentos, usuarios, auditoría).

No hay TODOs/FIXMEs explícitos en el backend. En frontend, los "pendientes" visibles son en su mayoría textos de estado de UI, salvo los dos stubs literales citados en `espacio-trabajo-page.ts`.

---

## 8. Infraestructura

### `infrastructure/docker-compose.yml`
Tres servicios:
- `postgres` (imagen `postgres:17-alpine`, monta `database/init` como `docker-entrypoint-initdb.d`, healthcheck `pg_isready`).
- `backend` (build desde `backend.Dockerfile`, perfil `prod`, depende de `postgres` healthy).
- `frontend` (build desde `frontend.Dockerfile`, servido con Nginx, depende de `backend`).

Variables de entorno con defaults de **desarrollo** (contraseñas y JWT secret dummy) — revisar/reemplazar antes de cualquier despliegue real.

### CI (`.github/workflows/`)
- `backend-ci.yml`: en push/PR a `backend/**`, JDK 21 Temurin, `mvn clean verify` (build + tests de todos los módulos Maven, incluidos los vacíos).
- `frontend-ci.yml`: en push/PR a `frontend/**` o `packages/**`, pnpm 9 + Node 22, instala deps, compila `packages/shared`, luego build de Angular. **No corre tests unitarios de Angular en CI**, solo build.
- `mobile-ci.yml`: en push/PR a `mobile/**`, Flutter stable, `flutter pub get`, `flutter analyze --no-fatal-infos`, `flutter test`.

---

## 9. Credenciales demo y tenants

Tenant único de demo real: `id = 20000000-0000-0000-0000-000000000001`, sembrado como "Acme" (migración 003) y **renombrado a "FinoCode"** en migración 016 (slug/code sin cambios; las credenciales `@acme.com` siguen siendo válidas).

| Rol | Usuario | Contraseña | Tenant |
|---|---|---|---|
| Administrador de tenant | `laura@acme.com` | `DemoPass123!` | FinoCode (ex-Acme) |
| Supervisor | `marcos@acme.com` | `DemoPass123!` | FinoCode (ex-Acme) |
| Super Administrador (plataforma) | `carlos@nexodocs.com` | `DemoPass123!` | — (global) |

Superadmins adicionales de **plataforma** (creados en migración 015, migrados de tenant a plataforma en 016 — `tenant_id = NULL`, `is_platform_admin = true`, misma contraseña demo): `andres.superadmin`, `edixon.superadmin`, `oscar.superadmin`, `diego.superadmin`, `denilson.superadmin`, `mauricio.superadmin` (probablemente el equipo de desarrollo).

Usuarios adicionales de relleno generados por la migración 005 (`tmp_names`) para poblar listados de UI.

No hay más tenants sembrados: la arquitectura multi-tenant vía RLS ya soporta múltiples tenants, pero hoy solo hay uno de demo.

---

## 10. Puesta en marcha rápida (resumen del README)

```powershell
# 1. Base de datos
docker compose -f infrastructure/docker-compose.yml up -d postgres

# 2. Backend
cd backend
.\mvnw.cmd clean install -DskipTests
.\mvnw.cmd -pl bootstrap spring-boot:run
# API: http://localhost:8080/api/v1 · Swagger: http://localhost:8080/swagger-ui.html

# 3. Frontend
pnpm install
pnpm run build:shared
pnpm dev   # o: cd frontend && pnpm start
# http://localhost:4200

# 4. Mobile
cd mobile
flutter pub get
flutter run
```

---

## 11. Puntos a tener en cuenta para próximas sesiones

- Si se va a implementar la migración real a arquitectura hexagonal, el trabajo consiste en **mover código de `backend/bootstrap` a los módulos vacíos de `backend/modules/*`**, no en crear módulos nuevos.
- Lo mismo aplica a mobile: si se va a adoptar Clean Architecture + BLoC, hay que **poblar `mobile/lib/features/*`** y añadir las dependencias (`flutter_bloc`, `get_it`, `dio`, `equatable`) a `pubspec.yaml`, migrando la lógica actual de `mobile/lib/screens/`.
- Verificar el desajuste de puerto Postgres (5434 en `application.yml` vs 5432 en compose) antes de depurar problemas de conexión local.
- El README usa "Acme" como nombre del tenant demo; en la base de datos actual se llama "FinoCode" desde la migración 016 — mantener esto en mente al hablar con el usuario sobre datos demo.
- Reportes y Tablero son las áreas con más deuda de mock data pendiente de conectar a la API real.
