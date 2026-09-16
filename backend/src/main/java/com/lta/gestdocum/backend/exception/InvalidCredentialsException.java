package com.lta.gestdocum.backend.exception;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Credenciales inválidas");
    }
}
