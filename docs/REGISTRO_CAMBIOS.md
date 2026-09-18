# Registro de cambios del proyecto

## 2026-09-18 — tenant FinoCode y separación de administración de plataforma

- Se añadió la migración incremental `016_finocode_tenant_name.sql`, que
  actualiza únicamente el nombre visible del tenant UUID
  `20000000-0000-0000-0000-000000000001` a `FinoCode`.
- `/auth/me` ahora expone `tenantName`, `platformAdmin` y `roleNames`; el
  frontend deja de mostrar el UUID como nombre de organización y elimina el
  selector de rol visual editable.
- La administración global de tenants exige `platform:tenant:manage`, emitido
  únicamente para usuarios marcados como administradores de plataforma.
  `/tenants` y `/tenants/new` tienen además un guard frontend y una pantalla
  propia de acceso restringido; el backend responde 403 ante acceso manual.
- La migración crea identidades de plataforma separadas para las seis cuentas
  demo, con `tenant_id = NULL` e `is_platform_admin = true`. Las identidades
  históricas tenant y sus UUID, relaciones documentales y asignaciones se
  conservan intactas porque `tenant_id` es inmutable.

## 2026-09-18 — contratos mínimos de documentos para el frontend

- Se añadió `GET /api/v1/documents/mine`, siempre limitado al tenant del JWT,
  para devolver documentos creados por el usuario autenticado o asignados a él.
- Se añadió `GET /api/v1/users/responsible` como alias tenant-scoped del listado
  de usuarios activos existente, protegido por `user:read`.
- El alta documental acepta `responsibleUserId` como alias JSON de la columna y
  campo de modelo existente `responsible_id`; no fue necesaria una migración.
- No se añadió `/documents/shared`: el esquema actual no tiene una relación de
  compartición o visibilidad que permita implementarlo sin inventar permisos.

## 2026-09-18 — API REST tenant-scoped de expedientes y usuarios demo de Acme

- Se añadió `GET /api/v1/expedients` (paginado, filtro por código, nombre o
  descripción) y `GET /api/v1/expedients/{id}`. Ambos requieren
  `expedient:read`, usan el tenant del JWT y establecen el contexto RLS antes
  de consultar; nunca aceptan `tenantId` desde el cliente.
- Se incorporó el mapeo backend de `expedients` (`Expedient`, repositorio,
  servicio y DTO), complementando las APIs existentes de pacientes e historias
  clínicas para que Angular pueda consumir datos reales.
- Se añadió la migración idempotente `database/init/015_acme_superadmin_demo_users.sql`
  con seis cuentas demo `Superadministrador` (Andres, Edixon, Oscar, Diego,
  Denilson y Mauricio) y cuatro usuarios de prueba con roles existentes.
  Usa hashes BCrypt generados por PostgreSQL y credenciales solo de demostración.
- No se modificaron migraciones aplicadas ni archivos del frontend.

## 2026-09-18 — dataset sintético reproducible de Acme Consulting

- Se añadieron `database/seeds/acme_synthetic_300.sql` y
  `database/seeds/load_acme_synthetic.ps1`, fuera de `database/init`, para
  cargar explícitamente 300 pacientes sintéticos con una historia clínica,
  documento, versión y vínculo por paciente.
- La carga usa UUID deterministas, transacción, preflight de tenant y
  `ON CONFLICT DO NOTHING`; no edita migraciones, no borra datos y no se
  ejecuta automáticamente en producción. Los correos usan `example.invalid` y
  todos los valores están marcados como sintéticos.
- La base solo conserva la ruta del archivo. El script genera 300 fixtures
  pequeños y opcionalmente los copia al volumen persistente del backend.
  PostgreSQL no puede escribir ese volumen directamente; para producción real
  debe usarse la futura API autenticada de subida.

## 2026-09-18 — corrección de permisos de `/api/v1/auth/me` con volumen existente

- Se identificó que `AuthenticatedUserContext` cambia la conexión a
  `nexodocs_app`, mientras `004_saas_hardening` revoca el `SELECT` de tabla
  sobre `users` y concede columnas explícitas, omitiendo correctamente
  `password_hash` para listados pero incompatiblemente con la entidad JPA
  completa del backend.
- Se añade `database/init/014_auth_user_password_hash_privilege.sql`, sin
  editar migraciones aplicadas ni tocar datos. La corrección concede solo
  `SELECT(password_hash)` al rol `nexodocs_app`; RLS continúa limitando las
  filas y el DTO no expone el hash.
- En una instalación existente debe ejecutarse
  `powershell -NoProfile -File .\database\migrate.ps1`; no se debe eliminar el
  volumen PostgreSQL. La migración es transaccional e idempotente.

## 2026-09-18 — healthcheck del frontend Docker

- El healthcheck de Nginx usa `127.0.0.1` en lugar de `localhost` para evitar
  que la resolución IPv6 compruebe una dirección donde el listener no está
  publicado.
- El cambio corrige el estado `unhealthy` sin alterar el puerto público ni el
  proxy `/api/`.

## 2026-09-18 — compatibilidad del checksum documental

- Se añade la migración incremental `013_document_checksum_compatibility.sql`
  para convertir `document_versions.checksum_sha256` de `char(64)` a
  `varchar(64)`, que es el tipo declarado por Hibernate.
- La conversión elimina únicamente el padding propio de `char`; los valores
  existentes y la restricción de formato SHA-256 se conservan.

## 2026-09-18 — arranque integrado con Docker Compose

- Se documenta el flujo recomendado para levantar PostgreSQL, Spring Boot y
  Angular/Nginx con `docker compose up -d --build --wait`.
- Se mantienen separados los volúmenes de PostgreSQL y almacenamiento
  documental para evitar perder datos al detener o recrear contenedores.
- El flujo local con hot reload permanece disponible para desarrollo diario.
- La inicialización automática de `database/init/` aplica solo sobre un volumen
  PostgreSQL nuevo; las bases existentes deben actualizarse con el migrador
  incremental.

## 2026-09-18 — cierre incremental HU-03 a HU-12

Esta entrada reemplaza las limitaciones históricas que más abajo indicaban que
no existían Flutter, carga binaria o cronología documental.

- HU-03 abre la historia clínica única en la misma transacción que el alta del
  paciente. HU-04 valida y captura alergias, medicación y diagnósticos base
  estructurados desde Angular y REST.
- HU-05 elimina credenciales precargadas y añade renovación coordinada de JWT
  ante respuestas 401. HU-06 publica roles activos por tenant, los consume en
  el alta de usuarios y conecta el registro general a la auditoría persistente.
- HU-07 integra apertura, episodios, notas y documentos vinculados en la línea
  cronológica. HU-08 añade búsqueda con debounce, alta y consulta de notas
  médicas inmutables.
- HU-09 incorpora `mobile/`, cliente Flutter Android/iOS con tokens en almacén
  seguro. HU-10 añade `quick-summary` y consulta móvil de alergias,
  diagnósticos y cinco notas recientes.
- HU-11 incorpora versiones binarias append-only en almacenamiento local,
  límites/tipos permitidos, checksum SHA-256, descarga autenticada y
  transiciones documentales explícitas. Los binarios viven fuera del webroot;
  la base conserva la ruta, tipo, tamaño, hash y autor. Este contrato permite
  que OCR futuro genere candidatos de metadatos sin modificar el original.
- HU-12 añade imágenes multi-stage de backend/frontend, Nginx sin privilegios,
  Compose PostgreSQL + Spring Boot + Angular, healthchecks y volumen separado
  para archivos. Los secretos obligatorios se reciben por entorno.

Verificación: pruebas dirigidas Java por cada HU, `DATABASE_TESTS_OK`,
`pnpm typecheck`, pruebas y build Angular, `flutter analyze`, `flutter test`,
`docker compose config` y build correcto de ambas imágenes.

Limitaciones vigentes: OCR/catalogación automática, validación humana de
metadatos extraídos y adaptador S3 quedan para Sprint 2. El proveedor activo de
HU-11 es almacenamiento local persistente; el bundle Angular mantiene una
advertencia de presupuesto (617.91 kB frente a 500 kB).

## 2026-09-18 — HU-02: contexto RLS y auditoría de accesos HTTP

- El contexto transaccional cambia explícitamente a `nexodocs_app` antes de
  fijar `app.tenant_id` y `app.user_id`, por lo que una conexión propietaria de
  desarrollo deja de omitir RLS en los servicios que usan el contexto.
- Usuarios, tipos documentales, etiquetas, departamentos y consulta de auditoría
  ahora establecen también el contexto RLS en operaciones tenant-scoped.
- La migración incremental `012_http_access_audit.sql` incorpora una función
  `SECURITY DEFINER` que registra método, ruta, resultado, IP y user-agent sin
  copiar cuerpos, tokens ni contenido clínico.
- Un interceptor registra las peticiones `/api/**` autenticadas. Las operaciones
  globales de plataforma quedan fuera hasta separar formalmente su datasource y
  rol PostgreSQL privilegiado.

## 2026-09-18 — HU-01: sesiones refresh persistentes

- Se añadió la migración incremental `011_persistent_auth_sessions.sql`; no se
  modificaron migraciones históricas ni el volumen PostgreSQL local.
- Los refresh tokens se almacenan únicamente como SHA-256, rotan en cada uso y
  una reutilización revoca las sesiones activas del usuario.
- Logout revoca persistentemente el refresh token y el cambio de contraseña
  revoca todas las sesiones anteriores antes de emitir una nueva.
- La revocación del access token continúa en memoria hasta que expire; resolver
  esa limitación requiere persistir identificadores `jti` o reducir su duración.
- Verificación: `AuthSessionServiceTest`, `JwtServiceTest` y
  `JwtAuthenticationFilterTest` correctos; prueba PostgreSQL aislada finalizó
  con `DATABASE_TESTS_OK`.

## 2026-09-18 — HU-08 y HU-11: notas médicas y documentos tenant-scoped

### Cambios arquitectónicos

- Se añadió la migración incremental `010_medical_notes.sql`; no se editaron
  migraciones aplicadas. `medical_notes` vincula cada nota al tenant, historia
  clínica, autor y opcionalmente episodio. Tiene RLS `FORCE`, FK compuesta para
  impedir referencias cruzadas y permisos separados `medical_note:read/create`.
- Se incorporó `MedicalNoteController` con listado paginado por historia y alta
  append-only. La API nunca acepta `tenantId` ni `authorId`; ambos salen del
  JWT/contexto autenticado. No se expone edición o borrado de notas para
  conservar trazabilidad clínica.
- Se incorporó `DocumentController` y `DocumentService` para listar/buscar,
  consultar, crear documentos y cambiar estados. Todas las consultas usan el
  tenant autenticado, fijan el contexto RLS por transacción y respetan las
  autoridades de documento existentes; la base sigue siendo la autoridad final
  sobre transiciones y versiones.

### Limitaciones reales

- La creación de documentos requiere que el cliente conozca IDs válidos de tipo,
  expediente, departamento y responsables; no se añadió carga binaria ni alta
  de versiones porque `document_versions` es inmutable y su contrato de
  almacenamiento todavía no está definido.
- Las notas médicas requieren que `010_medical_notes` esté aplicada y que el JWT
  contenga los permisos derivados de `role_permissions`. No se modificó Angular.
- `docs/CONTEXTO_PROYECTO.md` y `docs/database/DISEÑO_Y_OPERACION.md` no están
  presentes físicamente en esta revisión; se verificaron `AGENTS.md`,
  `database/README.md` y el esquema SQL real.

## 2026-09-18 — Alcance móvil web de HU-09 y HU-10

- Se aclara el alcance del sprint: HU-09 no requiere una aplicación Flutter
  independiente. La autenticación y el acceso desde teléfono se realizarán
  mediante la aplicación Angular responsive publicada en la nube.
- HU-09 se evaluará por adaptación responsive, navegación, login, manejo de
  sesión y compatibilidad con navegadores móviles.
- HU-10 se evaluará por la consulta rápida y legible del expediente, alergias,
  diagnósticos y notas recientes desde una pantalla móvil. No implica crear una
  aplicación nativa separada.

## 2026-09-18 — HU-03, HU-04 y HU-07: expediente clínico REST

### Cambios arquitectónicos

- Se normalizaron los nombres de las migraciones incrementales a
  `007_tenant_user_management.sql`, `008_tenant_status_compatibility.sql` y
  `009_clinical_domain_extensions.sql`. La relación con HU-02, HU-03, HU-04 y
  HU-07 queda documentada dentro de cada SQL, no en el nombre técnico del
  archivo.
- Se conservaron los identificadores históricos de `app.schema_migrations` como
  alias compatibles. Al actualizar una instalación existente se registra el
  identificador técnico sin repetir cambios, revertir datos ni eliminar el
  volumen PostgreSQL.

- Se añadió la migración incremental `009_clinical_domain_extensions.sql`, sin
  modificar 004 ni migraciones anteriores. Normaliza y hace único por tenant el
  par `documentType/documentNumber` (CI o SEGURO) y agrega diagnósticos base
  estructurados en `clinical_histories.base_diagnoses`.
- `POST /api/v1/patients` crea el paciente/expediente inicial; la restricción SQL
  es la protección definitiva contra carreras y responde 409 ante duplicados.
- `POST` y `PUT/PATCH /api/v1/clinical-histories` capturan antecedentes,
  alergias, medicación y diagnósticos base; todas las consultas se filtran por
  tenant y requieren permisos `patient:*`.
- `GET /api/v1/clinical-histories/{id}/timeline` devuelve la apertura y
  episodios existentes ordenados por fecha descendente. No se inventan
  documentos ni episodios: los episodios solo se muestran cuando ya existen en
  `clinical_episodes`.
- Antes de operar sobre el módulo clínico, el backend fija `app.tenant_id` y
  `app.user_id` con `set_config(..., true)` en la transacción actual. Los valores
  proceden del JWT validado, no de parámetros del cliente.

### Contratos y limitaciones

El alta exige `documentType` (`CI` o `SEGURO`), `documentNumber`, `firstName` y
`lastName`. El cuerpo de historia acepta `allergies` (`allergen`, `severity`,
`reaction`) y `baseDiagnoses` (`code`, `description`, `diagnosedAt`), además de
los campos de antecedentes existentes. La cronología actualmente incluye
apertura y episodios; aún no existe endpoint de alta/cierre de episodios ni
versionado clínico independiente. La documentación referenciada
`docs/CONTEXTO_PROYECTO.md` y `docs/database/DISEÑO_Y_OPERACION.md` no está
presente físicamente en esta revisión; se siguieron las reglas disponibles en
`AGENTS.md`, `database/README.md` y el esquema real.

## 2026-09-18 — HU-02: administración global y usuarios por tenant

### Revisión correctiva

- `PUT /api/v1/users/{id}` conserva autorización explícita `user:update`.
- La asignación de roles exige además `role:assign` o `user:manage`; los IDs se
  resuelven siempre por `tenant_id`, por lo que un rol de otro tenant no es
  asignable. Los roles de plataforma/Superadmin son rechazados.
- La primera versión de 007 no podía imponer CHECK sobre los estados públicos:
  los enums históricos contienen `PAST_DUE`, `INVITED` y `SUSPENDED`. Se retiró
  ese CHECK de 007 y se añadió `008_tenant_status_compatibility.sql`: elimina
  CHECKs incompatibles si una instalación anterior los tenía y valida únicamente
  nuevas inserciones o cambios de estado, conservando filas históricas.
- 007 asigna explícitamente permisos HU-02 al rol `Administrador de tenant`.

### Cambios arquitectónicos

- Se añadió la migración incremental `database/init/007_tenant_user_management.sql`;
  no se modificó `004_saas_hardening.sql`. La migración formaliza los estados públicos
  de HU-02, agrega permisos explícitos de tenant/roles/auditoría y protege mediante
  trigger la existencia del último administrador activo.
- El login de un Superadmin admite `tenantId` nulo y emite únicamente permisos
  globales (`tenant:manage`, `audit:read_global`). Un usuario de tenant continúa
  recibiendo los permisos calculados desde `user_roles`.
- Se incorporaron `TenantController` para listar/cambiar estado globalmente y
  `AuditController` con consulta global para Superadmin o filtrada por tenant para
  administradores. La gestión de usuarios conserva rutas tenant-scoped, valida el
  contexto autenticado y permite asignar roles activos del tenant; nunca acepta un
  rol de plataforma.
- La baja y cambio de estado del propio usuario se rechazan en servicio. El
  trigger SQL impide dejar un tenant sin administrador activo, también ante
  escrituras directas que no pasen por HTTP.

### Verificación y limitaciones

- `backend/mvnw.cmd -DskipTests package` — correcto.
- `backend/mvnw.cmd test` compila, pero el contexto de integración no pudo abrir
  PostgreSQL por credenciales/configuración local de la sesión; las pruebas unitarias
  existentes no se pudieron reportar como suite verde.
- No se modificó Angular. La escritura detallada de auditoría depende de los triggers
  y funciones de auditoría ya instalados por 004; el backend expone lectura, no inventa
  eventos para operaciones que la base aún no genera.

Este documento conserva el historial explicativo de cambios relevantes. Cada
entrada indica qué existía antes, qué se modificó o mejoró y qué limitaciones
continúan. Los agentes deben actualizarlo cuando realicen cambios derivados de
una exploración o una decisión arquitectónica.

## 2026-09-17 — HU-01: recuperación segura de contraseña

### Estado anterior

- La pantalla de login mostraba un aviso, pero no existía flujo de recuperación.
- No había endpoint ni almacenamiento de solicitudes de recuperación.

### Cambios realizados

- Se agregó la migración incremental `006_password_recovery.sql`.
- Se agregaron solicitudes con token aleatorio hasheado, expiración y uso único.
- Se agregaron `POST /api/v1/auth/forgot-password` y
  `POST /api/v1/auth/reset-password`.
- La respuesta de solicitud es genérica para no revelar si un correo existe.
- El correo se envía mediante SMTP configurable, compatible con Mailtrap.
- Angular ahora incluye `/forgot-password` y `/reset-password`.

### Validación

- La migración `006_password_recovery` se aplicó al PostgreSQL local sin borrar
  el volumen.
- `mvnw.cmd test` — correcto, 21 pruebas sin fallos.
- `pnpm typecheck` — correcto.
- El test de rutas refleja el catálogo actual de 80 rutas.

### Limitaciones reales

- El envío requiere credenciales SMTP de Mailtrap u otro proveedor.
- La revocación persistente de todos los refresh tokens anteriores al cambiar
  la contraseña todavía requiere almacenamiento de sesiones/tokens.
- El token se guarda como hash; el enlace expira por defecto en 30 minutos.

## 2026-09-16 — Corrección de conexión local PostgreSQL

### Estado anterior

- Docker Compose publicaba PostgreSQL en `localhost:5433`.
- Ese puerto ya estaba ocupado por una instalación local de PostgreSQL en
  Windows, por lo que Spring Boot se conectaba a otra instancia y recibía una
  contraseña distinta.
- El contexto `BackendApplicationTests` fallaba al abrir la conexión JDBC.

### Cambios realizados

- Docker Compose ahora publica el contenedor en `127.0.0.1:5434`, conservando
  el volumen existente y sin eliminar datos.
- El valor predeterminado de `spring.datasource.url` usa `127.0.0.1:5434`.
- Se actualizaron `.env.example` y la documentación operativa.
- Se alineó la contraseña del rol `nexodocs` dentro del contenedor con
  `nexodocs_dev`.
- Se marcó explícitamente el constructor de producción de `JwtService` para que
  Spring pueda resolverlo después de agregar el constructor compatible con las
  pruebas unitarias.

### Validación

- `docker compose up -d --wait` — correcto; PostgreSQL quedó `healthy`.
- Conexión TCP al contenedor en `127.0.0.1:5434` — correcta.
- `mvn -q test` con `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` y
  `CORS_ALLOWED_ORIGINS` configurados — correcto.

### Limitaciones reales

- El PostgreSQL instalado en Windows continúa escuchando en `5433`; no fue
  detenido ni modificado.
- Las variables de entorno del backend deben configurarse en la terminal desde
  la que se ejecuta Maven o Spring Boot.

## 2026-09-16 — HU-01: autenticación Angular conectada a Spring Boot

### Estado anterior

- La ruta inicial podía mostrar directamente el workspace sin sesión.
- La pantalla de login era únicamente visual y el botón navegaba a la demo.
- Angular no tenía cliente HTTP, guard de rutas, interceptor ni almacenamiento de
  tokens.
- Spring Boot emitía solamente un access token JWT. No existían renovación ni
  cierre de sesión por endpoint.

### Cambios realizados

- Se agregó `AuthService` con sesión en `sessionStorage`, carga de `/auth/me`,
  login, renovación y cierre de sesión.
- Se agregó un interceptor HTTP que adjunta el bearer token y devuelve al login
  cuando una API responde `401`.
- Se agregó un guard para proteger todas las rutas del workspace. Al entrar a
  `/`, un usuario no autenticado es redirigido a `/login`.
- El formulario solicita tenant, usuario/correo y contraseña, muestra estados de
  validación y consume `POST /api/v1/auth/login`.
- El shell muestra el usuario autenticado y elimina las credenciales al cerrar
  sesión.
- Spring Boot ahora emite refresh tokens firmados, expone `POST /auth/refresh` y
  `POST /auth/logout`, y rechaza access tokens revocados durante la vida del
  proceso.

### Validación

- `pnpm typecheck` — correcto.
- `pnpm test` — correcto.
- `pnpm build` — correcto, con advertencia preexistente de presupuesto inicial.
- `mvn -q -DskipTests package` dentro de `backend/` — correcto.
- `git diff --check` — correcto.

### Limitaciones reales

- La URL de API está configurada para desarrollo en
  `http://localhost:8080/api/v1`; debe externalizarse por ambiente antes de
  desplegar.
- La revocación de access tokens es en memoria y se pierde al reiniciar el
  backend. Para producción debe persistirse en una tabla de sesiones o revocación.
- La renovación conserva el refresh token; falta rotación y detección de reuse.
- La recuperación de contraseña aún requiere integrar un proveedor de correo,
  tokens de un solo uso y persistencia de solicitudes.

## 2026-09-16 — Rediseño funcional del módulo Reportes Angular

### Estado anterior

- Las siete rutas existentes de Reportes (`/reports`, `/reports/users`,
  `/reports/workflows`, `/reports/storage`, `/reports/audit`,
  `/reports/productivity` y `/reports/by-area`) se resolvían con el
  `WorkspacePage` genérico y compartían una lista de demostración.
- No había KPIs, visualizaciones, filtros combinables ni tablas específicas por
  subcategoría. La exportación solo era una acción genérica del workspace.
- El rol visual se mantenía dentro del shell y no podía ser consultado por una
  pantalla de reporte para controlar el alcance del selector de tenant.

### Cambios realizados

- Se añadió `features/reports/reports-page.ts`, una pantalla standalone que
  selecciona la definición del reporte a partir de la URL existente. Todas las
  subcategorías conservan sus rutas y ahora presentan una composición común de
  encabezado, selector tenant, filtros, KPIs, gráficos, tabla paginada y nota de
  demo.
- Se añadió `core/data/report-data.ts` con datos mock tipados y definiciones
  específicas para Documentos, Usuarios, Workflows, Almacenamiento, Resumen de
  auditoría, Productividad y Actividad por área. Cada definición tiene columnas,
  filtros y agrupaciones visuales distintas.
- Se añadieron componentes standalone reutilizables en
  `core/components/reporting/`: `ReportHeader`, `ReportFilters`, `KpiCard`,
  `ReportChart`, `ReportTable`, `ExportDropdown` y `TenantSelector`. Se
  reutilizó `core/components/pagination/pagination.ts`, incluyendo los tamaños
  5/10/25/50/100, página actual, total de páginas y total de resultados.
- Se añadió `core/state/demo-session.ts` y se conectó el rol visual del shell a
  ese estado local. Un usuario normal ve únicamente el tenant actual; el
  selector `Todos los tenants` y el gráfico comparativo solo aparecen para
  `Superadministrador`.
- Se actualizaron `core/routes/app.routes.ts`, el catálogo de Reportes y
  `shell/app.ts`. Se conservaron las 78 rutas, URLs y el sidebar turquesa.
- Se agregaron estilos responsive en `frontend/src/styles.css`, con gráficas
  HTML/SVG/CSS y sin dependencias nuevas.

### Componentes reutilizados y creados

- Reutilizado: `Pagination`, `App`/shell, catálogo `navigationRoutes` y
  superficie visual global (`panel`, `module-action`, identidad turquesa).
- Creado: `ReportsPage`, `ReportHeader`, `ReportFilters`, `KpiCard`,
  `ReportChart`, `ReportTable`, `ExportDropdown`, `TenantSelector`,
  `DemoSessionState` y las definiciones mock de `report-data.ts`.

### Validación

- `pnpm typecheck` — correcto.
- `pnpm test` — correcto: 1 prueba de mapa de rutas pasó y la prueba HTTP
  quedó omitida por no definir `APP_URL`.
- `pnpm build` — correcto: compilación Angular de producción generada en
  `frontend/dist/nexodocs-frontend`.
- `git diff --check` — correcto.

### Datos mock y pendientes backend

- Los registros, KPIs, series, estados, accesos, IPs, tamaños y comparativos
  son datos simulados locales. Los filtros recalculan tabla, KPIs y gráficos
  dentro del navegador.
- PDF y Excel son stubs explícitos: muestran el formato, los filtros y el total
  actual, pero no generan archivos ni realizan llamadas.
- No se agregó autenticación, autorización real, persistencia ni conexión a
  PostgreSQL. Un backend futuro deberá resolver tenant/usuario autenticados,
  RBAC, consultas paginadas, exportación y aislamiento RLS antes de sustituir
  los mocks.

## 2026-09-16 — Fase 2 del backend: CRUDs maestros por tenant

### Estado anterior

- El backend solo exponía el CRUD inicial de usuarios y no tenía endpoints
  persistentes para los catálogos documentales de configuración.
- No existían entidades JPA, DTOs ni servicios para `document_types`, `tags` o
  `tenant_departments`.
- No había paginación, búsqueda ni validación de duplicados para esos maestros.

### Cambios realizados

- Se añadieron entidades JPA alineadas con el esquema real para tipos
  documentales, etiquetas y departamentos/áreas, incluyendo `jsonb`,
  referencias UUID, estado activo y timestamps donde existen.
- Se añadieron DTOs de entrada/salida que no incluyen `tenant_id`, secretos ni
  credenciales.
- Se implementaron repositorios con consultas tenant-scoped, filtros
  opcionales y `Pageable`; los servicios usan siempre `AuthenticatedUserContext`.
- Se implementaron los endpoints REST bajo `/api/v1/document-types`,
  `/api/v1/tags` y `/api/v1/departments`, con `GET`, `GET/{id}`, `POST`,
  `PUT/PATCH/{id}` y baja lógica para los recursos que tienen `is_active`.
- Se aplicaron las authorities existentes `configuration:read/create/update/delete`,
  sin inventar permisos. Los duplicados devuelven 409 y los recursos fuera del
  tenant se comportan como 404.
- Se extrajo `CrudTextSupport` para normalizar filtros y validar textos
  obligatorios. Para `tags`, que no tiene columna de baja lógica, `DELETE`
  conserva el borrado físico previsto por la FK de asignaciones.

### Mejoras

- Los listados son paginables y no pueden seleccionar registros de otro tenant
  aunque el identificador exista.
- Los nombres/códigos se validan sin espacios exteriores y se rechazan
  duplicados de forma insensible a mayúsculas antes de persistir.
- La API conserva separación entre catálogos maestros y acciones de dominio:
  no implementa documentos, versiones, workflows, OCR, notificaciones ni
  auditoría como CRUD genérico.

### Pruebas

- `backend\mvnw.cmd -f backend\pom.xml -DskipTests package` — correcto.
- `backend\mvnw.cmd -f backend\pom.xml -Dtest=CatalogCrudSecurityTest,CatalogControllerMockMvcTest test`
  — añadido como validación dirigida (tenant, paginación, duplicados, permisos
  declarados y 404).

### Limitaciones

- El backend todavía no establece por transacción `SET LOCAL ROLE`,
  `app.tenant_id` ni `app.user_id`; el aislamiento implementado en esta fase es
  el alcance explícito de repositorios/servicios y requiere completar el
  contexto RLS antes de producción.
- Las referencias `categoryId`, `retentionPolicyId` y `workflowTemplateId` se
  validan finalmente mediante las FK compuestas de PostgreSQL; no se abrió un
  CRUD adicional para esos catálogos.
- `tags` no tiene `is_active`/`deleted_at` en el esquema. Su baja es física y
  puede retirar las filas de `document_tags` por el `ON DELETE CASCADE` definido
  por la base.

## 2026-09-16 — Fase 1 del backend: contexto, JWT y alcance por tenant

### Estado anterior

- El filtro JWT construía una autenticación con `username` y una lista de
  authorities vacía; los claims `userId` y `tenantId` no llegaban a servicios.
- `UserService` confiaba en el `tenantId` del request y buscaba por ID sin
  restringir actualizaciones o bajas al tenant autenticado.
- No existían `GET /api/v1/auth/me` ni un listado paginado de usuarios.
- Las mutaciones no verificaban permisos RBAC del catálogo de PostgreSQL y el
  manejador global convertía cualquier `RuntimeException` en 401.
- CORS estaba deshabilitado sin una configuración por entorno.

### Cambios realizados

- Se añadió `AuthenticatedUser`/`AuthenticatedUserContext` y el JWT ahora
  valida claims obligatorios y transporta authorities de
  `user_roles`/`role_permissions` sin permitir listas vacías.
- `GET /api/v1/auth/me` y `GET /api/v1/users` son reutilizables, autenticados,
  paginados y tenant-scoped; el filtro de usuarios es opcional.
- Repositorios y `UserService` usan métodos que exigen el tenant del contexto
  para crear, consultar, actualizar y dar de baja. Un tenant enviado al crear
  solo se acepta si coincide.
- Se protegieron las mutaciones con `user:create`, `user:update` y
  `user:delete`, permisos existentes en `database/init/003_seed.sql`.
- Se diferenciaron errores 400, 401, 403, 404 y 409. CORS acepta únicamente
  orígenes explícitos desde `CORS_ALLOWED_ORIGINS`.
- Se agregaron pruebas unitarias para claims y authorities, filtro JWT,
  ausencia de token y rechazo de tenant cruzado.

### Pruebas

- `backend/mvnw.cmd -f backend/pom.xml -DskipTests package` — correcto.
- `backend/mvnw.cmd -f backend/pom.xml -Dtest=JwtServiceTest,JwtAuthenticationFilterTest,UserServiceSecurityTest,GlobalExceptionHandlerTest test` — correcto (7 pruebas).
- `backend/mvnw.cmd -f backend/pom.xml test` — las 7 pruebas unitarias nuevas
  pasan; la prueba histórica de contexto falla porque PostgreSQL local rechaza
  la contraseña configurada para `nexodocs`.

### Decisiones y pendientes

- No se inventaron permisos: las expresiones usan códigos del seed. El
  endpoint de usuarios requiere `user:read`; una identidad sin permisos no
  recibe token.
- Esta fase no modifica SQL ni implementa todavía `SET LOCAL ROLE`,
  `app.tenant_id`/`app.user_id`, CRUD documental, revocación de JWT ni
  autenticación de producción.

## 2026-09-16 — Alineación inicial del backend y seguridad

### Estado anterior

- Spring Boot 3.2.4 con Java 21 apuntaba a una base externa y contenía
  credenciales y un secreto JWT dentro de `application.yml`.
- Hibernate usaba `ddl-auto: update`, aunque el esquema oficial se administra
  mediante migraciones PostgreSQL.
- `Role` usaba UUID y `is_system_role`, mientras PostgreSQL define `roles.id`
  como `bigint identity` y la columna como `is_system`.
- El login consultaba usuarios sin restringir la búsqueda al tenant recibido.
- `POST /api/v1/users` estaba permitido sin autenticación.
- No existía un registro específico de cambios para los agentes.

### Cambios realizados

- La conexión PostgreSQL y la configuración JWT ahora se obtienen mediante
  variables de entorno.
- Hibernate quedó en modo `validate`, con SQL visible desactivado y
  `open-in-view` desactivado.
- El modelo y repositorio de roles se alinearon con `bigint` e `is_system`.
- El login exige `tenantId` y busca por identificador dentro de ese tenant.
- Se eliminó la excepción de seguridad que permitía crear usuarios sin token.
- El JWT ahora incluye el identificador de usuario y usa expiración configurable.
- El agente explorador quedó obligado a registrar estado anterior, cambios,
  mejoras, pruebas y limitaciones en este documento.

### Validación

- La compilación y empaquetado posteriores terminaron correctamente con
  `backend/mvnw.cmd -f backend/pom.xml -DskipTests package`.
- La prueba de contexto posterior se ejecutó con variables temporales y falló
  porque PostgreSQL local rechazó la contraseña configurada para `nexodocs`.
  No se volvió a usar la base externa.
- La validación completa debe repetirse con PostgreSQL local disponible,
  credenciales correctas y `JWT_SECRET` definido.

### Pendiente

- Rotar las credenciales externas y el secreto JWT que estuvieron expuestos en
  el historial Git.
- Implementar el contexto RLS real (`SET LOCAL ROLE`, `app.tenant_id` y
  `app.user_id`) dentro de transacciones.
- Reemplazar el rol clínico de demostración por RBAC general basado en
  `user_roles` y `role_permissions`.

## 2026-09-16 — Flujos documentales, paginación y digitalización Angular

### Estado anterior

- El botón `Nueva accion` de Expedientes solo mostraba un mensaje genérico y
  no ofrecía acciones seleccionables.
- Las listas del workspace no tenían paginación ni un estado visible de página,
  tamaño y total de resultados.
- Expedientes mostraba una lista fija sin filtros combinables por estado, área
  y fecha.
- Las subcategorías de documentos y los pasos de digitalización aparecían
  como entradas independientes del sidebar, aunque todas renderizaban la misma
  pantalla genérica.
- Escanear documento reutilizaba un formulario básico; no distinguía carga de
  archivo, cámara móvil ni la integración pendiente con un escáner de
  escritorio.
- Procesamiento OCR no mostraba de forma conjunta el documento origen, el
  texto extraído, el resumen ni un estado de procesamiento explícito.

### Cambios realizados

- Se agregó `core/components/pagination/pagination.ts`, componente standalone
  reutilizable con selector 5, 10, 25, 50 y 100, página actual, total,
  rango visible y controles anterior/siguiente. Se integró en el listado
  compartido y en Documentos recientes del dashboard.
- Se implementó el menú de `Nueva acción` para Expedientes con creación,
  importación demo e inicio de workflow manejados localmente.
- Se incorporaron filtros combinables de texto, estado, área, fecha inicial y
  fecha final en las listas de Expedientes; todos reinician la paginación y
  recalculan el total.
- Se consolidó Documentos en una vista con pestañas internas para todos,
  recientes, pendientes, revisión, aprobados, archivados y papelera. Las URLs
  históricas siguen registradas y funcionan, pero sus subcategorías ya no se
  duplican en el sidebar.
- Se simplificó Digitalización a Escanear documento y Procesamiento OCR en el
  sidebar. Validación/extracción, indexación y corrección de metadatos se
  mantienen como pasos internos, conservando sus URLs directas.
- Escanear documento ahora permite seleccionar un archivo real, usar un
  `input` de cámara con `capture="environment"` y activar un stub claramente
  rotulado para escáner conectado de escritorio.
- Procesamiento OCR ahora expone origen, archivo, identificador, páginas,
  confianza, estado `REQUIRES_VALIDATION`, resumen y texto extraído, con
  acciones locales para validar, indexar o corregir metadatos.
- Se actualizaron los tipos y datos de navegación demo sin agregar
  dependencias, endpoints, persistencia ni cambios en backend o SQL.

### Mejoras

- La navegación evita vistas duplicadas y mantiene compatibilidad con las 78
  rutas existentes y con enlaces directos.
- Las listas vacías por filtros presentan un estado explícito y las acciones
  de OCR dejan visible el estado de la demostración.
- La interacción es responsive y conserva la identidad turquesa, blanca y gris
  claro de NexoDocs.

### Pruebas

- `pnpm typecheck` — correcto.
- `pnpm test` — correcto: mapa de 78 rutas sin URLs duplicadas; la prueba HTTP
  quedó omitida porque no se ejecutó con `APP_URL`.
- `pnpm build` — correcto: compilación Angular de producción generada en
  `frontend/dist/nexodocs-frontend`.

### Limitaciones

- El frontend continúa usando datos simulados y señales locales; ninguna acción
  persiste en PostgreSQL ni consume una API.
- La carga y la cámara leen el archivo en el navegador para la demostración,
  pero no lo suben ni ejecutan OCR real.
- El escáner conectado es deliberadamente un stub y requiere una futura
  integración de escritorio.
- La paginación es local mientras no exista backend; un servicio futuro deberá
  mover filtros, totales y páginas al servidor para volúmenes grandes.

## 2026-09-16 — Módulo de Auditoría Angular por subcategorías

### Estado anterior

- Las ocho rutas de Auditoría (`/audit`, `/audit/access`,
  `/audit/document-creation`, `/audit/modifications`, `/audit/downloads`,
  `/audit/approvals`, `/audit/deletions` y `/audit/permissions`) se resolvían
  con la pantalla genérica de Workspace.
- No había una lectura específica para el feed cronológico, sesiones de
  seguridad, creación documental, diferencias de versiones, descargas,
  aprobaciones, bajas lógicas o cambios RBAC.
- No existía un detalle lateral compartido ni filtros propios por tipo de
  auditoría.

### Cambios realizados

- Se creó `features/audit/audit-page.ts` como feature standalone con layouts
  diferenciados para las ocho subcategorías, manteniendo las URLs y las 78
  rutas del catálogo de navegación.
- Se añadió `features/audit/data/audit-mock.ts` con interfaces y registros
  tipados para eventos, sesiones, creaciones, modificaciones, descargas,
  aprobaciones, eliminaciones y cambios de permisos.
- Se añadieron `AuditFilters`, `AuditPagination` y
  `AuditEventDrawer` como componentes reutilizables dentro de la feature.
  El drawer reúne metadatos, detalles, resultados y bloques before/after.
- Se incorporaron búsqueda global, filtros específicos, reinicio de filtros,
  paginación con el componente compartido de tamaños 5/10/25/50/100, badges
  de acción/resultado y handlers visuales para cada acción visible.
- Eliminaciones distingue `Soft delete`, `Archivado` y `Anulación`; la
  restauración es un stub visible que no persiste cambios. El selector de
  tenant solo aparece para el rol visual Superadministrador y está rotulado
  como demostración.
- Se actualizó el enrutado para dirigir únicamente las rutas de Auditoría a
  `AuditPage` y se añadieron estilos responsive para feed, tablas, tarjetas,
  stepper, diff, ledger y drawer.

### Verificación y limitaciones

- `pnpm typecheck` — correcto.
- `pnpm test` — correcto: se conserva el mapa de 78 rutas; la prueba HTTP se
  omite cuando no se define `APP_URL`.
- `pnpm build` — correcto: compilación Angular de producción.
- `git diff --check` — correcto.
- Todos los datos son mock locales. Exportación, restauración, navegación a
  entidades, comparación binaria y acciones del drawer muestran handlers de
  demostración, pero no llaman una API ni persisten.
- Un backend futuro deberá resolver autenticación, tenant autorizado, RBAC,
  sesiones reales, auditoría append-only, consultas paginadas y aislamiento
  RLS antes de reemplazar estos mocks.
  #   #       2   0   2   6   -   0   9   -   1   6   :       I   m   p   l   e   m   e   n   t   a   c   i    %  % n       H   U   -   1   0       �   �   �       C   o   n   s   u   l   t   a       R    % �   p   i   d   a       d   e       E   x   p   e   d   i   e   n   t   e       a       P   i   e       d   e       C   a   m   a    
    
    
    
   #   #   #       R   e   s   u   m   e   n    
    
   S   e       r   e   f   a   c   t   o   r   i   z    %  %     e   l       s   e   r   v   i   c   i   o       d   e       c   h   a   t   b   o   t       p   a   r   a       i   n   t   e   g   r   a   r       *   *   S   p   r   i   n   g       A   I   *   *       c   o   n       h   e   r   r   a   m   i   e   n   t   a   s       (   t   o   o   l   s   )       y       g   a   r   a   n   t   i   z   a   r       a   i   s   l   a   m   i   e   n   t   o       m   u   l   t   i   t   e   n   a   n   t       m   e   d   i   a   n   t   e       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   .   r   e   q   u   i   r   e   T   e   n   a   n   t   I   d   (   )   `   .       L   a       b    % Q % s   q   u   e   d   a       d   e       d   o   c   u   m   e   n   t   o   s       a   h   o   r   a       c   o   n   s   u   l   t   a       l   a       B   D       r   e   a   l       (   t   a   b   l   a       `   d   o   c   u   m   e   n   t   s   `   )       e   n       l   u   g   a   r       d   e       d   a   t   o   s       m   o   c   k   ,       c   o   n       R   L   S       d   e       P   o   s   t   g   r   e   S   Q   L       c   o   m   o       c   a   p   a       a   d   i   c   i   o   n   a   l       d   e       s   e   g   u   r   i   d   a   d   .    
    
    
    
   #   #   #       C   a   m   b   i   o   s       P   r   i   n   c   i   p   a   l   e   s    
    
    
    
   #   #   #   #       1   .       *   *   D   e   p   e   n   d   e   n   c   i   a   s       (   p   o   m   .   x   m   l   )   *   *    
    
   -       �   �   �       A   g   r   e   g   a   d   o   :       `   o   r   g   .   s   p   r   i   n   g   f   r   a   m   e   w   o   r   k   .   a   i   :   s   p   r   i   n   g   -   a   i   -   o   p   e   n   a   i   -   s   p   r   i   n   g   -   b   o   o   t   -   s   t   a   r   t   e   r   :   1   .   0   .   0   -   M   1   `    
    
    
    
   #   #   #   #       2   .       *   *   M   o   d   e   l   o   s       J   P   A   *   *    
    
   -       �   �   �       C   r   e   a   d   o   :       `   D   o   c   u   m   e   n   t   .   j   a   v   a   `       (   `   b   a   c   k   e   n   d   /   s   r   c   /   m   a   i   n   /   j   a   v   a   /   .   .   .   /   m   o   d   e   l   /   D   o   c   u   m   e   n   t   .   j   a   v   a   `   )    
    
           -       M   a   p   e   a       t   a   b   l   a       `   d   o   c   u   m   e   n   t   s   `       d   e   l       s   c   h   e   m   a       `   a   p   p   `    
    
           -       I   n   c   l   u   y   e       t   o   d   o   s       l   o   s       c   a   m   p   o   s   :       `   i   d   `   ,       `   t   e   n   a   n   t   I   d   `   ,       `   e   x   p   e   d   i   e   n   t   I   d   `   ,       `   d   o   c   u   m   e   n   t   T   y   p   e   I   d   `   ,       `   c   o   d   e   `   ,       `   n   a   m   e   `   ,       `   d   e   s   c   r   i   p   t   i   o   n   `   ,       `   s   t   a   t   u   s   `   ,       e   t   c   .    
    
           -       E   n   u   m       `   D   o   c   u   m   e   n   t   S   t   a   t   u   s   `       c   o   n       v   a   l   o   r   e   s   :       D   R   A   F   T   ,       P   E   N   D   I   N   G   ,       I   N   _   R   E   V   I   E   W   ,       A   P   P   R   O   V   E   D   ,       R   E   J   E   C   T   E   D   ,       C   U   R   R   E   N   T   ,       A   R   C   H   I   V   E   D   ,       V   O   I   D   E   D   ,       T   R   A   S   H   E   D    
    
    
    
   #   #   #   #       3   .       *   *   R   e   p   o   s   i   t   o   r   i   o   s       J   P   A   *   *    
    
   -       �   �   �       C   r   e   a   d   o   :       `   D   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   .   j   a   v   a   `       (   `   b   a   c   k   e   n   d   /   s   r   c   /   m   a   i   n   /   j   a   v   a   /   .   .   .   /   r   e   p   o   s   i   t   o   r   y   /   D   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   .   j   a   v   a   `   )    
    
           -       M    % �   t   o   d   o   s       d   e       b    % Q % s   q   u   e   d   a   :       `   f   i   n   d   B   y   T   e   n   a   n   t   I   d   A   n   d   N   a   m   e   C   o   n   t   a   i   n   i   n   g   I   g   n   o   r   e   C   a   s   e   (   U   U   I   D       t   e   n   a   n   t   I   d   ,       S   t   r   i   n   g       n   a   m   e   )   `    
    
           -       O   t   r   o   s   :       b    % Q % s   q   u   e   d   a       p   o   r       e   s   t   a   d   o   ,       f   i   l   t   r   a   d   o       d   e       e   l   i   m   i   n   a   d   o   s   ,       e   t   c   .    
    
           -       *   *   C   r    % �   t   i   c   o   *   *   :       T   o   d   o   s       l   o   s       m    % �   t   o   d   o   s       r   e   q   u   i   e   r   e   n       `   t   e   n   a   n   t   I   d   `       e   x   p   l    % �   c   i   t   o       e   n       l   a       f   i   r   m   a    
    
    
    
   #   #   #   #       4   .       *   *   S   e   r   v   i   c   i   o   s   *   *    
    
   -       �   �   �       R   e   f   a   c   t   o   r   i   z   a   d   o   :       `   D   o   c   u   m   e   n   t   S   e   a   r   c   h   S   e   r   v   i   c   e   .   j   a   v   a   `    
    
           -       �   �   �       R   e   m   o   v   i   d   o   :       D   e   c   o   r   a   d   o   r       `   @   S   e   r   v   i   c   e   `   ;       a   h   o   r   a       e   s       `   @   C   o   m   p   o   n   e   n   t   `    
    
           -       �   �   �       I   n   y   e   c   t   a   d   o   :       `   D   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   `       y       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   `    
    
           -       �   �   �       C   a   m   b   i   o       d   e       f   i   r   m   a   :       `   s   e   a   r   c   h   D   o   c   u   m   e   n   t   s   B   y   T   e   n   a   n   t   (   S   t   r   i   n   g       q   u   e   r   y   ,       i   n   t       l   i   m   i   t   )   `       �   �   �       y   a       N   O       t   o   m   a       `   t   e   n   a   n   t   I   d   `       c   o   m   o       p   a   r    % �   m   e   t   r   o    
    
                   -       O   b   t   i   e   n   e       `   t   e   n   a   n   t   I   d   `       i   n   t   e   r   n   a   m   e   n   t   e       v    % �   a       `   a   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   .   r   e   q   u   i   r   e   T   e   n   a   n   t   I   d   (   )   `    
    
           -       �   �   �       C   a   m   b   i   o       d   e       b   a   c   k   e   n   d   :       C   o   n   s   u   l   t   a       r   e   a   l       a       B   D       (   `   d   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   .   f   i   n   d   B   y   T   e   n   a   n   t   I   d   A   n   d   N   a   m   e   C   o   n   t   a   i   n   i   n   g   I   g   n   o   r   e   C   a   s   e   (   t   e   n   a   n   t   I   d   ,       q   u   e   r   y   )   `   )    
    
           -       �   �   �       M   a   n   t   i   e   n   e   :       `   b   u   i   l   d   R   A   G   C   o   n   t   e   x   t   (   L   i   s   t   <   D   o   c   u   m   e   n   t   D   T   O   >   )   `       p   a   r   a       f   o   r   m   a   t   e   a   r       d   o   c   u   m   e   n   t   o   s       e   n       c   o   n   t   e   x   t   o       L   L   M    
    
    
    
   -       �   �   �       R   e   f   a   c   t   o   r   i   z   a   d   o   :       `   R   A   G   S   e   r   v   i   c   e   .   j   a   v   a   `    
    
           -       �   �   �       I   n   y   e   c   t   a   d   o   :       `   F   u   n   c   t   i   o   n   <   S   t   r   i   n   g   ,       S   t   r   i   n   g   >       d   o   c   u   m   e   n   t   S   e   a   r   c   h   `       (   l   a       h   e   r   r   a   m   i   e   n   t   a       d   e   s   d   e       `   C   h   a   t   B   o   t   T   o   o   l   s   C   o   n   f   i   g   `   )    
    
           -       �   �   �       I   n   y   e   c   t   a   d   o   :       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   `    
    
           -       �   �   �       C   a   m   b   i   o       d   e       f   i   r   m   a   :       `   p   r   o   c   e   s   s   Q   u   e   r   y   (   S   t   r   i   n   g       u   s   e   r   Q   u   e   r   y   ,       b   o   o   l   e   a   n       i   n   c   l   u   d   e   D   o   c   u   m   e   n   t   s   )   `       �   �   �       r   e   m   o   v   i   d   o       p   a   r    % �   m   e   t   r   o       `   t   e   n   a   n   t   I   d   `    
    
           -       �   �   �       I   n   t   e   g   r   a   c   i    %  % n   :       `   .   f   u   n   c   t   i   o   n   (   "   d   o   c   u   m   e   n   t   S   e   a   r   c   h   "   ,       d   o   c   u   m   e   n   t   S   e   a   r   c   h   T   o   o   l   )   `       e   n       e   l       p   r   o   m   p   t    
    
           -       �   �   �       S   e   g   u   r   i   d   a   d   :       V   a   l   i   d   a       `   a   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   .   r   e   q   u   i   r   e   T   e   n   a   n   t   I   d   (   )   `       a   l       i   n   i   c   i   o    
    
    
    
   #   #   #   #       5   .       *   *   C   o   n   f   i   g   u   r   a   c   i    %  % n   *   *    
    
   -       �   �   �       I   m   p   l   e   m   e   n   t   a   d   o   :       `   C   h   a   t   B   o   t   T   o   o   l   s   C   o   n   f   i   g   .   j   a   v   a   `       (   `   b   a   c   k   e   n   d   /   s   r   c   /   m   a   i   n   /   j   a   v   a   /   .   .   .   /   c   o   n   f   i   g   /   C   h   a   t   B   o   t   T   o   o   l   s   C   o   n   f   i   g   .   j   a   v   a   `   )    
    
           -       C   r   e   a       `   @   B   e   a   n       F   u   n   c   t   i   o   n   <   S   t   r   i   n   g   ,       S   t   r   i   n   g   >       d   o   c   u   m   e   n   t   S   e   a   r   c   h   (   )   `    
    
           -       W   r   a   p   p   e   a       `   D   o   c   u   m   e   n   t   S   e   a   r   c   h   S   e   r   v   i   c   e   .   s   e   a   r   c   h   D   o   c   u   m   e   n   t   s   B   y   T   e   n   a   n   t   (   )   `       y       `   b   u   i   l   d   R   A   G   C   o   n   t   e   x   t   (   )   `    
    
           -       A   n   o   t   a   d   o       c   o   n       `   @   D   e   s   c   r   i   p   t   i   o   n   `       p   a   r   a       q   u   e       S   p   r   i   n   g       A   I       r   e   c   o   n   o   z   c   a       l   a       h   e   r   r   a   m   i   e   n   t   a    
    
           -       S   p   r   i   n   g       A   I       r   e   g   i   s   t   r   a       a   u   t   o   m    % �   t   i   c   a   m   e   n   t   e       c   o   m   o       h   e   r   r   a   m   i   e   n   t   a       d   i   s   p   o   n   i   b   l   e       p   a   r   a       C   l   a   u   d   e    
    
    
    
   #   #   #   #       6   .       *   *   C   o   n   t   r   o   l   a   d   o   r   e   s   *   *    
    
   -       �   �   �       R   e   f   a   c   t   o   r   i   z   a   d   o   :       `   C   h   a   t   C   o   n   t   r   o   l   l   e   r   .   j   a   v   a   `    
    
           -       �   �   �       I   n   y   e   c   t   a   d   o   :       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   `    
    
           -       �   �   �       A   n   o   t   a   d   o   :       `   @   P   r   e   A   u   t   h   o   r   i   z   e   (   "   i   s   A   u   t   h   e   n   t   i   c   a   t   e   d   (   )   "   )   `       e   n       `   /   a   p   i   /   c   h   a   t   /   a   s   k   `    
    
           -       �   �   �       R   e   m   o   v   i   d   o   :       C   a   m   p   o       `   t   e   n   a   n   t   I   d   `       d   e   l       D   T   O       d   e       e   n   t   r   a   d   a    
    
           -       �   �   �       C   a   m   b   i   o       d   e       f   i   r   m   a   :       `   c   h   a   t   (   C   h   a   t   R   e   q   u   e   s   t   D   T   O   )   `       �   �   �       `   r   a   g   S   e   r   v   i   c   e   .   p   r   o   c   e   s   s   Q   u   e   r   y   (   m   e   s   s   a   g   e   ,       i   n   c   l   u   d   e   D   o   c   u   m   e   n   t   s   )   `       (   s   i   n       `   t   e   n   a   n   t   I   d   `   )    
    
           -       �   �   �       V   a   l   i   d   a   c   i    %  % n   :       L   l   a   m   a       `   a   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   .   r   e   q   u   i   r   e   T   e   n   a   n   t   I   d   (   )   `       y       `   r   e   q   u   i   r   e   U   s   e   r   I   d   (   )   `       p   a   r   a       g   a   r   a   n   t   i   z   a   r       c   o   n   t   e   x   t   o    
    
    
    
   #   #   #   #       7   .       *   *   D   T   O   s   *   *    
    
   -       �   �   �       A   c   t   u   a   l   i   z   a   d   o   :       `   C   h   a   t   R   e   q   u   e   s   t   D   T   O   .   j   a   v   a   `    
    
           -       �   �   �       R   e   m   o   v   i   d   o   :       C   a   m   p   o   s       `   t   e   n   a   n   t   I   d   `       y       `   u   s   e   r   I   d   `    
    
           -       �   �   �       M   a   n   t   i   e   n   e   :       `   m   e   s   s   a   g   e   `   ,       `   i   n   c   l   u   d   e   D   o   c   u   m   e   n   t   s   `    
    
           -       A   h   o   r   a       c   o   n   t   i   e   n   e       s   o   l   o       l   o       q   u   e       e   l       c   l   i   e   n   t   e       e   n   v    % �   a   ;       t   e   n   a   n   t       y       u   s   e   r       v   i   e   n   e   n       d   e   l       J   W   T    
    
    
    
   -       �   �   �       A   c   t   u   a   l   i   z   a   d   o   :       `   C   h   a   t   R   e   s   p   o   n   s   e   D   T   O   .   j   a   v   a   `    
    
           -       S   i   n       c   a   m   b   i   o   s       d   e       l    %  % g   i   c   a   ;       s   o   l   o       p   a   q   u   e   t   e       c   o   r   r   e   c   t   o    
    
    
    
   -       �   �   �       A   c   t   u   a   l   i   z   a   d   o   :       `   D   o   c   u   m   e   n   t   D   T   O   .   j   a   v   a   `    
    
           -       S   i   n       c   a   m   b   i   o   s       d   e       l    %  % g   i   c   a   ;       s   o   l   o       p   a   q   u   e   t   e       c   o   r   r   e   c   t   o    
    
    
    
   #   #   #       G   a   r   a   n   t    % �   a   s       d   e       S   e   g   u   r   i   d   a   d       M   u   l   t   i   t   e   n   a   n   t    
    
    
    
   1   .       *   *   E   x   t   r   a   c   c   i    %  % n       d   e       T   e   n   a   n   t       d   e   l       J   W   T   *   *    
    
               -       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   .   r   e   q   u   i   r   e   T   e   n   a   n   t   I   d   (   )   `       o   b   t   i   e   n   e       U   U   I   D       d   e   s   d   e       e   l       t   o   k   e   n       a   u   t   e   n   t   i   c   a   d   o    
    
               -       L   a   n   z   a       `   T   e   n   a   n   t   R   e   q   u   i   r   e   d   E   x   c   e   p   t   i   o   n   `       s   i       n   o       e   x   i   s   t   e       (   n   u   n   c   a       n   u   l   l   )    
    
    
    
   2   .       *   *   F   i   l   t   r   a   d   o       e   n       R   e   p   o   s   i   t   o   r   i   o   *   *    
    
               -       `   D   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   .   f   i   n   d   B   y   T   e   n   a   n   t   I   d   A   n   d   N   a   m   e   C   o   n   t   a   i   n   i   n   g   I   g   n   o   r   e   C   a   s   e   (   t   e   n   a   n   t   I   d   ,       q   u   e   r   y   )   `    
    
               -       *   *   S   i   e   m   p   r   e       i   n   c   l   u   y   e       `   t   e   n   a   n   t   I   d   `   *   *       e   n       l   a       W   H   E   R   E       c   l   a   u   s   e    
    
    
    
   3   .       *   *   R   L   S       d   e       P   o   s   t   g   r   e   S   Q   L   *   *    
    
               -       T   a   b   l   a       `   d   o   c   u   m   e   n   t   s   `       t   i   e   n   e       p   o   l    % �   t   i   c   a       R   L   S       c   o   n   f   i   g   u   r   a   d   a       e   n       m   i   g   r   a   c   i    %  % n       `   0   0   4   _   s   a   a   s   _   h   a   r   d   e   n   i   n   g   `    
    
               -       F   i   l   t   r   a       a   d   i   c   i   o   n   a   l   e   s       p   o   r       `   t   e   n   a   n   t   _   i   d   `       a       n   i   v   e   l       B   D       (   d   e   f   e   n   s   a       e   n       p   r   o   f   u   n   d   i   d   a   d   )    
    
    
    
   4   .       *   *   C   o   n   t   e   x   t   o       d   e       S   p   r   i   n   g       S   e   c   u   r   i   t   y   *   *    
    
               -       J   w   t   A   u   t   h   e   n   t   i   c   a   t   i   o   n   F   i   l   t   e   r       p   o   p   u   l   a       `   S   e   c   u   r   i   t   y   C   o   n   t   e   x   t   H   o   l   d   e   r   `       c   o   n       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   `    
    
               -       `   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   `       e   x   t   r   a   e       d   e   s   d   e       a   h    % �    
    
    
    
   #   #   #       C   a   m   b   i   o   s       e   n       e   l       F   l   u   j   o       d   e       U   s   u   a   r   i   o    
    
    
    
   *   *   A   n   t   e   s       (   M   o   c   k   )   :   *   *    
    
   `   `   `    
    
   P   O   S   T       /   a   p   i   /   c   h   a   t   /   a   s   k    
    
   {    
    
           "   t   e   n   a   n   t   _   i   d   "   :       "   a   b   c   -   1   2   3   "   ,           �   �   T%      E   n   v   i   a   d   o       p   o   r       c   l   i   e   n   t   e    
    
           "   u   s   e   r   _   i   d   "   :       "   u   s   e   r   -   4   5   6   "   ,    
    
           "   m   e   s   s   a   g   e   "   :       "   , %  % C   u    % �   l   e   s       s   o   n       m   i   s       e   x   p   e   d   i   e   n   t   e   s   ?   "   ,    
    
           "   i   n   c   l   u   d   e   _   d   o   c   u   m   e   n   t   s   "   :       t   r   u   e    
    
   }    
    
   �   �   �       D   o   c   u   m   e   n   t   S   e   a   r   c   h   S   e   r   v   i   c   e   .   s   e   a   r   c   h   D   o   c   u   m   e   n   t   s   B   y   T   e   n   a   n   t   (   "   a   b   c   -   1   2   3   "   ,       "   , %  % C   u    % �   l   e   s   .   .   .   "   ,       5   )    
    
   �   �   �       R   e   t   o   r   n   a       d   a   t   o   s       m   o   c   k       s   i   n       c   o   n   s   u   l   t   a   r       B   D    
    
   `   `   `    
    
    
    
   *   *   D   e   s   p   u    % �   s       (   S   e   g   u   r   o       +       R   e   a   l   )   :   *   *    
    
   `   `   `    
    
   P   O   S   T       /   a   p   i   /   c   h   a   t   /   a   s   k    
    
   A   u   t   h   o   r   i   z   a   t   i   o   n   :       B   e   a   r   e   r       <   J   W   T       c   o   n       t   e   n   a   n   t   _   i   d       y       u   s   e   r   _   i   d   >    
    
   {    
    
           "   m   e   s   s   a   g   e   "   :       "   , %  % C   u    % �   l   e   s       s   o   n       m   i   s       e   x   p   e   d   i   e   n   t   e   s   ?   "   ,    
    
           "   i   n   c   l   u   d   e   _   d   o   c   u   m   e   n   t   s   "   :       t   r   u   e    
    
   }    
    
   �   �   �       C   h   a   t   C   o   n   t   r   o   l   l   e   r       v   a   l   i   d   a       J   W   T    
    
   �   �   �       A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   .   r   e   q   u   i   r   e   T   e   n   a   n   t   I   d   (   )       �   �   �       <   U   U   I   D       d   e   l       J   W   T   >    
    
   �   �   �       R   A   G   S   e   r   v   i   c   e   .   p   r   o   c   e   s   s   Q   u   e   r   y   (   m   e   s   s   a   g   e   ,       t   r   u   e   )    
    
   �   �   �       D   o   c   u   m   e   n   t   S   e   a   r   c   h   S   e   r   v   i   c   e   .   s   e   a   r   c   h   D   o   c   u   m   e   n   t   s   B   y   T   e   n   a   n   t   (   q   u   e   r   y   ,       5   )    
    
           �   �   �       O   b   t   i   e   n   e       t   e   n   a   n   t   I   d       d   e   l       c   o   n   t   e   x   t   o       (   n   o       d   e   l       c   l   i   e   n   t   e   )    
    
           �   �   �       D   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   .   f   i   n   d   B   y   T   e   n   a   n   t   I   d   A   n   d   N   a   m   e   C   o   n   t   a   i   n   i   n   g   I   g   n   o   r   e   C   a   s   e   (   t   e   n   a   n   t   I   d   ,       q   u   e   r   y   )    
    
           �   �   �       C   o   n   s   u   l   t   a       r   e   a   l       a       B   D       +       R   L   S    
    
   �   �   �       M   a   p   e   a       a       D   o   c   u   m   e   n   t   D   T   O    
    
   �   �   �       C   h   a   t   C   l   i   e   n   t       l   l   a   m   a       h   e   r   r   a   m   i   e   n   t   a       d   o   c   u   m   e   n   t   S   e   a   r   c   h       �   �   �       b   u   i   l   d   R   A   G   C   o   n   t   e   x   t   (   )    
    
   �   �   �       C   l   a   u   d   e       r   e   s   p   o   n   d   e       c   o   n       c   o   n   t   e   x   t   o       d   o   c   u   m   e   n   t   o   s       d   e   l       t   e   n   a   n   t       a   u   t   e   n   t   i   c   a   d   o    
    
   `   `   `    
    
    
    
   #   #   #       R   e   s   p   o   n   s   a   b   i   l   i   d   a   d   e   s       P   e   n   d   i   e   n   t   e   s    
    
    
    
   -       �   �   �       B   a   c   k   e   n   d       i   m   p   l   e   m   e   n   t   a   d   o       c   o   n       S   p   r   i   n   g       A   I       y       s   e   g   u   r   i   d   a   d       m   u   l   t   i   t   e   n   a   n   t    
    
   -       �   <%   %     F   r   o   n   t   e   n   d       (   A   n   g   u   l   a   r   )   :       A   j   u   s   t   a   r       l   l   a   m   a   d   a       a       `   /   a   p   i   /   c   h   a   t   /   a   s   k   `       (   r   e   m   o   v   i   d   o       `   t   e   n   a   n   t   _   i   d   `   ,       a   g   r   e   g   a   r       J   W   T       e   n       h   e   a   d   e   r   )    
    
   -       �   <%   %     B   D   :       V   e   r   i   f   i   c   a   r       R   L   S       e   s   t    % �       a   c   t   i   v   o       e   n       m   i   g   r   a   c   i    %  % n       `   0   0   4   _   s   a   a   s   _   h   a   r   d   e   n   i   n   g   `    
    
   -       �   <%   %     T   e   s   t   s   :       U   n   i   t   a   r   i   o   s       p   a   r   a       `   D   o   c   u   m   e   n   t   S   e   a   r   c   h   S   e   r   v   i   c   e   `       y       `   R   A   G   S   e   r   v   i   c   e   `    
    
    
    
   #   #   #       N   o   t   a   s       d   e       A   r   q   u   i   t   e   c   t   u   r   a    
    
    
    
   -       *   *   S   p   r   i   n   g       A   I       V   e   r   s   i   o   n   *   *   :       `   1   .   0   .   0   -   M   1   `       (   m   i   l   e   s   t   o   n   e   )   .       E   v   a   l   u   a   r       e   s   t   a   b   i   l   i   d   a   d       e   n       p   r   o   d   u   c   c   i    %  % n   .    
    
   -       *   *   C   h   a   t   C   l   i   e   n   t   .   B   u   i   l   d   e   r   *   *   :       S   e       i   n   y   e   c   t   a       a   u   t   o   m    % �   t   i   c   a   m   e   n   t   e       d   e   s   d   e       S   p   r   i   n   g       B   o   o   t    
    
   -       *   *   F   u   n   c   t   i   o   n       a   s       T   o   o   l   *   *   :       S   p   r   i   n   g       A   I       d   e   s   c   u   b   r   e       a   u   t   o   m    % �   t   i   c   a   m   e   n   t   e       f   u   n   c   i   o   n   e   s       `   @   B   e   a   n   `       a   n   o   t   a   d   a   s       c   o   n       `   @   D   e   s   c   r   i   p   t   i   o   n   `    
    
   -       *   *   A   u   t   h   e   n   t   i   c   a   t   e   d   U   s   e   r   C   o   n   t   e   x   t   *   *   :       S   i   n   g   l   e   t   o   n       `   @   C   o   m   p   o   n   e   n   t   `       q   u   e       l   e   e       `   S   e   c   u   r   i   t   y   C   o   n   t   e   x   t   H   o   l   d   e   r   `    
    
   -       *   *   D   o   c   u   m   e   n   t   S   t   a   t   u   s       E   n   u   m   *   *   :       S   i   n   c   r   o   n   i   z   a   d   o       c   o   n       t   i   p   o       P   o   s   t   g   r   e   S   Q   L       `   d   o   c   u   m   e   n   t   _   s   t   a   t   u   s   `       e   n       D   B    
    
    
    
   #   #   #       V   a   l   i   d   a   c   i    %  % n    
    
    
    
   P   a   r   a       v   e   r   i   f   i   c   a   r       l   a       i   m   p   l   e   m   e   n   t   a   c   i    %  % n   :    
    
   1   .       C   o   m   p   i   l   a   r   :       `   m   v   n       c   l   e   a   n       c   o   m   p   i   l   e   `       (   M   a   v   e   n       d   e   s   c   a   r   g   a   r    % �       S   p   r   i   n   g       A   I   )    
    
   2   .       P   r   u   e   b   a       d   e       B   D   :       `   p   o   w   e   r   s   h   e   l   l       -   N   o   P   r   o   f   i   l   e       -   F   i   l   e       d   a   t   a   b   a   s   e   /   t   e   s   t   s   /   r   u   n   .   p   s   1   `       (   v   a   l   i   d   a       R   L   S   )    
    
   3   .       P   r   u   e   b   a       d   e       A   P   I   :       P   O   S   T       `   /   a   p   i   /   c   h   a   t   /   a   s   k   `       c   o   n       J   W   T       v    % �   l   i   d   o       (   s   i   n       `   t   e   n   a   n   t   _   i   d   `       e   n       b   o   d   y   )    
    
   4   .       L   o   g   s   :       V   e   r   i   f   i   c   a   r       q   u   e       `   D   o   c   u   m   e   n   t   R   e   p   o   s   i   t   o   r   y   `       c   o   n   s   u   l   t   a       c   o   n       c   l    % �   u   s   u   l   a       `   W   H   E   R   E       t   e   n   a   n   t   _   i   d       =       ?   `    
    
    
    
   #   #       2   0   2   6   -   0   9   -   1   6   :       C   o   r   r   e   c   c   i    %  % n       �   �   �       e   l       b   a   c   k   e   n   d       n   o       a   r   r   a   n   c   a   b   a       (   c   h   a   t   b   o   t       d   e   s   h   a   b   i   l   i   t   a   d   o       t   e   m   p   o   r   a   l   m   e   n   t   e   )       +       d   a   t   o   s       d   e       d   e   m   o   s   t   r   a   c   i    %  % n       a   m   p   l   i   a   d   o   s    
    
    
    
   #   #   #       C   o   n   t   e   x   t   o       r   e   a   l       v   e   r   i   f   i   c   a   d   o    
    
    
    
   A   l       i   n   t   e   n   t   a   r       l   e   v   a   n   t   a   r       e   l       b   a   c   k   e   n   d       (   `   m   v   n   w       s   p   r   i   n   g   -   b   o   o   t   :   r   u   n   `   )       p   a   r   a       p   r   u   e   b   a   s       m   a   n   u   a   l   e   s       c   o   n       P   o   s   t   m   a   n   ,       l   a       a   p   l   i   c   a   c   i    %  % n       *   *   n   o       a   r   r   a   n   c   a   b   a   *   *   .       L   a       e   n   t   r   a   d   a       a   n   t   e   r   i   o   r       d   e       e   s   t   e       r   e   g   i   s   t   r   o       d   o   c   u   m   e   n   t   a   b   a       `   s   p   r   i   n   g   -   a   i   -   b   o   m       1   .   0   .   0   -   M   1   `   ,       p   e   r   o       `   p   o   m   .   x   m   l   `       t   e   n    % �   a       f   i   j   a   d   o       `   2   .   0   .   1   `   .       S   e       c   o   m   p   r   o   b    %  %     c   o   n   t   r   a       l   a       d   o   c   u   m   e   n   t   a   c   i    %  % n       o   f   i   c   i   a   l       d   e       S   p   r   i   n   g       A   I       q   u   e   :    
    
    
    
   -       `   s   p   r   i   n   g   -   a   i   -   b   o   m       2   .   0   .   1   `       r   e   q   u   i   e   r   e       *   *   S   p   r   i   n   g       B   o   o   t       4       /       S   p   r   i   n   g       F   r   a   m   e   w   o   r   k       7   *   *   .    
    
   -       L   a       l    % �   n   e   a       `   1   .   0   .   x   `       d   e       S   p   r   i   n   g       A   I       r   e   q   u   i   e   r   e       *   *   S   p   r   i   n   g       B   o   o   t       3   .   4   .   x   /   3   .   5   .   x   *   *   .    
    
   -       E   s   t   e       b   a   c   k   e   n   d       u   s   a       *   *   S   p   r   i   n   g       B   o   o   t       3   .   2   .   4   *   *       (   f   i   j   a   d   o       e   n       A   G   E   N   T   S   .   m   d       c   o   m   o       a   r   q   u   i   t   e   c   t   u   r   a       v   i   g   e   n   t   e   )   .    
    
    
    
   E   s       d   e   c   i   r   :       *   *   n   i   n   g   u   n   a       v   e   r   s   i    %  % n       d   e       S   p   r   i   n   g       A   I       e   s       c   o   m   p   a   t   i   b   l   e       c   o   n       l   a       v   e   r   s   i    %  % n       d   e       S   p   r   i   n   g       B   o   o   t       q   u   e       u   s   a       h   o   y       e   l       p   r   o   y   e   c   t   o   .   *   *       E   l       i   n   t   e   n   t   o       d   e       a   r   r   a   n   q   u   e       f   a   l   l   a   b   a       c   o   n       `   N   o   C   l   a   s   s   D   e   f   F   o   u   n   d   E   r   r   o   r   :       o   r   g   .   s   p   r   i   n   g   f   r   a   m   e   w   o   r   k   .   c   o   r   e   .   r   e   t   r   y   .   R   e   t   r   y   T   e   m   p   l   a   t   e   `       e   n       v   a   r   i   a   s       a   u   t   o   c   o   n   f   i   g   u   r   a   c   i   o   n   e   s       d   e       S   p   r   i   n   g       A   I       (   c   h   a   t   ,       r   e   t   r   y   )   ,       p   o   r   q   u   e       e   s   a       c   l   a   s   e       n   o       e   x   i   s   t   e       e   n       S   p   r   i   n   g       F   r   a   m   e   w   o   r   k       6   .   1   .   5   .    
    
    
    
   #   #   #       C   a   m   b   i   o   s       a   p   l   i   c   a   d   o   s       (   t   e   m   p   o   r   a   l   e   s   ,       r   e   v   e   r   s   i   b   l   e   s   )    
    
    
    
   #   #   #   #       `   b   a   c   k   e   n   d   /   p   o   m   .   x   m   l   `    
    
   -       C   o   m   e   n   t   a   d   o       e   l       `   d   e   p   e   n   d   e   n   c   y   M   a   n   a   g   e   m   e   n   t   `       d   e       `   s   p   r   i   n   g   -   a   i   -   b   o   m   `       y       l   a       d   e   p   e   n   d   e   n   c   i   a       `   s   p   r   i   n   g   -   a   i   -   s   t   a   r   t   e   r   -   m   o   d   e   l   -   g   o   o   g   l   e   -   g   e   n   a   i   `   ,       c   o   n       u   n       `   T   O   D   O   `       e   x   p   l   i   c   a   n   d   o       p   o   r       q   u    % �       y       q   u    % �       v   e   r   s   i    %  % n       o   b   j   e   t   i   v   o       s   e       n   e   c   e   s   i   t   a   .    
    
   -       A   g   r   e   g   a   d   o       `   m   a   v   e   n   -   c   o   m   p   i   l   e   r   -   p   l   u   g   i   n   `       c   o   n       `   <   e   x   c   l   u   d   e   s   >   `       p   a   r   a       `   C   h   a   t   B   o   t   T   o   o   l   s   C   o   n   f   i   g   .   j   a   v   a   `   ,       `   R   A   G   S   e   r   v   i   c   e   .   j   a   v   a   `       y       `   C   h   a   t   C   o   n   t   r   o   l   l   e   r   .   j   a   v   a   `       (   u   s   a   n       t   i   p   o   s       d   e       S   p   r   i   n   g       A   I       c   o   m   o       `   T   o   o   l   C   a   l   l   b   a   c   k   `   ;       s   i   n       l   a       d   e   p   e   n   d   e   n   c   i   a       n   o       c   o   m   p   i   l   a   n   )   .       E   l       c    %  % d   i   g   o       *   *   n   o       s   e       b   o   r   r    %  % *   *   ,       s   o   l   o       s   e       e   x   c   l   u   y    %  %     d   e       l   a       b   u   i   l   d       h   a   s   t   a       e   l       u   p   g   r   a   d   e   .    
    
    
    
   #   #   #   #       `   b   a   c   k   e   n   d   /   s   r   c   /   m   a   i   n   /   r   e   s   o   u   r   c   e   s   /   a   p   p   l   i   c   a   t   i   o   n   .   y   m   l   `    
    
   -       C   o   m   e   n   t   a   d   o       e   l       b   l   o   q   u   e       `   s   p   r   i   n   g   .   a   i   .   g   o   o   g   l   e   .   g   e   n   a   i   .   *   `       (   d   e   p   e   n   d    % �   a       d   e       l   a       d   e   p   e   n   d   e   n   c   i   a       r   e   m   o   v   i   d   a   )   .    
    
    
    
   #   #   #   #       `   b   a   c   k   e   n   d   /   s   r   c   /   m   a   i   n   /   j   a   v   a   /   .   .   .   /   m   o   d   e   l   /   D   o   c   u   m   e   n   t   .   j   a   v   a   `    
    
   -       *   *   B   u   g       r   e   a   l       e   n   c   o   n   t   r   a   d   o       y       c   o   r   r   e   g   i   d   o   *   *   :       l   a       e   n   t   i   d   a   d       t   e   n    % �   a       `   @   T   a   b   l   e   (   n   a   m   e       =       "   d   o   c   u   m   e   n   t   s   "   ,       s   c   h   e   m   a       =       "   a   p   p   "   )   `   .       L   a       e   n   t   r   a   d   a       a   n   t   e   r   i   o   r       d   e       e   s   t   e       r   e   g   i   s   t   r   o       d   o   c   u   m   e   n   t   a   b   a       q   u   e       l   a       t   a   b   l   a       v   i   v    % �   a       e   n       e   l       s   c   h   e   m   a       `   a   p   p   `   ,       p   e   r   o       l   a       b   a   s   e       r   e   a   l       (   v   e   r   i   f   i   c   a   d   a       c   o   n       `   \   d   t       a   p   p   .   *   `   )       s   o   l   o       t   i   e   n   e       `   a   p   p   .   s   c   h   e   m   a   _   m   i   g   r   a   t   i   o   n   s   `   ;       `   d   o   c   u   m   e   n   t   s   `       (   c   o   m   o       e   l       r   e   s   t   o       d   e       l   a   s       t   a   b   l   a   s       d   e       n   e   g   o   c   i   o   )       v   i   v   e       e   n       `   p   u   b   l   i   c   `   .       S   e       c   o   r   r   i   g   i    %  %     a       `   @   T   a   b   l   e   (   n   a   m   e       =       "   d   o   c   u   m   e   n   t   s   "   )   `   .       S   i   n       e   s   t   e       f   i   x   ,       H   i   b   e   r   n   a   t   e       f   a   l   l   a   b   a       l   a       v   a   l   i   d   a   c   i    %  % n       d   e       e   s   q   u   e   m   a       a   l       a   r   r   a   n   c   a   r       (   `   S   c   h   e   m   a   -   v   a   l   i   d   a   t   i   o   n   :       m   i   s   s   i   n   g       t   a   b   l   e       [   a   p   p   .   d   o   c   u   m   e   n   t   s   ]   `   )       p   a   r   a       c   u   a   l   q   u   i   e   r       r   e   q   u   e   s   t   ,       n   o       s   o   l   o       p   a   r   a       e   l       c   h   a   t   b   o   t   .    
    
    
    
   #   #   #       E   s   t   a   d   o       r   e   a   l       a   c   t   u   a   l       d   e   l       c   h   a   t   b   o   t    
    
    
    
   -       *   *   D   e   s   h   a   b   i   l   i   t   a   d   o   .   *   *       N   o       c   o   m   p   i   l   a       n   i       s   e       e   j   e   c   u   t   a       n   i   n   g    % Q % n       c    %  % d   i   g   o       d   e       `   C   h   a   t   B   o   t   T   o   o   l   s   C   o   n   f   i   g   `   ,       `   R   A   G   S   e   r   v   i   c   e   `       n   i       `   C   h   a   t   C   o   n   t   r   o   l   l   e   r   `   .    
    
   -       P   a   r   a       r   e   a   c   t   i   v   a   r   l   o       h   a   c   e       f   a   l   t   a       p   r   i   m   e   r   o       s   u   b   i   r       `   s   p   r   i   n   g   -   b   o   o   t   -   s   t   a   r   t   e   r   -   p   a   r   e   n   t   `       a       `   3   .   4   .   x   `   /   `   3   .   5   .   x   `       (   c   a   m   b   i   o       a   r   q   u   i   t   e   c   t    %  % n   i   c   o       m   a   y   o   r   ,       a   f   e   c   t   a       S   e   c   u   r   i   t   y   /   J   P   A   /   o   t   r   o   s       s   t   a   r   t   e   r   s       �   �   �       p   e   n   d   i   e   n   t   e   ,       n   o       r   e   a   l   i   z   a   d   o       e   n       e   s   t   a       s   e   s   i    %  % n   )   ,       y       l   u   e   g   o       r   e   a   c   t   i   v   a   r       `   s   p   r   i   n   g   -   a   i   -   b   o   m   `       e   n       u   n   a       v   e   r   s   i    %  % n       `   1   .   0   .   x   `       y       l   o   s       3       a   r   c   h   i   v   o   s       e   x   c   l   u   i   d   o   s   .    
    
   -       E   l       r   e   s   t   o       d   e   l       b   a   c   k   e   n   d       (   a   u   t   h   ,       C   R   U   D   s       d   e       c   a   t    % �   l   o   g   o   s   ,       R   L   S       a       n   i   v   e   l       d   e       q   u   e   r   i   e   s   )       f   u   n   c   i   o   n   a       n   o   r   m   a   l   m   e   n   t   e       s   o   b   r   e       S   p   r   i   n   g       B   o   o   t       3   .   2   .   4   ;       s   e       v   e   r   i   f   i   c    %  %     l   o   g   i   n       r   e   a   l       v    % �   a       `   P   O   S   T       /   a   p   i   /   v   1   /   a   u   t   h   /   l   o   g   i   n   `       c   o   n       u   n       u   s   u   a   r   i   o       d   e   l       s   e   e   d   .    
    
    
    
   #   #   #       D   a   t   o   s       d   e       d   e   m   o   s   t   r   a   c   i    %  % n       a   m   p   l   i   a   d   o   s       (   `   d   a   t   a   b   a   s   e   /   i   n   i   t   /   0   0   5   _   d   e   m   o   _   u   s   e   r   s   .   s   q   l   `   )    
    
    
    
   N   u   e   v   a       m   i   g   r   a   c   i    %  % n       i   n   c   r   e   m   e   n   t   a   l       (   n   u   m   e   r   a   d   a       t   r   a   s       `   0   0   4   _   s   a   a   s   _   h   a   r   d   e   n   i   n   g   `   ,       s   i   n       m   o   d   i   f   i   c   a   r   l   a   )       q   u   e       a   m   p   l    % �   a       e   l       s   e   e   d       d   e       `   0   0   3   `   :    
    
    
    
   -       A   g   r   e   g   a       r   o   l   e   s       `   S   u   p   e   r   v   i   s   o   r   `       y       `   U   s   u   a   r   i   o       o   p   e   r   a   t   i   v   o   `       a       *   *   C   l    % �   n   i   c   a       C   e   n   t   r   a   l   *   *       (   a   n   t   e   s       s   o   l   o       t   e   n    % �   a       `   A   d   m   i   n   i   s   t   r   a   d   o   r       d   e       t   e   n   a   n   t   `   )   ,       c   o   n       l   o   s       m   i   s   m   o   s       p   e   r   m   i   s   o   s       q   u   e       s   u   s       e   q   u   i   v   a   l   e   n   t   e   s       e   n       A   c   m   e   .    
    
   -       A   g   r   e   g   a       2       d   e   p   a   r   t   a   m   e   n   t   o   s       a       C   l    % �   n   i   c   a       C   e   n   t   r   a   l       (   `   A   d   m   i   n   i   s   t   r   a   c   i    %  % n   `   ,       `   R   a   d   i   o   l   o   g    % �   a   `   )       p   a   r   a       r   e   p   a   r   t   i   r       u   s   u   a   r   i   o   s   .    
    
   -       L   l   e   v   a       a       *   *   2   0       u   s   u   a   r   i   o   s       a   c   t   i   v   o   s       p   o   r       t   e   n   a   n   t   *   *       (   A   c   m   e       y       C   l    % �   n   i   c   a       C   e   n   t   r   a   l   )   ,       r   e   p   a   r   t   i   d   o   s       2       A   d   m   i   n   i   s   t   r   a   d   o   r       d   e       t   e   n   a   n   t       /       6       S   u   p   e   r   v   i   s   o   r       /       1   2       U   s   u   a   r   i   o       o   p   e   r   a   t   i   v   o       p   o   r       t   e   n   a   n   t   .       C   o   n   t   r   a   s   e    % � % a       d   e       t   o   d   o   s   :       `   D   e   m   o   P   a   s   s   1   2   3   !   `       (   e   x   c   l   u   s   i   v   a   m   e   n   t   e       d   e       d   e   m   o   s   t   r   a   c   i    %  % n   ,       i   g   u   a   l       q   u   e       e   l       r   e   s   t   o       d   e   l       s   e   e   d   )   .    
    
   -       E   s       i   d   e   m   p   o   t   e   n   t   e       (   `   O   N       C   O   N   F   L   I   C   T       D   O       N   O   T   H   I   N   G   `   )       y       s   i   g   u   e       e   l       m   i   s   m   o       p   a   t   r    %  % n       t   r   a   n   s   a   c   c   i   o   n   a   l       q   u   e       `   0   0   4   `       (   a   d   v   i   s   o   r   y       l   o   c   k   ,       r   e   g   i   s   t   r   o       e   n       `   a   p   p   .   s   c   h   e   m   a   _   m   i   g   r   a   t   i   o   n   s   `   )   .    
    
    
    
   *   *   V   e   r   i   f   i   c   a   c   i    %  % n       r   e   a   l   i   z   a   d   a   :   *   *       s   e       a   p   l   i   c    %  %     c   o   n       `   d   a   t   a   b   a   s   e   /   m   i   g   r   a   t   e   .   p   s   1   `       s   o   b   r   e       u   n   a       b   a   s   e       e   x   i   s   t   e   n   t   e       (   n   o   -   o   p       l   i   m   p   i   o   ,       s   i   n       d   u   p   l   i   c   a   r       f   i   l   a   s   )       y       s   e       p   r   o   b    %  %     d   e       p   u   n   t   a       a       p   u   n   t   a       e   n       u   n   a       i   n   s   t   a   n   c   i   a       P   o   s   t   g   r   e   s       a   i   s   l   a   d   a       c   o   n       v   o   l   u   m   e   n       1   0   0   %       n   u   e   v   o       (   c   o   n   t   e   n   e   d   o   r       y       v   o   l   u   m   e   n       t   e   m   p   o   r   a   l   e   s   ,       s   i   n       t   o   c   a   r       l   a       b   a   s   e       r   e   a   l   )   ,       c   o   n   f   i   r   m   a   n   d   o       q   u   e       `   d   o   c   k   e   r   -   e   n   t   r   y   p   o   i   n   t   -   i   n   i   t   d   b   .   d   `       e   j   e   c   u   t   a       `   0   0   1   `   �   �   �   `   0   0   5   `       e   n       o   r   d   e   n       y       p   r   o   d   u   c   e       e   l       m   i   s   m   o       r   e   s   u   l   t   a   d   o   :       2   0   /   2   0       u   s   u   a   r   i   o   s   ,       d   i   s   t   r   i   b   u   c   i    %  % n       d   e       r   o   l   e   s       i   d    % �   n   t   i   c   a   .    
    
    
    
   #   #   #       L   i   m   i   t   a   c   i   o   n   e   s       r   e   a   l   e   s       p   e   n   d   i   e   n   t   e   s    
    
    
    
   -       C   h   a   t   b   o   t       n   o       f   u   n   c   i   o   n   a   l       h   a   s   t   a       e   l       u   p   g   r   a   d   e       d   e       S   p   r   i   n   g       B   o   o   t       (   v   e   r       a   r   r   i   b   a   )   .    
    
   -       E   l       u   p   g   r   a   d   e       d   e       S   p   r   i   n   g       B   o   o   t       n   o       s   e       e   v   a   l   u    %  %     e   n       e   s   t   a       s   e   s   i    %  % n       m    % �   s       a   l   l    % �       d   e       c   o   n   f   i   r   m   a   r       l   a       i   n   c   o   m   p   a   t   i   b   i   l   i   d   a   d       d   e       v   e   r   s   i   o   n   e   s   ;       f   a   l   t   a       r   e   v   i   s   a   r       b   r   e   a   k   i   n   g       c   h   a   n   g   e   s       d   e       S   e   c   u   r   i   t   y   /   J   P   A       a   n   t   e   s       d   e       i   n   t   e   n   t   a   r   l   o   .    
    
   -       L   o   s       2   0       u   s   u   a   r   i   o   s       n   u   e   v   o   s       p   o   r       t   e   n   a   n   t       n   o       t   i   e   n   e   n       `   d   o   c   u   m   e   n   t   _   t   y   p   e   `   /   `   d   o   c   u   m   e   n   t   _   n   u   m   b   e   r   `   /   `   p   h   o   n   e   `   ;       q   u   e   d   a   n       `   N   U   L   L   `       c   o   m   o       e   n       e   l       r   e   s   t   o       d   e   l       s   e   e   d   .    
    
    
 
