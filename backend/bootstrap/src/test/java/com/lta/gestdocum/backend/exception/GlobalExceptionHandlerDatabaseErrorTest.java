package com.lta.gestdocum.backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GlobalExceptionHandlerDatabaseErrorTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/anything");

    @Test
    void databaseErrorsReturnGenericMessageWithoutSqlDetail() {
        var cause = new RuntimeException("ERROR: permission denied for table document_versions");
        var exception = new InvalidDataAccessResourceUsageException("could not execute statement [select ...]", cause);

        ResponseEntity<Map<String, Object>> response = handler.handleDataAccess(exception, request);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        String message = response.getBody().get("message").toString();
        assertFalse(message.contains("ERROR:"), message);
        assertFalse(message.contains("permission denied"), message);
        assertFalse(message.contains("document_versions"), message);
        assertEquals("Database Error", response.getBody().get("error"));
    }

    @Test
    void integrityViolationKeepsItsGenericConflictMessage() {
        var exception = new DataIntegrityViolationException("ERROR: duplicate key value violates unique constraint");

        ResponseEntity<Map<String, Object>> response = handler.handleConflict(exception, request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("La operación entra en conflicto con datos existentes", response.getBody().get("message"));
    }
}
