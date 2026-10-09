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
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice(basePackages = "com.lta.gestdocum.backend.controller")
public class GlobalExceptionHandler {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

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
        log.error("Violación de integridad en {} {}", request.getMethod(), request.getRequestURI(), exception);
        return error(HttpStatus.CONFLICT, "Conflict",
                "La operación entra en conflicto con datos existentes", request);
    }

    // Errores de BD no contemplados (p. ej. "permission denied", RLS): se registran y se devuelven con su causa
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(
            org.springframework.dao.DataAccessException exception, HttpServletRequest request) {
        log.error("Error de acceso a datos en {} {}", request.getMethod(), request.getRequestURI(), exception);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Database Error",
                exception.getMostSpecificCause().getMessage(), request);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicate(
            DuplicateResourceException exception, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "Conflict", exception.getMessage(), request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(
            IllegalStateException exception, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "Conflict", exception.getMessage(), request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(
            ResponseStatusException exception, HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(exception.getStatusCode().value());
        String message = exception.getReason() == null ? status.getReasonPhrase() : exception.getReason();
        return error(status, status.getReasonPhrase(), message, request);
    }

    @ExceptionHandler({
            org.springframework.orm.ObjectOptimisticLockingFailureException.class,
            jakarta.persistence.OptimisticLockException.class
    })
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(
            Exception exception, HttpServletRequest request) {
        log.warn("Conflicto de concurrencia optimista en {} {}", request.getMethod(), request.getRequestURI());
        return error(HttpStatus.CONFLICT, "Conflict",
                "El registro clínico fue modificado concurrentemente por otro usuario. Recargue los datos para ver los cambios más recientes.",
                request);
    }

    private ResponseEntity<Map<String, Object>> error(
            HttpStatus status, String error, String message, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", status.value());
        body.put("error", error);
        body.put("message", message == null ? error : message);
        body.put("path", request.getRequestURI());
        body.put("code", errorCode(status, error, message, request.getRequestURI()));
        return ResponseEntity.status(status).body(body);
    }

    private String errorCode(HttpStatus status, String error, String message, String path) {
        String text = message == null ? "" : message.toLowerCase(java.util.Locale.ROOT);
        if (status == HttpStatus.FORBIDDEN) {
            if (path.contains("/tasks/") && (text.contains("tarea no asignada") || text.contains("no asignada al usuario"))) return "TASK_NOT_ASSIGNED_TO_USER";
            return "PERMISSION_DENIED";
        }
        if (status == HttpStatus.NOT_FOUND && path.contains("/workflows/")) {
            if (path.contains("/tasks/")) return "TASK_NOT_FOUND";
            if (path.contains("/templates/")) return "TEMPLATE_NOT_FOUND";
            return "WORKFLOW_NOT_FOUND";
        }
        if (status == HttpStatus.CONFLICT) {
            if (text.contains("tarea") && (text.contains("resuelta") || text.contains("completada"))) return "TASK_ALREADY_COMPLETED";
            if (text.contains("transici")) return "INVALID_TRANSITION";
            if (text.contains("workflow") && (text.contains("finaliz") || text.contains("complet"))) return "WORKFLOW_ALREADY_COMPLETED";
            return "RESOURCE_CONFLICT";
        }
        if (status == HttpStatus.BAD_REQUEST && text.contains("transici")) return "INVALID_TRANSITION";
        return error.toUpperCase(java.util.Locale.ROOT).replace(' ', '_');
    }
}
