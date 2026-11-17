package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.RefreshTokenRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceIsolatedRefreshTest {
    @Test
    void refreshReadsUserAndRotatesSessionInsideRegisteredTenantRoute() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).tenantId(tenantId).username("operator")
                .email("operator@example.test").firstName("Test").lastName("User")
                .status(UserStatus.ACTIVE).build();
        UserRepository users = mock(UserRepository.class);
        TenantRepository tenants = mock(TenantRepository.class);
        PlanRepository plans = mock(PlanRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        AuthSessionService sessions = mock(AuthSessionService.class);
        AccessTokenRevocationService revocations = mock(AccessTokenRevocationService.class);
        TenantDatabaseLifecycleService lifecycle = mock(TenantDatabaseLifecycleService.class);
        JdbcTemplate tenantJdbc = mock(JdbcTemplate.class);
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(lifecycle.isTenantLoginAllowed(tenantId)).thenReturn(true);
        when(lifecycle.isIsolatedTenant(tenantId)).thenReturn(true);
        when(jwt.extractRefreshIdentity("refresh-token"))
                .thenReturn(new JwtService.RefreshIdentity(userId, tenantId, "operator"));
        when(jwt.generateToken(eq(userId), eq(tenantId), eq("operator"), anyCollection())).thenReturn("access-token");
        when(jwt.generateRefreshToken(userId, tenantId, "operator")).thenReturn("replacement-token");
        when(jwt.getExpiration()).thenReturn(1000L);
        when(jwt.getRefreshExpiration()).thenReturn(2000L);
        when(tenantJdbc.query(anyString(), any(RowMapper.class), any(), any())).thenAnswer(invocation -> {
            TenantDatabaseContext.Route route = TenantDatabaseContext.current();
            assertNotNull(route);
            assertEquals(tenantId, route.tenantId());
            return List.of(user);
        });
        when(users.findAuthorityCodes(userId, tenantId)).thenReturn(List.of("document:read"));
        when(plans.findEnabledFeatureKeysByTenantId(tenantId)).thenReturn(List.of());

        AuthService service = new AuthService(users, tenants, plans, encoder, jwt, sessions, revocations);
        service.setTenantDatabaseLifecycleService(lifecycle);
        service.setTenantLoginInfrastructure(tenantJdbc, txManager);
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("refresh-token");

        var response = service.refresh(request);

        assertEquals("access-token", response.getToken());
        assertEquals("replacement-token", response.getRefreshToken());
        verify(sessions).rotate(eq(user), eq("refresh-token"), eq("replacement-token"), eq(2000L));
        verify(users, never()).findByTenantAndIdentifier(any(), any());
        verify(tenantJdbc).execute("SET LOCAL ROLE nexodocs_app");
    }
}
