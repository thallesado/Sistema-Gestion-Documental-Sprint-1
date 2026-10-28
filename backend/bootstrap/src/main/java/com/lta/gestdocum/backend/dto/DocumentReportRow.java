package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record DocumentReportRow(
        UUID id,
        String document,
        String code,
        String type,
        String area,
        String owner,
        String date,
        String status
) {}
