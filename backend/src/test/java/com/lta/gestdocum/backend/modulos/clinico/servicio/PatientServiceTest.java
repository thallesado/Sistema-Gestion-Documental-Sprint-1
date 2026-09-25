package com.lta.gestdocum.backend.modulos.clinico.servicio;

import com.lta.gestdocum.backend.modulos.clinico.dto.PatientCreateRequest;
import com.lta.gestdocum.backend.modulos.clinico.modelo.ClinicalHistory;
import com.lta.gestdocum.backend.modulos.clinico.modelo.Patient;
import com.lta.gestdocum.backend.modulos.clinico.repositorio.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.modulos.clinico.repositorio.PatientRepository;
import com.lta.gestdocum.backend.comun.seguridad.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PatientServiceTest {
    @Mock PatientRepository patientRepository;
    @Mock ClinicalHistoryRepository clinicalHistoryRepository;
    @Mock AuthenticatedUserContext userContext;

    @Test
    void createAlsoOpensExactlyOneClinicalHistoryForThePatient() {
        UUID tenantId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        when(userContext.requireTenantId()).thenReturn(tenantId);
        when(patientRepository.saveAndFlush(any(Patient.class))).thenAnswer(invocation -> {
            Patient patient = invocation.getArgument(0);
            patient.setId(patientId);
            return patient;
        });

        PatientCreateRequest request = new PatientCreateRequest();
        request.setDocumentType(" ci ");
        request.setDocumentNumber(" 123456 ");
        request.setFirstName(" Ana ");
        request.setLastName(" Pérez ");

        PatientService service = new PatientService(
                patientRepository, clinicalHistoryRepository, userContext);
        service.create(request);

        ArgumentCaptor<ClinicalHistory> history = ArgumentCaptor.forClass(ClinicalHistory.class);
        verify(clinicalHistoryRepository).save(history.capture());
        assertThat(history.getValue().getTenantId()).isEqualTo(tenantId);
        assertThat(history.getValue().getPatientId()).isEqualTo(patientId);
        assertThat(history.getValue().getCode()).startsWith("HC-");
        assertThat(history.getValue().getAllergies()).isEmpty();
        assertThat(history.getValue().getBaseDiagnoses()).isEmpty();
    }
}
