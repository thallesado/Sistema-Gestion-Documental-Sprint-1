package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

/**
 * Registro de tokens FCM del dispositivo del usuario autenticado. Tenant y usuario salen siempre del
 * JWT validado, nunca del cuerpo de la petición; RLS impide tocar tokens de otros usuarios.
 */
@Service
@Transactional
public class PushTokenService {

    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;

    public PushTokenService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context) {
        this.db = db;
        this.context = context;
    }

    /**
     * Alta o actualización (upsert por token). Un token que ya pertenece a otra cuenta no es visible
     * para este usuario por RLS: en ese caso el servidor responde 409 y la app lo reintentará al
     * iniciar sesión o al cambiar de token.
     */
    public void register(String platform, String token) {
        Map<String, Object> p = scope(Map.of("platform", platform, "token", token.trim()));
        try {
            db.update("""
                    INSERT INTO user_push_tokens (tenant_id, user_id, platform, token, is_active, last_used_at)
                    VALUES (:tenant, :user, :platform, :token, true, now())
                    ON CONFLICT (token) DO UPDATE
                      SET platform = EXCLUDED.platform, is_active = true, last_used_at = now()
                      WHERE user_push_tokens.tenant_id = EXCLUDED.tenant_id
                        AND user_push_tokens.user_id = EXCLUDED.user_id
                    """, p);
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este dispositivo ya está registrado para otra cuenta");
        }
    }

    /** Baja del token del usuario actual (al cerrar sesión). Idempotente. */
    public void delete(String token) {
        db.update("DELETE FROM user_push_tokens WHERE tenant_id = :tenant AND user_id = :user AND token = :token",
                scope(Map.of("token", token.trim())));
    }

    private Map<String, Object> scope(Map<String, Object> values) {
        context.establishDatabaseContext();
        Map<String, Object> p = new HashMap<>(values);
        p.put("tenant", context.requireTenantId());
        p.put("user", context.requireUserId());
        return p;
    }
}
