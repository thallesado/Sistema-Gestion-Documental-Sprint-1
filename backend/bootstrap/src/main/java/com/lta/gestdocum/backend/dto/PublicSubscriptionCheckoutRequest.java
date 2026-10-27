package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Datos del formulario de alta: la organización se crea recién cuando Stripe confirma el pago. */
public record PublicSubscriptionCheckoutRequest(
        @NotBlank @Size(max = 160) String tenantName,
        @Email @Size(max = 150) String companyEmail,
        @NotBlank @Size(max = 160) String administratorName,
        @NotBlank @Email @Size(max = 150) String adminEmail,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotBlank @Pattern(regexp = "(?i)BASIC|PRO|ENTERPRISE") String planCode,
        @Pattern(regexp = "MONTHLY|ANNUAL") String billingPeriod) { }
