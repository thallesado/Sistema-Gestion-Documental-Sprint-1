package com.lta.gestdocum.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecurityConfigResponseTest {
    @Test
    void authenticationErrorsAreServedAsUtf8SoAccentsSurvive() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        SecurityConfig.writeJsonError(response, 401, "Unauthorized", "Autenticación requerida");

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentType().toLowerCase().contains("charset=utf-8"), response.getContentType());
        assertEquals("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"Autenticación requerida\"}",
                new String(response.getContentAsByteArray(), StandardCharsets.UTF_8));
    }
}
