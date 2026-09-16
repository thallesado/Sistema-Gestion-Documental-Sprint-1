package com.lta.gestdocum.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice(basePackages = "com.lta.gestdocum.backend.controller")
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return error(HttpStatus.BAD_REQUEST, "Validation failed", message, request);
    }

    @ExceptionHandler({ConstraintViolationException.class, HttpMessageNotReadableException.class,
            IllegalArgumentException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(
            Exception exception, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "Bad Request", exception.getMessage(), request);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidCredentials(
            InvalidCredentialsException exception, HttpServletRequest request) {
        return error(HttpStatus.UNAUTHORIZED, "Unauthorized", exception.getMessage(), request);
    }

    @ExceptionHandler({AuthenticationCredentialsNotFoundException.class})
    public ResponseEntity<Map<String, Object>> handleAuthentication(
            Exception exception, HttpServletRequest request) {
        return error(HttpStatus.UNAUTHORIZED, "Unauthorized", exception.getMessage(), request);
    }

    @ExceptionHandler({AccessDeniedException.class, TenantMismatchException.class,
            TenantRequiredException.class})
    public ResponseEntity<Map<String, Object>> handleForbidden(
            Exception exception, HttpServletRequest request) {
        return error(HttpStatus.FORBIDDEN, "Forbidden", exception.getMessage(), request);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(
            NotFoundException exception, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "Not Found", exception.getMessage(), request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(
            DataIntegrityViolationException exception, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "Conflict",
                "La operación entra en conflicto con datos existentes", request);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicate(
            DuplicateResourceException exception, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "Conflict", exception.getMessage(), request);
    }

    private ResponseEntity<Map<String, Object>> error(
            HttpStatus status, String error, String message, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", status.value());
        body.put("error", error);
        body.put("message", message == null ? error : message);
        body.put("path", request.getRequestURI());
        return ResponseEntity.status(status).body(body);
    }
}
