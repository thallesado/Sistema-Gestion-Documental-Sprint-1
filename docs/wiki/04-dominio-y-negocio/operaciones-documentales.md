# Entregas externas, buzón documental, archivo físico y traducción

> Revisión documental: 2026-11-18, checkout `4d7c663` mas cambios locales. HU-26 incorpora roles separados y recuperacion de evidencia fisica; los otros modulos mantienen los limites y pruebas indicados en sus secciones.

## Entradas y procesos

**Cambio vigente HU-28 (2026-11-18):** por decision del usuario, el buzon funciona por defecto solo como recepcion automatica de adjuntos y descarga. `MAIL_INTAKE_RECEIVE_ONLY=true` omite ClamAV y la revision humana. Conserva controles tecnicos de tamano, firma y estructura, tenant/RLS, SHA-256, procedencia y deduplicacion. Los adjuntos validos quedan `RECEIVED` / `NOT_SCANNED`, sin crear documentos ni versiones y sin calificarlos como libres de malware. La interfaz ofrece «Ver recepcion» y «Descargar adjunto»; no ofrece revision, antivirus, OCR ni incorporacion en este modo. Las descripciones del flujo anterior de escaneo/revision que siguen se conservan como antecedente o aplican solo al desactivar explicitamente este modo.

`GET /api/v1/mail-intake/items` informa `receiveOnly`. `GET /items/{id}/download`, bajo la misma base, exige `mail-intake:read`, tenant y archivo integro, responde como adjunto `application/octet-stream`, `no-store` y `nosniff`. Un adjunto historico `SCAN_PENDING` / `SCANNER_UNAVAILABLE` puede descargarse y se presenta como recibido en este modo; no se reescriben sus resultados historicos. Archivos rechazados por estructura/formato, eliminados o de otro tenant no se descargan. Los endpoints anteriores de revision responden 409 en modo recepcion. La migracion `101_mail_intake_receive_only` solo amplia los estados permitidos, sin convertir registros ni alterar permisos/RLS. No se modifica EC2.

Validacion de este cambio: `DocumentOperationsIntegrationTest` ejecuto 22 pruebas, cero fallos/errores y una omitida (el recorrido visual opcional), sobre PostgreSQL efimero con runtime restringido. El caso de solo recepcion usa correo IMAP/SMTP GreenMail, verifica `RECEIVED`/`NOT_SCANNED`, descarga de bytes identicos con Content-Disposition adjunto, 404 de otro tenant, 409 de preview/rescan/accept, ausencia de documento vinculado y deduplicacion. Compilaciones Docker backend/frontend correctas. Chromium sobre localhost:4201 con respuestas API sinteticas comprobo progreso, ausencia de accion Revisar y aviso de escaner requerido, y presencia de descarga. La migracion 101 se aplico y se repitio correctamente solo en `nexodocs-pruebas-postgres-1`; backend/frontend de localhost:4201 recreados con las imagenes HU-28. No se envio otro correo Gmail real en esta verificacion; se conserva la evidencia anterior de recepcion Gmail.

| Función | Ruta Angular | Proceso real |
|---|---|---|
| Entregas externas | `/deliveries` | Seleccionar versión vigente aprobada → destinatario, motivo, vigencia y descarga → outbox → correo → portal → código por correo → acceso temporal → revocación/vencimiento. |
| Portal del destinatario | `/external/delivery#…` | Enlace firmado; elimina el fragmento de la barra, solicita código y mantiene la sesión solamente en memoria. No necesita cuenta interna. |
| Buzón documental | `/mail-intake` | Perfil autorizado → carpeta/reglas → probar IMAP → recepción automática → controles técnicos → adjunto recibido y descarga. Sin revisión ni incorporación documental por defecto. |
| Archivo físico | `/physical-archive` y `/physical-archive/:id` | Ubicaciones → ficha/custodio → solicitud → reserva → entrega física confirmada → devolución inspeccionada → incidencia/conciliación o disponibilidad. |
| Traducción documental | `/translations` y `/translations/:id` | PDF verificable y consentimiento -> proveedor -> revision por otra persona -> copia derivada no certificada. Sin proveedor configurado, 503. |

Sidebar: Documentos → Entregas externas; Digitalización → Buzón documental; Expedientes → Archivo físico; Documentos → Traducciones. Se muestran según permisos, sin sustituir autorización del backend. El detalle documental también enlaza a entregas y traducciones. Las rutas directas esperan la carga de `/auth/me` antes de evaluar permisos.

## Backend y almacenamiento

Se reutilizan `DocumentService`, `DocumentStorageService`, versiones, ETag, límites de plan, permisos de componentes, notificaciones internas y auditoría existente. Los controladores son [ExternalDeliveryController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/ExternalDeliveryController.java), [MailIntakeController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/MailIntakeController.java), [PhysicalArchiveController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/PhysicalArchiveController.java) y [DocumentTranslationController](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/DocumentTranslationController.java).

`DocumentOperations` abre primero el alcance de routing y después la transacción; establece rol `nexodocs_app`, tenant y actor, y exige tanto permiso de sesión como permiso actual en PostgreSQL. El worker usa un actor activo autorizado del tenant, con una función propia de alcance acotado; no utiliza el provisionador privilegiado ni amplía `backup_scheduler_actor`.

Migraciones locales nuevas: 092 archivo físico, 093 entregas, 094 buzones, 095 notificaciones/actor de worker, 096 consistencia y conciliación, 097 traducción documental, 098 conservacion de referencias historicas 099 revision concurrente y 100 recuperacion de archivo fisico. Cada archivo registra su nombre completo en `app.schema_migrations`. Inspeccionar numeración remota antes de integrar nuevos cambios.

## Contratos HTTP

Todos los endpoints internos comienzan por `/api/v1`, requieren sesión y se restringen al tenant. UUID inválido devuelve 400; otro tenant obtiene 403/404 según el punto de autorización. Los listados son paginados; los selectores muestran hasta 100 opciones.

| Base | Lecturas | Escrituras |
|---|---|---|
| `/deliveries` | GET listado, `/options`, `/{id}/events` | POST crear (202), `/{id}/revoke`, `/{id}/resend` (202) |
| `/external-deliveries` | Sin GET público de archivos | POST `/code`, `/verify`, `/info`, `/content`; capability firmada y sesión externa, sin JWT de usuario |
| `/physical-archive` | GET `/options`, `/items`, `/items/{id}` | POST/PUT fichas y ubicaciones; DELETE ubicación vacía; POST solicitudes, reservar/rechazar/cancelar/entregar/devolver, resolver incidencia, reasignar custodio y retirar |
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

Desde la migracion 100, los paquetes nuevos incluyen ubicaciones, fichas, prestamos y movimientos en `_physical_archive`, sin rebobinarlos. Restaurar conserva lo existente, recupera registros faltantes y exige conciliacion de la custodia recuperada. Ver [HU-26](archivo-fisico-y-prestamos.md). Los paquetes anteriores no incluian esa evidencia. Comunicaciones externas, ledger de recepcion y traducciones siguen fuera de la exportacion portable completa; el respaldo de PostgreSQL, archivos y clave sigue siendo necesario para recuperar infraestructura.

## Validación reproducible

```powershell
pnpm --dir frontend build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/document-operations.ps1 -Browser
powershell -NoProfile -ExecutionPolicy Bypass -File database/tests/run.ps1
node scripts/validate-wiki.mjs --include-remote
```

El script crea PostgreSQL desechable en tmpfs, aplica migraciones y ejecuta HTTP real con runtime NOSUPERUSER/NOBYPASSRLS, SMTP/IMAP GreenMail y un servidor de prueba del protocolo antivirus. Nunca usa la base local principal. `-Browser` requiere Playwright/Chromium y frontend compilado; utiliza el backend aislado real, sin respuestas API simuladas. Las capturas de `docs/evidencias/operaciones-documentales/` contienen solamente datos sintéticos.

La prueba del protocolo no certifica firmas/detección de una instalación ClamAV real. Tampoco certifica entrega SMTP/IMAP de Gmail/Microsoft, OAuth renovable ni Gemini real. Los diseños de [propuestas](../07-propuestas/README.md) conservan su rótulo conceptual y no se confunden con estas capturas.

## Traduccion: proceso implementado

1. `DocumentTranslationService.options()` ofrece versiones PDF con archivo real, no documentos anulados, archivados o eliminados. Los idiomas admitidos son es/en/pt/fr/de.
2. `create()` exige `translation:create`, lectura completa del documento y consentimiento para enviar texto a Google. `verifiedSource()` limita la lectura a 25 MiB, rechaza enlaces simbolicos y rutas de otro tenant; `TranslationSourceExtractor.extract()` comprueba SHA-256, PDF con texto, 1-10 paginas y hasta 20.000 caracteres. No usa texto fijo ni OCR implicito.
3. Se registra TRANSLATING antes de llamar a `GeminiClient.generateCompleteText()` **fuera de la transaccion**. El glosario activo del par de idiomas se incluye como contexto. Se almacena el modelo realmente utilizado. No se guarda el texto en logs ni auditoria.
4. La admision se serializa por tenant: maximo 20 solicitudes en 24 horas y una activa por version/idioma. Una respuesta vacia, excesiva, truncada (finishReason distinto de STOP) o un error registra FAILED; no devuelve exito inventado. `expireInterrupted()` marca como fallidas las solicitudes TRANSLATING sin avance durante una hora, sin reintentar automaticamente una llamada con coste.
5. El resultado se conserva como un bloque de revision con texto original y traducido. `updateSegment()` exige otra persona autorizada, estado permitido y revision optimista. El PATCH requiere `revision` (inicialmente 0); una edicion obsoleta obtiene 409. El bloque admite hasta 30.000 caracteres revisados.
6. `publish()` exige `translation:publish` y `document:create`, persona distinta del solicitante y todos los segmentos ACCEPTED/MODIFIED con texto. Vuelve a verificar disponibilidad e integridad del archivo fuente. Crea un **documento nuevo en borrador**, con metadatos y enlaces originales y version PDF propia, mediante `DocumentService.create()` y `DocumentStorageService.upload()`. No modifica ni aprueba el original.
7. `generateTranslatedPdf()` pagina por altura y ancho real, conserva acentos de los idiomas admitidos y rotula la copia NO CERTIFICADA. Si Helvetica no puede representar un simbolo, falla explicitamente en vez de borrarlo. No reproduce la maquetacion original ni admite PDF escaneado sin texto.
8. Publicar dos veces devuelve 409. Cancelar durante el procesamiento impide guardar/publicar su resultado. El historial conserva solicitudes aunque una restauracion retire documentos; `source_available` y `derived_available` distinguen disponibilidad actual de hechos historicos.

El proveedor puede alterar u omitir informacion: la revision humana sigue siendo obligatoria. La prueba automatizada utiliza Gemini simulado; no acredita calidad linguistica ni una llamada real a Google. Para probar el proveedor real se requiere `GEMINI_API_KEY` vigente en el backend, acceso de red y documentos sinteticos autorizados. Los permisos de traduccion se administran por rol; la migracion 097 actual solo los inicializa para roles con `backup:configure`. Instalaciones que aplicaron una version anterior requieren revisar sus concesiones, con respaldo previo.

## Funciones y recorridos para mantenimiento

- Entrega: `ExternalDeliveryService.options()` selecciona versiones aprobadas con archivo y hash; `create()` comprueba archivo y encola el mensaje; `DocumentOperationWorker.sendOne()` intenta SMTP; `requestCode()`, `verify()`, `info()` y `content()` aplican acceso temporal; `revoke()` lo invalida. `SMTP_ACCEPTED` no prueba entrega al buzon.
- Buzon: `MailboxGateway.test()` y `read()` consultan IMAP; `MailIntakeService.enqueue()`, `runJob()` y `storeAttachment()` registran recepcion; `IntakeFileScanner.scan()` requiere antivirus; `accept()` crea documento o version y `reject()` conserva el rechazo. SMTP e IMAP se configuran por separado. `DocumentOperationWorker.tick()` usa SYNC_ERROR ante un fallo general, sin atribuirlo automaticamente a una contrasena incorrecta.
- Original fisico: `PhysicalArchiveService.location()` y `saveItem()` registran ubicacion/ficha; `request()` solicita; `action()` reserva, entrega, devuelve o cancela; `maintenance()` vence reservas y recuerda devoluciones.
- Traduccion: `create()` -> `verifiedSource()`/`TranslationSourceExtractor.extract()` -> `GeminiClient.generateCompleteText()` -> `updateSegment()` -> `publish()`/`generateTranslatedPdf()` -> documento/version derivados. `cancel()` conserva la solicitud cancelada.

La migracion 098 conserva el ledger al retirar una fuente durante restauracion; las consultas LEFT JOIN mantienen visible el historial. La migracion 099 agrega `review_revision`. Los registros de estos modulos se excluyen de la restauracion logica para preservar hechos externos; esto **no constituye una exportacion individual completa** de sus datos y archivos.

`DocumentService.changeStatus()` fuerza la escritura y refresca la entidad antes de devolver el ETag, porque PostgreSQL establece `updated_at` mediante trigger. `statusResponseEtagSupportsNextTransition` comprueba dos transiciones consecutivas sin recarga.

## Evidencia local de esta continuacion (2026-11-17)

- `DocumentOperationsIntegrationTest`: 15 pruebas, cero fallos/errores/omitidas, incluyendo HTTP real, SMTP/IMAP de laboratorio y navegador. Se agregaron reserva concurrente con dos solicitantes, vencimiento sin entrega y traduccion con revision separada, edicion obsoleta, publicacion unica y fallo del proveedor.
- `TranslationSourceExtractorTest`: 4 pruebas correctas; incluye acentos, paginacion y rechazo explicito de simbolos no representables.
- `GeminiClientTest`: 8 pruebas correctas con servidor HTTP local, incluyendo rechazo de MAX_TOKENS y concatenacion de partes en respuesta completa.
- Compilacion Angular correcta. Suite SQL: `DATABASE_TESTS_OK` para inicializacion, bootstrap aislado, actualizacion/idempotencia, rollback, runtime restringido y versiones concurrentes. La integracion funcional de estos modulos usa routing desactivado; no equivale a un recorrido de dos bases tenant aisladas.
- No se aplicaron migraciones a la base principal ni a AWS. Los contenedores de demostracion que ya estaban ejecutandose no se reconstruyeron en esta continuacion.
- Pendiente de evidencia externa: Google real, SMTP/IMAP del proveedor y motor antivirus real. Pendiente de implementacion: alcance ampliado de P06 indicado en su propuesta y exportacion/restauracion portable completa del ledger y sus archivos. No afirmar 100% de las cuatro propuestas a partir de estas pruebas.

## Prueba de correo real (2026-11-18)

Se configuro Mailgun SMTP exclusivamente en `nexodocs-pruebas-backend-1`, usando el entorno aislado de demostracion de localhost:4201. Se recreo solo ese backend, sin reconstruir imagen, ejecutar migraciones ni cambiar el backend principal de localhost:4200 o AWS. La prueba no certifica el despliegue del nuevo main completo.

Se ejercitaron por HTTP los recorridos reales de contacto publico, alta de organizacion ficticia con bienvenida, recuperacion de contrasena de esa cuenta nueva y HU-25 con documento sintetico aprobado. La bienvenida registro envio exitoso; recuperacion creo una solicitud valida sin errores SMTP registrados y contacto devolvio 200 sin excepcion de envio. En HU-25, LINK y CODE terminaron SENT/SMTP_ACCEPTED, un intento cada uno. Son cinco mensajes al mismo destinatario autorizado; no se verifico la llegada a su bandeja ni se uso su codigo/token de recuperacion para cambiar la contrasena.

La organizacion creada se identifica como ficticia y uso el recorrido local de pago simulado, sin cobro real. Ninguna cuenta existente cambio su correo o contrasena. El informe detallado, sin tokens ni contrasenas, queda en el directorio temporal del operador (`nexodocs-mailgun-functional-report.json`), fuera de Git.

Limites comprobados del entorno: el aviso por migracion de precio depende de Stripe, no configurado; no se ejecuto ni simulo un cambio real de plan para enviar ese aviso. HU-28 sigue sin perfiles/conexiones IMAP y sin motor antivirus configurado. SMTP saliente no habilita recepcion IMAP. La prueba previa a un destinatario Gmail no autorizado obtuvo rechazo 421 del sandbox; el destinatario Hotmail autorizado si fue aceptado. No se intento agotar la cuota del proveedor.

## HU-28: antivirus aplazado por recursos (2026-11-18)

### Progreso visible de recepcion

El buzon incluye un panel de recepcion: en cola, consulta de correos, adjunto detectado/descargando (nombre y bytes reales), validacion y resultado final. No afirma recepcion antes de detectar el adjunto ni muestra porcentajes inventados. Consulta el estado cada dos segundos mientras hay trabajos activos; la bandeja se actualiza al confirmar el lote y el boton de sincronizar se bloquea para esa conexion mientras esta en curso. En reposo el sondeo es cada quince segundos aproximadamente. Si la consulta falla se conserva el estado previo con un aviso de error.

`GET /api/v1/mail-intake/items` conserva sus campos y agrega `started_at` a los trabajos y `progress` opcional (`phase`, `fileName`, `downloadedBytes`) solo durante una descarga/validacion activa. Los detalles se mantienen en memoria del backend que procesa el trabajo y se eliminan al terminar, tambien ante fallo. El listado se autoriza primero por tenant/RLS. Tras un reinicio o al consultar otra replica puede verse solo el estado persistido del lote; esta implementacion local no comparte progreso entre replicas. Terminar la descarga no elimina los controles de formato ni de antivirus. Una sincronizacion completada limpia el error de un reintento anterior.

Verificacion del panel: construcciones Docker backend/frontend correctas; `MailboxGatewayProgressTest` usa IMAP GreenMail y comprueba deteccion previa, bytes crecientes, contenido integro y validacion antes de entregar el adjunto. Navegador Chromium sobre localhost:4201 con API simulada verifica cola, descarga, bytes, validacion, finalizacion, fallo, actualizacion automatica y bloqueo de sincronizacion duplicada. La captura sintetica y el script de esa comprobacion quedan en el directorio temporal del operador (`nexodocs-hu28-descarga.png`, `nexodocs-hu28-progress-check.cjs`). No se envio otro correo real para esta prueba visual. El cambio esta aplicado solo al entorno de pruebas local; antivirus real y despliegue EC2 siguen pendientes.

El asunto no tiene un texto obligatorio: `subject_filter` es opcional; vacio acepta cualquier asunto, y con valor exige una coincidencia parcial sin distinguir mayusculas. En la conexion Gmail de pruebas se retiro el filtro de laboratorio `HU28`. Los mensajes omitidos no se recuperan automaticamente al cambiar reglas porque el cursor UID ya avanzo.

Se ajusto `MailboxGateway` para solicitar bloques IMAP de 1 MiB en lugar del valor por defecto de 16 KiB del cliente. Un volcado de hilos del backend de pruebas mostro la descarga detenida en `IMAPInputStream`/`MailboxGateway.read()` con un PDF grande, retrasando los siguientes mensajes. El cambio conserva TLS, lectura sin marcar mensajes, limites de archivo y bloqueo por falta de antivirus. Se aplica al backend de pruebas local, sin despliegue EC2.

Evidencia real posterior al ajuste: el lote de Gmail termino `COMPLETED` con dos adjuntos persistidos en la base del entorno de pruebas de localhost:4201. El PDF pequeno quedo `SCAN_PENDING` / `SCANNER_UNAVAILABLE`; el PDF grande quedo `QUARANTINED` / `REJECTED_STRUCTURE`. Se comprobo por IMAP y consulta de estado en base; no equivale a validacion visual, analisis antivirus ni incorporacion documental. La construccion Docker con `mvn clean package` termino correctamente y se valido la wiki. El despliegue de pruebas usa el override temporal `nexodocs-hu28-images.yml` con la imagen `nexodocs-hu28-backend`; conservar ese override al recrearlo.

Por decision del usuario, la instalacion y prueba de ClamAV real quedan pendientes por falta de recursos: la EC2 dispone de 1 GB de RAM segun el usuario, sin inspeccion remota en esta continuacion. No se instala el motor ni se modifica AWS. La configuracion de Gmail/IMAP esta en curso; no constituye evidencia de recepcion real hasta completar la prueba.

Se conserva el bloqueo de seguridad existente: sin antivirus disponible, un adjunto de formato y estructura validos obtiene `SCANNER_UNAVAILABLE` y queda en `SCAN_PENDING`, sin vista previa ni incorporacion. Omitir temporalmente el despliegue de ClamAV no significa marcar archivos limpios ni permitir su aceptacion. Puede comprobarse conexion IMAP y recepcion en cuarentena; quedan pendientes analisis real, revision con vista previa e incorporacion completa de HU-28. Retomar cuando exista capacidad suficiente o un escaner remoto conectado de forma privada.

Fuentes: [IntakeFileScanner](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/IntakeFileScanner.java) y [MailIntakeService](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MailIntakeService.java).

## HU-26: avance del 2026-11-18

Ver [archivo fisico y prestamos](archivo-fisico-y-prestamos.md) para permisos, funciones, API, evidencia visual y limites. Se corrigieron solicitudes/cancelaciones y recepcion de devoluciones con roles acotados, nombres historicos, reasignacion de custodio sin liberar prestamos y compatibilidad de respaldos creados por runtime restringido. El recorrido de ZIP descargado y restauracion por API se verifica ademas de la funcion SQL. No se exige SMTP para este modulo: sus avisos son internos.

## HU-27: verificacion posterior con proveedor real

El 2026-11-18 se completaron dos ciclos de traduccion con Gemini real, revision con otra cuenta y descarga de PDF, conservando los originales. [Cuenta local, permisos y evidencia](traduccion-pruebas-locales.md). Esta comprobacion sustituye el pendiente de Google real para ese recorrido PDF en 4201; no certifica DOCX, calidad profesional, IMAP ni antivirus externo.
