# Respaldos y restauración por organización

> Revisión documental: 2026-10-21. Base `c93a8b4` más implementación local sin commit. Sustituye el estado de «vista previa» descrito en notas históricas; no acredita despliegue en AWS.

## Implementación

Para captura completa de plataforma y operación desde un host separado, consultar [respaldo completo del host](../06-operacion/respaldo-completo.md). Es una herramienta adicional pendiente de instalación y ensayo operativo; no modifica el aislamiento de las restauraciones por tenant.

El módulo pertenece al backend de NexoDocs. No requiere un proveedor de respaldos ni una API externa. [TenantBackupService](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/TenantBackupService.java) implementa generación, verificación, descarga, restauración, programación y retención. [BackupController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/BackupController.java) expone la API interna usada por Angular.

Historial, configuración diaria, operaciones y referencias de evidencia se guardan en PostgreSQL. Los paquetes ZIP se escriben en `STORAGE_LOCAL_PATH/.backups/{tenantId}/{backupId}.zip`, dentro del volumen documental existente. Cada paquete contiene `snapshot.json`, `manifest.json` y los archivos del tenant; incluye SHA-256 del snapshot y de cada archivo. El checksum del ZIP queda en la base y en el evento de finalización de auditoría. Se comprueba correspondencia entre tenant, identificador, esquema, datos y archivos antes de restaurar.

En sistemas POSIX, el directorio de respaldos y sus paquetes se restringen al propietario. Los ZIP son sensibles: contienen datos documentales, clínicos y datos de cuentas. No están cifrados por este módulo. Su descarga exige permiso específico y no expone rutas del servidor. Guardarlos en el mismo volumen es recuperación lógica local; no sustituye una copia externa para recuperar un disco perdido.

## Datos incluidos y excepciones

La captura enumera tablas **base** públicas con `tenant_id`; las vistas no se exportan como tablas. Incluye usuarios, roles, permisos asignados, pacientes, historias, notas, recetas si están persistidas en esas tablas, documentos/versiones, expedientes, workflows, comentarios, aprobaciones y sus relaciones. La extensión clínica no es obligatoria para otros rubros.

Se conservan sin rebobinar auditoría y anclas, historial/configuración de respaldos, operaciones/evidencias de restauración, sesiones, revocaciones, recuperación de contraseña y transacciones de facturación/pagos/solicitudes comerciales. Los catálogos globales no se sustituyen. Del tenant se recuperan datos institucionales y regionales; no se retrocede el plan ni se revierten cobros externos. Para usuarios existentes se conserva el hash de contraseña actual; se recuperan sus datos y asignaciones. Identidades posteriores necesarias para referencias de auditoría permanecen desactivadas mediante `deleted_at`, en vez de eliminarse.

Archivos normales bajo `{tenantId}/` y originales OCR bajo `ocr/{tenantId}/`. También se soportan archivos heredados `synthetic/` referenciados exactamente por las filas del tenant. No se copia esa carpeta compartida completa y se rechazan referencias compartidas con otro tenant, rutas fuera de alcance y enlaces simbólicos. Si falta un archivo asociado, el respaldo falla; no se anuncia una copia completa ficticia.

La firma de esquema protege frente a recuperar columnas incompatibles. Un cambio de esquema requiere un respaldo nuevo o diseñar un conversor; no existe conversión automática de paquetes antiguos.

## Recuperación y evidencia histórica

1. Verificar permisos actuales de la base, tenant, nombre de confirmación, integridad y compatibilidad.
2. Registrar operación persistente y suspender escrituras del tenant mediante triggers y bloqueos advisory. Otras organizaciones siguen funcionando.
3. Crear y verificar un respaldo de seguridad completo, fijado como evidencia.
4. Preparar archivos faltantes mediante movimientos atómicos. No se borran archivos posteriores ni se sobrescriben rutas cuyo contenido difiera; esa incompatibilidad aborta la operación.
5. Recuperar las tablas operativas en una transacción SQL. Las claves foráneas se comprueban antes de confirmar; un fallo revierte el cambio de datos.
6. Conservar eventos de auditoría originales y registrar el resultado de la restauración.

La [migración 050](../../../database/init/050_tenant_backups.sql) mantiene triggers y RLS habilitados. Sus funciones permiten la recuperación controlada solo con prueba de evidencia ligada al identificador de la transacción actual. El rol de aplicación no puede crear esa prueba. Los triggers ordinarios mantienen su comportamiento fuera de esa transacción, y auditoría/evidencia nunca reciben excepción de mutación. Las FKs de tablas operativas pasan a DEFERRABLE/NO ACTION donde correspondía RESTRICT, conservando comprobación inmediata en operaciones normales.

Los registros operativos posteriores dejan de estar vigentes; su estado exacto queda en el paquete de seguridad fijado y su payload. Auditoría y cadena de hashes no se reemplazan. Las filas de `tenant_restore_evidence` y los respaldos completos fijados rechazan modificación/borrado ordinario. Se conservan indefinidamente: la retención no elimina estas evidencias.

Ejemplo: una aprobación del martes sigue en auditoría después de restaurar el lunes. El paquete de seguridad contiene la versión y estado desplazados. Desde el detalle del respaldo protegido se consulta el UUID de versión, documento, nota, aprobación o evento, obteniendo la copia histórica; nunca se sustituye silenciosamente por el dato vigente. Para archivos exactos se descarga el ZIP y se verifican sus hashes. La auditoría registra las consultas de evidencia y descargas.

## API, permisos y pantalla

| Operación interna | Permiso |
|---|---|
| `GET /api/v1/backups` | `backup:read` |
| `POST /api/v1/backups` | `backup:create` |
| `PUT /api/v1/backups/settings` | `backup:configure` |
| `POST /api/v1/backups/{id}/verify` | `backup:read` |
| `GET /api/v1/backups/{id}/download` | `backup:download` |
| `POST /api/v1/backups/{id}/restore` | `backup:restore`, y creación del respaldo de seguridad autorizada |
| `GET /api/v1/backups/{id}/evidence?table=…&rowId=…` | `backup:download`; tablas permitidas y paquete protegido del propio tenant |
| `GET /api/v1/backups/maintenance` | Sesión de ese tenant; solo estado de operación |

La autorización efectiva se consulta en PostgreSQL por operación, no solo en el JWT. La migración concede permisos inicialmente a administradores/superadministradores del tenant. Ser administrador de plataforma sin tenant no concede acceso transversal. Operaciones y descargas de identificadores de otro tenant se rechazan.

Angular usa datos reales, consultas periódicas, filtros y paginación en memoria. No se incluye payload sensible en el listado. El botón de restaurar exige verificación válida/compatible y coincidencia exacta del nombre; el backend repite las validaciones. Un banner del shell anuncia la suspensión temporal y recuerda conservar formularios abiertos. El bloqueo real de escrituras reside en PostgreSQL, también para jobs.

La configuración es diaria, con hora, zona horaria y retención entre 1 y 365 días. El backend comprueba vencimientos cada minuto; después de un reinicio ejecuta la copia del día cuando corresponda, sin inventar copias de días anteriores. Requiere un usuario activo autorizado para crear respaldos del tenant. La retención elimina paquetes ordinarios vencidos, conserva sus registros y audita la expiración. Los usados como objetivo o seguridad de una restauración se fijan y quedan fuera de retención.

## Ejecución y pruebas

Diseñado para el backend único del despliegue actual. Los trabajos se ejecutan en segundo plano con dos workers locales y estados persistidos; un reinicio marca trabajos no terminados como interrumpidos. No hay cola distribuida ni soporte de múltiples réplicas de backend para el programador. La captura de JSON en memoria y la paginación cliente son límites de escala que deben medirse antes de usar tenants grandes.

La base aislada de integración contiene una copia del esquema/dataset local y el almacenamiento de prueba. No ejecutar scripts de pruebas de restauración en la base de trabajo:

- [tenant-backup-integration.sql](../../../scripts/tests/tenant-backup-integration.sql): compara todas las tablas operativas, otro tenant, bloqueo de escrituras, auditoría inmutable y evidencia; termina con ROLLBACK.
- [TenantBackupServiceTest](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/service/TenantBackupServiceTest.java): checksum, aislamiento de rutas, traversal y symlinks.
- [TenantBackupIntegrationTest](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/service/TenantBackupIntegrationTest.java): ZIP real, corrupción, confirmación, recuperación de datos/archivo, auditoría, otro tenant, copia automática, retención y protección de payload fijado. Solo corre con `NEXODOCS_BACKUP_IT=true`, base aislada migrada y `BACKUP_FIXTURE_STORAGE` apuntando a archivos de prueba. La suite normal lo omite explícitamente.

Se verificó el escenario completo y el script SQL en bases aisladas. No se ejecutó una restauración destructiva sobre el tenant de trabajo ni sobre EC2. Los resultados finales de build/despliegue local se informan en la entrega, no son una certificación permanente.

## Entrega local verificada

La migración 050 se aplicó después de respaldar base y archivos en el directorio local de respaldos (prefijo pre-backup-module). Backend, frontend y migrador fueron reconstruidos. Frontend y API pública respondieron HTTP 200; la API de respaldos sin sesión respondió 401. El programador generó dos paquetes AUTOMATIC/COMPLETED para los dos tenants existentes y sus SHA-256 coincidieron con el historial.

Build backend: 169 casos, 168 correctos y 1 integración omitida por requerir opt-in. La integración completa se ejecutó separadamente y pasó (incluye retención). Frontend: 116 pruebas correctas y 1 omitida. Verificador documental: 9 pruebas correctas. El script SQL de recuperación completo pasó contra la copia aislada con el esquema final; la bitácora conserva el hash original y la evidencia protegida rechaza mutaciones. Estas cifras son resultados de esta entrega, no sustituyen verificaciones después de otros cambios.

Para ver la entrada del sidebar tras la nueva concesión de permisos, renovar sesión y recargar el frontend Docker en localhost:4200. Los cambios permanecen locales, sin push ni despliegue a EC2.
