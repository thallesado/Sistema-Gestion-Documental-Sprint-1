# Base de datos y migraciones

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Estado y ejecución

PostgreSQL 17, pgcrypto, esquema compartido con RLS. Código a590a6d: SQL hasta `035_ocr_job_persistence.sql`. Elegir el siguiente número revisando las ramas compartidas, no copiando un ejemplo fijo.

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
