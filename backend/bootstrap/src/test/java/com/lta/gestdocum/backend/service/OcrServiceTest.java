package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class OcrServiceTest {

    private OcrService ocrService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        // Inicializamos con API key dummy para test unitario
        ocrService = new OcrService("dummy-key", "gemini-3.8-flash", 5, objectMapper);
    }

    @Test
    @DisplayName("processDocument() should reject empty files with IllegalArgumentException")
    void shouldRejectEmptyFile() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "test.png", "image/png", new byte[0]);
        assertThrows(IllegalArgumentException.class, () -> ocrService.processDocument(emptyFile));
    }

    @Test
    @DisplayName("processDocument() should reject unsupported mime types")
    void shouldRejectUnsupportedMimeType() {
        MockMultipartFile txtFile = new MockMultipartFile("file", "test.txt", "text/plain", "texto plano".getBytes());
        assertThrows(IllegalArgumentException.class, () -> ocrService.processDocument(txtFile));
    }

    @Test
    @DisplayName("processDocument() with blank apiKey should return fallback response safely")
    void shouldReturnFallbackWhenApiKeyIsBlank() {
        OcrService unconfiguredService = new OcrService("", "gemini-3.8-flash", 5, objectMapper);
        MockMultipartFile imageFile = new MockMultipartFile("file", "receta.jpg", "image/jpeg", "fake-image-bytes".getBytes());

        OcrProcessResponse response = unconfiguredService.processDocument(imageFile);

        assertNotNull(response);
        assertEquals("OTRO", response.documentType());
        assertTrue(response.extractedSummary().contains("falta API Key"));
        assertEquals(0.50, response.confidence());
    }
}
