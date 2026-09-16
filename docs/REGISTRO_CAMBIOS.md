# Registro de cambios del proyecto

Este documento conserva el historial explicativo de cambios relevantes. Cada
entrada indica qué existía antes, qué se modificó o mejoró y qué limitaciones
continúan. Los agentes deben actualizarlo cuando realicen cambios derivados de
una exploración o una decisión arquitectónica.

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
