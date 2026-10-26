package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.AuditExternalAnchor;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileAttribute;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Append-only JSON-lines sink. Meant to live on a separate volume/mount that the database
 * administrator cannot rewrite. It only ever opens the file with APPEND (never TRUNCATE),
 * fsyncs every write, and creates it owner-only where POSIX permissions exist.
 *
 * <p>Writers are serialised with a sibling {@code .lock} file (across processes) plus a per-path monitor
 * (across threads of this JVM), and the idempotency check runs inside that critical section, so two
 * instances sharing the mount cannot append the same anchor twice. Reads are incremental: only the bytes
 * appended since the previous call are parsed, and the cache resets if the file is replaced or shrinks.
 */
public class AuditAnchorFileSink implements AuditAnchorPublisher {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<PosixFilePermission> OWNER_RW =
            PosixFilePermissions.fromString("rw-------");
    private static final ConcurrentHashMap<Path, Object> MONITORS = new ConcurrentHashMap<>();

    private final Path file;
    private final Path lockFile;
    private final Object monitor;

    // Incremental read cache, guarded by the monitor.
    private final Map<String, AuditExternalAnchor> bestByScope = new HashMap<>();
    private long parsedBytes;
    private Object parsedFileKey;

    public AuditAnchorFileSink(Path file) {
        this.file = file.toAbsolutePath().normalize();
        this.lockFile = this.file.resolveSibling(this.file.getFileName() + ".lock");
        this.monitor = MONITORS.computeIfAbsent(this.file, p -> new Object());
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
    public void publish(AuditExternalAnchor anchor) {
        if (Files.isDirectory(file)) {
            throw new AuditAnchorPublishException("External anchor path is a directory");
        }
        synchronized (monitor) {
            try {
                Path parent = file.getParent();
                if (parent != null) {
                    Files.createDirectories(parent);
                }
                FileAttribute<?>[] attrs = posix(file)
                        ? new FileAttribute<?>[]{PosixFilePermissions.asFileAttribute(OWNER_RW)}
                        : new FileAttribute<?>[0];
                try (FileChannel lockChannel = FileChannel.open(lockFile,
                        Set.of(StandardOpenOption.CREATE, StandardOpenOption.WRITE), attrs);
                     FileLock ignored = lockChannel.lock()) {
                    if (Files.exists(file) && latestMatches(anchor)) {
                        return; // idempotent: same scope/seq/hash already recorded
                    }
                    byte[] line = (JSON.writeValueAsString(anchor) + "\n").getBytes(StandardCharsets.UTF_8);
                    try (FileChannel ch = FileChannel.open(file,
                            Set.of(StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND), attrs)) {
                        ByteBuffer buf = ByteBuffer.wrap(line);
                        while (buf.hasRemaining()) {
                            ch.write(buf);
                        }
                        ch.force(true);
                    }
                }
            } catch (IOException e) {
                throw new AuditAnchorPublishException("Cannot append to external anchor file: " + e.getClass().getSimpleName(), e);
            }
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
    public Optional<AuditExternalAnchor> latest(String scope) {
        synchronized (monitor) {
            if (!Files.exists(file)) {
                resetCache();
                return Optional.empty();
            }
            try {
                refresh();
            } catch (IOException e) {
                throw new AuditAnchorPublishException("Cannot read external anchor file: " + e.getClass().getSimpleName(), e);
            }
            return Optional.ofNullable(bestByScope.get(scope));
        }
    }

    private void resetCache() {
        bestByScope.clear();
        parsedBytes = 0;
        parsedFileKey = null;
    }

    /** Parses only the complete lines appended since the last call. Caller holds the monitor. */
    private void refresh() throws IOException {
        BasicFileAttributes attrs = Files.readAttributes(file, BasicFileAttributes.class);
        Object key = attrs.fileKey();
        if (parsedFileKey != null && key != null && !key.equals(parsedFileKey)) {
            resetCache();
        }
        parsedFileKey = key;
        try (RandomAccessFile raf = new RandomAccessFile(file.toFile(), "r")) {
            long length = raf.length();
            if (length < parsedBytes) {
                resetCache();
                parsedFileKey = key;
            }
            if (length == parsedBytes) {
                return;
            }
            byte[] chunk = new byte[(int) Math.min(Integer.MAX_VALUE - 8, length - parsedBytes)];
            raf.seek(parsedBytes);
            raf.readFully(chunk);
            int lastNewline = -1;
            for (int i = chunk.length - 1; i >= 0; i--) {
                if (chunk[i] == '\n') {
                    lastNewline = i;
                    break;
                }
            }
            if (lastNewline < 0) {
                return; // no complete line yet
            }
            String complete = new String(chunk, 0, lastNewline + 1, StandardCharsets.UTF_8);
            for (String line : complete.split("\n")) {
                absorb(line);
            }
            parsedBytes += lastNewline + 1;
        }
    }

    private void absorb(String line) {
        if (line.isBlank()) {
            return;
        }
        AuditExternalAnchor a;
        try {
            a = JSON.readValue(line, AuditExternalAnchor.class);
        } catch (IOException malformed) {
            return;
        }
        if (a.scope() == null || a.recordHash() == null) {
            return;
        }
        AuditExternalAnchor best = bestByScope.get(a.scope());
        if (best == null || a.chainSeq() >= best.chainSeq()) {
            bestByScope.put(a.scope(), a);
        }
    }
}
