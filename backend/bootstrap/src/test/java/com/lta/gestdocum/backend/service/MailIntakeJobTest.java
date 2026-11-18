package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MailIntakeJobTest {

    @Mock private NamedParameterJdbcTemplate db;
    @Mock private JdbcTemplate jdbc;
    @Mock private PlatformTransactionManager transactions;
    @Mock private MailboxGateway gateway;
    @Mock private IntakeFileScanner scanner;
    @Mock private DocumentService documents;
    @Mock private DocumentStorageService storage;
    @Mock private OcrService ocr;
    @Mock private PlanLimitService limits;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void unAdjuntoFallidoNoDetieneElLoteYBorraSuArchivo() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID connectionId = UUID.randomUUID();
        authenticate(tenantId);
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of(Map.of(
                "enabled", true,
                "uid_validity", 1L,
                "last_uid", 0L,
                "profile_key", "perfil",
                "folder", "INBOX",
                "since_at", OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                "sender_filter", "",
                "subject_filter", "")));
        when(db.queryForObject(anyString(), anyMap(), eq(Integer.class))).thenReturn(0);
        when(scanner.scan(any(), anyString())).thenReturn("CLEAN");
        AtomicInteger inserts = new AtomicInteger();
        List<String> updates = new ArrayList<>();
        when(db.update(anyString(), anyMap())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.startsWith("INSERT INTO mail_intake_items")) {
                if (inserts.incrementAndGet() == 2) {
                    throw new IllegalStateException("fila rechazada");
                }
                return 1;
            }
            updates.add(sql);
            return 1;
        });
        when(gateway.read(anyString(), anyString(), anyLong(), anyLong(), any(), anyString(), anyString(), any()))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    Consumer<MailboxGateway.Attachment> consumer = invocation.getArgument(7);
                    consumer.accept(attachment(1, new byte[]{1, 2}));
                    consumer.accept(attachment(2, new byte[]{3, 4}));
                    return new MailboxGateway.Cursor(4L, 8L, 2);
                });

        Path root = Files.createTempDirectory("mail-intake-job");
        try {
            var service = new MailIntakeService(operations(), gateway, scanner, documents, storage, ocr, limits, false, root.toString());
            service.runJob(Map.of("id", UUID.randomUUID(), "connection_id", connectionId));
            assertTrue(updates.stream().anyMatch(sql -> sql.startsWith("UPDATE mailbox_connections")));
            try (var files = Files.walk(root.resolve(tenantId.toString()).resolve(".mail"))) {
                assertEquals(1, files.filter(Files::isRegularFile).count());
            }
        } finally {
            deleteTree(root);
        }
    }

    @Test
    void unLoteRevertidoBorraLosArchivosEscritos() throws Exception {
        Path root = Files.createTempDirectory("mail-intake-rollback");
        Path file = root.resolve("adjunto");
        Files.writeString(file, "dato");
        TransactionSynchronizationManager.initSynchronization();
        try {
            List<Path> written = new ArrayList<>();
            written.add(file);
            MailIntakeService.discardOnRollback(written);
            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            }
            assertFalse(Files.exists(file));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
            deleteTree(root);
        }
    }

    private DocumentOperations operations() {
        return new DocumentOperations(db, jdbc, new ObjectMapper(), new AuthenticatedUserContext(), transactions);
    }

    private static void authenticate(UUID tenantId) {
        var user = new AuthenticatedUser(UUID.randomUUID(), tenantId, "buzon", Set.of("mailbox:manage"));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
        SecurityContextHolder.setContext(context);
    }

    private static MailboxGateway.Attachment attachment(int part, byte[] data) {
        return new MailboxGateway.Attachment(1L, part, part, null, "a@b.c", "asunto",
                OffsetDateTime.parse("2026-11-18T00:00:00Z"), "archivo-" + part + ".pdf", "application/pdf", data);
    }

    private static void deleteTree(Path root) throws Exception {
        if (!Files.exists(root)) return;
        try (var walk = Files.walk(root)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (Exception ignored) { }
            });
        }
    }
}
