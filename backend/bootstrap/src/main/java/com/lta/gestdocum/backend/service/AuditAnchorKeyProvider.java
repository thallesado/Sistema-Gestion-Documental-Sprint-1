package com.lta.gestdocum.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;

/**
 * Clave HMAC con la que se firman las anclas de auditoría (C3). Debe vivir fuera de la base de datos: si el
 * DBA la conociera podría recalcular la cadena y firmar un ancla nueva.
 *
 * <ul>
 *   <li>{@code AUDIT_ANCHOR_SECRET} propio: se usa tal cual.</li>
 *   <li>Sin él (o con el antiguo valor público del repositorio): se genera una clave aleatoria la primera vez y
 *   se guarda en {@code AUDIT_ANCHOR_KEY_FILE} (por defecto junto al archivo de anclas externo), con permisos
 *   solo para el proceso. Cada instalación tiene así su propia clave sin configuración manual.</li>
 * </ul>
 *
 * Las anclas firmadas con el antiguo valor público antes de {@link #LEGACY_KEY_RETIRED_AT} se siguen aceptando
 * para no marcar como manipuladas las instalaciones existentes; cualquier ancla posterior con esa clave se rechaza.
 */
@Component
public class AuditAnchorKeyProvider {

    /** Valor público que traía {@code application.yml}; solo sirve para reconocer anclas antiguas. */
    static final String LEGACY_PUBLIC_SECRET = "nexodocs-tamper-proof-anchor-master-key-2026";
    static final OffsetDateTime LEGACY_KEY_RETIRED_AT = OffsetDateTime.parse("2026-10-28T00:00:00Z");
    static final String DEFAULT_KEY_FILE = "./data/audit-anchor/anchor.key";

    private static final Logger log = LoggerFactory.getLogger(AuditAnchorKeyProvider.class);

    private final String secret;
    private final String source;

    public AuditAnchorKeyProvider(
            @Value("${nexodocs.audit.anchor-secret:}") String configuredSecret,
            @Value("${nexodocs.audit.anchor-key-file:}") String keyFile,
            @Value("${nexodocs.audit.external-anchor.file-path:}") String externalFile) {
        if (configuredSecret != null && !configuredSecret.isBlank() && !LEGACY_PUBLIC_SECRET.equals(configuredSecret.trim())) {
            this.secret = configuredSecret.trim();
            this.source = "AUDIT_ANCHOR_SECRET";
        } else {
            if (LEGACY_PUBLIC_SECRET.equals(configuredSecret == null ? null : configuredSecret.trim())) {
                log.warn("AUDIT_ANCHOR_SECRET has the old public value; it is ignored and a generated key is used instead.");
            }
            Path path = resolveKeyFile(keyFile, externalFile);
            this.secret = loadOrCreate(path);
            this.source = path.toString();
        }
    }

    /** Para pruebas: una clave fija. */
    public static AuditAnchorKeyProvider fixed(String secret) {
        return new AuditAnchorKeyProvider(secret, "", "");
    }

    public String secret() {
        return secret;
    }

    /**
     * Solo una instalación que nunca configuró su propio secreto firmó con el valor público. Con
     * {@code AUDIT_ANCHOR_SECRET} propio las anclas antiguas ya usaban esa clave y no hay nada que tolerar.
     */
    public boolean legacyFallbackAllowed() {
        return !"AUDIT_ANCHOR_SECRET".equals(source);
    }

    /** Origen de la clave (variable o ruta del archivo), sin revelar su valor. */
    public String source() {
        return source;
    }

    /** Un ancla anterior al retiro del valor público puede estar firmada con él. */
    static boolean legacyAccepted(OffsetDateTime anchoredAt) {
        return anchoredAt != null && anchoredAt.isBefore(LEGACY_KEY_RETIRED_AT);
    }

    static Path resolveKeyFile(String keyFile, String externalFile) {
        if (keyFile != null && !keyFile.isBlank()) return Path.of(keyFile.trim());
        if (externalFile != null && !externalFile.isBlank()) {
            Path parent = Path.of(externalFile.trim()).toAbsolutePath().getParent();
            if (parent != null) return parent.resolve("anchor.key");
        }
        return Path.of(DEFAULT_KEY_FILE);
    }

    static String loadOrCreate(Path path) {
        try {
            if (Files.exists(path)) {
                String existing = Files.readString(path, StandardCharsets.UTF_8).trim();
                if (existing.length() >= 32) return existing;
                throw new IllegalStateException("Audit anchor key file is too short: " + path);
            }
            Path parent = path.toAbsolutePath().getParent();
            if (parent != null) Files.createDirectories(parent);
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            String generated = HexFormat.of().formatHex(random);
            try {
                Files.writeString(path, generated + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
            } catch (FileAlreadyExistsException race) {
                return Files.readString(path, StandardCharsets.UTF_8).trim();
            }
            try {
                Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException ignored) {
                // Sistemas sin permisos POSIX (Windows): se conserva el archivo con los permisos por defecto.
            }
            log.info("Generated a new audit anchor key at {}", path);
            return generated;
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read or create the audit anchor key file " + path, e);
        }
    }
}
