package com.lta.gestdocum.backend.security;

import java.util.List;

/** Authorities fijas de las cuentas de plataforma (no pertenecen a ningún tenant ni tienen roles RBAC). */
public final class PlatformAuthorities {

    public static final List<String> CODES = List.of("platform:tenant:manage", "audit:read_global");

    private PlatformAuthorities() {
    }
}
