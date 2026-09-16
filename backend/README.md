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

## Estado actual y límites

El login inicial valida usuario, contraseña, estado y `tenantId`, y genera un
JWT con identificadores de usuario y tenant. La creación de usuarios requiere
autenticación. El módulo clínico es opcional y ya no determina el rol general
del token.

Todavía falta implementar el contexto RLS por transacción
(`app.tenant_id` y `app.user_id`), la autorización completa basada en
`user_roles`/`role_permissions`, los módulos documentales y las pruebas de
integración de seguridad. No se debe conectar Angular directamente a la base.
