package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocumentContentSignatureTest {
    private static final String DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    private static MockMultipartFile file(String type, byte[] content) {
        return new MockMultipartFile("file", "x", type, content);
    }

    @Test
    void acceptsContentThatMatchesTheDeclaredType() {
        assertDoesNotThrow(() -> DocumentStorageService.requireMatchingContent(
                file("application/pdf", "%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII))));
        assertDoesNotThrow(() -> DocumentStorageService.requireMatchingContent(
                file("image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0})));
        assertDoesNotThrow(() -> DocumentStorageService.requireMatchingContent(
                file("image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0})));
        assertDoesNotThrow(() -> DocumentStorageService.requireMatchingContent(
                file(DOCX, new byte[] {'P', 'K', 3, 4, 0})));
    }

    @Test
    void rejectsContentThatDoesNotMatchTheDeclaredType() {
        byte[] script = "MZ-not-a-pdf".getBytes(StandardCharsets.US_ASCII);
        assertThrows(IllegalArgumentException.class,
                () -> DocumentStorageService.requireMatchingContent(file("application/pdf", script)));
        assertThrows(IllegalArgumentException.class,
                () -> DocumentStorageService.requireMatchingContent(file("image/png", "%PDF-1.4".getBytes(StandardCharsets.US_ASCII))));
        assertThrows(IllegalArgumentException.class,
                () -> DocumentStorageService.requireMatchingContent(file(DOCX, "%PDF-1.4".getBytes(StandardCharsets.US_ASCII))));
    }
}
