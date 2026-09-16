package com.lta.gestdocum.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final HttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users");

    @Test
    void mapsNotFoundTo404() {
        assertEquals(HttpStatus.NOT_FOUND,
                handler.handleNotFound(new NotFoundException("missing"), request).getStatusCode());
    }

    @Test
    void mapsIntegrityConflictTo409() {
        assertEquals(HttpStatus.CONFLICT,
                handler.handleConflict(new DataIntegrityViolationException("duplicate"), request)
                        .getStatusCode());
    }
}
