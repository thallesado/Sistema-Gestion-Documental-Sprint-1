package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Alta de token push. Solo plataformas móviles: la web no usa FCM en este sprint. */
public record PushTokenRequest(
        @NotBlank @Size(max = 4096) String token,
        @NotBlank @Pattern(regexp = "ANDROID|IOS", message = "platform debe ser ANDROID o IOS") String platform) {
}
