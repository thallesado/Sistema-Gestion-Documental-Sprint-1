package com.lta.gestdocum.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static PatientCreateRequest patient(String email) {
        PatientCreateRequest request = new PatientCreateRequest();
        request.setDocumentType("CI");
        request.setDocumentNumber("123");
        request.setFirstName("Ana");
        request.setLastName("Perez");
        request.setEmail(email);
        return request;
    }

    @Test
    void patientEmailMustBeAnEmailWhenProvided() {
        assertEquals(1, validator.validate(patient("no-es-email")).size());
        assertTrue(validator.validate(patient("paciente@ejemplo.com")).isEmpty());
        assertTrue(validator.validate(patient(null)).isEmpty());
        assertTrue(validator.validate(patient("")).isEmpty());
    }

    @Test
    void tenantSlugMustBeLowercaseUrlSafe() {
        for (String invalid : new String[] {"Org QA!!", "UPPER", "con espacio", "-inicio", "fin-", "doble--guion", "ñandú"}) {
            assertEquals(1, validator.validate(new TenantCreateRequest("Org", "ORG", invalid, "a@b.co")).size(), invalid);
        }
        for (String valid : new String[] {"org-qa", "acme", "clinica-central", "hospital2"}) {
            assertTrue(validator.validate(new TenantCreateRequest("Org", "ORG", valid, "a@b.co")).isEmpty(), valid);
        }
    }
}
