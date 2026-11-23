package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.RefreshTokenRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
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
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void refreshReadsUserAndRotatesSessionInsideRegisteredTenantRoute(boolean isolated) {
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
        when(lifecycle.isIsolatedTenant(tenantId)).thenReturn(isolated);
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
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void tenantLoginUsesRestrictedLookupAndRejectsWrongPassword(boolean isolated) {
        UUID tenantId = UUID.randomUUID(), userId = UUID.randomUUID();
        User user = User.builder().id(userId).tenantId(tenantId).username("operator")
                .passwordHash("test-hash").status(UserStatus.ACTIVE).build();
        UserRepository users = mock(UserRepository.class);
        PlanRepository plans = mock(PlanRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        AuthSessionService sessions = mock(AuthSessionService.class);
        TenantDatabaseLifecycleService lifecycle = mock(TenantDatabaseLifecycleService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PlatformTransactionManager tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(lifecycle.isTenantLoginAllowed(tenantId)).thenReturn(true);
        when(lifecycle.isIsolatedTenant(tenantId)).thenReturn(isolated);
        when(jdbc.query(anyString(), any(RowMapper.class), any(), any())).thenAnswer(invocation -> {
            assertEquals(tenantId, TenantDatabaseContext.current().tenantId());
            assertEquals("SELECT * FROM app.lookup_tenant_login(?::uuid, ?::text)", invocation.getArgument(0));
            return List.of(user);
        });
        when(users.findAuthorityCodes(userId, tenantId)).thenReturn(List.of("document:read"));
        when(plans.findEnabledFeatureKeysByTenantId(tenantId)).thenReturn(List.of());
        when(encoder.matches("valid-password", "test-hash")).thenReturn(true);
        when(jwt.generateToken(eq(userId), eq(tenantId), eq("operator"), anyCollection())).thenReturn("access-token");
        AuthService service = new AuthService(users, mock(TenantRepository.class), plans, encoder, jwt,
                sessions, mock(AccessTokenRevocationService.class));
        service.setTenantDatabaseLifecycleService(lifecycle);
        service.setTenantLoginInfrastructure(jdbc, tx);
        AuthRequest request = new AuthRequest();
        request.setTenantId(tenantId);
        request.setUsernameOrEmail("operator");
        request.setPassword("valid-password");
        assertEquals("access-token", service.login(request).getToken());
        verify(users, never()).findByTenantAndIdentifier(any(), any());
        request.setPassword("wrong-password");
        org.junit.jupiter.api.Assertions.assertThrows(InvalidCredentialsException.class, () -> service.login(request));
        org.junit.jupiter.api.Assertions.assertNull(TenantDatabaseContext.current());
        verify(sessions).issue(eq(user), any(), org.mockito.ArgumentMatchers.anyLong());
    }

}
