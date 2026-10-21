package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record PublicSignupResponse(
    UUID tenantId,
    String tenantName,
    String adminUsername,
    String adminEmail,
    String temporaryPassword,
    boolean simulatedPayment,
    String paymentReference,
    String message,
    AuthResponse auth
) {}
