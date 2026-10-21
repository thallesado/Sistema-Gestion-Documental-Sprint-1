package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.UUID;

public record PublicSignupRequest(
    @NotBlank String companyName,
    String companyCode,
    String companySlug,
    @Email @NotBlank String companyEmail,
    UUID planId,
    String planCode,
    @NotBlank String adminName,
    @Email @NotBlank String adminEmail,
    String adminPassword,
    String paymentMethod,
    BigDecimal amountUsd,
    String billingPeriod
) {}
