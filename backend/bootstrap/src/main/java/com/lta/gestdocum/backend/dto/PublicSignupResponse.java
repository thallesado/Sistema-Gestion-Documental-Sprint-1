package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record PublicSignupResponse(
    UUID tenantId,
    String tenantName,
    String adminUsername,
    String adminEmail,
    /** Obsoleto: nunca se devuelve una contraseña; siempre null (se mantiene por compatibilidad del contrato). */
    String temporaryPassword,
    boolean simulatedPayment,
    String paymentReference,
    String message,
    AuthResponse auth
) {}
