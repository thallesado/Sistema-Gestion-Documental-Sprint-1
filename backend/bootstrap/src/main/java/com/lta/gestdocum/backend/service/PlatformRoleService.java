package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.PlatformAuthorities;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Autoridades de una cuenta de plataforma según su rol interno (066). Una cuenta sin rol no tiene
 * autoridades y no puede iniciar sesión. Lee con el usuario de conexión: nexodocs_app no ve estas tablas.
 */
@Service
public class PlatformRoleService {
    private static final Logger log = LoggerFactory.getLogger(PlatformRoleService.class);

    private final JdbcTemplate jdbc;

    public PlatformRoleService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<String> authoritiesFor(UUID platformUserId) {
        try {
            return jdbc.queryForList("""
                    select a.authority from platform_user_roles r join platform_role_authorities a on a.role_code = r.role_code
                    where r.user_id = ? order by a.authority
                    """, String.class, platformUserId);
        } catch (DataAccessException missing) {
            // Base sin 066: el comportamiento anterior (todas las cuentas de plataforma con las mismas autoridades).
            log.warn("Roles de plataforma no disponibles ({}); se usan las autoridades fijas", missing.getClass().getSimpleName());
            return PlatformAuthorities.CODES;
        }
    }

    /** Rol interno de la cuenta, o null. */
    public String roleOf(UUID platformUserId) {
        try {
            List<String> roles = jdbc.queryForList("select role_code from platform_user_roles where user_id = ?", String.class, platformUserId);
            return roles.isEmpty() ? null : roles.get(0);
        } catch (DataAccessException missing) {
            return null;
        }
    }
}
