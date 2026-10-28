package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record BillingCheckoutRequest(
        @NotBlank @Pattern(regexp = "(?i)BASIC|PRO|ENTERPRISE") String planCode,
        @NotBlank @Pattern(regexp = "STRIPE_CARD|BANK_QR|CRYPTO_USDT") String paymentMethod,
        @NotBlank @Pattern(regexp = "MONTHLY|ANNUAL") String billingCycle,
        String cryptoNetwork) { }
