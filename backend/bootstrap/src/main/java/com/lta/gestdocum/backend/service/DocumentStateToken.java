package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Document;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Objects;
import java.util.UUID;

/** Opaque optimistic-concurrency token for a document's status and current version. */
public final class DocumentStateToken {
    private DocumentStateToken() { }

    public static String from(Document document) {
        return from(document.getId(), document.getStatus(), document.getCurrentVersion(), document.getUpdatedAt());
    }

    public static String from(UUID id, Document.DocumentStatus status, Integer currentVersion,
                              java.time.OffsetDateTime updatedAt) {
        String state = id + "\n" + status + "\n" + currentVersion + "\n" + updatedAt;
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(state.getBytes(StandardCharsets.UTF_8));
            return "\"" + Base64.getUrlEncoder().withoutPadding().encodeToString(hash) + "\"";
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public static void requireMatch(String supplied, Document current) {
        if (supplied == null || supplied.isBlank()) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,
                    "Envía el ETag vigente del documento en el encabezado If-Match.");
        }
        String expected = from(current);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                supplied.trim().getBytes(StandardCharsets.US_ASCII))) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_FAILED,
                    "El documento cambió de estado o versión. Recarga sus datos antes de continuar.");
        }
    }
}
