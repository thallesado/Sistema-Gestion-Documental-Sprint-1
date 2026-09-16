package com.lta.gestdocum.backend.exception;

public class TenantRequiredException extends RuntimeException {
    public TenantRequiredException() {
        super("La operación requiere un tenant autenticado");
    }
}
