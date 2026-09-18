package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.AllergyEntry;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.MedicalNoteRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PatientQuickSummaryServiceTest {
    @Test
    void returnsBedsideAllergiesFromTenantClinicalHistory() {
        var patientService = mock(PatientService.class);
        var histories = mock(ClinicalHistoryRepository.class);
        var notes = mock(MedicalNoteRepository.class);
        var context = mock(AuthenticatedUserContext.class);
        UUID tenantId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID historyId = UUID.randomUUID();
        when(context.requireTenantId()).thenReturn(tenantId);
        when(patientService.requireByIdAndTenant(patientId, tenantId)).thenReturn(
                Patient.builder().id(patientId).firstName("Ana").lastName("Pérez")
                        .documentType("CI").documentNumber("123").build());
        when(histories.findByTenantIdAndPatientId(tenantId, patientId)).thenReturn(Optional.of(
                ClinicalHistory.builder().id(historyId).tenantId(tenantId).patientId(patientId).code("HC-1")
                        .allergies(List.of(new AllergyEntry("Penicilina", "GRAVE", "Urticaria"))).build()));
        when(notes.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
                org.mockito.ArgumentMatchers.eq(tenantId), org.mockito.ArgumentMatchers.eq(historyId),
                org.mockito.ArgumentMatchers.any())).thenReturn(org.springframework.data.domain.Page.empty());

        var result = new PatientQuickSummaryService(patientService, histories, notes, context).get(patientId);

        assertThat(result.allergies()).singleElement().extracting(AllergyEntry::allergen)
                .isEqualTo("Penicilina");
        assertThat(result.patientName()).isEqualTo("Ana Pérez");
    }
}
