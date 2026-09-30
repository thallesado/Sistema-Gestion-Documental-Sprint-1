package com.lta.gestdocum.shared.exception;

public class TenantMismatchException extends RuntimeException {
    public TenantMismatchException() {
        super("El tenant solicitado no coincide con el tenant autenticado");
    }
}
