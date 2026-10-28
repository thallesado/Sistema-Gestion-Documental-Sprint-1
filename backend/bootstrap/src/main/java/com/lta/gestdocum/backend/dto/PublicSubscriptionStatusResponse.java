package com.lta.gestdocum.backend.dto;

import java.util.UUID;

/** Estado del alta tras volver de Stripe; COMPLETED solo lo escribe el webhook o la consulta a Stripe. */
public record PublicSubscriptionStatusResponse(String status, String tenantName, UUID tenantId, String message) { }
