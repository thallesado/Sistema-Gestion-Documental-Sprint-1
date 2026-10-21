package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** Request for a self-service subscription change. */
public record PlanChangeRequest(@NotBlank(message = "planCode es obligatorio") String planCode) { }
