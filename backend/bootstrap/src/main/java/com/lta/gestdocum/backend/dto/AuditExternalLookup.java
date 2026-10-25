package com.lta.gestdocum.backend.dto;

/** Result of asking the external destination for the latest anchor of a scope. */
public record AuditExternalLookup(Status status, AuditExternalAnchor anchor, String destination, String detail) {
    public enum Status { FOUND, NONE, UNREACHABLE, UNVERIFIABLE, NOT_CONFIGURED }
}
