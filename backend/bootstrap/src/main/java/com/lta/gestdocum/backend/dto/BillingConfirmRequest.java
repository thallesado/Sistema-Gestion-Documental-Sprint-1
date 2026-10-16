package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record BillingConfirmRequest(@NotBlank UUID transactionId, String confirmationReference) { }
