package com.lta.gestdocum.usuarios.application.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateRoleStatusRequest(@NotNull Boolean isActive) {
}
