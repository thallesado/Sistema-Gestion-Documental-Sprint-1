package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.Set;

public record RoleAssignmentRequest(@NotEmpty Set<Long> roleIds) {}
