# Extensión clínica y representación del paciente

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

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

MedicalNoteService limita transición a DRAFT -> APPROVED o VOIDED, pero create acepta status inicial y la UI permite aprobada. No afirmar aprobación jerárquica automática ni firma electrónica por esa etiqueta. No hay edición del texto existente en el servicio revisado.

## Límites

- Inactivar paciente no equivale a alta médica, ni cierra historia/workflows.
- No se representa un circuito completo de derivación/atención/alta; no ampliarlo como requisito de todos los tenants.
- Documentos vinculados en historia usan clinical_document_links; patientId por sí solo no crea el vínculo.
- linkDocument no comprueba la coincidencia de patientId del documento con historia; resolver según regla de asociación, no por UI solamente.
- Timeline fija RECORDED para notas y resumen no distingue su estado: riesgo de presentar borrador/anulada como vigente.
- Lecturas de historias dadas de baja no son uniformes entre resumen/notas/listado.
- Rutas /clinical/history y /expedients/clinical/history abren componentes distintos.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PatientService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PatientService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/ClinicalHistory.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/ClinicalHistory.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MedicalNoteService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MedicalNoteService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ClinicalHistoryService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ClinicalHistoryService.java), [frontend/src/app/features/clinico/clinico.routes.ts](../../../frontend/src/app/features/clinico/clinico.routes.ts).
