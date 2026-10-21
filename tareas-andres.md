# Tareas de Andres: respaldos, infraestructura y despliegue

Carga estimada: 9,5 días. Migraciones reservadas: 042 y 043. Lee antes `README.md` (reglas de archivos calientes y flujo de GitHub).

Además eres el único que modifica `infrastructure/**` y `.github/workflows/**`, y quien configura la protección de `main` y despliega desde etiquetas.

## F1. Respaldo y restauración por tenant (requisito 6, P1, 5 días)

### Qué pide el docente

Con una base de datos compartida entre quince colegios, si el colegio 10 necesita restaurar el respaldo de ayer, restaurar toda la base destruiría los datos de hoy de los otros catorce. El sistema debe poder respaldar y restaurar **un solo cliente** sin tocar a los demás.

### Qué ya existe

- Tabla `backup_history` en `database/init/001_schema.sql` (con `tenant_id`, `backup_type` `TENANT` o `FULL`, `status`, `file_path`, `file_size_bytes`) y su política RLS en `002_security.sql`.
- Un `pg_dump` global en `database/migrate.ps1`, que solo corre antes de migrar.
- Todas las tablas de negocio tienen `tenant_id` y RLS. Los archivos están en disco bajo `STORAGE_LOCAL_PATH`: documentos en `{tenantId}/{documentId}/{versionId}` y digitalizaciones OCR en `ocr/{tenantId}/{jobId}`.
- No existe ninguna entidad, servicio ni controlador de respaldos.

### Qué implementar

1. Entidad `BackupHistory` y su repositorio.
2. `TenantBackupService.export(tenantId)`:
   - detectar las tablas con columna `tenant_id` desde `information_schema` y ordenarlas según sus claves foráneas;
   - volcar sus filas a un archivo (JSON por líneas dentro de un ZIP) y copiar la carpeta de archivos del tenant;
   - incluir un manifiesto con tenant, fecha, última migración aplicada y suma SHA-256 del paquete;
   - registrar el resultado en `backup_history`.
3. `TenantBackupService.restore(backupId)`:
   - crear primero un respaldo de seguridad del estado actual;
   - ejecutar todo en una sola transacción: borrar únicamente las filas de ese tenant en orden inverso de claves foráneas e insertar las del respaldo;
   - verificar el manifiesto antes de empezar y abortar si no coincide.
4. Endpoints, con permisos nuevos `backup:create` y `backup:restore` creados en la migración 042:
   - `POST /api/v1/backups` (respaldo manual del tenant actual);
   - `GET /api/v1/backups` (historial);
   - `GET /api/v1/backups/{id}/download`;
   - `POST /api/v1/backups/{id}/restore` (exige confirmación explícita en el cuerpo);
   - `POST /api/v1/platform/backups/full` (solo superadministrador: `pg_dump` completo más el almacenamiento).

### Decisión de diseño que debes tomar y documentar

Las tablas `audit_events` y `document_versions` tienen triggers que bloquean `UPDATE` y `DELETE` (`app.block_mutation()`). Una restauración que borre e inserte fallará ahí. Opciones:

- **Recomendada:** en esas dos tablas no borrar, e insertar con `ON CONFLICT DO NOTHING`. Se conserva el historial y se registra el evento de restauración en la auditoría.
- No recomendada: desactivar los triggers durante la restauración. Contradice la inmutabilidad que pide el docente.

También hay que resolver qué rol de base de datos ejecuta el respaldo. La aplicación corre con `SET LOCAL ROLE nexodocs_app` bajo RLS, que solo ve un tenant. Define un rol dedicado en la migración 042 y úsalo solo desde este servicio.

### Archivos

Nuevos: `model/BackupHistory.java`, `repository/BackupHistoryRepository.java`, `service/TenantBackupService.java`, `controller/BackupController.java`, `database/init/042_backup_permissions.sql`, y tests. No hace falta tocar archivos compartidos.

### Criterio de aceptación

Prueba con dos tenants: respaldar el A, modificar datos del A y del B, restaurar el A. El A vuelve al estado del respaldo y el B conserva sus cambios de después. Debe haber un script o test que lo demuestre y la decisión sobre las tablas inmutables escrita en `docs/`.

## F2. Respaldos programados y pantalla (requisito 6, P1, 3 días)

### Qué pide el docente

Tres niveles: automáticos, programados y de infraestructura completa.

### Qué ya existe

No hay `@EnableScheduling` ni ningún `@Scheduled`, y no hay pantalla de respaldos.

### Qué implementar

1. `@EnableScheduling` y `BackupScheduler`:
   - respaldo automático diario por tenant con hora configurable (`application.yml`, bloque propio);
   - respaldo completo de infraestructura programado por el superadministrador;
   - retención: conservar los últimos N y borrar los más viejos, registrándolo en `backup_history`.
2. Pantalla `features/backups/` en Angular: historial, botón "Respaldar ahora", descarga y restauración con diálogo de confirmación que obligue a escribir el nombre del tenant. La ruta y la entrada de menú ya vienen del PR 0.
3. Opcional si da el tiempo: frecuencia de respaldo según el plan (coordinar con Mauricio, tarea A1).

### Criterio de aceptación

Con el programador activo se crea un respaldo sin intervención, la pantalla lo lista y se puede restaurar desde ella. Un usuario sin `backup:restore` no ve el botón y la API responde 403.

## C2. Logins fallidos y límite de intentos (requisito 3, P1, 1 día)

### Qué ya existe

- `WebMvcConfig` excluye `/api/v1/auth/**` de la auditoría HTTP.
- `AuthenticationAuditService` solo tiene `recordSuccessfulAuthentication`.
- El límite de peticiones (`PublicEndpointRateLimitFilter`) solo protege `GET /api/v1/tenants/public`.

### Qué implementar

1. `recordFailedAuthentication`: evento `LOGIN_FAILED` con resultado `FAILURE`, IP, agente de usuario y el usuario intentado. Nunca guardar la contraseña.
2. Límite de intentos en `POST /api/v1/auth/login`, por IP y por usuario (por ejemplo 5 por minuto), con respuesta 429 y bloqueo temporal.
3. Tests: tras N fallos la API responde 429 y cada fallo deja un evento.

Archivos: `AuthController`/`AuthService` (solo el camino de fallo), `AuthenticationAuditService`, un filtro nuevo, `SecurityConfig` (registro del filtro) y un bloque en `application.yml`. Diego trabaja en la inserción de `audit_events` (C1 y C3): coordinar para no tocar `HttpAuditService`.

## G3. Compilar el APK en la integración continua (requisito 7, P2, 0,5 días)

`.github/workflows/mobile-ci.yml` solo ejecuta `flutter pub get`, `analyze` y `test`. Añadir `flutter build apk --debug` y subir el APK como artefacto. Reescribir `mobile/README.md` (hoy es la plantilla de Flutter) con cómo apuntar la app a un servidor.

## Responsabilidades de infraestructura

- Definir un `JWT_SECRET` propio en `infrastructure/.env` del servidor. El valor por defecto es inseguro.
- Activar la protección de `main` descrita en `README.md`.
- Desplegar desde etiquetas, no desde el último commit. Tras cada despliegue, comprobar los registros del contenedor `migrate`.
- Si se añaden variables nuevas (respaldos, límites), documentarlas en `.env.example`.

## Dependencias y coordinación

- No dependes de nadie para empezar.
- Diego (C3) añadirá columnas de cadena de hashes a `audit_events`: el respaldo debe incluirlas.
- Mauricio (A1) crea las entidades de planes: si quieres frecuencia por plan, espera a que estén.
