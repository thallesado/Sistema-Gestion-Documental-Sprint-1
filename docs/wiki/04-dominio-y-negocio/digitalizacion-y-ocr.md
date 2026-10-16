# Digitalización y OCR persistido

> Revisión documental: 2026-10-16. Base de código `a590a6d`, integrada localmente para preparar esta publicación. No certifica producción.

## Qué versión está presente

| Base | Implementación inspeccionada |
|---|---|
| Histórico d1a1202 | /ocr/process consulta Gemini; confirmación/indexación de WorkspacePage solo cambia signals. |
| Base actual a590a6d | OcrJobService/OcrJob/OcrFileStore, trabajos persistidos, métricas y operaciones de revisión/indexación. Migración 035. |
| EC2 | El usuario aportó COMMIT e historial de 035 el 2026-10-14. No se comprobó desde este checkout el commit servido ni el recorrido final. |

No reutilizar el diagnóstico del OCR histórico como si describiera la implementación actual. No crear una segunda implementación de jobs.

## Contrato actual verificado

Base /api/v1/ocr:

- POST /process: archivo multipart, trabajo y resultado persistidos.
- GET /jobs y /jobs/{id}: trabajos recientes y detalle.
- GET /stats: métricas y disponibilidad de configuración.
- POST /jobs/{id}/validate y /reject: revisión.
- POST /jobs/{id}/index: creación documental y versión.
- PATCH /jobs/{id}/metadata: correcciones según estado y reglas de documento.

Estados del modelo: QUEUED, PROCESSING, REQUIRES_VALIDATION, VALIDATED, INDEXED, FAILED, REJECTED. Validate exige REQUIRES_VALIDATION; index exige VALIDATED; reject admite REQUIRES_VALIDATION/VALIDATED. Corrección de metadatos admite VALIDATED/INDEXED y, para documento indexado, comprueba DRAFT.

Original OCR en `ocr/{tenantId}/{jobId}` bajo storage. Indexación conserva vínculo document_id y usa almacenamiento documental existente. El nombre de paciente detectado queda como metadato; no demuestra asociación a un paciente existente ni a su historia.

Revisar CAN_RUN_OCR, CAN_READ_OCR, CAN_REVIEW_OCR y CAN_INDEX_OCR en el controlador; no aplicar un permiso único a todas las acciones por simplificación.

## Configuración y pruebas

Solo nombres de variables: GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT_SECONDS. El valor predeterminado es gemini-3.5-flash-lite. Valores del entorno y overrides prevalecen; la presencia de configuración no confirma acceso/cuota del proveedor.

El Nginx versionado configura client_max_body_size 26m y timeouts 120s. El Dockerfile frontend debe copiar nginx.conf en build si sus pruebas lo leen; esa corrección sigue como cambio local separado, fuera de esta publicación documental.

Prueba con información ficticia: procesar, confirmar, indexar, recargar, consultar jobs/documento y descargar versión. Probar error real, reintento y aislamiento tenant. No presentar confidence como precisión clínica validada ni anunciar guardado sin respuesta de persistencia.

Fuentes de la revisión a590a6d, disponibles en el checkout y mediante `git show a590a6d:ruta`:
- `backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/OcrController.java`
- `backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrJobService.java`
- `backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrFileStore.java`
- `backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/OcrJob.java`
- `database/init/035_ocr_job_persistence.sql`

Sus contratos principales están en verification.json y se validan contra el checkout. Más fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java), [frontend/src/app/core/api/ocr-api.service.ts](../../../frontend/src/app/core/api/ocr-api.service.ts). [Estado](../05-guias-ia/estado-verificado-y-pendientes.md).
