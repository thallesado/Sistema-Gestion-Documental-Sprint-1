# Registro de cambios del proyecto

Este documento conserva el historial explicativo de cambios relevantes. Cada
entrada indica qué existía antes, qué se modificó o mejoró y qué limitaciones
continúan. Los agentes deben actualizarlo cuando realicen cambios derivados de
una exploración o una decisión arquitectónica.

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
