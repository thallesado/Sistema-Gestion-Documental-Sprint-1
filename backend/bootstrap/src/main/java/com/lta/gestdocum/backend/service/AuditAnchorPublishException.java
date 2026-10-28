package com.lta.gestdocum.backend.service;

/** Failure talking to an external anchor destination. Messages never carry credentials or full URLs. */
public class AuditAnchorPublishException extends RuntimeException {
    public AuditAnchorPublishException(String message) {
        super(message);
    }

    public AuditAnchorPublishException(String message, Throwable cause) {
        super(message, cause);
    }
}
