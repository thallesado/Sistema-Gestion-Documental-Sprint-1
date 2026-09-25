package com.lta.gestdocum.backend.modulos.organizaciones.dto;

import java.util.UUID;

public record TenantResponse(UUID id, String name, String code, String slug, String status) {}
