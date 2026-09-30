package com.lta.gestdocum.clinico.application.service;

import com.lta.gestdocum.clinico.application.dto.PatientQuickSummaryResponse;
import com.lta.gestdocum.clinico.domain.model.Patient;
import com.lta.gestdocum.clinico.domain.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.clinico.domain.repository.MedicalNoteRepository;
import com.lta.gestdocum.shared.security.AuthenticatedUserContext;
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
        var history = historyRepository.findByTenantIdAndPatientId(tenantId, patientId).orElse(null);
        if (history == null) {
            return new PatientQuickSummaryResponse(patientId, patient.getFirstName() + " " + patient.getLastName(),
                    patient.getDocumentType() + " " + patient.getDocumentNumber(), null, null,
                    List.of(), List.of(), List.of());
        }
        var notes = noteRepository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
                        tenantId, history.getId(), PageRequest.of(0, 5)).getContent().stream()
                .map(note -> new PatientQuickSummaryResponse.RecentNote(
                        note.getId(), note.getNoteType(), note.getContent(), note.getCreatedAt()))
                .toList();
        return new PatientQuickSummaryResponse(patientId, patient.getFirstName() + " " + patient.getLastName(),
                patient.getDocumentType() + " " + patient.getDocumentNumber(), history.getId(), history.getCode(),
                history.getAllergies(), history.getBaseDiagnoses(), notes);
    }
}
