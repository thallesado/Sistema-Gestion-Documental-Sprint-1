package com.lta.gestdocum.usuarios.application.dto;

public record PermissionResponse(
        Long id, String code, String module, String action, String description, String criticality) {
}
