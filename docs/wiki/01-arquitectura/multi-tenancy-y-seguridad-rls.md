# Multi-tenancy y RLS

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Contexto real

El JWT usa claim `tenantId`. `AuthenticatedUserContext` resuelve tenant y usuario autenticados. En transacción ejecuta `SET LOCAL ROLE nexodocs_app` y `set_config('app.tenant_id', ..., true)`, `set_config('app.user_id', ..., true)`.

**`app.current_tenant_id()` es una función, no el nombre de la variable.** Establecer solo el tenant no satisface el contexto de usuario/RBAC. Ejemplo de comprobación de lectura en una base de prueba, con UUID de un usuario activo autorizado:

```sql
BEGIN;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', '<uuid-tenant-autorizado>', true),
       set_config('app.user_id', '<uuid-usuario-autorizado>', true);
SELECT app.current_tenant_id(), app.current_user_id(), app.context_is_valid();
ROLLBACK;
```

No ejecutar los marcadores literalmente ni considerar que fijar UUID autentica una conexión.

## Evolución de políticas

- 002 crea `tenant_isolation`.
- 004 reemplaza esa política en muchas tablas con `tenant_context AS RESTRICTIVE TO nexodocs_app`, validación de tenant/usuario y políticas permisivas `rbac_select/insert/update/delete`.
- Migraciones posteriores tienen ajustes específicos, incluida lectura del perfil en 034. No generar una política universal ignorando estas capas.
- Una política restrictiva sola no concede acceso: hacen falta políticas permisivas y privilegios de tabla/función.
- Superusuarios/roles BYPASSRLS no son sujetos equivalentes para probar aislamiento. FORCE RLS no restringe superusuarios.
- `context_is_valid()` exige usuario activo no eliminado, del tenant, no de plataforma y suscripción en los estados permitidos por su SQL.

## Tablas y consultas

Datos de organización: `tenant_id` obligatorio, unicidad `(tenant_id, id)` cuando se referencia y FKs tenant-scoped. Se puede conservar PK global `id` y agregar unicidad compuesta; no afirmar que todas las PK son compuestas.

Agregar ENABLE/FORCE RLS, políticas del patrón vigente y GRANT mínimos. No copiar solo un filtro de tenant sin RBAC. Tablas globales y usuarios/sesiones de plataforma tienen excepciones deliberadas: inspeccionar el modelo antes de imponer tenant no nulo.

El tenant para negocio procede del contexto. Login, selección pública y administración autorizada son casos distintos; no prohibir por descripción todos los parámetros tenant de todas las API. Cuentas de plataforma no reciben automáticamente acceso a workflows de organizaciones.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/AuthenticatedUserContext.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/AuthenticatedUserContext.java), [database/init/002_security.sql](../../../database/init/002_security.sql), [database/init/004_saas_hardening.sql](../../../database/init/004_saas_hardening.sql), [database/init/034_user_self_read_policy.sql](../../../database/init/034_user_self_read_policy.sql). Referencia: [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
