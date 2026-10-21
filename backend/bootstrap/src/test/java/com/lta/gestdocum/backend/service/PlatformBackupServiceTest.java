package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlatformBackupServiceTest {
    @TempDir Path queue;
    final AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
    void platform() {
        when(context.require()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), null, "platform-test",
                Set.of("platform:tenant:manage")));
    }
    @Test void onlyPlatformCanRequestEvenIfTenantHasSameAuthority() throws Exception {
        when(context.require()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "tenant-test",
                Set.of("platform:tenant:manage")));
        var service = new PlatformBackupService(context, queue.toString());
        assertThrows(AccessDeniedException.class, service::request);
        try (var files = Files.list(queue)) { assertEquals(0, files.count()); }
    }
    @Test void disabledOrOfflineOperatorRejectsInsteadOfReportingFakeSuccess() throws Exception {
        platform();
        assertEquals(503, assertThrows(ResponseStatusException.class,
                new PlatformBackupService(context, "")::request).getStatusCode().value());
        var service = new PlatformBackupService(context, queue.toString());
        assertEquals(503, assertThrows(ResponseStatusException.class, service::request).getStatusCode().value());
        Path heartbeat = Files.writeString(queue.resolve("worker-ready"), "");
        Files.setLastModifiedTime(heartbeat, java.nio.file.attribute.FileTime.from(Instant.now().minusSeconds(181)));
        assertEquals(503, assertThrows(ResponseStatusException.class, service::request).getStatusCode().value());
    }
    @Test void queuedRequestSurvivesServiceRestartAndConcurrentRequestIsRejected() throws Exception {
        platform();
        Files.writeString(queue.resolve("worker-ready"), "");
        var service = new PlatformBackupService(context, queue.toString());
        UUID id = (UUID) service.request().get("id");
        assertEquals("PENDING", new PlatformBackupService(context, queue.toString()).status(id).get("status"));
        assertEquals(409, assertThrows(ResponseStatusException.class, service::request).getStatusCode().value());
        Files.move(queue.resolve(id.toString()).resolve("requested"), queue.resolve(id.toString()).resolve("running"));
        assertEquals("RUNNING", service.status(id).get("status"));
        Files.move(queue.resolve(id.toString()).resolve("running"), queue.resolve(id.toString()).resolve("completed"));
        assertEquals("COMPLETED", service.status(id).get("status"));
        assertEquals("PENDING", service.request().get("status"));
    }
}
