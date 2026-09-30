package com.lta.gestdocum.usuarios.application.dto;

import java.util.UUID;

public record TenantResponse(UUID id, String name, String code, String slug, String status) {}
