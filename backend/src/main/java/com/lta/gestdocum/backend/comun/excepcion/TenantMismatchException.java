package com.lta.gestdocum.backend.comun.excepcion;

public class TenantMismatchException extends RuntimeException {
    public TenantMismatchException() {
        super("El tenant solicitado no coincide con el tenant autenticado");
    }
}
