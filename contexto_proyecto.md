# Contexto técnico y de arquitectura: NexoDocs

> Documento generado a partir de la inspección estática del repositorio. Describe el estado del código y de la configuración versionada; no incluye valores del archivo `.env` ni credenciales.

## Resumen del Proyecto

**NexoDocs** es una plataforma multi-tenant para gestión, control y trazabilidad de documentos organizacionales y clínicos. Su núcleo permite catalogar documentos, versionarlos, adjuntar archivos, administrarlos dentro de expedientes y someterlos a flujos de revisión, aprobación y tareas. El dominio clínico añade pacientes, historias clínicas, episodios, notas médicas, enlaces entre documentos e historias, y estructuras DICOM.

Las capacidades principales identificadas son:

- Autenticación con JWT, sesiones persistentes, recuperación de contraseña, perfiles, roles y permisos.
- Gestión SaaS por tenant: planes, departamentos, usuarios, grupos, cuotas y aislamiento de datos.
- Gestión documental: categorías, tipos, metadatos JSONB, versiones, etiquetas, comentarios, ciclo de estados y almacenamiento de archivos local montado en Docker.
- Expedientes y dominio clínico: pacientes, historias, revisiones, notas, episodios y asociaciones documento-paciente.
- OCR con trabajos persistentes, validación/indexación y configuración opcional para Gemini.
- Workflows configurables: plantillas, etapas, transiciones, tareas, checklist, aprobaciones, vencimientos, eventos y notificaciones.
- Auditoría de eventos y de accesos HTTP, reportes y tablero operativo.

La solución expone una API REST bajo `/api/v1`, una aplicación web Angular y un cliente móvil Flutter. El `README.md` presenta la solución como modular y orientada a Arquitectura Limpia/Hexagonal; el análisis del código confirma capas de presentación, servicio, repositorio y persistencia, con la salvedad de que la implementación Java está hoy concentrada casi por completo en `backend/bootstrap`.

## Stack Tecnológico y Dependencias

| Área | Tecnologías principales | Evidencia y uso |
| --- | --- | --- |
| Backend | Java 21, Spring Boot 3.2.12, Maven multi-módulo | API REST, configuración, validación, seguridad y ejecución. |
| Persistencia | Spring Data JPA, Hibernate, PostgreSQL 17 Alpine | Entidades JPA; esquema y migraciones SQL PostgreSQL. |
| Seguridad | Spring Security, JJWT 0.11.5, RBAC y PostgreSQL RLS | JWT stateless, autorización por `@PreAuthorize`, contexto de tenant/usuario y políticas a nivel de fila. |
| API y calidad | Springdoc OpenAPI 2.5.0, Actuator, Jakarta Validation, JUnit | Swagger/OpenAPI, health check, validación de DTOs y pruebas de servicios. |
| Sanitización | Jsoup 1.18.3 | Servicio de sanitización HTML. |
| Frontend web | Angular 20.3, TypeScript 5.9, RxJS 7.8, Zone.js | Componentes standalone, router y cliente HTTP. |
| UI web | Tiptap 3, jsPDF 4, jsPDF-AutoTable 5 | Edición de texto enriquecido y exportación de informes/PDF. |
| Compartido web | pnpm workspace y paquete `@nexodocs/shared` | Tipos, constantes y utilidades TypeScript compartidas. |
| Móvil | Flutter/Dart >= 3.13, `http`, `flutter_secure_storage` | Cliente Android/iOS, comunicación HTTP y almacenamiento seguro local. |
| Infraestructura | Docker Compose, Nginx, Dockerfiles, shell/PowerShell | PostgreSQL, migrador, backend y frontend estático/proxy. |

### Extractos de manifiestos relevantes

`package.json` raíz organiza el workspace de pnpm y delega las tareas al frontend y al paquete compartido:

```json
{
  "name": "nexodocs",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @nexodocs/frontend dev",
    "build": "pnpm --filter @nexodocs/frontend build",
    "build:shared": "pnpm --filter @nexodocs/shared build",
    "test": "pnpm --filter @nexodocs/frontend test"
  }
}
```

El backend declara Java 21 y los módulos de dominio en el agregador Maven:

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>3.2.12</version>
</parent>
<properties>
  <java.version>21</java.version>
</properties>
<modules>
  <module>shared</module>
  <module>bootstrap</module>
</modules>
```

Dependencias destacadas del ejecutable `bootstrap`: `spring-boot-starter-web`, `data-jpa`, `security`, `validation`, `mail`, driver PostgreSQL, JJWT, Springdoc OpenAPI, Jsoup, Lombok y `spring-boot-starter-test`. El frontend declara Angular 20.3, Tiptap, jsPDF, RxJS y TypeScript 5.9. El móvil declara `http` y `flutter_secure_storage`.

## Estructura de Directorios

Árbol de alto nivel. Se excluyen dependencias, artefactos y cachés de compilación (`node_modules`, `target`, `dist`, `.git`, `.next`, `.angular`, `.dart_tool`, `.gradle` y similares).

```text
Sistema-Gestion-Documental-Sprint-1/
├── .github/
│   └── workflows/                 # automatizaciones CI/CD
├── backend/
│   ├── bootstrap/                 # aplicación Spring Boot, API, servicios y JPA
│   ├── shared/                    # DTOs, excepciones, JWT y utilidades Java
│   └── pom.xml                    # agregador Maven
├── database/
│   ├── init/                      # esquema, RLS, semillas y 37 scripts SQL versionados
│   ├── seeds/                     # datos sintéticos y scripts de carga
│   ├── tests/                     # validaciones SQL
│   └── migrate.ps1
├── docs/                          # workflows, historias y matrices de cumplimiento
├── frontend/
│   ├── public/                    # recursos estáticos
│   ├── src/app/
│   │   ├── core/                  # auth, API, configuración, rutas, estado y utilidades
│   │   ├── features/              # auth, clínico, documentos, expedientes, workflows, etc.
│   │   ├── shared/                # componentes reutilizables
│   │   └── shell/                 # layout de la aplicación
│   ├── tests/                     # pruebas Node para flujos UI
│   └── angular.json
├── infrastructure/
│   ├── docker/                    # Dockerfiles, Nginx y script de migración
│   └── docker-compose.yml
├── mobile/
│   ├── lib/                       # core, pantallas, DI y puntos de entrada Dart
│   ├── android/  ├── ios/  ├── web/
│   └── test/
├── packages/shared/               # tipos/constantes/utilidades TypeScript compartidos
├── scripts/                       # automatización de pruebas de workflows
├── Makefile
├── package.json
└── pnpm-workspace.yaml
```

## Modelo de Datos y Base de Datos

### Tecnología y evolución del esquema

La fuente de verdad del esquema es PostgreSQL y está en `database/init`; no se utiliza Prisma ni un ORM para generar las tablas. `001_schema.sql` contiene la base inicial, `002_security.sql` activa el aislamiento inicial y `003_seed.sql` aporta datos semilla. Hay 37 scripts SQL de `001` a `035` (las numeraciones `018` y `020` tienen dos scripts con distinto sufijo). El contenedor `migrate` registra y aplica los posteriores a la instalación inicial en `app.schema_migrations`.

El script de migración solo reaplica scripts no registrados y espera que cada uno registre su propia versión. PostgreSQL también ejecuta los archivos de `database/init` al crear el volumen por primera vez.

### Entidades y agrupación funcional

| Área | Tablas o entidades principales |
| --- | --- |
| SaaS e identidad | `plans`, `plan_limits`, `plan_features`, `tenants`, `tenant_departments`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_groups`, `user_group_members`, `auth_sessions`, `revoked_access_tokens`, `password_recovery_requests` |
| Documental | `retention_policies`, `document_categories`, `document_types`, `metadata_definitions`, `expedient_types`, `expedients`, `expedient_participants`, `documents`, `document_versions`, `document_metadata_values`, `tags`, `document_tags`, `document_comments` |
| Workflows | `workflow_templates`, `workflow_template_stages`, `workflow_template_transitions`, `workflows`, `workflow_documents`, `workflow_tasks`, `workflow_events`, `workflow_comments`, `workflow_steps`, `workflow_approvals`, `workflow_checklist_items` |
| OCR, notificaciones y control | `ocr_jobs`, `notifications`, `audit_events`, `report_templates`, `tenant_usage_monthly`, `backup_history`, además de auditoría de acceso HTTP |
| Clínico e imagen | `patients`, `clinical_staff`, `clinical_histories`, `clinical_history_revisions`, `clinical_episodes`, `clinical_document_links`, `medical_notes`, `dicom_studies`, `dicom_series`, `dicom_instances` |
| Móvil y delegación | `task_delegations`, `user_push_tokens` |

El modelo usa UUID como identificador predominante, `timestamptz` para auditoría temporal, JSONB para metadatos/reglas/detalles, tipos enumerados PostgreSQL para estados y claves foráneas compuestas `(tenant_id, id)` para reforzar pertenencia al tenant. Los estados base incluyen suscripciones, usuarios, expedientes, documentos, workflows, tareas, notificaciones y OCR.

Fragmento representativo del esquema documental y sus relaciones:

```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expedient_id uuid,
  document_type_id uuid NOT NULL,
  author_id uuid NOT NULL,
  patient_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  code varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  status document_status NOT NULL DEFAULT 'DRAFT',
  current_version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, expedient_id) REFERENCES expedients(tenant_id, id),
  FOREIGN KEY (tenant_id, document_type_id) REFERENCES document_types(tenant_id, id)
);

CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  version_number integer NOT NULL,
  file_path text NOT NULL,
  file_name varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  checksum_sha256 char(64),
  author_id uuid NOT NULL,
  UNIQUE (tenant_id, document_id, version_number),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);
```

### Seguridad e integridad de datos

- La base implementa Row-Level Security (RLS) para aislamiento por tenant. El contexto se establece por transacción con `set_config('app.tenant_id', ...)` y `set_config('app.user_id', ...)` desde `AuthenticatedUserContext`.
- Las políticas combinan tenant, usuario actual y permisos RBAC. Hay restricciones específicas para notificaciones, reportes, versiones, documentos y eventos de workflow.
- Eventos de auditoría y de workflow cuentan con triggers que bloquean actualización y borrado. Existen triggers para `updated_at`, control de versiones, integridad de plantillas y estados documentales.
- Historias clínicas incorporan revisión, borrado lógico, bloqueo optimista y vínculos con documentos mediante migraciones posteriores.

Las entidades JPA reflejan una porción operativa de este esquema en `backend/bootstrap/.../model`, entre ellas `Document`, `DocumentVersion`, `Expedient`, `Patient`, `ClinicalHistory`, `MedicalNote`, `OcrJob`, `AuditEvent`, `User`, `Tenant` y `Role`.

## Configuración Principal

### Backend Spring Boot

- Puerto por defecto: `8080`; nombre de aplicación: `nexodocs-backend`.
- Perfiles: `application-dev.yml` usa variables para PostgreSQL local y habilita SQL formateado; `application-prod.yml` requiere `DB_USER` y `DB_PASSWORD`, reduce el log a `WARN/INFO` y espera el host `postgres`.
- La configuración base define PostgreSQL, Hibernate/JPA (`ddl-auto: update`, `open-in-view: false`), correo SMTP configurable, carga multipart de hasta 25 MB por archivo y 26 MB por solicitud.
- JWT de acceso y refresh se parametrizan mediante variables de entorno; CORS, expiración de recuperación de contraseña, directorio de almacenamiento y límites de la consulta pública de tenants también son configurables.
- Integración opcional para Gemini: clave API, modelo, timeout, URL base y espera de reintento. No se documentan ni exponen valores sensibles en este archivo de contexto.
- Springdoc sirve OpenAPI en `/v3/api-docs`; Swagger se configura para uso en la raíz. El README indica `/swagger-ui.html` y Actuator health en `/actuator/health`.

**Observación de consistencia:** el YAML base apunta a una base local `nexodocs` en el puerto 5434, mientras que el perfil de desarrollo usa `gestdocum` y puerto 5432 por defecto. Docker define `nexodocs` y expone 5434 por defecto. Conviene seleccionar explícitamente el perfil y las variables esperadas en cada entorno.

### Docker Compose

El archivo `infrastructure/docker-compose.yml` orquesta cuatro servicios:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    volumes:
      - nexodocs_postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
  migrate:
    depends_on:
      postgres: { condition: service_healthy }
  backend:
    depends_on:
      migrate: { condition: service_completed_successfully }
    volumes:
      - nexodocs_document_storage:/data/storage
  frontend:
    depends_on:
      - backend
```

Los puertos publicados por defecto son PostgreSQL `5434:5432`, backend `8080:8080` y frontend `4200:80`. Los volúmenes persistentes separan datos PostgreSQL y archivos documentales. La configuración se obtiene por variables de entorno con valores de desarrollo para Docker; para despliegues reales deben suministrarse secretos y credenciales fuera del repositorio.

### Web y móvil

- Angular usa `angular.json`, TypeScript estricto mediante `tsconfig.app.json`, proxy de desarrollo en `proxy.conf.json`, componentes standalone y `provideHttpClient` con interceptor de autenticación.
- Las rutas web se cargan principalmente de forma diferida por feature y se protegen con `authGuard`; las rutas de administración añaden `userAdminGuard`.
- Flutter acepta `NEXODOCS_API_URL` en compilación y, en ausencia de ella, usa como base `/api/v1` en el puerto 8080 local. Su contenedor de inyección actualmente es un punto de extensión con inicialización vacía.

## Patrones de Diseño y Arquitectura

### Vista de componentes

```text
Angular 20 SPA ─────┐
Flutter mobile ─────┼──> REST /api/v1 ──> Spring Boot bootstrap
                    │                         ├── Controllers + DTOs
                    │                         ├── Services / casos de uso
                    │                         ├── Spring Data repositories
                    │                         └── JPA entities
                    │
                    └── JWT + RBAC + CORS
                                                │ establece tenant/user por transacción
                                                v
                                        PostgreSQL 17 + RLS + triggers
                                                │
                                        almacenamiento de archivos local
```

### Backend

El patrón efectivo es una arquitectura por capas, próxima a MVC/Service/Repository:

1. **Controladores REST** reciben solicitudes bajo `/api/v1`, validan DTOs y aplican permisos con `@PreAuthorize`.
2. **Servicios** contienen reglas de negocio, límites transaccionales y resolución de tenant/usuario. Ejemplos: `DocumentService`, `WorkflowEngineService`, `ClinicalHistoryService`, `OcrJobService` y `AuthService`.
3. **Repositorios** son interfaces `JpaRepository` con consultas derivadas, JPQL y algunas consultas nativas.
4. **Entidades JPA y DTOs** separan persistencia de contratos HTTP. `shared` contiene respuestas comunes, excepciones, JWT y utilidades.
5. **Infraestructura transversal** gestiona JWT, filtro de autenticación, CORS, OpenAPI, interceptor de auditoría, almacenamiento de archivos, correo y sanitización HTML.

La seguridad combina JWT stateless, autorización por permiso y RLS en PostgreSQL. Es una defensa en profundidad: el servicio fija explícitamente el contexto de usuario/tenant antes de consultar y la base aplica las políticas de aislamiento.

Tras la limpieza estructural, el reactor Maven contiene solo `shared` y `bootstrap`. El backend opera como un monolito Spring Boot por capas: `bootstrap` concentra controladores, servicios, repositorios, entidades, DTOs y configuración; `shared` aporta utilidades, excepciones, DTOs comunes y soporte JWT. No existen módulos Maven de dominio independientes.

### Frontend web

Sigue organización **feature-driven**:

- `core`: servicios API, autenticación, interceptor, guards, rutas, configuración y estado.
- `features`: funcionalidades de negocio con sus páginas, componentes y rutas (autenticación, clínico, documentos, expedientes, workflows, reportes, auditoría y administración).
- `shared`: componentes reutilizables como paginación, exportación y editor enriquecido.
- `shell`: composición visual principal.

Las llamadas HTTP se encapsulan en servicios específicos de API. El router usa carga dinámica de componentes y protección declarativa de rutas.

### Cliente móvil

El cliente móvil mantiene una estructura funcional centrada en `lib/screens`, `lib/core/api` e `injection`. Los esqueletos vacíos `lib/features` y los subdirectorios core sin implementación se eliminaron; el contenedor de inyección aún no registra dependencias. Por tanto, Clean Architecture/BLoC no está implementada como una separación completa de data/domain/presentation.

### Pruebas y verificabilidad

- Backend: pruebas JUnit de servicios para documentos, expedientes, OCR, workflows e historias clínicas, además de sanitización HTML.
- Frontend: pruebas Node para dashboard, documentos, expedientes, búsqueda, OCR, rutas, cámara y workflows.
- Base de datos: scripts de validación, incluida la relación documento-paciente.
- Móvil: prueba de widget base.

## Archivos Fuente de Referencia

- `README.md`, `backend/README.md`, `docs/workflows.md`
- `package.json`, `frontend/package.json`, `packages/shared/package.json`, `mobile/pubspec.yaml`
- `backend/pom.xml`, `backend/bootstrap/pom.xml`
- `database/init/001_schema.sql` y migraciones `002` a `035`
- `backend/bootstrap/src/main/resources/application*.yml`
- `infrastructure/docker-compose.yml` e `infrastructure/docker/migrate.sh`
- `frontend/src/app/core/routes/app.routes.ts`, `frontend/src/app/core/config/app.config.ts`
