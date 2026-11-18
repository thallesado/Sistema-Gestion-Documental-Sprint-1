# Entregas externas, buzón documental, archivo físico y traducción

> Revisión documental: 2026-11-17, checkout `c0c49ab` más cambios locales. Implementacion local parcial de P01, P04 y P05; P06 esta bloqueada. El correo real y la recuperacion completa requieren validacion.

## Entradas y procesos

| Función | Ruta Angular | Proceso real |
|---|---|---|
| Entregas externas | `/deliveries` | Seleccionar versión vigente aprobada → destinatario, motivo, vigencia y descarga → outbox → correo → portal → código por correo → acceso temporal → revocación/vencimiento. |
| Portal del destinatario | `/external/delivery#…` | Enlace firmado; elimina el fragmento de la barra, solicita código y mantiene la sesión solamente en memoria. No necesita cuenta interna. |
| Buzón documental | `/mail-intake` | Perfil autorizado → carpeta/reglas → probar IMAP → sincronizar → escanear → revisión humana → documento nuevo o versión existente con ETag → documento real. |
| Archivo físico | `/physical-archive` y `/physical-archive/:id` | Ubicaciones → ficha/custodio → solicitud → reserva → entrega física confirmada → devolución inspeccionada → incidencia/conciliación o disponibilidad. |
| Traducción documental | `/translations` y `/translations/:id` | Consulta disponible; creacion y publicacion bloqueadas con HTTP 503 hasta implementar y probar traduccion real. |

Sidebar: Documentos → Entregas externas; Digitalización → Buzón documental; Expedientes → Archivo físico; Documentos → Traducciones. Se muestran según permisos, sin sustituir autorización del backend. El detalle documental también enlaza a entregas y traducciones. Las rutas directas esperan la carga de `/auth/me` antes de evaluar permisos.

## Backend y almacenamiento

Se reutilizan `DocumentService`, `DocumentStorageService`, versiones, ETag, límites de plan, permisos de componentes, notificaciones internas y auditoría existente. Los controladores son [ExternalDeliveryController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/ExternalDeliveryController.java), [MailIntakeController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/MailIntakeController.java), [PhysicalArchiveController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/PhysicalArchiveController.java) y [DocumentTranslationController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/DocumentTranslationController.java).

`DocumentOperations` abre primero el alcance de routing y después la transacción; establece rol `nexodocs_app`, tenant y actor, y exige tanto permiso de sesión como permiso actual en PostgreSQL. El worker usa un actor activo autorizado del tenant, con una función propia de alcance acotado; no utiliza el provisionador privilegiado ni amplía `backup_scheduler_actor`.

Migraciones locales nuevas: 092 archivo físico, 093 entregas, 094 buzones, 095 notificaciones/actor de worker, 096 consistencia y conciliación, y 097 traducción documental. Cada archivo registra su nombre completo en `app.schema_migrations`. Inspeccionar numeración remota antes de integrar nuevos cambios.

## Contratos HTTP

Todos los endpoints internos comienzan por `/api/v1`, requieren sesión y se restringen al tenant. UUID inválido devuelve 400; otro tenant obtiene 403/404 según el punto de autorización. Los listados son paginados; los selectores muestran hasta 100 opciones.

| Base | Lecturas | Escrituras |
|---|---|---|
| `/deliveries` | GET listado, `/options`, `/{id}/events` | POST crear (202), `/{id}/revoke`, `/{id}/resend` (202) |
| `/external-deliveries` | Sin GET público de archivos | POST `/code`, `/verify`, `/info`, `/content`; capability firmada y sesión externa, sin JWT de usuario |
| `/physical-archive` | GET `/options`, `/items`, `/items/{id}` | POST/PUT fichas y ubicaciones; DELETE ubicación vacía; POST solicitudes, reservar/rechazar/cancelar/entregar/devolver, resolver incidencia y retirar |
| `/mail-intake` | GET `/connections`, `/items`, `/items/{id}`, `/items/{id}/preview` | POST/PUT conexión; POST test/disconnect/sync (202); accept/reject/rescan/reconcile/ocr de adjunto |
| `/translations` | GET `/options`, `/requests`, `/requests/{id}` | POST `/requests` (201), PATCH `/requests/{id}/segments/{segId}`, POST `/requests/{id}/publish`, POST `/requests/{id}/cancel`, POST/DELETE `/glossary` |

Transiciones de préstamo: REQUESTED → RESERVED/REJECTED/CANCELLED; RESERVED → HANDED_OVER/CANCELLED; HANDED_OVER → RETURNED. No existe entrega por arrastrar una tarjeta ni devolución automática. Solo una reserva/préstamo activo por original; la reserva vence como máximo a las 24 horas. Vencimiento de devolución genera recordatorio, sin afirmar que el papel regresó. Movimientos son inmutables; edición usa revisión optimista y solo se permite disponible.

Aceptar un adjunto reclama su fila y reutiliza creación/carga documental dentro de la misma transacción. Una segunda aceptación responde 409. Para agregar una versión se exige el ETag actual, motivo y permisos; ante 412 se recarga. El nuevo documento es borrador, nunca aprobado por recibir correo. Se notifica al responsable y se conserva procedencia.

## Correo, identidad externa y límites reales

Entregas: solo versión actual APPROVED/CURRENT al emitir; se conserva la versión exacta aunque luego haya otra. Cada acceso revalida estado, emisor autorizado, tenant, archivo y SHA-256. Se rechazan documentos eliminados, anulados o archivados. Un perfil con componentes documentales ocultos no puede entregar el archivo completo.

Vigencia 1–168 horas. Código de seis dígitos: 10 minutos, máximo cinco intentos y cinco solicitudes, espera mínima 60 segundos. Sesión externa: 20 minutos y acotada a una entrega. Tokens/códigos/sesiones no se guardan en claro: HMAC y outbox cifrado AES-GCM. El enlace llega únicamente por correo. Las respuestas públicas usan no-store, no-referrer y sandbox para contenido. Límite adicional de 60 peticiones/minuto por IP y endpoint público; en varias réplicas es local a cada proceso.

`SMTP_ACCEPTED` significa que SMTP aceptó el envío, no entrega garantizada a la bandeja del destinatario. Hay tres intentos persistidos de envío; reenvío manual espera cinco minutos. Revocar no retira una copia que el receptor ya descargó. Deshabilitar descarga tampoco puede impedir capturas o la conservación de bytes visualizados.

## Configuración necesaria, sin secretos en la wiki

- SMTP: reutiliza `MAIL_*` y `MAIL_FROM`. No enviar un enlace clínico real mediante HTTP. `FRONTEND_URL` debe ser HTTPS; la excepción `DOCUMENT_OPERATIONS_ALLOW_INSECURE_LOCAL` es exclusivamente para laboratorio local.
- Clave durable: `DOCUMENT_OPERATIONS_KEY_FILE`, por defecto dentro del volumen de almacenamiento, `.operations/key`. Conservarla junto al respaldo de infraestructura mediante un canal seguro; cambiarla invalida enlaces y mensajes cifrados pendientes. No se entrega en ZIP de tenant.
- IMAP: `MAILBOX_PROFILES_JSON`, objeto de perfiles configurados por administrador del servidor. Campos: `tenantId`, `label`, `host`, `port`, `tls`, `username`, `secret`, y opcional `auth: XOAUTH2`. Nunca se devuelve el secreto al navegador. Cada tenant solo ve sus perfiles; TLS y comprobación de certificado obligatorios fuera del laboratorio. XOAUTH2 consume un token vigente administrado externamente; no implementa renovación OAuth del proveedor.
- Escáner: `CLAMAV_HOST` y `CLAMAV_PORT` (3310). Protocolo ClamAV INSTREAM; si no responde, SCAN_PENDING y ninguna incorporación/vista previa. No se incluye ni configura silenciosamente un antivirus en EC2.
- OCR optativo: `MAIL_INTAKE_OCR_ENABLED=false` por defecto. Solo habilitar con proveedor configurado y autorización organizacional para enviar documentos a Google. Cada ejecución exige `ocr:create`, confirmación explícita y cuota; usa `OcrService` y devuelve sugerencias a revisar, no crea pacientes ni aprueba documentos.
- Worker: `DOCUMENT_OPERATIONS_WORKER_ENABLED` (true), sondeo por defecto cada minuto. IMAP automático por conexión habilitada como máximo cada dos minutos. No requiere un contenedor privilegiado nuevo.

La cuenta/carpeta se abre solo lectura; no borra, mueve ni marca mensajes leídos. Filtros: remitente exacto y asunto contiene. Un remitente coincidente no prueba autenticidad. La primera sincronización solo incorpora mensajes desde la activación; no hay importación histórica masiva. Cursor UIDVALIDITY/UID, unicidad por parte y Message-ID+hash auxiliar evitan repeticiones; un mismo hash en otro mensaje solo muestra advertencia.

Adjuntos: PDF, PNG, JPEG y DOCX; máximo 25 MiB por archivo, diez adjuntos, profundidad MIME cinco y cien posiciones UID por sondeo. Se comprueba firma, estructura y antivirus. PDFBox valida PDF, cifrado, máximo 2.000 páginas y contenido activo; DOCX tiene límites de expansión/entradas y bloqueo de macros; imágenes tienen tope de píxeles. No es una garantía absoluta contra archivos maliciosos. Ante error de conexión el lote falla explícitamente y se vuelve a probar la conexión antes de sincronizar. El cursor se confirma con el lote; la unicidad impide duplicar lo ya registrado.

Retención configurable 1–365 días por conexión: purga archivos rechazados/cuarentena vencidos en lotes limitados y conserva el ledger/hash/auditoría. No elimina documentos incorporados ni pendientes útiles. Desconectar pausa sincronizaciones; para revocar acceso al proveedor también retirar/revocar el perfil del servidor.

## Restauración y respaldo: distinción indispensable

Custodia física, comunicaciones externas y ledger de recepción se conservan fuera de `app.backup_tables()`: **una restauración lógica del tenant no los rebobina**. Restaurar revoca entregas/sesiones existentes y cancela mensajes pendientes; no revive un token. Un adjunto importado cuya versión desaparece pasa a RECONCILIATION_REQUIRED y exige motivo para volver a revisión. Los préstamos y entregas reales continúan vigentes; un original disponible que perdió su vínculo digital queda en conciliación, sin convertirse en papel devuelto.

Esta conservación no equivale a una copia de desastre: el ZIP lógico del tenant no contiene esas tablas ni sus archivos de cuarentena. El respaldo completo de PostgreSQL, volumen documental y clave de operaciones es necesario para recuperar infraestructura. No presentar el ZIP de tenant como exportación completa de estos tres módulos. La ampliación de exportación portable del ledger y sus archivos es una limitación actual explícita.

## Validación reproducible

```powershell
pnpm --dir frontend build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/document-operations.ps1 -Browser
powershell -NoProfile -ExecutionPolicy Bypass -File database/tests/run.ps1
node scripts/validate-wiki.mjs --include-remote
```

El script crea PostgreSQL desechable en tmpfs, aplica migraciones y ejecuta HTTP real con runtime NOSUPERUSER/NOBYPASSRLS, SMTP/IMAP GreenMail y un servidor de prueba del protocolo antivirus. Nunca usa la base local principal. `-Browser` requiere Playwright/Chromium y frontend compilado; utiliza el backend aislado real, sin respuestas API simuladas. Las capturas de `docs/evidencias/operaciones-documentales/` contienen solamente datos sintéticos.

La prueba del protocolo no certifica firmas/detección de una instalación ClamAV real. Tampoco certifica entrega SMTP/IMAP de Gmail/Microsoft, OAuth renovable ni Gemini real. Los diseños de [propuestas](../07-propuestas/README.md) conservan su rótulo conceptual y no se confunden con estas capturas.

## Traduccion: bloqueo preventivo

La creacion y publicacion responden 503: el codigo previo utilizaba parrafos fijos ajenos al documento y no exigia revision completa. Sigue pendiente implementar extraccion real, traduccion y validacion por segmento. No usar para documentos reales.

## Funciones y recorridos para mantenimiento

- Entrega: `ExternalDeliveryService.options()` selecciona versiones aprobadas; `create()` comprueba archivo y crea un mensaje pendiente; `DocumentOperationWorker.sendOne()` intenta SMTP; `requestCode()`, `verify()`, `info()` y `content()` aplican acceso temporal; `revoke()` invalida el acceso. `SMTP_ACCEPTED` no prueba entrega al buz?n.
- Buz?n: `MailboxGateway.test()` y `read()` consultan IMAP; `MailIntakeService.enqueue()`, `runJob()` y `storeAttachment()` registran recepci?n; `IntakeFileScanner.scan()` requiere un antivirus disponible; `accept()` crea documento o versi?n y `reject()` conserva el rechazo. No basta configurar SMTP para habilitar IMAP.
- Original f?sico: `PhysicalArchiveService.location()` y `saveItem()` registran ubicaci?n y ficha; `request()` solicita; `action()` reserva, entrega, devuelve o cancela; `maintenance()` vence reservas y recuerda devoluciones.
- Traducci?n: `DocumentTranslationService.create()` y `publish()` est?n bloqueadas con HTTP 503; `options()` y `detail()` no prueban una traducci?n real. No presentar el flujo como terminado.

Los registros de los modulos se excluyen de la restauracion logica del tenant para preservar hechos externos; un respaldo completo de PostgreSQL, archivos y clave es indispensable. Esto no constituye una restauraci?n individual completa de estas funciones.

La migraci?n 097 en una base nueva concede los permisos de traducci?n solo a roles con `backup:configure`; no se concede configuraci?n o publicaci?n a todos los lectores de documentos. Bases donde se aplic? una versi?n anterior deben revisar esos permisos con una migraci?n espec?fica y respaldo previo.

`DocumentService.changeStatus()` fuerza la escritura y refresca la entidad antes de devolver el ETag, porque PostgreSQL establece `updated_at` mediante un trigger. La prueba `statusResponseEtagSupportsNextTransition` comprueba dos transiciones consecutivas sin recarga.

`TranslationSourceExtractor.extract()` comprueba SHA-256, formato PDF, limite de 10 paginas y 20.000 caracteres; rechaza archivos protegidos o sin texto. Existe como componente probado y aun no esta conectado al flujo, que continua bloqueado con HTTP 503.

## Correcciones de la auditoría (2026-11-18)

- Traducción: `options`, `list` y `detail` exigen también `document:read`, porque exponen nombre, código y texto de los documentos (la tabla `documents` solo tiene RLS por tenant). Probado en `DocumentOperationsIntegrationTest`.
- Buzón: `MailboxGateway.normalizeMime` guarda el tipo sin parámetros y usa `application/octet-stream` si es vacío, inválido o mayor de 150 caracteres (`mime_type varchar(150)`). Antes un `Content-Type` largo hacía fallar el INSERT, se revertía el lote y el cursor no avanzaba, así que un solo correo bloqueaba cada sincronización. Sigue pendiente aislar los errores por mensaje (hoy cualquier otra excepción dentro de `runJob` revierte el lote completo) y borrar los archivos de cuarentena escritos en un lote revertido.
- Interfaz (2026-11-18): Traducciones oculta «Nueva traducción» y «Publicar copia derivada» mientras el backend responde 503 (`creationEnabled = false` en `translations-page.ts`); cancelar exige `translation:create` y el editor de segmentos solo aparece con `translation:review` en `REVIEW_PENDING`/`CHANGES_REQUESTED`. El buzón traduce `scan_result` y `error_code`, solo ofrece vista previa para PDF/PNG/JPEG y muestra «Digitalización OCR» solo con `ocr:create`. ReportIQ abre la pestaña externa con `noopener,noreferrer` y solo acepta `postMessage` del origen y la ventana de su iframe.
