# Base de datos y migraciones

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Estado y ejecución

PostgreSQL 17, pgcrypto, esquema compartido con RLS. Código a590a6d: SQL hasta `035_ocr_job_persistence.sql`. Elegir el siguiente número revisando las ramas compartidas, no copiando un ejemplo fijo. La rama `oscar` añade `040_component_permissions.sql` (privilegios por componente; ver [usuarios y privilegios](../04-dominio-y-negocio/usuarios-grupos-y-privilegios.md)); 036 a 039 ya los ocupaba la facturación. `041_user_profile_insert_grants.sql` concede a `nexodocs_app` el INSERT que faltaba sobre las columnas de perfil de `users` creadas en 018 (sin él, `POST /users` fallaba con *permission denied for table users*). `042_current_role_names.sql` crea `app.current_role_names()` para que `/auth/me` muestre el grupo real a perfiles sin `role:read`. **Conflicto de numeración:** `origin/main` ya tiene `040_audit_client_timestamp.sql` y `041_audit_tamper_proof.sql`; las versiones se registran por nombre de archivo, así que ambas parejas se aplican, pero hay que acordar la renumeración antes de fusionar. Tampoco usar `FOR UPDATE` sobre `tenants` desde `nexodocs_app`: bajo RLS exige la política de UPDATE (`configuration:update`) y devuelve cero filas al resto de perfiles; `PlanRepository.findPlanIdByTenantIdForUpdate` usa un `pg_advisory_xact_lock` por tenant.

El historial es `app.schema_migrations.version` con nombre completo sin extensión. Hay prefijos repetidos (018/020); no son colisiones automáticas. El runner no comprueba checksum del contenido aplicado.

- Volumen nuevo: PostgreSQL ejecuta init completo, incluidos seed históricos.
- Base existente: servicio migrate usa SQL incluido en su **imagen**, omite 001-003 y consulta historial.
- Agregar SQL al repositorio no actualiza una imagen existente; reconstruir migrate.
- Backend depende de finalización exitosa de migrate.
- Hibernate local/prod hereda ddl-auto update; es una discrepancia con la intención de controlar esquema solo con SQL.

## Convención de migración nueva

Reutilizar un archivo vigente como referencia. Incluir ON_ERROR_STOP, transacción, lock/advisory lock apropiado, guard por nombre completo, cambios y registro en historial dentro de la transacción. No cambiar una migración aplicada: agregar otra.

Idempotencia puede lograrse con guard de historial; IF NOT EXISTS en cada instrucción no es un reemplazo de la transacción ni del control de integridad.

Para tabla tenant-scoped: tenant no nulo, unicidad compuesta necesaria, FKs compuestas, ENABLE/FORCE RLS, políticas restrictivas de contexto **y** permisivas RBAC, GRANT mínimos y funciones auxiliares cuando correspondan. No copiar únicamente tenant_isolation del esquema histórico.

No hay plantilla universal ejecutable: permisos, columnas, reglas y nombres deben definirse para el caso real.

## Seguridad operacional

Inspeccionar historial/datos/logs y respaldar antes de migrar. Una restricción puede rechazar datos previos sin que sea correcto eliminarlos. No usar down -v, borrar volúmenes, ejecutar seeds ficticios o reinicializar para solucionar el fallo.

El rol migrador administra DDL; no recomendar privilegios de migrador para el backend normal. Las funciones SECURITY DEFINER requieren dueño, search_path y grants revisados.

Fuentes: [infrastructure/docker/migrate.sh](../../../infrastructure/docker/migrate.sh), [infrastructure/docker/migrations.Dockerfile](../../../infrastructure/docker/migrations.Dockerfile), [database/init/004_saas_hardening.sql](../../../database/init/004_saas_hardening.sql), [database/README.md](../../../database/README.md). [Pruebas](../05-guias-ia/pruebas-y-validacion.md) y [recuperación](../06-operacion/despliegue-y-recuperacion.md).
