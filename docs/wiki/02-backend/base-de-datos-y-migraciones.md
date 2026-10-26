# Base de datos y migraciones

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Estado y ejecución

PostgreSQL 17, pgcrypto, esquema compartido con RLS. Código a590a6d: SQL hasta `035_ocr_job_persistence.sql`. Elegir el siguiente número revisando las ramas compartidas, no copiando un ejemplo fijo. 036 a 039 son de facturación y 040/041 de auditoría (`040_audit_client_timestamp.sql`, `041_audit_tamper_proof.sql`). `042_component_permissions.sql` añade los privilegios por componente (ver [usuarios y privilegios](../04-dominio-y-negocio/usuarios-grupos-y-privilegios.md)). `043_user_profile_insert_grants.sql` concede a `nexodocs_app` el INSERT que faltaba sobre las columnas de perfil de `users` creadas en 018 (sin él, `POST /users` fallaba con *permission denied for table users*). `044_current_role_names.sql` crea `app.current_role_names()` para que `/auth/me` muestre el grupo real a perfiles sin `role:read`. 042 a 044 se llamaron 040 a 042 en la rama `oscar` antes de integrarse con la auditoría; cada una reconoce su nombre antiguo en `app.schema_migrations` y, si ya estaba aplicada, solo registra el nuevo. Tampoco usar `FOR UPDATE` sobre `tenants` desde `nexodocs_app`: bajo RLS exige la política de UPDATE (`configuration:update`) y devuelve cero filas al resto de perfiles; `PlanRepository.findPlanIdByTenantIdForUpdate` usa un `pg_advisory_xact_lock` por tenant. `045_audit_chain_select_grant.sql` da a `nexodocs_security` SELECT sobre `tenant_id`, `chain_seq` y `record_hash` de `audit_events`: el trigger SECURITY DEFINER de la cadena (041) los lee y sin ese permiso toda escritura auditada fallaba. Como ese trigger retiene el bloqueo de la cadena del tenant hasta el commit, `DefaultAuditRecorder` escribe el evento detallado en `afterCommit` (transacción nueva); escribirlo antes en `REQUIRES_NEW` interbloqueaba la petición. Pendiente de C3: `AuditVerificationService` usa `InetAddress.getHostAddress()` y la migración `host(inet)`, así que una IP IPv6 (`::1`) rompe `/audit/verify`.

Actualización local 2026-10-19: se agregaron y aplicaron las migraciones 034–041 sobre un volumen existente respaldado. La migración `044_enterprise_inquiries_schema.sql` completa la tabla requerida por `EnterpriseInquiry`, ausente de las migraciones anteriores; se dejaron libres 042/043 para las tareas de respaldos coordinadas. La nueva tabla tiene FK compuesta a usuarios, ENABLE/FORCE RLS, contexto restrictivo y SELECT/INSERT únicamente para el usuario propietario dentro del tenant. No concede UPDATE/DELETE a `nexodocs_app`. Este resultado local no acredita aplicación en EC2.

El historial es `app.schema_migrations.version` con nombre completo sin extensión. Hay prefijos repetidos (018/020); no son colisiones automáticas. El runner no comprueba checksum del contenido aplicado.

- Volumen nuevo: PostgreSQL ejecuta init completo, incluidos seed históricos.
- Base existente: servicio migrate usa SQL incluido en su **imagen**, omite 001-003 y consulta historial.
- Agregar SQL al repositorio no actualiza una imagen existente; reconstruir migrate.
- Backend depende de finalización exitosa de migrate.
- En el checkout actualizado, `application.yml` usa `ddl-auto: validate`. El arranque detecta tablas o tipos incompatibles; corregir migraciones/mapeos y no desactivar la validación. La afirmación anterior sobre `update` correspondía al snapshot histórico.

## Convención de migración nueva

Reutilizar un archivo vigente como referencia. Incluir ON_ERROR_STOP, transacción, lock/advisory lock apropiado, guard por nombre completo, cambios y registro en historial dentro de la transacción. No cambiar una migración aplicada: agregar otra.

Idempotencia puede lograrse con guard de historial; IF NOT EXISTS en cada instrucción no es un reemplazo de la transacción ni del control de integridad.

Para tabla tenant-scoped: tenant no nulo, unicidad compuesta necesaria, FKs compuestas, ENABLE/FORCE RLS, políticas restrictivas de contexto **y** permisivas RBAC, GRANT mínimos y funciones auxiliares cuando correspondan. No copiar únicamente tenant_isolation del esquema histórico.

No hay plantilla universal ejecutable: permisos, columnas, reglas y nombres deben definirse para el caso real.

## Seguridad operacional

Inspeccionar historial/datos/logs y respaldar antes de migrar. Una restricción puede rechazar datos previos sin que sea correcto eliminarlos. No usar down -v, borrar volúmenes, ejecutar seeds ficticios o reinicializar para solucionar el fallo.

El rol migrador administra DDL; no recomendar privilegios de migrador para el backend normal. Las funciones SECURITY DEFINER requieren dueño, search_path y grants revisados.

La migración `053_fix_runtime_grants.sql` corrige dos permisos que fallaban en una base construida solo con las migraciones: `INSERT` de `nexodocs_app` sobre `users.preferred_language` y `users.must_change_password` (046 y 051 solo daban UPDATE y SELECT, y `POST /api/v1/users` respondía 500), y `SELECT, INSERT, UPDATE` de `nexodocs_security` sobre `tenant_usage_monthly` (dueño de `app.record_tenant_monthly_usage`; sin él, crear documentos respondía 500). La migración `058_users_self_update.sql` agrega la política RLS `self_update` sobre `users` y el trigger `users_guard_self_update`: antes, `rbac_update` exigía `user:update`, así que cualquier otro usuario recibía "0 filas actualizadas" (reportado como conflicto de concurrencia, HTTP 409) al cambiar su propia contraseña o perfil. Sin `user:update`, un usuario solo puede modificar su propia fila y no puede cambiar `status`, `department_id`, `username` ni `deleted_at`; la prueba es `scripts/tests/self-update-users.sql`. La prueba de regresión de 053 es `scripts/tests/runtime-grants.sql`. Al agregar una columna mapeada por Hibernate o una función SECURITY DEFINER, revisar los grants de INSERT/UPDATE del rol que realmente los ejecuta.

Fuentes: [infrastructure/docker/migrate.sh](../../../infrastructure/docker/migrate.sh), [infrastructure/docker/migrations.Dockerfile](../../../infrastructure/docker/migrations.Dockerfile), [database/init/004_saas_hardening.sql](../../../database/init/004_saas_hardening.sql), [database/README.md](../../../database/README.md). [Pruebas](../05-guias-ia/pruebas-y-validacion.md) y [recuperación](../06-operacion/despliegue-y-recuperacion.md).
