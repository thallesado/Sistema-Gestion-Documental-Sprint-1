package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateRoleStatusRequest(@NotNull Boolean isActive) {
}
