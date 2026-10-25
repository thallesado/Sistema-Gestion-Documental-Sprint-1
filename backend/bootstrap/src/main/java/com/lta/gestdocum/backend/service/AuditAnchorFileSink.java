package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.AuditExternalAnchor;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.FileAttribute;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Optional;
import java.util.Set;

/**
 * Append-only JSON-lines sink. Meant to live on a separate volume/mount that the database
 * administrator cannot rewrite. It only ever opens the file with APPEND (never TRUNCATE),
 * fsyncs every write, and creates it owner-only where POSIX permissions exist.
 */
public class AuditAnchorFileSink implements AuditAnchorPublisher {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<PosixFilePermission> OWNER_RW =
            PosixFilePermissions.fromString("rw-------");

    private final Path file;

    public AuditAnchorFileSink(Path file) {
        this.file = file.toAbsolutePath().normalize();
    }

    @Override
    public String destination() {
        return "file:" + file;
    }

    @Override
    public String kind() {
        return "file";
    }

    @Override
    public boolean supportsLookup() {
        return true;
    }

    @Override
    public synchronized void publish(AuditExternalAnchor anchor) {
        if (Files.isDirectory(file)) {
            throw new AuditAnchorPublishException("External anchor path is a directory");
        }
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            if (Files.exists(file) && latestMatches(anchor)) {
                return; // idempotent: same scope/seq/hash already recorded
            }
            FileAttribute<?>[] attrs = posix(file)
                    ? new FileAttribute<?>[]{PosixFilePermissions.asFileAttribute(OWNER_RW)}
                    : new FileAttribute<?>[0];
            byte[] line = (JSON.writeValueAsString(anchor) + "\n").getBytes(StandardCharsets.UTF_8);
            try (FileChannel ch = FileChannel.open(file,
                    Set.of(StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND), attrs);
                 FileLock ignored = ch.lock()) {
                ByteBuffer buf = ByteBuffer.wrap(line);
                while (buf.hasRemaining()) {
                    ch.write(buf);
                }
                ch.force(true);
            }
        } catch (IOException e) {
            throw new AuditAnchorPublishException("Cannot append to external anchor file: " + e.getClass().getSimpleName(), e);
        }
    }

    private boolean latestMatches(AuditExternalAnchor anchor) {
        return latest(anchor.scope())
                .filter(l -> l.chainSeq() == anchor.chainSeq() && l.recordHash().equalsIgnoreCase(anchor.recordHash()))
                .isPresent();
    }

    private static boolean posix(Path p) {
        Path root = p.getRoot();
        return root != null && root.getFileSystem().supportedFileAttributeViews().contains("posix");
    }

    @Override
    public synchronized Optional<AuditExternalAnchor> latest(String scope) {
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        AuditExternalAnchor best = null;
        try {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (line.isBlank()) {
                    continue;
                }
                AuditExternalAnchor a;
                try {
                    a = JSON.readValue(line, AuditExternalAnchor.class);
                } catch (IOException malformed) {
                    continue;
                }
                if (a.scope() == null || a.recordHash() == null || !a.scope().equals(scope)) {
                    continue;
                }
                if (best == null || a.chainSeq() >= best.chainSeq()) {
                    best = a;
                }
            }
        } catch (IOException e) {
            throw new AuditAnchorPublishException("Cannot read external anchor file: " + e.getClass().getSimpleName(), e);
        }
        return Optional.ofNullable(best);
    }
}
