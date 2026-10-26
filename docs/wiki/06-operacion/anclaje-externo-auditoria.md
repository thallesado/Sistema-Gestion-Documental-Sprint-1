# Anclaje externo de la cadena de auditoría

> Revisión documental: 2026-10-25 (sprint especial C3). Base de código: `3876454` más los cambios del sprint especial. Implementado y probado localmente contra una base de pruebas aislada; no activado en producción.

## Qué resuelve

La cadena SHA-256 de `audit_events` detecta que se altere una fila aislada. No detecta a un administrador de base de datos que deshabilite los triggers, reescriba filas, recalcule **toda** la cadena y vuelva a crear el ancla interna (`audit_anchors`, tipo `LOCAL_SIGNED`), porque todo vive en la misma base. El anclaje externo publica el último hash y su secuencia en un destino fuera del control de la base y `GET /api/v1/audit/verify` los compara.

## Destinos (`AuditAnchorPublisher`)

- **Archivo append-only** (`AUDIT_ANCHOR_EXTERNAL_FILE`): JSON lines, una por ancla, abierto solo con `APPEND` (nunca trunca ni sobrescribe), `fsync` en cada escritura, permisos `rw-------` al crearlo (si el sistema es POSIX) y bloqueo de archivo. Debe apuntar a un volumen/mount distinto al de la base, con permisos que el DBA no pueda modificar (idealmente solo-agregar o WORM). Si el DBA puede escribir ese archivo, la garantía se pierde: es una condición de despliegue, no algo que el código pueda imponer.
- **HTTP opcional** (`AUDIT_ANCHOR_EXTERNAL_HTTP_URL`): `POST` (o `PUT` para URL prefirmada) del ancla firmada, con timeout y cabecera `Authorization` opcional. No añade dependencias, solo http/https, sin redirecciones; los logs y mensajes nunca incluyen la cabecera ni la URL completa. Con `AUDIT_ANCHOR_EXTERNAL_HTTP_READ_URL` (GET `?scope=<tenantId|global>` que devuelve el ancla o un arreglo) también permite verificar; sin ella el estado es `UNVERIFIABLE`. No hay integración nativa con S3.

## Programador

`AuditAnchorScheduler` corre según `AUDIT_ANCHOR_CRON` (por defecto cada 15 minutos). Por cada tenant y para la cadena global: verifica la cadena completa, crea (o reutiliza) el ancla interna y la publica. **No sella una cadena que ya no verifica** (incluida una divergencia con el ancla externa previa), para que una reescritura no reemplace el sello honesto. Sin destino configurado queda `DISABLED` y lo informa en el arranque y en `GET /api/v1/audit/anchor/status` (lectura para `audit:read_global` o `audit:read_tenant`; solo tipos de destino, nunca rutas ni URL). El anclaje manual `POST /api/v1/audit/anchor` sigue siendo solo del superadministrador y no cambia.

## Estados de `externalAnchorStatus.status`

| Estado | Significado | `valid` |
| --- | --- | --- |
| `ANCHORED_MATCH` | El hash en la secuencia sellada coincide con la cadena actual | sin cambio |
| `ANCHOR_MISMATCH` | La cadena difiere del sello externo o fue truncada (`EXTERNAL_ANCHOR_MISMATCH`) | `false` |
| `ANCHOR_SIGNATURE_INVALID` | La línea externa no verifica con la clave HMAC (`EXTERNAL_ANCHOR_TAMPERED`) | `false` |
| `NO_EXTERNAL_ANCHOR` | Configurado pero aún no hay sello publicado | sin cambio |
| `UNREACHABLE` | No se pudo leer el destino; no afirma ni niega integridad | sin cambio |
| `UNVERIFIABLE` | Solo hay destinos de escritura | sin cambio |
| `NOT_CONFIGURED` | Sin destino; solo cadena interna (comportamiento anterior) | sin cambio |

La pantalla de Auditoría muestra este estado, también al administrador del tenant (solo lectura).

## Variables

`AUDIT_ANCHOR_EXTERNAL_FILE`, `AUDIT_ANCHOR_EXTERNAL_HTTP_URL`, `AUDIT_ANCHOR_EXTERNAL_HTTP_READ_URL`, `AUDIT_ANCHOR_EXTERNAL_HTTP_METHOD`, `AUDIT_ANCHOR_EXTERNAL_HTTP_AUTH_HEADER`, `AUDIT_ANCHOR_EXTERNAL_HTTP_TIMEOUT_MS`, `AUDIT_ANCHOR_CRON` y `AUDIT_ANCHOR_SECRET` (ver `infrastructure/.env.example`). La clave por defecto del repositorio es pública: definir `AUDIT_ANCHOR_SECRET` en producción y mantenerla fuera de la base, o un atacante con acceso al repositorio puede firmar anclas falsas.

## Endurecimiento

- **Secreto:** `AuditAnchorSecretGuard` detiene el arranque en el perfil `prod` si hay un destino externo configurado y `AUDIT_ANCHOR_SECRET` conserva el valor público por defecto; en otros casos solo advierte en el log.
- **Escritura concurrente:** el sumidero de archivo serializa a los escritores con un archivo hermano `<archivo>.lock` y comprueba la idempotencia dentro de ese bloqueo, así que dos instancias que comparten el volumen no duplican un ancla. El archivo `.lock` queda junto al de anclas y no contiene datos.
- **Lectura incremental:** `latest()` solo procesa los bytes agregados desde la consulta anterior y reinicia su caché si el archivo se reemplaza o se acorta.
- **Detalle de errores:** si el destino no se puede leer, `/audit/verify` responde un mensaje genérico; el detalle (con host y puerto) queda solo en el log del servidor.

## Límites conocidos

- Si el atacante controla también el volumen externo o `AUDIT_ANCHOR_SECRET`, no hay detección.
- Un archivo externo borrado vuelve a `NO_EXTERNAL_ANCHOR`; proteger el volumen y monitorear ese estado.
- El ciclo verifica la cadena completa de cada tenant: el costo crece con el volumen de auditoría.

## Pruebas

`AuditAnchorFileSinkTest`, `AuditAnchorHttpSinkTest` (servidor local efímero), `AuditExternalAnchorVerificationTest`, `AuditAnchorSchedulerTest` y, con `NEXODOCS_AUDIT_ANCHOR_IT=true` sobre una base aislada migrada, `AuditAnchorDbaAttackIntegrationTest`, que deshabilita triggers, reescribe una fila, recalcula la cadena y el ancla interna, y comprueba `ANCHOR_MISMATCH`. En frontend: `frontend/tests/audit-anchor-status.test.mjs`.
