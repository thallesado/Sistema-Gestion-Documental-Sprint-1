package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Requests are consumed by a separate host operator, never by a privileged web process. */
@Service
public class PlatformBackupService {
    private final AuthenticatedUserContext context;
    private final Path queue;

    public PlatformBackupService(AuthenticatedUserContext context,
            @Value("${backups.platform.queue-path:}") String queuePath) {
        this.context = context;
        this.queue = queuePath.isBlank() ? null : Path.of(queuePath).toAbsolutePath().normalize();
    }

    private void authorize() {
        var actor = context.require();
        if (actor.tenantId() != null || !actor.authorities().contains("platform:tenant:manage")) {
            throw new AccessDeniedException("Se requiere administrador de plataforma");
        }
        if (queue == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "El operador de respaldos completos no está configurado");
    }

    public synchronized Map<String, Object> request() throws IOException {
        authorize();
        Path heartbeat = queue.resolve("worker-ready");
        if (!Files.isRegularFile(heartbeat, LinkOption.NOFOLLOW_LINKS)
                || Files.getLastModifiedTime(heartbeat).toInstant().isBefore(Instant.now().minusSeconds(180))) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "El operador de respaldos completos no está disponible");
        }
        try (var entries = Files.list(queue)) {
            if (entries.filter(p -> p.getFileName().toString().matches("[0-9a-f-]{36}"))
                    .anyMatch(p -> Files.exists(p.resolve("requested")) || Files.exists(p.resolve("running")))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya hay un respaldo completo en curso");
            }
        }
        UUID id = UUID.randomUUID();
        Path operation = Files.createDirectory(queue.resolve(id.toString()));
        Files.writeString(operation.resolve("actor"), context.require().userId().toString(), StandardOpenOption.CREATE_NEW);
        Files.writeString(operation.resolve("requested"), Instant.now().toString(), StandardOpenOption.CREATE_NEW);
        return Map.of("id", id, "status", "PENDING");
    }

    public Map<String, Object> status(UUID id) {
        authorize();
        Path operation = queue.resolve(id.toString());
        if (!Files.isDirectory(operation, LinkOption.NOFOLLOW_LINKS))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Operación no encontrada");
        String state = Files.exists(operation.resolve("completed")) ? "COMPLETED"
                : Files.exists(operation.resolve("failed")) ? "FAILED"
                : Files.exists(operation.resolve("running")) ? "RUNNING" : "PENDING";
        return Map.of("id", id, "status", state);
    }
}
