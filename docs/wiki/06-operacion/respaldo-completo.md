# Respaldo completo del host

> Revisión documental: 2026-10-21. Revisión `c93a8b4` más cambios sin commit. Herramientas preparadas; no instaladas ni ejecutadas en producción.

## Captura y programación

[backup-full.sh](../../../infrastructure/backup-full.sh) captura PostgreSQL en formato custom y el volumen `/data/storage`, incluidos los ZIP por tenant. Requiere Linux, Docker Compose, Git, `findmnt`, `flock`, `tar`, `sha256sum` y la imagen local `postgres:17-alpine`. El destino debe existir en un sistema de archivos distinto del checkout y los volúmenes de origen. Debe ser almacenamiento cifrado y restringido al operador: los paquetes contienen información sensible. No copia archivos `.env` ni imprime configuración de conexión. La configuración del servidor debe recuperarse por su mecanismo de aprovisionamiento existente.

El script detiene el backend para que la base y los archivos correspondan al mismo intervalo sin escrituras. Requiere un único backend y ausencia de otros escritores externos. Reactiva el backend al terminar, incluso si falla la captura. El PostgreSQL sigue disponible: no elimina ni reinicializa volúmenes. Verifica el catálogo del dump, la lectura del TAR y SHA-256 antes de publicar el directorio final; una captura fallida queda como `.partial` y exige revisión del operador. Verificar un archivo no demuestra que se pueda restaurar: es obligatorio ensayar la recuperación.

En el servidor, ajustar `/opt/nexodocs` y `/mnt/nexodocs-backups` a las rutas reales antes de instalar los archivos [service](../../../infrastructure/systemd/nexodocs-full-backup.service) y [timer](../../../infrastructure/systemd/nexodocs-full-backup.timer). El timer define las 03:00 UTC y recupera ejecuciones omitidas después de un reinicio. Ejecutar primero el servicio manualmente, comprobar `journalctl -u nexodocs-full-backup.service` y confirmar un directorio final con sumas válidas. Después activar el timer y comprobar su próxima ejecución. No se instaló este programador en esta sesión.

No hay borrado automático de copias completas ni de evidencia fijada. El operador debe controlar capacidad, alertas de fallo/espacio y retención externa antes de activarlo. El script no sustituye una política de conservación.

## Solicitud desde la plataforma

`POST /api/v1/platform/backups/full` devuelve 202 y un identificador de operación. `GET /api/v1/platform/backups/full/{id}` consulta PENDING, RUNNING, COMPLETED o FAILED. Solo admite identidad sin tenant con el permiso existente `platform:tenant:manage`; asignar ese permiso a una cuenta de tenant no le concede acceso. No se devuelven rutas, datos de la copia ni logs del operador. La cola conserva el UUID del solicitante, fecha y estado.

El [servicio](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PlatformBackupService.java) publica solicitudes en un directorio compartido. Por defecto está deshabilitado y devuelve 503. Si el heartbeat del operador no existe o tiene más de tres minutos, devuelve 503; si ya hay una solicitud pendiente o en curso, devuelve 409. No anuncia un respaldo realizado al recibir una solicitud. La cola persiste al reiniciar el backend.

Para habilitarlo en Linux, crear `/var/lib/nexodocs-backup-queue` con permisos exclusivos para operador y usuario del backend. Incorporar el [override de Compose](../../../infrastructure/docker-compose.backup-operator.yml) y conservarlo en futuras recreaciones. Usa `BACKUPS_PLATFORM_QUEUE_PATH` para la propiedad `backups.platform.queue-path`. No montar el socket Docker dentro del backend. Instalar el [worker](../../../infrastructure/backup-worker.sh), su [service](../../../infrastructure/systemd/nexodocs-backup-worker.service) y [timer](../../../infrastructure/systemd/nexodocs-backup-worker.timer), con las mismas rutas/destino y proyecto Compose del despliegue. El timer procesa solicitudes cada minuto; el timer diario independiente cubre las copias automáticas sin intervención. Si el proyecto Compose tiene nombre personalizado, configurar `COMPOSE_PROJECT_NAME` en ambos servicios del host. Ajustar también `ReadWritePaths` si se cambian rutas.

El worker serializa ejecuciones, marca FAILED una operación interrumpida y conserva los resultados. Sus logs se consultan en journald del host, fuera de la cola escrita por la aplicación. Los temporizadores no están activados en esta sesión. Es obligatorio probar una solicitud real y su resultado antes de habilitar la función en producción.

Validación local del 2026-10-21: tres pruebas Java del servicio cubren autorización, operador deshabilitado/no disponible, persistencia y estados. [backup-full.test.sh](../../../scripts/tests/backup-full.test.sh), ejecutado en un contenedor Linux sin red y con Docker simulado, comprueba recuperación tras fallo de dump, ausencia de publicación ficticia, heartbeat y detección de operaciones interrumpidas. La sintaxis de los scripts fue validada. No equivale a un ensayo real de captura/restauración de infraestructura.

## Despliegue desde etiqueta

[deploy-tag.sh](../../../infrastructure/deploy-tag.sh) exige checkout limpio y una etiqueta existente, cambia a su commit exacto y comprueba que el migrador terminó con código cero. No hace fetch ni publica etiquetas. Usar `COMPOSE_PROJECT_NAME` del despliegue y, si corresponde, `COMPOSE_ENV_FILE` con la ruta de configuración externa. Con `ENABLE_BACKUP_OPERATOR=true` conserva el override de la cola durante la recreación. Se ejecuta únicamente en el host autorizado, después de revisar y publicar los cambios. No se ejecutó aquí. Después comprobar registros del migrador, HTTP, login y aislamiento; el script no certifica esas comprobaciones.

## Ensayo de recuperación

1. Utilizar un host aislado, sin tráfico de producción y con volúmenes nuevos. Comprobar `SHA256SUMS` antes de usar el paquete.
2. Recuperar el checkout de `revision.txt`. Si existe `checkout-warning.txt`, la revisión no reproduce los cambios locales: conservarlos y versionarlos antes de un despliegue definitivo.
3. Aprovisionar la configuración mediante el mecanismo del entorno, sin copiar valores a tickets o logs. Inicializar los roles requeridos por las migraciones en una base vacía de ensayo.
4. Mantener backend y migrador detenidos. Recuperar `database.dump` con `pg_restore --exit-on-error` en una base vacía compatible. Conservar propietarios y permisos; no ejecutar contra una base existente ni usar `--clean` sobre producción.
5. Extraer `storage.tar` únicamente en el volumen vacío de almacenamiento, como operador autorizado. Verificar propietario, espacio y hashes de archivos documentales.
6. Arrancar el backend de la revisión respaldada; comprobar migraciones, perfil, listado/descarga de documentos y OCR de dos tenants, aislamiento y cadena de auditoría. Registrar duración, errores y resultado antes de considerar la recuperación operativa.

## Alcance pendiente

Falta ejecutar captura y recuperación completa en un host con destino independiente y configurar capacidad/retención. El endpoint y worker separado están implementados, pendientes de instalación y ensayo conjunto. El backend web no recibe el socket Docker ni permisos de superusuario del host. Protección de `main`, despliegue desde etiqueta y configuración de producción requieren acceso administrativo al repositorio y al servidor; no se comprobaron aquí.
