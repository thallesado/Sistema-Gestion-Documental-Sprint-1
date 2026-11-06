package com.lta.gestdocum.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HtmlSanitizerServiceTest {

    @Test
    void rejectsEmptyFormattingLeftAfterRemovingMaliciousContent() {
        HtmlSanitizerService service = new HtmlSanitizerService();
        assertEquals("", service.sanitize("<script>alert('x')</script><p><br></p>"));
        assertEquals("", service.sanitize("<iframe src='evil'></iframe><p> </p>"));
    }

    private HtmlSanitizerService sanitizer;

    @BeforeEach
    void setUp() {
        sanitizer = new HtmlSanitizerService();
    }

    @Test
    @DisplayName("sanitize() should preserve safe formatting tags (b, i, p, ul, li, h1)")
    void shouldPreserveSafeTags() {
        String input = "<p>Paciente presenta <strong>fiebre alta</strong> y <em>dolor torácico</em>.</p><ul><li>Reposo</li></ul>";
        String output = sanitizer.sanitize(input);

        assertTrue(output.contains("<strong>fiebre alta</strong>"));
        assertTrue(output.contains("<em>dolor torácico</em>"));
        assertTrue(output.contains("<li>Reposo</li>"));
    }

    @Test
    @DisplayName("sanitize() should strip script tags and inline event handlers (XSS)")
    void shouldStripScriptAndEventHandlers() {
        String input = "<p>Tratamiento <script>alert('XSS')</script><img src='x' onerror='alert(1)'>indicado.</p>";
        String output = sanitizer.sanitize(input);

        assertFalse(output.contains("<script>"));
        assertFalse(output.contains("alert"));
        assertFalse(output.contains("onerror"));
        assertFalse(output.contains("<img"));
        assertTrue(output.contains("Tratamiento"));
        assertTrue(output.contains("indicado."));
    }

    @Test
    @DisplayName("HU-10: elimina iframe y atributos de ejecución conservando el texto seguro")
    void shouldStripIframeAndInlineHandlers() {
        String output = sanitizer.sanitize("<p onload='alert(1)' onerror='alert(2)'>Control seguro</p>"
                + "<iframe src='javascript:alert(3)'></iframe>");
        assertEquals("<p>Control seguro</p>", output);
    }

    @Test
    @DisplayName("HU-10: un payload exclusivamente malicioso queda vacío")
    void shouldRemoveMaliciousOnlyContent() {
        assertTrue(sanitizer.sanitize("<script>alert(1)</script><iframe src='x'></iframe>"
                + "<img src='x' onerror='alert(2)'>").isBlank());
    }

    @Test
    @DisplayName("sanitize() should handle null and empty input gracefully")
    void shouldHandleNullAndEmpty() {
        assertEquals("", sanitizer.sanitize(null));
        assertEquals("", sanitizer.sanitize("   "));
    }
}
