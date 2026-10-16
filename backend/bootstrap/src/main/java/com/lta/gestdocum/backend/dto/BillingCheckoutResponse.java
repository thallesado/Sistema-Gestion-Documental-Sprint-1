package com.lta.gestdocum.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record BillingCheckoutResponse(UUID transactionId, String paymentMethod, BigDecimal amountUsd,
                                      String currency, String externalReference, Instant expiresAt,
                                      Map<String, Object> paymentData) { }
