package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import com.lta.gestdocum.backend.service.PushMessageSender.PushMessage;
import com.lta.gestdocum.backend.service.PushMessageSender.PushOutcome;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

/**
 * Envía avisos push de workflow a los tokens activos del destinatario.
 *
 * <p>El envío nunca ocurre dentro de la transacción de negocio: se programa con
 * {@link TransactionSynchronization#afterCommit()} y se ejecuta en un hilo aparte. Si la transacción
 * falla, no se envía nada. El aviso sigue existiendo en la tabla {@code notifications}, así que el
 * sondeo de la app lo muestra igualmente.
 *
 * <p>Seguridad: el contenido es genérico (sin nombres de documentos, pacientes ni datos clínicos).
 * Solo viajan {@code notificationId} y {@code taskId} en los datos del mensaje.
 *
 * <p>Acceso a datos: la política RLS de {@code user_push_tokens} solo deja ver las filas del propio
 * usuario. Por eso el trabajo fija el contexto del destinatario (tenant y usuario) dentro de una
 * transacción local, igual que una petición suya.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    private static final Set<String> TASK_NOTICE_TYPES = Set.of("TASK_ASSIGNED", "REVIEW_REQUIRED", "APPROVAL_REQUIRED");

    private final NamedParameterJdbcTemplate db;
    private final PushMessageSender sender;
    private final TransactionTemplate transaction;
    private final Executor executor;
    private final boolean enabled;

    public PushService(NamedParameterJdbcTemplate db,
                       PushMessageSender sender,
                       PlatformTransactionManager transactionManager,
                       @Qualifier("pushExecutor") Executor executor) {
        this.db = db;
        this.sender = sender;
        this.transaction = new TransactionTemplate(transactionManager);
        this.executor = executor;
        this.enabled = sender.isConfigured();
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Programa el aviso push para una notificación ya insertada. Llamar desde la transacción que la creó:
     * el envío empieza solo si esa transacción confirma.
     *
     * @param taskId tarea a abrir al tocar el aviso, o {@code null} si el aviso no es de una tarea
     */
    public void notifyAfterCommit(UUID tenantId, UUID recipientId, UUID notificationId, UUID taskId, String noticeType) {
        if (!enabled || tenantId == null || recipientId == null || notificationId == null) return;
        Delivery delivery = new Delivery(tenantId, recipientId, notificationId, taskId, noticeType);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    submit(delivery);
                }
            });
        } else {
            submit(delivery);
        }
    }

    private void submit(Delivery delivery) {
        try {
            executor.execute(() -> deliver(delivery));
        } catch (RejectedExecutionException exception) {
            // Cola llena: el aviso sigue en la bandeja y el sondeo de la app lo mostrará.
            log.warn("Cola de avisos push llena; un aviso no se envió por push");
        }
    }

    /** Envío síncrono del aviso. Público para pruebas y para el hilo del ejecutor. */
    public void deliver(Delivery delivery) {
        try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useTenant(delivery.tenantId())) {
            Recipient recipient = readRecipient(delivery);
            // El usuario desactivó las push en su perfil: no se envía a ninguno de sus dispositivos.
            if (!recipient.pushEnabled() || recipient.tokens().isEmpty()) return;
            PushMessage message = buildMessage(recipient.language(), delivery);
            for (String token : recipient.tokens()) {
                PushOutcome outcome = sender.send(token, message);
                if (outcome == PushOutcome.INVALID_TOKEN) deactivate(delivery, token);
            }
        } catch (RuntimeException exception) {
            log.warn("No se pudo enviar el aviso push ({})", exception.getClass().getSimpleName());
        }
    }

    private Recipient readRecipient(Delivery delivery) {
        return transaction.execute(status -> {
            establishRecipientContext(delivery);
            Recipient.Prefs prefs = db.query(
                    "SELECT preferred_language, push_notifications FROM users WHERE tenant_id = :tenant AND id = :user",
                    params(delivery),
                    rs -> rs.next() ? new Recipient.Prefs(rs.getString(1), rs.getBoolean(2)) : new Recipient.Prefs(null, false));
            List<String> tokens = db.queryForList(
                    "SELECT token FROM user_push_tokens WHERE tenant_id = :tenant AND user_id = :user AND is_active",
                    params(delivery),
                    String.class);
            return new Recipient(prefs.language(), prefs.pushEnabled(), tokens);
        });
    }

    private void deactivate(Delivery delivery, String token) {
        transaction.executeWithoutResult(status -> {
            establishRecipientContext(delivery);
            Map<String, Object> p = new HashMap<>(params(delivery));
            p.put("token", token);
            db.update("UPDATE user_push_tokens SET is_active = false WHERE tenant_id = :tenant AND user_id = :user AND token = :token", p);
        });
        log.info("Token push desactivado tras respuesta de FCM");
    }

    private void establishRecipientContext(Delivery delivery) {
        db.getJdbcTemplate().execute("SET LOCAL ROLE nexodocs_app");
        db.queryForMap(
                "SELECT set_config('app.tenant_id', :tenant, true), set_config('app.user_id', :user, true)",
                params(delivery));
    }

    private static Map<String, Object> params(Delivery delivery) {
        Map<String, Object> p = new HashMap<>();
        p.put("tenant", delivery.tenantId().toString());
        p.put("user", delivery.recipientId().toString());
        return p;
    }

    /** Texto y datos del aviso. Sin datos del documento ni de la tarea más allá de sus identificadores. */
    static PushMessage buildMessage(String language, Delivery delivery) {
        boolean english = language != null && language.toLowerCase().startsWith("en");
        boolean task = TASK_NOTICE_TYPES.contains(delivery.noticeType());
        String title = task
                ? (english ? "New task assigned" : "Nueva tarea asignada")
                : (english ? "New workflow notice" : "Nuevo aviso de workflow");
        String body = english ? "Open NexoDocs to see the details." : "Abre NexoDocs para ver los detalles.";
        Map<String, String> data = new HashMap<>();
        data.put("notificationId", delivery.notificationId().toString());
        if (delivery.taskId() != null) data.put("taskId", delivery.taskId().toString());
        return new PushMessage(title, body, data);
    }

    /** Aviso a enviar. Puede pasarse a pruebas sin acceso a base de datos. */
    public record Delivery(UUID tenantId, UUID recipientId, UUID notificationId, UUID taskId, String noticeType) { }

    /** Datos del destinatario leídos con su propio contexto RLS. */
    record Recipient(String language, boolean pushEnabled, List<String> tokens) {
        record Prefs(String language, boolean pushEnabled) { }
    }
}
