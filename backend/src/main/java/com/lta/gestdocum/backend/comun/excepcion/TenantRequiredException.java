package com.lta.gestdocum.backend.comun.excepcion;

public class TenantRequiredException extends RuntimeException {
    public TenantRequiredException() {
        super("La operación requiere un tenant autenticado");
    }
}
