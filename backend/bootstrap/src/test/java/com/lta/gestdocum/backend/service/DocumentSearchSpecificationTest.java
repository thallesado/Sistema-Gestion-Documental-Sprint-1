package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentSearchFilters;
import com.lta.gestdocum.backend.model.ComponentState;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class DocumentSearchSpecificationTest {
    private final ComponentFormCatalog.Form form = ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM);

    @Test
    void rejectsReversedDateRange() {
        var filters = new DocumentSearchFilters(null, null, null, null, null, null,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 10, 1), null, null);
        assertThrows(IllegalArgumentException.class, () -> DocumentSearchSpecification.build(
                UUID.randomUUID(), UUID.randomUUID(), "all", null, null, filters, ComponentFormAccess.unrestricted(form)));
    }

    @Test
    void hiddenFieldsCannotBeUsedToInferTheirValues() {
        var filters = new DocumentSearchFilters(null, null, null, "Secreto", null, null, null, null, null, null);
        var access = new ComponentFormAccess(form, Map.of("especialidad", ComponentState.HIDDEN));
        assertThrows(AccessDeniedException.class, () -> DocumentSearchSpecification.build(
                UUID.randomUUID(), UUID.randomUUID(), "all", null, null, filters, access));
    }

    @Test
    void readOnlyFieldsRemainSearchable() {
        var filters = new DocumentSearchFilters(null, null, null, "Pediatría", null, null, null, null, null, null);
        var access = new ComponentFormAccess(form, Map.of("especialidad", ComponentState.VISIBLE_READONLY));
        assertDoesNotThrow(() -> DocumentSearchSpecification.build(
                UUID.randomUUID(), UUID.randomUUID(), "all", null, null, filters, access));
    }
}
