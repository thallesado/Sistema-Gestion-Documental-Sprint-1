package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class DocumentMetadataValidatorTest {
    private final Map<String,Object> schema = Map.of("required", List.of("reference", "date", "count", "signed"),
            "properties", Map.of("reference", Map.of("type", "string", "minLength", 3, "maxLength", 20),
                    "date", Map.of("type", "string", "format", "date"),
                    "count", Map.of("type", "integer", "minimum", 0, "maximum", 10),
                    "signed", Map.of("type", "boolean"),
                    "priority", Map.of("type", "string", "enum", List.of("NORMAL", "URGENT"))));

    private Map<String,Object> valid() {
        return new HashMap<>(Map.of("reference", "REF-13", "date", "2026-11-06", "count", 0, "signed", false));
    }

    @Test void acceptsZeroAndFalseAsRequiredValues() {
        assertDoesNotThrow(() -> DocumentMetadataValidator.validate(schema, valid()));
    }
    @Test void requiresFieldsForLegacyRequiredOnlySchemas() {
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(Map.of("required", List.of("supplier")), Map.of()));
    }
    @Test void rejectsBlankRequiredValues() {
        var values=valid(); values.put("reference", "   ");
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void rejectsInvalidDates() {
        var values=valid(); values.put("date", "2026-02-30");
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void rejectsFractionalIntegers() {
        var values=valid(); values.put("count", 1.5);
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void rejectsOutOfRangeValues() {
        var values=valid(); values.put("count", 11);
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void rejectsWrongBooleanTypes() {
        var values=valid(); values.put("signed", "false");
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void rejectsUnknownEnumOptions() {
        var values=valid(); values.put("priority", "UNKNOWN");
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void rejectsTextLengthViolations() {
        var values=valid(); values.put("reference", "A");
        assertThrows(IllegalArgumentException.class, () -> DocumentMetadataValidator.validate(schema, values));
    }
    @Test void acceptsTypesWithoutExtraMetadata() {
        assertDoesNotThrow(() -> DocumentMetadataValidator.validate(Map.of(), Map.of()));
    }
}
