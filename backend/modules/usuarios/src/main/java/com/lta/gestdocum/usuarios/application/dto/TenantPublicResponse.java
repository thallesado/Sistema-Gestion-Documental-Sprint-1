package com.lta.gestdocum.usuarios.application.dto;

import java.util.UUID;

/** Datos mínimos de una organización para el selector público del login. */
public record TenantPublicResponse(UUID id, String name) {}
