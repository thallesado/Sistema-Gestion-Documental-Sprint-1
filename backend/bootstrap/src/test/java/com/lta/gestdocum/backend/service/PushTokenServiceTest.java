package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PushTokenServiceTest {

    private static final UUID TENANT_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TENANT_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID USER_A = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");

    private final NamedParameterJdbcTemplate db = mock(NamedParameterJdbcTemplate.class);
    private final AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
    private final PushTokenService service = new PushTokenService(db, context);

    private void authenticateAs(UUID tenant, UUID user) {
        when(context.requireTenantId()).thenReturn(tenant);
        when(context.requireUserId()).thenReturn(user);
        // Por defecto el upsert afecta una fila, como en PostgreSQL al dar de alta o reactivar.
        when(db.update(anyString(), anyMap())).thenReturn(1);
    }

    @Test
    void registroHaceUpsertPorTokenConTenantYUsuarioDelJwt() {
        authenticateAs(TENANT_A, USER_A);

        service.register("ANDROID", "  token-1  ");

        verify(context).establishDatabaseContext();
        verify(db).update(
                contains("ON CONFLICT (token) DO UPDATE"),
                argThatMap(p -> TENANT_A.equals(p.get("tenant")) && USER_A.equals(p.get("user"))
                        && "ANDROID".equals(p.get("platform")) && "token-1".equals(p.get("token"))));
    }

    @Test
    void elUpsertSoloActualizaFilasDelMismoTenantYUsuario() {
        authenticateAs(TENANT_A, USER_A);
        service.register("ANDROID", "token-1");
        verify(db).update(
                contains("WHERE user_push_tokens.tenant_id = EXCLUDED.tenant_id"),
                anyMap());
    }

    @Test
    void tokenDeOtraCuentaDevuelveConflicto() {
        authenticateAs(TENANT_A, USER_A);
        when(db.update(anyString(), anyMap())).thenThrow(new DuplicateKeyException("duplicate"));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.register("ANDROID", "token-ajeno"));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    /**
     * Comprobado en PostgreSQL 17: si el token ya es de otra cuenta, el WHERE del ON CONFLICT descarta la
     * actualización y la sentencia afecta 0 filas sin lanzar error. Eso también debe ser un 409.
     */
    @Test
    void tokenDeOtraCuentaSinErrorDeBaseDevuelveConflicto() {
        authenticateAs(TENANT_A, USER_A);
        when(db.update(anyString(), anyMap())).thenReturn(0);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.register("ANDROID", "token-ajeno"));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void bajaSoloDelUsuarioAutenticadoYDeSuTenant() {
        authenticateAs(TENANT_B, USER_A);

        service.delete("token-1");

        verify(db).update(
                eq("DELETE FROM user_push_tokens WHERE tenant_id = :tenant AND user_id = :user AND token = :token"),
                argThatMap(p -> TENANT_B.equals(p.get("tenant")) && USER_A.equals(p.get("user"))
                        && "token-1".equals(p.get("token"))));
    }

    /** Coincidencia de mapas de parámetros sin ambigüedad de sobrecargas. */
    private static Map<String, Object> argThatMap(java.util.function.Predicate<Map<String, Object>> predicate) {
        return org.mockito.ArgumentMatchers.argThat(map -> map != null && predicate.test(map));
    }
}
