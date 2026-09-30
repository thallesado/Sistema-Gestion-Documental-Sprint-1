package com.lta.gestdocum.backend.dto;

public record PermissionResponse(
        Long id, String code, String module, String action, String description, String criticality) {
}
