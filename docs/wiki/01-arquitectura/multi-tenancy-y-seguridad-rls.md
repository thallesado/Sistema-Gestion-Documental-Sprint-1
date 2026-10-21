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

## Bitácora inmutable y modelo de amenazas

A partir de la migración `041_audit_tamper_proof.sql`, `audit_events` implementa una cadena de hashes SHA-256 por tenant serializada mediante advisory locks transaccionales:

- **Cadena criptográfica en base de datos**: En cada inserción (`BEFORE INSERT`), el trigger `trg_audit_events_chain` adquiere `pg_advisory_xact_lock(726395, hashtext(coalesce(tenant_id::text, 'global')))` y calcula `record_hash = sha256(previous_hash || contenido canónico)` enlazado secuencialmente al `chain_seq` anterior. La génesis utiliza 64 ceros.
- **Modelo de amenazas y anclaje externo**:
  - *Amenaza de aplicación (usuario malicioso o inyección SQL)*: Los triggers de inmutabilidad (`trg_audit_events_no_update`, `trg_audit_events_no_delete`) impiden cualquier edición o borrado vía sentencias DML normales.
  - *Amenaza de DBA / Superusuario sin ancla*: Un superusuario con privilegios de sistema puede deshabilitar triggers y alterar filas históricas. El servicio `AuditVerificationService` (`GET /api/v1/audit/verify`) detecta de inmediato el eslabón roto (`HASH_MISMATCH` o `PREVIOUS_HASH_MISMATCH`). Sin embargo, un DBA con control total podría recalcular toda la cadena hacia adelante.
  - *Mitigación con ancla externa sellada*: `AuditAnchorService` publica periódicamente o bajo demanda sellos firmados con HMAC-SHA256 (`public.audit_anchors` y almacenamiento externo como S3 Object Lock). Si el DBA recalcula la cadena interna en la base de datos, la divergencia entre el hash sellado externamente y el hash recalculado es matemáticamente detectable (`EXTERNAL_ANCHOR_MISMATCH`), imposibilitando el repudio o la falsificación retroactiva.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/AuthenticatedUserContext.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/AuthenticatedUserContext.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuditVerificationService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuditVerificationService.java), [database/init/002_security.sql](../../../database/init/002_security.sql), [database/init/004_saas_hardening.sql](../../../database/init/004_saas_hardening.sql), [database/init/034_user_self_read_policy.sql](../../../database/init/034_user_self_read_policy.sql), [database/init/041_audit_tamper_proof.sql](../../../database/init/041_audit_tamper_proof.sql). Referencia: [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
