# Extensión clínica y representación del paciente

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

Actualización parcial HU-09: 2026-11-06 sobre `91fb767` y cambios locales. Las demás observaciones conservan su alcance histórico.

## Modelo actual

- Patient: identidad CI/SEGURO, nombres, nacimiento, género y contactos básicos; estado ACTIVE/INACTIVE. No contiene grupo sanguíneo ni contactos de emergencia estructurados.
- Alta PatientService: crea paciente e historia vacía en una transacción. No crea Expedient ni inicia workflow.
- ClinicalHistory: antecedentes, grupo sanguíneo, alergias, medicamentos, diagnósticos base, observaciones, baja lógica y `@Version Long`.
- ClinicalHistoryRevision: revisiones; consultar servicio para contenido y disparadores de creación.
- MedicalNote: historia obligatoria, episodio opcional, autor autenticado, texto sanitizado, estado y fecha.
- ClinicalEpisode: modelo y lectura en timeline; no se encontró ciclo completo de administración de atención.
- ClinicalDocumentLink: asociación explícita de documento a paciente/historia/episodio, diferente de documents.patient_id.

## Acciones y permisos

Historias usan patient:read/create/update; notas medical_note:read/create/update. Revisión/baja/enlace tienen permisos adicionales específicos en controladores, no clinical:history:read inventado.

HU-09 (2026-11-06, checkout 91fb767 más cambios locales): toda nota nueva se crea en DRAFT. MedicalNoteService rechaza un estado inicial distinto, bloquea la fila durante la transición y permite únicamente DRAFT -> APPROVED o VOIDED; cualquier transición posterior lanza IllegalStateException. La pantalla solo ofrece Emitir/Anular a usuarios con medical_note:update y muestra un aviso de inmutabilidad para los estados finales. No representa firma electrónica.

La migración 088_medical_note_lifecycle agrega defensa en PostgreSQL: rechaza altas en estado terminal, cambios de contenido durante la transición, modificaciones de estados terminales y borrado físico. No reescribe notas históricas. Debe aplicarse también a las bases aisladas antes de afirmar protección SQL en ellas.

## HU-10: editor SOAP y sanitización (2026-11-06)

Revisión del checkout `91fb767` más cambios locales: los cuatro controles SOAP (`subjective`, `objective`, `assessment`, `plan`) de `notas-medicas-page.ts` usan `app-rich-text-editor`, el selector real del componente compartido TipTap. No usan textarea. El nombre `app-richtext-editor` del enunciado difiere del selector implementado; la funcionalidad descrita corresponde al componente existente.

`MedicalNoteService.create` llama obligatoriamente a `HtmlSanitizerService.sanitize` antes de construir/persistir la nota. El servicio usa `Jsoup.clean` con una lista de etiquetas de formato permitidas; elimina `script`, `iframe` y atributos de ejecución como `onload` y `onerror`. Si el resultado queda vacío, lanza `IllegalArgumentException` sin llamar a `repository.save`.

Verificación local ampliada: `HtmlSanitizerServiceTest` (6 casos) y `MedicalNoteServiceTest` (25 casos) correctos mediante Maven. El sanitizador también rechaza etiquetas de formato vacías que queden después de quitar el contenido malicioso. El recorrido con paciente sintético comprobó los cuatro editores, negrita, lista numerada, guardado, recarga y HTML limpio persistido en PostgreSQL; un POST exclusivamente malicioso devuelve 400 sin crear una fila. [Capturas completas y resultados HTTP de HU-10](../../evidencias/hu10/README.md). No certifica AWS.

Fuentes: [editor compartido](../../../frontend/src/app/shared/components/rich-text-editor/rich-text-editor.component.ts), [formulario SOAP](../../../frontend/src/app/features/clinico/pages/notas-medicas-page.ts), [sanitizador Jsoup](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/HtmlSanitizerService.java), [pruebas de sanitización](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/security/HtmlSanitizerServiceTest.java), [pruebas del servicio](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/service/MedicalNoteServiceTest.java).

## HU-11: baja justificada y vínculos documentales (2026-11-06)

Checkout `91fb767` más cambios locales, comprobado en la base desechable usada para HU-09. No certifica AWS ni el aprovisionamiento automático de tenants.

- `DELETE /clinical-histories/{id}` exige un motivo de 10 a 500 caracteres después de recortar espacios. Conserva la fila y guarda `deleted_at`, `deleted_by` y `deletion_reason`. El evento `CLINICAL_HISTORY_DELETED` se persiste en la misma transacción; Jackson serializa el motivo sin perder comillas, barras ni saltos de línea.
- La migración `089_clinical_history_integrity` impide DELETE físico y cambios a una historia dada de baja; valida motivo y pertenencia del autor al tenant. También impide notas y nuevos vínculos sobre historias dadas de baja y documentos asignados a otro paciente. No modifica filas históricas durante su instalación.
- La pestaña Documentos permite buscar y paginar el repositorio, vincular, desvincular y abrir el detalle/versiones del documento. Los documentos sin paciente asignado pueden anexarse; los asignados deben corresponder al paciente de la historia. Desvincular elimina solo el vínculo y conserva el archivo.
- Los eventos `CLINICAL_DOCUMENT_LINKED` y `CLINICAL_DOCUMENT_UNLINKED` identifican el documento y se guardan junto con la operación. La auditoría es de solo lectura y su detalle presenta el motivo de la baja y el autor.
- `GET /clinical-histories/deletion?patientId=...`, protegido por `patient:read` y alcance tenant, devuelve la constancia de baja o 204 si no existe. La pantalla la presenta después de recargar y oculta la edición. Listado, notas y resumen rápido excluyen la historia dada de baja; no se eliminan sus notas o documentos.
- Los botones de baja y vinculación reflejan los permisos aceptados por el controlador; el backend sigue siendo la autoridad. Los errores de consulta documental se muestran en pantalla.

Evidencia y límites de las pruebas: [flujo local HU-09](../../evidencias/hu09/README.md). La prueba SQL específica termina en ROLLBACK.

## Límites

- Inactivar paciente no equivale a alta médica, ni cierra historia/workflows.
- No se representa un circuito completo de derivación/atención/alta; no ampliarlo como requisito de todos los tenants.
- Documentos vinculados en historia usan clinical_document_links; patientId por sí solo no crea el vínculo.
- HU-11 comprueba la coincidencia del paciente en servidor y SQL cuando el documento tiene paciente asignado.
- Timeline fija RECORDED para notas y resumen no distingue su estado: riesgo de presentar borrador/anulada como vigente.
- HU-11 excluye historias dadas de baja del resumen, las notas y el listado; la constancia y la auditoría conservan su evidencia.
- Rutas /clinical/history y /expedients/clinical/history abren componentes distintos.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PatientService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PatientService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/ClinicalHistory.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/ClinicalHistory.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MedicalNoteService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MedicalNoteService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ClinicalHistoryService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ClinicalHistoryService.java), [frontend/src/app/features/clinico/clinico.routes.ts](../../../frontend/src/app/features/clinico/clinico.routes.ts).
