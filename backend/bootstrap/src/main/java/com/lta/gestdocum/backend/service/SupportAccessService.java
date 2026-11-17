package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.SupportAccessDtos.*;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.PlatformAuthorities;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * Acceso de soporte con consentimiento (fase 5, migración 066). La plataforma solicita módulos de solo
 * lectura, duración y motivo; el administrador del tenant aprueba o rechaza (app.decide_support_access) y
 * puede revocar. Con la aprobación vigente, quien la pidió obtiene un token de soporte: su propia identidad
 * de plataforma dentro del tenant, con los permisos de lectura aprobados. Nunca se inicia sesión como un
 * usuario del tenant. La base reconoce la sesión solo si la solicitud está aprobada y vigente y la
 * transacción es de solo lectura (app.support_session_valid).
 *
 * <p>Emergencia (break-glass): sin el tenant, con dos aprobaciones internas de otras personas (un
 * superadministrador y otro rol) y aviso inmediato a la organización.
 */
@Service
public class SupportAccessService {
    private static final Logger log = LoggerFactory.getLogger(SupportAccessService.class);
    private static final Set<String> ACCESSIBLE = Set.of("TRIAL", "ACTIVE", "PAST_DUE");

    /** Módulos que se pueden solicitar y los permisos de lectura que conceden. */
    public static final Map<String, SupportModule> MODULES;
    static {
        Map<String, SupportModule> modules = new LinkedHashMap<>();
        modules.put("DOCUMENTS", new SupportModule("DOCUMENTS", "Documentos", List.of("document:read", "document_version:read", "ocr:read", "configuration:read", "tenant:read")));
        modules.put("EXPEDIENTS", new SupportModule("EXPEDIENTS", "Expedientes", List.of("expedient:read", "configuration:read", "tenant:read")));
        modules.put("WORKFLOWS", new SupportModule("WORKFLOWS", "Workflows y tareas", List.of("workflow:read", "workflow_template:read", "task:read", "tenant:read")));
        modules.put("USERS", new SupportModule("USERS", "Usuarios y grupos", List.of("user:read", "role:read", "permission:read", "tenant:read")));
        modules.put("CLINICAL", new SupportModule("CLINICAL", "Módulo clínico", List.of("patient:read", "medical_note:read", "dicom:read", "tenant:read")));
        modules.put("AUDIT", new SupportModule("AUDIT", "Auditoría", List.of("audit:read", "audit:read_tenant", "tenant:read")));
        modules.put("REPORTS", new SupportModule("REPORTS", "Reportes", List.of("report:read", "tenant:read")));
        modules.put("CONFIGURATION", new SupportModule("CONFIGURATION", "Configuración", List.of("configuration:read", "notification:read", "tenant:read")));
        MODULES = Collections.unmodifiableMap(modules);
    }

    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;
    private final AuthenticatedUserContext context;
    private final EntityManager entityManager;
    private final JwtService jwtService;
    private final JavaMailSender mailSender;
    private final String mailFrom;

    public SupportAccessService(JdbcTemplate jdbc, PlatformAuditService audit, AuthenticatedUserContext context,
                                EntityManager entityManager, JwtService jwtService, ObjectProvider<JavaMailSender> mailSenderProvider,
                                @Value("${app.mail-from:no-reply@nexodocs.local}") String mailFrom) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.context = context;
        this.entityManager = entityManager;
        this.jwtService = jwtService;
        this.mailSender = mailSenderProvider == null ? null : mailSenderProvider.getIfAvailable();
        this.mailFrom = mailFrom;
    }

    // ------------------------------------------------------------ plataforma

    public List<SupportModule> modules() { return List.copyOf(MODULES.values()); }

    @Transactional(readOnly = true)
    public List<Request> platformList(UUID tenantId) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        return list(tenantId, actor.userId(), actor.authorities().contains(PlatformAuthorities.SUPPORT_ACCESS));
    }

    @Transactional
    public Request request(RequestCreate request) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        List<String> modules = request.modules().stream().map(m -> m.trim().toUpperCase(Locale.ROOT)).distinct().toList();
        List<String> unknown = modules.stream().filter(m -> !MODULES.containsKey(m)).toList();
        if (!unknown.isEmpty()) throw new IllegalArgumentException("Módulos desconocidos: " + String.join(", ", unknown));
        List<String> permissions = permissionsFor(modules);
        Map<String, Object> tenant = tenant(request.tenantId());
        if (!ACCESSIBLE.contains(tenant.get("status")) || tenant.get("purged_at") != null) {
            throw new IllegalStateException("La organización no está operativa");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into support_access_requests (id, tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, break_glass, status)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, request.tenantId(), actor.userId(), reason, modules.toArray(String[]::new), permissions.toArray(String[]::new),
                request.durationMinutes(), request.breakGlass(), request.breakGlass() ? "PENDING_INTERNAL" : "PENDING_TENANT");
        audit.record("SUPPORT_ACCESS_REQUESTED", request.tenantId(), reason, null, mapOf("requestId", id.toString(),
                "modules", modules, "durationMinutes", request.durationMinutes(), "breakGlass", request.breakGlass()));
        if (!request.breakGlass()) {
            tenantEvent(request.tenantId(), actor.userId(), "SUPPORT_ACCESS_REQUESTED", id,
                    mapOf("modules", modules, "durationMinutes", request.durationMinutes(), "reason", reason, "requestedBy", actor.username()));
            notifyAdmins(request.tenantId(), "Solicitud de acceso de soporte",
                    "El equipo de NexoDocs solicita acceso de solo lectura a " + labels(modules) + " durante " + request.durationMinutes()
                            + " minutos. Apruébalo o recházalo en Configuración → Acceso de soporte.", id);
        }
        return find(id, actor.userId(), true);
    }

    /** Quien la pidió (o un superadministrador) la anula; si estaba vigente, el acceso termina ya. */
    @Transactional
    public Request cancel(UUID id, String reasonText) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        Map<String, Object> row = lock(id);
        if (!actor.userId().equals(row.get("requested_by")) && !actor.authorities().contains(PlatformAuthorities.TEAM)) {
            throw new AccessDeniedException("Solo quien la solicitó puede anular la solicitud");
        }
        String status = displayStatus(row);
        if (!Set.of("PENDING_TENANT", "PENDING_INTERNAL", "APPROVED").contains(status)) {
            throw new IllegalStateException("La solicitud ya está cerrada");
        }
        jdbc.update("update support_access_requests set status = 'CANCELED', revoked_at = now(), revoked_by = ? where id = ?", actor.userId(), id);
        UUID tenantId = (UUID) row.get("tenant_id");
        audit.record("SUPPORT_ACCESS_CANCELED", tenantId, reason, mapOf("requestId", id.toString(), "status", status), mapOf("status", "CANCELED"));
        if (!(Boolean) row.get("break_glass") || "APPROVED".equals(status)) {
            tenantEvent(tenantId, actor.userId(), "SUPPORT_ACCESS_CANCELED", id, mapOf("reason", reason));
        }
        return find(id, actor.userId(), true);
    }

    /**
     * Aprobación interna de un acceso de emergencia. Con la de un superadministrador y la de otro rol
     * (personas distintas de quien lo pidió) se activa y se avisa a la organización en ese momento.
     */
    @Transactional
    public Request approveInternal(UUID id, String reasonText) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        Map<String, Object> row = lock(id);
        if (!Boolean.TRUE.equals(row.get("break_glass")) || !"PENDING_INTERNAL".equals(row.get("status"))) {
            throw new IllegalStateException("La solicitud no espera aprobaciones internas");
        }
        if (actor.userId().equals(row.get("requested_by"))) throw new IllegalStateException("No puedes aprobar tu propia solicitud");
        List<String> roles = jdbc.queryForList("select role_code from platform_user_roles where user_id = ?", String.class, actor.userId());
        if (roles.isEmpty()) throw new AccessDeniedException("Tu cuenta no tiene un rol de plataforma");
        Long already = jdbc.queryForObject("select count(*) from support_access_approvals where request_id = ? and approver_id = ?",
                Long.class, id, actor.userId());
        if (already != null && already > 0) throw new IllegalStateException("Ya aprobaste esta solicitud");
        jdbc.update("insert into support_access_approvals (request_id, approver_id, role_code, note) values (?, ?, ?, ?)",
                id, actor.userId(), roles.get(0), reason);
        UUID tenantId = (UUID) row.get("tenant_id");
        audit.record("SUPPORT_ACCESS_INTERNAL_APPROVED", tenantId, reason, null, mapOf("requestId", id.toString(), "role", roles.get(0)));
        List<String> approvalRoles = jdbc.queryForList(
                "select role_code from support_access_approvals where request_id = ? and approver_id <> ?", String.class, id, row.get("requested_by"));
        if (breakGlassReady(approvalRoles)) {
            int minutes = ((Number) row.get("duration_minutes")).intValue();
            jdbc.update("""
                    update support_access_requests set status = 'APPROVED', decided_at = now(), starts_at = now(),
                      expires_at = now() + make_interval(mins => ?) where id = ?
                    """, minutes, id);
            List<String> modules = TenantService.permissionCodes(row.get("modules"));
            audit.record("SUPPORT_ACCESS_BREAK_GLASS_ACTIVATED", tenantId, reason, null,
                    mapOf("requestId", id.toString(), "modules", modules, "durationMinutes", minutes));
            tenantEvent(tenantId, actor.userId(), "SUPPORT_ACCESS_BREAK_GLASS", id,
                    mapOf("modules", modules, "durationMinutes", minutes, "reason", row.get("reason")));
            String message = "El equipo de NexoDocs activó un acceso de emergencia de solo lectura a " + labels(modules) + " durante "
                    + minutes + " minutos, con doble aprobación interna. Motivo: " + row.get("reason")
                    + ". Puedes revocarlo en Configuración → Acceso de soporte.";
            notifyAdmins(tenantId, "Acceso de emergencia de NexoDocs", message, id);
            email(tenantId, "Acceso de emergencia de NexoDocs a tu organización", message);
        }
        return find(id, actor.userId(), true);
    }

    /** Token de la sesión de soporte para quien solicitó el acceso, mientras está vigente. */
    @Transactional
    public Session startSession(UUID id) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        Map<String, Object> row = lock(id);
        if (!actor.userId().equals(row.get("requested_by"))) throw new AccessDeniedException("Solo quien solicitó el acceso puede usarlo");
        if (!"APPROVED".equals(displayStatus(row))) throw new IllegalStateException("El acceso no está aprobado o ya venció");
        UUID tenantId = (UUID) row.get("tenant_id");
        Map<String, Object> tenant = tenant(tenantId);
        if (!ACCESSIBLE.contains(tenant.get("status"))) throw new IllegalStateException("La organización no está operativa");
        List<String> permissions = new ArrayList<>(TenantService.permissionCodes(row.get("permission_codes")));
        permissions.add(PlatformAuthorities.SUPPORT_SESSION);
        Instant expires = PlatformTenantService.instant(row.get("expires_at"));
        String token = jwtService.generateSupportToken(actor.userId(), tenantId, actor.username(), permissions, id, Date.from(expires));
        audit.record("SUPPORT_ACCESS_SESSION_STARTED", tenantId, (String) row.get("reason"), null,
                mapOf("requestId", id.toString(), "expiresAt", expires.toString()));
        tenantEvent(tenantId, actor.userId(), "SUPPORT_SESSION_STARTED", id, mapOf("expiresAt", expires.toString(), "requestedBy", actor.username()));
        return new Session(token, expires, tenantId, (String) tenant.get("name"), List.copyOf(permissions));
    }

    // ---------------------------------------------------------------- tenant

    @Transactional(readOnly = true)
    public List<Request> tenantList() {
        UUID tenantId = context.requireTenantId();
        return list(tenantId, null, false);
    }

    /** Aprobar, rechazar o revocar: lo decide la base (app.decide_support_access) con el contexto del tenant. */
    @Transactional
    public List<Request> decide(UUID id, String decision, String note) {
        AuthenticatedUser user = context.require();
        if (user.supportSession()) throw new AccessDeniedException("Una sesión de soporte no decide accesos de soporte");
        context.establishDatabaseContext();
        entityManager.createNativeQuery("select app.decide_support_access(cast(:id as uuid), :decision, :note)")
                .setParameter("id", id).setParameter("decision", decision)
                .setParameter("note", note == null || note.isBlank() ? null : note.trim())
                .getSingleResult();
        entityManager.createNativeQuery("RESET ROLE").executeUpdate();
        return list(user.tenantId(), null, false);
    }

    // ------------------------------------------------------- sesión de soporte

    /** Vigencia real del acceso, consultada en cada petición de la sesión (el tenant puede revocarlo). */
    public boolean sessionActive(AuthenticatedUser user) {
        if (!user.supportSession()) return false;
        Long active = jdbc.queryForObject("""
                select count(*) from support_access_requests s join tenants t on t.id = s.tenant_id
                where s.id = ? and s.tenant_id = ? and s.requested_by = ? and s.status = 'APPROVED'
                  and s.starts_at <= now() and s.expires_at > now() and s.revoked_at is null
                  and t.subscription_status in ('TRIAL','ACTIVE','PAST_DUE') and t.purged_at is null
                """, Long.class, user.supportAccessId(), user.tenantId(), user.userId());
        return active != null && active > 0;
    }

    /** Cada petición de la sesión queda en la auditoría del tenant, visible para él. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRequest(AuthenticatedUser user, String method, String path, int status, String ip) {
        tenantEvent(user.tenantId(), user.userId(), "SUPPORT_SESSION_" + method, user.supportAccessId(),
                mapOf("method", method, "path", path, "status", status, "actor", user.username(), "ip", ip),
                status < 400 ? "SUCCESS" : "FAILURE");
    }

    /** /auth/me de una sesión de soporte: la cuenta de plataforma, el tenant y la vigencia; nunca un usuario del tenant. */
    public UserResponse currentSupportUser(AuthenticatedUser user) {
        Map<String, Object> row = jdbc.queryForMap("""
                select u.username, u.email, u.first_name, u.last_name, t.name as tenant_name, t.logo_url, s.expires_at
                from support_access_requests s join users u on u.id = s.requested_by join tenants t on t.id = s.tenant_id
                where s.id = ? and s.requested_by = ? and s.tenant_id = ?
                """, user.supportAccessId(), user.userId(), user.tenantId());
        return UserResponse.builder()
                .id(user.userId()).tenantId(user.tenantId()).username((String) row.get("username")).email((String) row.get("email"))
                .firstName((String) row.get("first_name")).lastName((String) row.get("last_name")).status("ACTIVE")
                .tenantName((String) row.get("tenant_name")).tenantLogoUrl((String) row.get("logo_url")).platformAdmin(true)
                .permissions(user.authorities().stream().sorted().toList()).roleNames(Set.of("Soporte NexoDocs"))
                .supportSession(true).supportAccessExpiresAt(PlatformTenantService.instant(row.get("expires_at")))
                .build();
    }

    // ------------------------------------------------------------ utilidades

    private List<Request> list(UUID tenantId, UUID viewer, boolean canUse) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select s.*, t.name as tenant_name, ru.username as requested_by_name,
                  coalesce(du.first_name || ' ' || du.last_name, du.username) as decided_by_name
                from support_access_requests s join tenants t on t.id = s.tenant_id join users ru on ru.id = s.requested_by
                left join users du on du.id = s.decided_by
                where (cast(? as uuid) is null or s.tenant_id = ?)
                order by s.created_at desc limit 100
                """, tenantId, tenantId);
        Map<UUID, List<Approval>> approvals = new HashMap<>();
        if (!rows.isEmpty()) {
            jdbc.queryForList("""
                    select a.request_id, u.username, a.role_code, a.approved_at from support_access_approvals a join users u on u.id = a.approver_id
                    where a.request_id = any(?) order by a.approved_at
                    """, (Object) rows.stream().map(r -> r.get("id")).toArray(UUID[]::new))
                    .forEach(r -> approvals.computeIfAbsent((UUID) r.get("request_id"), k -> new ArrayList<>()).add(new Approval(
                            (String) r.get("username"), (String) r.get("role_code"), PlatformTenantService.instant(r.get("approved_at")))));
        }
        return rows.stream().map(r -> view(r, approvals.getOrDefault((UUID) r.get("id"), List.of()), viewer, canUse)).toList();
    }

    private Request find(UUID id, UUID viewer, boolean canUse) {
        return list(null, viewer, canUse).stream().filter(r -> r.id().equals(id)).findFirst()
                .orElseThrow(() -> new NotFoundException("Solicitud no encontrada"));
    }

    private static Request view(Map<String, Object> r, List<Approval> approvals, UUID viewer, boolean canUse) {
        String status = displayStatus(r);
        boolean mine = viewer != null && viewer.equals(r.get("requested_by"));
        return new Request((UUID) r.get("id"), (UUID) r.get("tenant_id"), (String) r.get("tenant_name"), (String) r.get("requested_by_name"),
                (String) r.get("reason"), TenantService.permissionCodes(r.get("modules")), ((Number) r.get("duration_minutes")).intValue(),
                Boolean.TRUE.equals(r.get("break_glass")), status, (String) r.get("decided_by_name"),
                PlatformTenantService.instant(r.get("decided_at")), (String) r.get("decision_note"),
                PlatformTenantService.instant(r.get("starts_at")), PlatformTenantService.instant(r.get("expires_at")),
                PlatformTenantService.instant(r.get("revoked_at")), PlatformTenantService.instant(r.get("created_at")),
                List.copyOf(approvals), mine, mine && canUse && "APPROVED".equals(status));
    }

    /** Una aprobada cuyo plazo terminó se muestra como EXPIRED (la base ya no la reconoce). */
    static String displayStatus(Map<String, Object> row) {
        String status = (String) row.get("status");
        Instant expires = PlatformTenantService.instant(row.get("expires_at"));
        return "APPROVED".equals(status) && (expires == null || !expires.isAfter(Instant.now())) ? "EXPIRED" : status;
    }

    /** Misma regla que el trigger de la base: dos aprobaciones, una de superadministrador y otra de otro rol. */
    static boolean breakGlassReady(List<String> approvalRoles) {
        return approvalRoles.size() >= 2 && approvalRoles.contains("SUPERADMIN")
                && approvalRoles.stream().anyMatch(role -> !"SUPERADMIN".equals(role));
    }

    static List<String> permissionsFor(List<String> modules) {
        if (modules.isEmpty()) throw new IllegalArgumentException("Elige al menos un módulo");
        return modules.stream().flatMap(m -> MODULES.get(m).permissions().stream()).distinct().sorted().toList();
    }

    private static String labels(List<String> modules) {
        return String.join(", ", modules.stream().map(m -> MODULES.containsKey(m) ? MODULES.get(m).label() : m).toList());
    }

    private Map<String, Object> lock(UUID id) {
        List<Map<String, Object>> rows = jdbc.queryForList("select * from support_access_requests where id = ? for update", id);
        if (rows.isEmpty()) throw new NotFoundException("Solicitud no encontrada");
        return rows.get(0);
    }

    private Map<String, Object> tenant(UUID tenantId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select id, name, email, subscription_status::text as status, purged_at from tenants where id = ?", tenantId);
        if (rows.isEmpty()) throw new NotFoundException("Organización no encontrada");
        return rows.get(0);
    }

    private void tenantEvent(UUID tenantId, UUID platformActor, String action, UUID requestId, Map<String, Object> details) {
        tenantEvent(tenantId, platformActor, action, requestId, details, "SUCCESS");
    }

    /** Evento en la auditoría del tenant con el actor de plataforma (platform_actor_id), sin usuario del tenant. */
    private void tenantEvent(UUID tenantId, UUID platformActor, String action, UUID requestId, Map<String, Object> details, String result) {
        try {
            jdbc.update("""
                    insert into audit_events (tenant_id, platform_actor_id, action, entity_type, entity_id, result, details)
                    values (?, ?, ?, 'support_access_requests', ?, ?, cast(? as jsonb))
                    """, tenantId, platformActor, action, requestId, result,
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(details));
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo registrar el evento de soporte", exception);
        }
    }

    private void notifyAdmins(UUID tenantId, String title, String message, UUID requestId) {
        jdbc.update("""
                insert into notifications (tenant_id, user_id, type, title, message, related_entity_type, related_entity_id)
                select distinct u.tenant_id, u.id, 'SUPPORT_ACCESS', ?, ?, 'support_access_requests', ?
                from users u
                join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
                join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
                where u.tenant_id = ? and u.deleted_at is null and u.status = 'ACTIVE' and r.name = 'Administrador de tenant'
                """, title, message, requestId, tenantId);
    }

    private void email(UUID tenantId, String subject, String body) {
        if (mailSender == null) return;
        String to = (String) tenant(tenantId).get("email");
        if (to == null || to.isBlank()) return;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (RuntimeException exception) {
            log.warn("No se pudo enviar el aviso de acceso de emergencia a {}: {}", tenantId, exception.getMessage());
        }
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }
}
