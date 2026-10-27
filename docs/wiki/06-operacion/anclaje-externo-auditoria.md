# Anclaje externo de la cadena de auditoría

> Revisión documental: 2026-10-27 (C3 completo). Base de código: `4b1d203` más el ancla por defecto en Docker, la clave generada y la cadena v2 (migración 062). Probado localmente contra una base aislada migrada; el despliegue en el servidor queda pendiente.

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

`AUDIT_ANCHOR_EXTERNAL_FILE`, `AUDIT_ANCHOR_EXTERNAL_HTTP_URL`, `AUDIT_ANCHOR_EXTERNAL_HTTP_READ_URL`, `AUDIT_ANCHOR_EXTERNAL_HTTP_METHOD`, `AUDIT_ANCHOR_EXTERNAL_HTTP_AUTH_HEADER`, `AUDIT_ANCHOR_EXTERNAL_HTTP_TIMEOUT_MS`, `AUDIT_ANCHOR_CRON`, `AUDIT_ANCHOR_SECRET` y `AUDIT_ANCHOR_KEY_FILE` (ver `infrastructure/.env.example`).

**Activo por defecto en Docker (2026-10-27).** `infrastructure/docker-compose.yml` pasa estas variables al backend y monta el volumen `nexodocs_audit_anchor` en `/var/lib/nexodocs/audit-anchor` **solo en el backend**: el contenedor de PostgreSQL no lo ve, así que un DBA con acceso solo a la base no puede reescribir el ancla. El archivo por defecto es `/var/lib/nexodocs/audit-anchor/anchors.jsonl`. Quien administra el host Docker sí alcanza ese volumen; para ese caso usar el destino HTTP hacia un almacenamiento WORM (por ejemplo S3 con Object Lock y `READ_URL`). Vaciar `AUDIT_ANCHOR_EXTERNAL_FILE` vuelve a `DISABLED`/`NOT_CONFIGURED`.

**Clave HMAC (`AuditAnchorKeyProvider`).** Ya no hay clave pública por defecto. Con `AUDIT_ANCHOR_SECRET` propio se usa tal cual (para compartirla entre réplicas). Sin él, el backend genera la primera vez una clave aleatoria de 256 bits en `AUDIT_ANCHOR_KEY_FILE` (por defecto `anchor.key` junto al archivo de anclas, permisos `rw-------`) y la reutiliza en cada arranque. El antiguo valor público se ignora si aparece en la variable. Las anclas firmadas con ese valor antes de `2026-10-28T00:00Z` se siguen aceptando para no marcar como manipuladas las instalaciones existentes; cualquier ancla posterior con esa clave se rechaza (`AuditAnchorHardeningTest`).

## Cadena v2 (migración 062)

`062_audit_chain_v2` agrega `audit_events.hash_version`. Las filas anteriores quedan en `1` sin reescribirse (su hash no cambia). El trigger fija `2` en cada evento nuevo y su contenido canónico (`app.canonical_audit_payload_v2`) añade, tras el de 041, `v2`, `platform_actor_id`, `user_agent`, `client_timestamp` (milisegundos) y `client_timezone`: un superusuario que cambie quién actuó como plataforma, el agente o la hora del cliente (C1) rompe la cadena. Cambiar `hash_version` de 2 a 1 sin recalcular tampoco pasa, porque el hash v1 no coincide con el guardado. La migración también crea un índice único `(tenant, chain_seq)` si no hay duplicados previos. Paridad Java/SQL probada en `AuditAnchorDbaAttackIntegrationTest.dbaChangingClientTimestampOrUserAgentIsDetectedByChainV2` sobre una base migrada desde cero (001-062).

`GET /api/v1/audit/verify` devuelve `CHAIN_DELETED` si existe un ancla pero la cadena quedó sin eventos. `GET /api/v1/audit/anchor/status` informa `MANUAL_ONLY` cuando hay destino pero `AUDIT_ANCHOR_CRON=-`. `POST /api/v1/audit/anchor` rechaza un `type` que no sea mayúsculas, dígitos y `_` (máximo 50).

## Endurecimiento

- **Secreto:** ver «Clave HMAC» arriba; el antiguo `AuditAnchorSecretGuard` se retiró porque ya no existe un valor público utilizable.
- **Escritura concurrente:** el sumidero de archivo serializa a los escritores con un archivo hermano `<archivo>.lock` y comprueba la idempotencia dentro de ese bloqueo, así que dos instancias que comparten el volumen no duplican un ancla. El archivo `.lock` queda junto al de anclas y no contiene datos.
- **Lectura incremental:** `latest()` solo procesa los bytes agregados desde la consulta anterior y reinicia su caché si el archivo se reemplaza o se acorta.
- **Detalle de errores:** si el destino no se puede leer, `/audit/verify` responde un mensaje genérico; el detalle (con host y puerto) queda solo en el log del servidor.

## Límites conocidos

- Si el atacante controla también el volumen externo o la clave (`AUDIT_ANCHOR_SECRET` o `anchor.key`), no hay detección.
- Un archivo externo borrado vuelve a `NO_EXTERNAL_ANCHOR`; proteger el volumen y monitorear ese estado.
- El ciclo verifica la cadena completa de cada tenant: el costo crece con el volumen de auditoría.

## Pruebas

`AuditAnchorFileSinkTest`, `AuditAnchorHttpSinkTest` (servidor local efímero), `AuditExternalAnchorVerificationTest`, `AuditAnchorSchedulerTest` y, con `NEXODOCS_AUDIT_ANCHOR_IT=true` sobre una base aislada migrada, `AuditAnchorDbaAttackIntegrationTest`, que deshabilita triggers, reescribe una fila, recalcula la cadena y el ancla interna, y comprueba `ANCHOR_MISMATCH`. En frontend: `frontend/tests/audit-anchor-status.test.mjs`.
