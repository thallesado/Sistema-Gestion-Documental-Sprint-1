package com.lta.gestdocum.backend.dto;

public record ReportEmbedResponse(
    String token,
    String embedUrl,
    String expiresAt,
    String dataSourceId
) {}
