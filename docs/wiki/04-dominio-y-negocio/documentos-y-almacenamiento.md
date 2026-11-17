# Documentos, expedientes y almacenamiento

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Núcleo común

Document es el registro maestro: tipo, código/nombre, estado, autor, responsable, área, expediente y metadatos; patientId/especialidad son opcionales clínicos. DocumentVersion representa cada archivo y su identidad propia.

Expedient agrupa documentos y responsables; no equivale automáticamente a ClinicalHistory. Reutilizar selección de entidades existentes para participantes, con tipo/rol explícito.

## Archivos y versiones

- DocumentStorageService exige motivo no vacío (hasta 1000 caracteres), archivo no vacío y máximo 25 MB.
- MIME allowlist local: PDF, JPEG, PNG, DOCX. El método adopt para indexación OCR también admite WEBP; no confundir las validaciones de carga manual, adopción OCR y avatars.
- Ruta relativa real: `{tenantId}/{documentId}/{versionId}`, sin carpetas año/mes ni extensión derivada del nombre original.
- Calcula SHA-256 durante copia; no deduplica automáticamente ni garantiza verificación del hash en cada descarga.
- Número de versión e integridad también dependen de lógica SQL: no implementar max+1 sin revisar bloqueo/concurrencia existente.
- Archivo temporal y movimiento; no sustituir por escritura directa sobre una versión anterior.
- Volumen de archivos y PostgreSQL son respaldos diferentes.

## Estados y workflows

Estados documentales: DRAFT, PENDING, IN_REVIEW, APPROVED, REJECTED, CORRECTED, CURRENT, ARCHIVED, VOIDED, TRASHED; consultar isAllowedTransition. Papelera no tiene restauración local implementada.

La migración 028 expone una función para detectar workflow activo y DocumentService impide cambiar manualmente su estado. **No demuestra un bloqueo general de toda subida de versiones o edición de metadatos.** El motor verifica la versión revisada/aprobada y exige nueva versión en corrección.

## HU-12: clasificación y filtros globales (2026-11-06)

Checkout `91fb767` más cambios locales. Las rutas GET `/documents`, `/documents/mine` y `/documents/shared` reciben categoría, tipo, departamento/servicio, especialidad, proceso institucional, responsable, fechas y orden mediante `DocumentSearchFilters`. `DocumentSearchSpecification` aplica los filtros en PostgreSQL antes de paginar; el total corresponde a todos los resultados, no a la página que Angular tenía cargada. Mantiene tenant, exclusión de bajas, permisos de componentes y alcance mine/shared.

La fecha de referencia es emisión o, si no existe, fecha de creación. Los límites son inclusivos; un rango invertido devuelve 400. Los filtros de texto tratan `%` y `_` como caracteres literales. No se permite filtrar campos ocultos ni ordenar por un nombre oculto. La búsqueda libre omite campos ocultos. Angular envía los filtros al servidor, reinicia la página cuando cambian y cancela consultas anteriores para evitar respuestas desactualizadas.

Se verificaron filtros individuales y combinados por HTTP y en pantalla con 15 documentos sintéticos: un documento fuera de la primera página se encuentra al filtrar; el rango exacto de emisión lo incluye, un rango sin coincidencias devuelve cero y limpiar filtros recupera el listado. [Capturas completas y resultados de HU-12](../../evidencias/hu12/README.md). No se verificó AWS ni se cambió la definición de Compartidos como autor distinto.

## HU-13: metadatos obligatorios y consulta (2026-11-06)

Checkout `91fb767` más cambios locales. Los tipos documentales ya exponían `metadataSchema`; ahora DocumentService valida ese contrato antes de persistir documentos y la pantalla genera sus campos, conserva los valores tipados y los muestra en el detalle. El esquema admite `required` y propiedades planas con tipo, título, fecha ISO, enum, longitudes y límites numéricos. Los tipos object/array se comprueban en su nivel superior; no es un validador general de JSON Schema ni resuelve referencias o esquemas anidados.

`PATCH /documents/{id}/metadata` exige `document:update`, bloquea la fila, mezcla los cambios sin borrar claves omitidas, valida el resultado y registra `UPDATE_METADATA` con los nombres de campos, sin copiar sus valores a la auditoría. Rechaza documentos cerrados o con workflow activo. Conserva las restricciones de componentes para valores que duplican paciente, responsable o emisión y devuelve el estado actualizado del documento. El cliente refleja los campos ocultos o de solo lectura.

WorkflowEngineService vuelve a validar los metadatos contra el tipo del documento antes de crear el workflow. Así un documento antiguo incompleto no elude la regla: puede completarse desde el detalle y luego iniciar su revisión. La pantalla consulta el tipo específico si no está en el catálogo activo cargado, para poder leer también sus metadatos históricos.

[Capturas completas, resultados HTTP y límites de HU-13](../../evidencias/hu13/README.md): alta, edición, recarga, rechazo del workflow incompleto e inicio exitoso tras corregirlo, comprobados con datos sintéticos locales. No describe AWS.

## HU-15: archivo digital (2026-11-06)

El catálogo central permite seleccionar Archivo digital: todos, Activos o Históricos. `archiveState=ACTIVE` excluye ARCHIVED, VOIDED y TRASHED; `HISTORICAL` incluye únicamente ARCHIVED. Se combina con tipo, fechas y los filtros de HU-12 en PostgreSQL antes de paginar, manteniendo tenant y permisos. Un valor desconocido devuelve 400. Sin ese filtro se conserva la consulta general de todos los estados.

Archivar desde APPROVED/CURRENT y restaurar desde ARCHIVED a CURRENT exige `document:archive` en el servicio, además del control de componentes y el token If-Match de HU-14. Tener solamente `document:update` no permite estas operaciones. Un workflow activo impide el cambio manual. Angular oculta las acciones de archivo/restauración sin permiso y vuelve a consultar el listado tras cambiar el estado, por lo que el documento sale del filtro anterior.

Archivar no borra documentos, metadatos ni versiones. Los metadatos y referencias se guardan en PostgreSQL y los archivos en el volumen central de almacenamiento: los binarios no se guardan en PostgreSQL. El histórico permite visualizar PDF/imágenes en otra pestaña y descargar archivos. La carga de otra versión devuelve 409 mientras está archivado; para continuar se restaura a Vigente. Los formatos sin visor nativo, como DOCX, se descargan.

[Flujo completo, capturas y resultados HU-15](../../evidencias/hu15/README.md): archivo y restauración por interfaz, filtros combinados, descarga con SHA-256 idéntico, denegación HTTP 403 sin permiso y conservación comprobada en PostgreSQL. Se verificó localmente con datos sintéticos; no certifica AWS.

## HU-16: conservación documental (2026-11-06)

`/settings/retention` permite crear, editar y eliminar políticas sin referencias, asociarlas a tipos y consultar documentos vencidos o próximos a cumplir el plazo. Usa `/api/v1/retention-policies`, `/types`, `/types/{id}` y `/due?days=30`. CRUD y asignación exigen los permisos `configuration:create/update/delete/read` correspondientes; consultar vencimientos también exige `document:read`. No se borran políticas referenciadas por tipos o transferencias; se pueden desactivar.

Plazos definidos de 0 a 1200 meses, o conservación indefinida explícita (`indefinite=true`, plazo nulo) que se conserva al editar. Las acciones KEEP (Conservar), TRANSFER y DELETE conviven con REVIEW, ARCHIVE y ANONYMIZE existentes. TRANSFER/DELETE exigen un plazo definido. La fecha inicial es el ingreso al nivel actual; inicialmente, emisión o creación del documento. PostgreSQL suma meses de calendario. Los vencimientos excluyen papelera/anulados, incluyen políticas activas con plazo definido y se ordenan por cumplimiento, hasta 500 resultados. Configurar DELETE no ejecuta eliminaciones automáticas: pasar un documento a TRASHED ahora exige `document:delete`, política DELETE vigente y plazo cumplido, además de las transiciones y controles previos. La baja sigue siendo lógica.

[Evidencia HU-16](../../evidencias/hu16/README.md): CRUD real, asociación persistente, vencimientos, permisos y protección contra disposición anticipada.

## HU-17: transferencias entre niveles (2026-11-06)

`/documents/transfers` consulta candidatos e historial, solicita un destino, confirma aprobación y confirma ejecución. API `/api/v1/document-transfers`, `/candidates`, `/{id}/approve` y `/{id}/execute`. Cambiar una transferencia exige `document:archive`, `document:read` y `configuration:read`; el historial exige lectura documental. Se reutilizan permisos existentes, sin inventar nombres nuevos.

La migración `090_document_retention_transfers` incorpora `documents.archive_level`, `archive_level_since` y una tabla de movimientos con RLS restrictivo por tenant, referencias compuestas, índice único de solicitud pendiente y estados REQUESTED → APPROVED → EXECUTED. El registro guarda solicitante, aprobador, ejecutor, fechas, motivo y una copia de política/plazo/cumplimiento. Un usuario autorizado puede ejercer más de una etapa; no se implementa separación obligatoria entre solicitante y aprobador.

Solo se permite Gestión → Central → Histórico. Se exige una política TRANSFER vigente con plazo cumplido, documento APPROVED/CURRENT/ARCHIVED y ausencia de workflow activo. No se permite saltar niveles, duplicar una solicitud pendiente ni repetir ejecución. Solicitar y aprobar no cambian el nivel: ejecutar actualiza el nivel y su fecha en la misma transacción y registra auditoría. Se bloquea documento, tipo, política y solicitud; aprobación/ejecución vuelven a comprobar vigencia, plazo y copia de la política. Una política cambiada bloquea la solicitud existente hasta restablecer sus valores; no hay cancelación de solicitudes en esta HU.

El movimiento es una clasificación lógica; no cambia el archivo físico, versiones, metadatos ni el estado de vigencia documental. El nivel HISTORICAL de HU-17 y el estado ARCHIVED de HU-15 son campos distintos. Se respetan componentes ocultos de nombre/código en las consultas. Candidatos e historial devuelven hasta 500 filas y muestran ese límite en pantalla.

[Evidencia HU-17](../../evidencias/hu17/README.md): dos movimientos completos desde Angular, integridad del PDF, denegaciones HTTP y prueba SQL de RLS y conservación de evidencia.

## Configuración y límites

DocumentType guarda metadataSchema, workflowTemplateId y retentionPolicyId. HU-13 conecta metadataSchema a la validación y consulta; HU-16/HU-17 hacen operativa la conservación y la transferencia manual. workflowTemplateId no inicia automáticamente un flujo. No se ejecutan disposiciones ni transferencias por cron. Compartidos consulta autor distinto, no ACL explícita. Cerrar un expediente no comprueba toda su integridad documental ni impide por sí mismo incorporar archivos.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ExpedientService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ExpedientService.java), [database/init/028_workflow_document_guard.sql](../../../database/init/028_workflow_document_guard.sql). [Núcleo por tenant](nucleo-documental-y-tenants.md), [OCR](digitalizacion-y-ocr.md).
## HU-14: control de revisión al cambiar estado o versión (2026-11-06)

El backend emite un `ETag` del documento calculado con SHA-256 de su id, estado, `currentVersion` y `updatedAt`. Angular conserva ese valor por documento: la lectura o creación lo obtiene y cada `PATCH /documents/{id}/status` o carga multipart a `/documents/{id}/versions` envía `If-Match`; la respuesta actualiza el token. La carga inicial usa el mismo mecanismo. El token no sustituye el JWT de sesión.

`DocumentStateToken.requireMatch` devuelve HTTP 428 si falta el token y 412 si ya no coincide con el estado/versión actual. Antes de validar y mutar, estado y versión bloquean la fila del documento dentro de la transacción, acotada al tenant, con `FOR UPDATE`. Si una carga posterior inserta una versión, la base avanza `current_version` y la política de versión nueva reinicia el estado a DRAFT; las filas anteriores permanecen en el historial.

Pruebas: `DocumentStateTokenTest` cubre cambios de token, ausencia y token obsoleto. La evidencia del navegador y respuestas HTTP locales está en [HU-14](../../evidencias/hu14/README.md). Se confirmó un documento sintético con versiones 1 y 2 y una transición obsoleta rechazada con 412. No se aplicó migración ni despliegue en AWS.
