package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record WorkflowReportRow(
        UUID id,
        String workflow,
        String document,
        String type,
        String stage,
        String owner,
        String start,
        String deadline,
        String elapsed,
        String status
) {}
