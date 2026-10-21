package com.lta.gestdocum.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record TenantUsageResponse(
    UUID tenantId,
    String tenantName,
    String planCode,
    String planName,
    String subscriptionStatus,
    Instant trialEndsAt,
    long trialDaysRemaining,
    long usersCount,
    long maxUsers,
    long documentsCount,
    long maxDocuments,
    long storageBytes,
    long maxStorageBytes,
    long ocrPagesMonth,
    long maxOcrPagesMonth
) {}
