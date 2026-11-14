package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PatientQuickSummaryResponse;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.MedicalNoteRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PatientQuickSummaryService {
    private final PatientService patientService;
    private final ClinicalHistoryRepository historyRepository;
    private final MedicalNoteRepository noteRepository;
    private final AuthenticatedUserContext context;
    /** B2: opcional para conservar el constructor existente; sin él no se oculta nada. */
    @Autowired(required = false)
    private ComponentPermissionService componentPermissions;

    public PatientQuickSummaryService(PatientService patientService,
                                      ClinicalHistoryRepository historyRepository,
                                      MedicalNoteRepository noteRepository,
                                      AuthenticatedUserContext context) {
        this.patientService = patientService;
        this.historyRepository = historyRepository;
        this.noteRepository = noteRepository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public PatientQuickSummaryResponse get(UUID patientId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        Patient patient = patientService.requireByIdAndTenant(patientId, tenantId);
        var history = historyRepository.findByTenantIdAndPatientIdAndDeletedAtIsNull(tenantId, patientId).orElse(null);
        if (history == null) {
            return new PatientQuickSummaryResponse(patientId, patient.getFirstName() + " " + patient.getLastName(),
                    patient.getDocumentType() + " " + patient.getDocumentNumber(), null, null,
                    List.of(), List.of(), List.of());
        }
        ComponentFormAccess noteAccess = componentPermissions == null
                ? ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.MEDICAL_NOTE_FORM))
                : componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM);
        var notes = noteRepository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
                        tenantId, history.getId(), PageRequest.of(0, 5)).getContent().stream()
                .map(note -> new PatientQuickSummaryResponse.RecentNote(
                        note.getId(), noteAccess.reveal("tipo", note.getNoteType()),
                        noteAccess.reveal("contenido", note.getContent()), note.getCreatedAt()))
                .toList();
        return new PatientQuickSummaryResponse(patientId, patient.getFirstName() + " " + patient.getLastName(),
                patient.getDocumentType() + " " + patient.getDocumentNumber(), history.getId(), history.getCode(),
                history.getAllergies(), history.getBaseDiagnoses(), notes);
    }
}
