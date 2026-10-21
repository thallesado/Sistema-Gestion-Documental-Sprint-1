package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.GlobalExceptionHandler;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.Version;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.lang.reflect.Field;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ClinicalHistoryOptimisticLockTest {

    @Test
    @DisplayName("ClinicalHistory entity should declare @Version field for optimistic locking")
    void clinicalHistoryShouldHaveVersionAnnotation() throws NoSuchFieldException {
        Field versionField = ClinicalHistory.class.getDeclaredField("version");
        assertNotNull(versionField, "ClinicalHistory debe tener el campo 'version'");
        assertTrue(versionField.isAnnotationPresent(Version.class),
                "El campo 'version' debe estar anotado con @Version de Jakarta Persistence");
        assertEquals(Long.class, versionField.getType(), "El campo 'version' debe ser de tipo Long");
    }

    @Test
    @DisplayName("GlobalExceptionHandler should map ObjectOptimisticLockingFailureException to HTTP 409 Conflict")
    void shouldHandleOptimisticLockingFailureExceptionAs409Conflict() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/clinical-histories/123");

        ObjectOptimisticLockingFailureException ex =
                new ObjectOptimisticLockingFailureException(ClinicalHistory.class, "123");

        ResponseEntity<Map<String, Object>> response = handler.handleOptimisticLock(ex, request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(409, response.getBody().get("status"));
        assertEquals("Conflict", response.getBody().get("error"));
        assertTrue(response.getBody().get("message").toString().contains("concurrentemente"),
                "El mensaje debe advertir sobre colisión concurrente al usuario");
    }

    @Test
    @DisplayName("GlobalExceptionHandler should map jakarta OptimisticLockException to HTTP 409 Conflict")
    void shouldHandleJakartaOptimisticLockExceptionAs409Conflict() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/clinical-histories/123");

        OptimisticLockException ex = new OptimisticLockException("Row was updated or deleted by another transaction");

        ResponseEntity<Map<String, Object>> response = handler.handleOptimisticLock(ex, request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(409, response.getBody().get("status"));
        assertTrue(response.getBody().get("message").toString().contains("concurrentemente"));
    }
}
