# NexoDocs — Backend API

Backend inicial de NexoDocs implementado con Spring Boot 3.2.4 y Java 21.
Su responsabilidad es exponer la futura API sin conectar el navegador
directamente a PostgreSQL.

## Tecnología

- Java 21.
- Spring Boot 3.2.4.
- Spring Security 6 con JWT stateless.
- Spring Data JPA y PostgreSQL 17.
- SpringDoc OpenAPI.

## Configuración

La aplicación no contiene credenciales ni secretos. Define estas variables
antes de ejecutarla:

```text
DB_URL=jdbc:postgresql://localhost:5433/nexodocs
DB_USERNAME=nexodocs
DB_PASSWORD=cambia_esta_clave
JWT_SECRET=un-secreto-aleatorio-de-al-menos-32-bytes
JWT_EXPIRATION_MS=28800000
CORS_ALLOWED_ORIGINS=http://localhost:4200
```

El esquema se administra con las migraciones de `../database/`. Hibernate usa
`ddl-auto: validate` y no debe modificar la base automáticamente.

## Comandos

Desde `backend/`:

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

Swagger queda disponible en
`http://localhost:8080/swagger-ui/index.html` cuando la aplicación está
ejecutándose.

## Fase 1: infraestructura de seguridad

- El filtro JWT valida firma y expiración, y propaga un contexto tipado con
  `userId`, `tenantId`, `username` y authorities de permisos.
- Las autoridades se cargan desde `user_roles`/`role_permissions` al iniciar
  sesión. Los nombres válidos son los sembrados en PostgreSQL, por ejemplo
  `user:read`, `user:create`, `user:update` y `user:delete`; no se concede
  acceso por una lista vacía ni por roles clínicos inventados.
- `GET /api/v1/auth/me` y `GET /api/v1/users?filter=...` requieren JWT. La
  segunda ruta devuelve `Page` y siempre consulta el tenant del contexto.
- Las mutaciones de usuarios exigen permisos explícitos y todas las lecturas,
  actualizaciones y bajas se restringen al tenant autenticado. Un `tenantId`
  recibido al crear solo se acepta si coincide; el backend nunca lo usa para
  elegir el tenant.
- CORS se configura con `CORS_ALLOWED_ORIGINS` y rechaza `*`, especialmente
  para evitar una apertura accidental en producción.

## Estado actual y límites

El login valida usuario, contraseña, estado y `tenantId`, y genera un JWT con
identificadores, tenant y permisos RBAC activos. La creación de usuarios
requiere autenticación y `user:create`. El módulo clínico es opcional y no
determina la autorización general del token.

Los servicios que leen o escriben datos protegidos establecen el contexto RLS
por transacción (`SET LOCAL ROLE`, `app.tenant_id` y `app.user_id`). La
revocación de access tokens persiste únicamente su huella SHA-256 en la tabla
`revoked_access_tokens` (migración `017_revoked_access_tokens.sql`, ya
aplicada); el refresh token continúa gestionándose en `auth_sessions`. Esa
tabla deliberadamente no usa RLS porque el filtro de seguridad debe poder
consultarla antes de establecer el contexto de la petición; el hash nunca
permite reconstruir el token original.

`GET /api/v1/audit` devuelve eventos persistidos del tenant autenticado con
actor, recurso, resultado, IP, agente y timestamp. Admite filtros exactos
`action`, `type`, `result` (`SUCCESS`/`FAILURE`), `from` y `to` mediante
`Specification` de JPA; el tamaño de página se limita a 100 y el orden se
restringe a campos auditables. Login, refresh y reset exitosos generan
auditoría de autenticación estableciendo el contexto RLS directamente desde la
identidad ya validada (sin depender del `SecurityContext`, que aún no existe
en `/auth/login`); las demás solicitudes autenticadas se auditan mediante un
interceptor HTTP que excluye `/api/v1/auth/**` para no duplicar eventos. Una
falla al persistir auditoría no altera la respuesta de negocio.

Las pruebas de esta fase son unitarias y MockMvc; las pruebas que requieren
PostgreSQL dependen de una instancia local con credenciales válidas y de las
migraciones aplicadas. No se debe conectar Angular directamente a la base.

## Fase 2: CRUDs maestros tenant-scoped

La Fase 2 incorpora CRUDs explícitos para catálogos de configuración. Todas las
operaciones obtienen el tenant desde `AuthenticatedUserContext`; no aceptan un
`tenantId` del cliente:

- `/api/v1/document-types`: tipos documentales, con búsqueda, filtro `active`,
  paginación y desactivación lógica.
- `/api/v1/tags`: etiquetas, con búsqueda y paginación. La tabla no tiene
  columna de baja lógica, por lo que `DELETE` realiza el borrado físico
  definido por el esquema (sus asignaciones se eliminan por la FK `CASCADE`).
- `/api/v1/departments`: áreas/departamentos, con búsqueda, filtro `active`,
  paginación y desactivación lógica.

Cada recurso expone `GET`, `GET/{id}`, `POST` y `PUT/PATCH/{id}`. Las rutas
requieren las authorities existentes `configuration:read`, `configuration:create`,
`configuration:update` y `configuration:delete`. Los servicios validan textos
obligatorios y duplicados sin exponer secretos o credenciales.

La conexión transaccional todavía no establece `SET LOCAL ROLE`,
`app.tenant_id` ni `app.user_id`; por ello el backend conserva el alcance
tenant-scoped en sus consultas y queda pendiente completar el contexto RLS
operativo antes de producción.
