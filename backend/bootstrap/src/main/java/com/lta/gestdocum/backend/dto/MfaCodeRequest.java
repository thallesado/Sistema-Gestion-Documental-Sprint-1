package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Segundo paso del login de plataforma: el desafío recibido y el código de 6 dígitos. */
public record MfaCodeRequest(@NotBlank @Size(max = 2000) String mfaToken,
                             @NotBlank @Pattern(regexp = "\\s*\\d{3}\\s?\\d{3}\\s*") String code) { }
