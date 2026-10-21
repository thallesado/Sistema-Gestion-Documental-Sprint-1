package com.lta.gestdocum.backend.dto;

public record AuditReportRow(
        Long id,
        String timestamp,
        String user,
        String action,
        String module,
        String resource,
        String area,
        String ip,
        String result
) {}
