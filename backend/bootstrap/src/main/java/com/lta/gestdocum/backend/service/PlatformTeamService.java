package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PlatformTeamDtos.*;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Equipo de plataforma (/platform/team, 066): alta de cuentas internas, rol, activación y reinicio del
 * doble factor. Solo el superadministrador (platform:team:manage). Siempre queda al menos un
 * superadministrador activo y nadie cambia su propio rol ni se desactiva a sí mismo.
 */
@Service
public class PlatformTeamService {
    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;
    private final PasswordEncoder passwordEncoder;
    private final PlatformMfaService mfa;
    private final AuthSessionService sessions;

    public PlatformTeamService(JdbcTemplate jdbc, PlatformAuditService audit, PasswordEncoder passwordEncoder,
                               PlatformMfaService mfa, AuthSessionService sessions) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.passwordEncoder = passwordEncoder;
        this.mfa = mfa;
        this.sessions = sessions;
    }

    @Transactional(readOnly = true)
    public Team team() {
        audit.requirePlatformAccount();
        List<Member> members = jdbc.queryForList("""
                select u.id, u.first_name, u.last_name, u.username, u.email, r.role_code, u.status::text as status, u.last_login_at,
                  u.created_at, (m.enabled_at is not null) as mfa_enabled
                from users u left join platform_user_roles r on r.user_id = u.id left join platform_user_mfa m on m.user_id = u.id
                where u.tenant_id is null and u.is_platform_admin and u.deleted_at is null
                order by u.status, u.first_name, u.last_name
                """).stream().map(r -> new Member((UUID) r.get("id"),
                (Objects.toString(r.get("first_name"), "") + " " + Objects.toString(r.get("last_name"), "")).trim(),
                (String) r.get("username"), (String) r.get("email"), (String) r.get("role_code"), (String) r.get("status"),
                PlatformTenantService.instant(r.get("last_login_at")), Boolean.TRUE.equals(r.get("mfa_enabled")),
                PlatformTenantService.instant(r.get("created_at")))).toList();
        Map<String, List<String>> authorities = new LinkedHashMap<>();
        jdbc.queryForList("select role_code, authority from platform_role_authorities order by authority")
                .forEach(r -> authorities.computeIfAbsent((String) r.get("role_code"), k -> new ArrayList<>()).add((String) r.get("authority")));
        List<Role> roles = jdbc.queryForList("select code, name, description from platform_roles order by sort_order").stream()
                .map(r -> new Role((String) r.get("code"), (String) r.get("name"), (String) r.get("description"),
                        List.copyOf(authorities.getOrDefault((String) r.get("code"), List.of())))).toList();
        return new Team(members, roles);
    }

    /** Alta con contraseña temporal: al entrar la cambia y registra su doble factor. */
    @Transactional
    public Team create(MemberCreate request) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Long existing = jdbc.queryForObject("""
                select count(*) from users where tenant_id is null and (lower(username) in (?, ?) or lower(email) in (?, ?))
                """, Long.class, username, email, username, email);
        if (existing != null && existing > 0) throw new IllegalArgumentException("Ya existe una cuenta de plataforma con ese usuario o correo");
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into users (id, tenant_id, username, email, password_hash, first_name, last_name, status, is_platform_admin, must_change_password)
                values (?, null, ?, ?, ?, ?, ?, 'ACTIVE', true, true)
                """, id, username, email, passwordEncoder.encode(request.temporaryPassword()), request.firstName().trim(), request.lastName().trim());
        jdbc.update("insert into platform_user_roles (user_id, role_code, assigned_by) values (?, ?, ?)", id, request.roleCode(), actor.userId());
        audit.record("PLATFORM_USER_CREATED", null, reason, null,
                mapOf("userId", id.toString(), "username", username, "email", email, "role", request.roleCode()));
        return team();
    }

    @Transactional
    public Team changeRole(UUID userId, RoleChange request) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        if (userId.equals(actor.userId())) throw new IllegalStateException("No puedes cambiar tu propio rol");
        Map<String, Object> member = lockMember(userId);
        String previous = (String) member.get("role_code");
        if (request.roleCode().equals(previous)) throw new IllegalArgumentException("La cuenta ya tiene ese rol");
        if ("SUPERADMIN".equals(previous)) assertAnotherActiveSuperadmin(userId);
        jdbc.update("""
                insert into platform_user_roles (user_id, role_code, assigned_by, assigned_at) values (?, ?, ?, now())
                on conflict (user_id) do update set role_code = excluded.role_code, assigned_by = excluded.assigned_by, assigned_at = now()
                """, userId, request.roleCode(), actor.userId());
        // Las autoridades viajan en el JWT: la cuenta vuelve a entrar con su rol nuevo.
        sessions.revokeAll(userId);
        audit.record("PLATFORM_USER_ROLE_CHANGED", null, reason, mapOf("userId", userId.toString(), "role", previous),
                mapOf("userId", userId.toString(), "role", request.roleCode()));
        return team();
    }

    @Transactional
    public Team changeStatus(UUID userId, StatusChange request) {
        AuthenticatedUser actor = audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        if (userId.equals(actor.userId())) throw new IllegalStateException("No puedes desactivar tu propia cuenta");
        Map<String, Object> member = lockMember(userId);
        String previous = (String) member.get("status");
        if (request.status().equals(previous)) throw new IllegalArgumentException("La cuenta ya está en ese estado");
        if ("INACTIVE".equals(request.status()) && "SUPERADMIN".equals(member.get("role_code"))) assertAnotherActiveSuperadmin(userId);
        jdbc.update("update users set status = cast(? as user_status), updated_at = now() where id = ?", request.status(), userId);
        if ("INACTIVE".equals(request.status())) sessions.revokeAll(userId);
        audit.record("PLATFORM_USER_STATUS_CHANGED", null, reason, mapOf("userId", userId.toString(), "status", previous),
                mapOf("userId", userId.toString(), "status", request.status()));
        return team();
    }

    /** Teléfono perdido o cambiado: la cuenta registra un doble factor nuevo en su próximo inicio de sesión. */
    @Transactional
    public Team resetMfa(UUID userId, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        lockMember(userId);
        mfa.reset(userId);
        sessions.revokeAll(userId);
        audit.record("PLATFORM_USER_MFA_RESET", null, reason, null, mapOf("userId", userId.toString()));
        return team();
    }

    private Map<String, Object> lockMember(UUID userId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select u.id, u.status::text as status, r.role_code from users u left join platform_user_roles r on r.user_id = u.id
                where u.id = ? and u.tenant_id is null and u.is_platform_admin and u.deleted_at is null for update of u
                """, userId);
        if (rows.isEmpty()) throw new NotFoundException("Cuenta de plataforma no encontrada");
        return rows.get(0);
    }

    private void assertAnotherActiveSuperadmin(UUID userId) {
        Long others = jdbc.queryForObject("""
                select count(*) from users u join platform_user_roles r on r.user_id = u.id
                where r.role_code = 'SUPERADMIN' and u.status = 'ACTIVE' and u.deleted_at is null and u.id <> ?
                """, Long.class, userId);
        if (others == null || others == 0) throw new IllegalStateException("Debe quedar al menos un superadministrador activo");
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }
}
