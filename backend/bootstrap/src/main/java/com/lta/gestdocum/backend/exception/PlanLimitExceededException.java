package com.lta.gestdocum.backend.exception;

import org.springframework.security.access.AccessDeniedException;

/** Se lanza cuando el plan contratado no permite crear o almacenar un recurso. */
public class PlanLimitExceededException extends AccessDeniedException {

    public PlanLimitExceededException(String message) {
        super(message);
    }
}
