package com.lta.gestdocum.backend.comun.excepcion;

public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}
