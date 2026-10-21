package com.lta.gestdocum.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Pregunta al asistente contextual con lo que el frontend sabe de la sesión.
 * El contexto solo trae rutas, el último error HTTP y códigos de permiso: nunca cuerpos ni datos clínicos.
 */
public record AssistantChatRequest(
        @NotBlank @Size(max = 1000) String message,
        @Valid Context context) {

    public record Context(
            @Size(max = 300) String route,
            @Size(max = 20) List<String> recentRoutes,
            @Valid ErrorInfo lastError,
            @Size(max = 500) List<String> permissions) {
    }

    public record ErrorInfo(int status, @Size(max = 10) String method, @Size(max = 300) String url) {
    }
}
