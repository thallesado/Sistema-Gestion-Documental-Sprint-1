package com.lta.gestdocum.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BillingInvoiceResponse(UUID id, BigDecimal amountUsd, String currency, String paymentMethod,
                                     String status, String externalReference, String billingPeriod,
                                     Instant createdAt, Instant completedAt) { }
