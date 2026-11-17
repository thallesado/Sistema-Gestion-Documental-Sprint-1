package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.config.PushProperties;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import com.lta.gestdocum.backend.service.PushMessageSender.PushMessage;
import com.lta.gestdocum.backend.service.PushMessageSender.PushOutcome;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** PushService con cliente FCM simulado y base de datos simulada (la RLS real se valida en PostgreSQL). */
class PushServiceTest {

    private static final UUID TENANT = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID RECIPIENT = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID NOTIFICATION = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID TASK = UUID.fromString("44444444-4444-4444-4444-444444444444");

    private final FakeFcm fcm = new FakeFcm();
    private final NamedParameterJdbcTemplate db = mock(NamedParameterJdbcTemplate.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final Executor direct = Runnable::run;

    @BeforeEach
    void wireJdbc() {
        when(db.getJdbcTemplate()).thenReturn(jdbc);
    }

    @AfterEach
    void clearSynchronizations() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private PushService service(PushMessageSender sender) {
        return new PushService(db, sender, transactions, direct);
    }

    private void stubRecipient(String language, List<String> tokens) {
        stubRecipient(language, true, tokens);
    }

    private void stubRecipient(String language, boolean pushEnabled, List<String> tokens) {
        when(db.query(anyString(), anyMap(), ArgumentMatchers.<ResultSetExtractor<PushService.Recipient.Prefs>>any()))
                .thenReturn(new PushService.Recipient.Prefs(language, pushEnabled));
        when(db.queryForList(anyString(), anyMap(), eq(String.class))).thenReturn(tokens);
    }

    private static PushService.Delivery delivery(UUID task, String type) {
        return new PushService.Delivery(TENANT, RECIPIENT, NOTIFICATION, task, type);
    }

    @Test
    void sinCredencialesElServicioQuedaDesactivadoYNoEnvia() {
        FirebasePushMessageSender sender = new FirebasePushMessageSender(new PushProperties("", ""));
        assertFalse(sender.isConfigured());

        PushService push = service(sender);
        assertFalse(push.isEnabled());
        push.notifyAfterCommit(TENANT, RECIPIENT, NOTIFICATION, TASK, "TASK_ASSIGNED");
        verify(db, never()).queryForList(anyString(), anyMap(), eq(String.class));
        verify(db, never()).update(anyString(), anyMap());
    }

    @Test
    void credencialesIlegiblesNoRompenElArranque() {
        FirebasePushMessageSender sender = new FirebasePushMessageSender(
                new PushProperties("C:/no-existe/firebase.json", ""));
        assertFalse(sender.isConfigured());
        assertFalse(service(sender).isEnabled());
    }

    @Test
    void avisoSeEnviaConIdentificadoresYTextoGenerico() {
        stubRecipient("es", List.of("token-a"));
        PushService push = service(fcm);

        push.deliver(delivery(TASK, "TASK_ASSIGNED"));

        assertEquals(1, fcm.sent.size());
        FakeFcm.Sent sent = fcm.sent.get(0);
        assertEquals("token-a", sent.token());
        assertEquals("Nueva tarea asignada", sent.message().title());
        assertEquals("Abre NexoDocs para ver los detalles.", sent.message().body());
        assertEquals(NOTIFICATION.toString(), sent.message().data().get("notificationId"));
        assertEquals(TASK.toString(), sent.message().data().get("taskId"));
    }

    @Test
    void idiomaInglesYSinTareaNoEnviaTaskId() {
        stubRecipient("en-US", List.of("token-a"));
        service(fcm).deliver(delivery(null, "WORKFLOW"));
        PushMessage message = fcm.sent.get(0).message();
        assertEquals("New workflow notice", message.title());
        assertFalse(message.data().containsKey("taskId"));
    }

    @Test
    void elEnvioSeProgramaTrasElCommitYNoAntes() {
        stubRecipient("es", List.of("token-a"));
        PushService push = service(fcm);

        TransactionSynchronizationManager.initSynchronization();
        push.notifyAfterCommit(TENANT, RECIPIENT, NOTIFICATION, TASK, "TASK_ASSIGNED");
        assertTrue(fcm.sent.isEmpty(), "no debe enviarse dentro de la transacción");

        List<TransactionSynchronization> syncs = new ArrayList<>(TransactionSynchronizationManager.getSynchronizations());
        TransactionSynchronizationManager.clearSynchronization();
        assertEquals(1, syncs.size());
        syncs.get(0).afterCommit();
        assertEquals(1, fcm.sent.size());
    }

    @Test
    void transaccionRevertidaNoEnvia() {
        stubRecipient("es", List.of("token-a"));
        PushService push = service(fcm);

        TransactionSynchronizationManager.initSynchronization();
        push.notifyAfterCommit(TENANT, RECIPIENT, NOTIFICATION, TASK, "TASK_ASSIGNED");
        // Rollback: se descartan las sincronizaciones sin invocar afterCommit.
        TransactionSynchronizationManager.clearSynchronization();

        assertTrue(fcm.sent.isEmpty());
    }

    @Test
    void tokenInvalidSeDesactivaYElValidoNo() {
        stubRecipient("es", List.of("token-muerto", "token-vivo"));
        fcm.perToken.put("token-muerto", PushOutcome.INVALID_TOKEN);
        fcm.perToken.put("token-vivo", PushOutcome.SENT);

        service(fcm).deliver(delivery(TASK, "TASK_ASSIGNED"));

        verify(db).update(
                ArgumentMatchers.<String>argThat(sql -> sql.contains("SET is_active = false")),
                ArgumentMatchers.<Map<String, Object>>argThat(p -> "token-muerto".equals(p.get("token"))));
        verify(db, never()).update(
                ArgumentMatchers.<String>argThat(sql -> sql.contains("SET is_active = false")),
                ArgumentMatchers.<Map<String, Object>>argThat(p -> "token-vivo".equals(p.get("token"))));
    }

    @Test
    void errorTransitorioNoDesactivaElToken() {
        stubRecipient("es", List.of("token-a"));
        fcm.outcome = PushOutcome.FAILED;
        service(fcm).deliver(delivery(TASK, "TASK_ASSIGNED"));
        verify(db, never()).update(anyString(), anyMap());
    }

    @Test
    void elContextoDeTenantEsDelDestinatarioDuranteLasConsultas() {
        List<UUID> seenTenants = new ArrayList<>();
        when(db.query(anyString(), anyMap(), ArgumentMatchers.<ResultSetExtractor<PushService.Recipient.Prefs>>any())).thenAnswer(invocation -> {
            seenTenants.add(TenantDatabaseContext.current().tenantId());
            return new PushService.Recipient.Prefs("es", true);
        });
        when(db.queryForList(anyString(), anyMap(), eq(String.class))).thenAnswer(invocation -> {
            seenTenants.add(TenantDatabaseContext.current().tenantId());
            return List.of("token-a");
        });

        service(fcm).deliver(delivery(TASK, "TASK_ASSIGNED"));

        assertEquals(List.of(TENANT, TENANT), seenTenants);
        assertNull(TenantDatabaseContext.current(), "el contexto de tenant se restaura al terminar");
    }

    @Test
    void usuarioConPushDesactivadaNoRecibeNada() {
        stubRecipient("es", false, List.of("token-a"));
        service(fcm).deliver(delivery(TASK, "TASK_ASSIGNED"));
        assertTrue(fcm.sent.isEmpty(), "la preferencia push del perfil se respeta");
    }

    @Test
    void sinTokensNoEnviaNada() {
        stubRecipient("es", List.of());
        service(fcm).deliver(delivery(TASK, "TASK_ASSIGNED"));
        assertTrue(fcm.sent.isEmpty());
    }

    @Test
    void textoDeTareasYAvisosGenericos() {
        PushMessage task = PushService.buildMessage("es", delivery(null, "APPROVAL_REQUIRED"));
        PushMessage other = PushService.buildMessage("es", delivery(null, "Etapa clínica"));
        assertEquals("Nueva tarea asignada", task.title());
        assertEquals("Nuevo aviso de workflow", other.title());
        assertEquals(Map.of("notificationId", NOTIFICATION.toString()), other.data());
        assertFalse(other.toString().contains("clínica"), "el nombre de la etapa no sale en el aviso");
    }

    /** Cliente FCM simulado: registra cada envío y responde con el resultado configurado. */
    static final class FakeFcm implements PushMessageSender {
        record Sent(String token, PushMessage message) { }

        final List<Sent> sent = new ArrayList<>();
        final Map<String, PushOutcome> perToken = new HashMap<>();
        PushOutcome outcome = PushOutcome.SENT;

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public PushOutcome send(String token, PushMessage message) {
            sent.add(new Sent(token, message));
            return perToken.getOrDefault(token, outcome);
        }
    }
}
