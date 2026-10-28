package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record ExpedientReportRow(
        UUID id,
        String expedient,
        String code,
        String type,
        String area,
        String owner,
        String date,
        String status
) {}
