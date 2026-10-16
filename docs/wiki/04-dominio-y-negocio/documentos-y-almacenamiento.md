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

## Configuración y límites

DocumentType guarda metadataSchema, workflowTemplateId y retentionPolicyId. En el código local no están conectados a validación dinámica/inicio automático/conservación operativa. Compartidos consulta autor distinto, no ACL explícita. Cerrar un expediente no comprueba toda su integridad documental ni impide por sí mismo incorporar archivos.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ExpedientService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ExpedientService.java), [database/init/028_workflow_document_guard.sql](../../../database/init/028_workflow_document_guard.sql). [Núcleo por tenant](nucleo-documental-y-tenants.md), [OCR](digitalizacion-y-ocr.md).
