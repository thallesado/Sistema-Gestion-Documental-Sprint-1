package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record UserReportRow(
        UUID id,
        String user,
        String role,
        String area,
        String lastAccess,
        long actions,
        String status
) {}
