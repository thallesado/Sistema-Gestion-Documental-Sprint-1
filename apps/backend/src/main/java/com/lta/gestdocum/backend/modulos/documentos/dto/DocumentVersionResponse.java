package com.lta.gestdocum.backend.modulos.documentos.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentVersionResponse(UUID id, UUID documentId, Integer versionNumber,
                                      String fileName, String mimeType, long fileSizeBytes,
                                      String checksumSha256, String changeReason,
                                      OffsetDateTime createdAt) {
}
