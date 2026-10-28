package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

/** Contratos de /api/v1/users/{id}/customization (permiso user:customize). */
public final class UserCustomizationDtos {

    private UserCustomizationDtos() {
    }

    /** Valores que el administrador puede personalizar. Nulo o vacío equivale a "sin restricción". */
    public record UserCustomizationRequest(
            @Size(max = 120) String jobTitle,
            @Size(max = 30) String phone,
            @Size(max = 500) String biography,
            @Pattern(regexp = "es|en|fr|zh") String language,
            @Size(max = 40) String landingPage,
            boolean emailNotifications,
            boolean pushNotifications,
            boolean mustChangePassword,
            LocalDate accessExpiresOn,
            Set<@Min(1) @Max(7) Integer> accessWeekdays,
            LocalTime accessStartTime,
            LocalTime accessEndTime,
            @Min(1) @Max(25) Integer maxUploadMb,
            @Min(1) @Max(10_000_000) Integer storageQuotaMb,
            Set<UUID> allowedDocumentTypeIds) {
    }

    public record UserCustomizationResponse(
            UUID userId,
            String username,
            String fullName,
            String jobTitle,
            String phone,
            String biography,
            String language,
            String landingPage,
            boolean emailNotifications,
            boolean pushNotifications,
            boolean mustChangePassword,
            LocalDate accessExpiresOn,
            Set<Integer> accessWeekdays,
            LocalTime accessStartTime,
            LocalTime accessEndTime,
            Integer maxUploadMb,
            Integer storageQuotaMb,
            Set<UUID> allowedDocumentTypeIds,
            long storageUsedBytes,
            String timezone,
            boolean hasActiveSession,
            boolean self) {
    }

    /** Lo que el propio usuario recibe en /auth/me para aplicar en la interfaz. */
    public record CurrentUserCustomization(
            String jobTitle,
            String language,
            String landingPage,
            Integer maxUploadMb,
            Integer storageQuotaMb,
            Set<UUID> allowedDocumentTypeIds) {
    }
}
