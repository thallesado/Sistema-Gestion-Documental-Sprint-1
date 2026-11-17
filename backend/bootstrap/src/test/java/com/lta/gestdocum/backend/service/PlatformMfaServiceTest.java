package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.Totp;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Doble factor obligatorio de las cuentas de plataforma: la contraseña sola no abre sesión. */
class PlatformMfaServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final JwtService jwt = new JwtService("0123456789abcdef0123456789abcdef-secret", 3_600_000L, 7_200_000L);
    private final UUID userId = UUID.randomUUID();
    private PlatformMfaService mfa;

    @BeforeEach
    void setUp() {
        mfa = new PlatformMfaService(jdbc, jwt, "", "0123456789abcdef0123456789abcdef-secret", true);
    }

    private User platformUser() {
        return User.builder().id(userId).username("root").email("root@nexodocs.test").passwordHash("hash")
                .status(UserStatus.ACTIVE).isPlatformAdmin(true).build();
    }

    private void storedMfa(String secret, boolean enabled, Long lastStep, int failures, Instant lockedUntil) {
        Map<String, Object> row = new HashMap<>();
        row.put("secret_enc", mfa.encrypt(secret));
        row.put("enabled_at", enabled ? Timestamp.from(Instant.now()) : null);
        row.put("last_used_step", lastStep);
        row.put("failed_attempts", failures);
        row.put("locked_until", lockedUntil == null ? null : Timestamp.from(lockedUntil));
        when(jdbc.queryForList(contains("for update"), eq(userId))).thenReturn(List.of(row));
        when(jdbc.queryForList(startsWith("select enabled_at"), eq(userId))).thenReturn(List.of(row));
    }

    @Test
    void secretIsEncryptedAtRest() {
        String secret = Totp.newSecret();
        String stored = mfa.encrypt(secret);
        assertTrue(stored.startsWith("v1:"));
        assertFalse(stored.contains(secret));
        assertEquals(secret, mfa.decrypt(stored));
        assertNotEquals(stored, mfa.encrypt(secret), "Cada cifrado usa un IV nuevo");
    }

    @Test
    void firstLoginReturnsAnEnrollmentChallengeWithoutTokens() {
        when(jdbc.queryForList(startsWith("select enabled_at"), eq(userId))).thenReturn(List.of());
        AuthResponse challenge = mfa.challenge(platformUser());
        assertNull(challenge.getToken());
        assertNull(challenge.getRefreshToken());
        assertTrue(challenge.isMfaRequired());
        assertTrue(challenge.isMfaSetupRequired());
        assertNotNull(challenge.getMfaSecret());
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("insert into platform_user_mfa"), args.capture());
        assertNotEquals(challenge.getMfaSecret(), args.getValue()[1], "El secreto no se guarda en claro");
    }

    @Test
    void enrolledAccountGetsAVerifyChallengeWithoutSecret() {
        storedMfa(Totp.newSecret(), true, null, 0, null);
        AuthResponse challenge = mfa.challenge(platformUser());
        assertTrue(challenge.isMfaRequired());
        assertFalse(challenge.isMfaSetupRequired());
        assertNull(challenge.getMfaSecret());
        assertNull(challenge.getToken());
    }

    @Test
    void correctCodeVerifiesAndRecordsTheStep() {
        String secret = Totp.newSecret();
        storedMfa(secret, true, null, 0, null);
        String token = jwt.generateMfaToken(userId, "root", PlatformMfaService.PURPOSE_VERIFY, 60_000);
        assertEquals(userId, mfa.verify(token, Totp.code(secret, Totp.step(Instant.now().getEpochSecond())), PlatformMfaService.PURPOSE_VERIFY));
        verify(jdbc).update(contains("set last_used_step = ?"), anyLong(), eq(userId));
    }

    @Test
    void wrongCodeCountsAndTheFifthLocksTheAccount() {
        storedMfa(Totp.newSecret(), true, null, 4, null);
        String token = jwt.generateMfaToken(userId, "root", PlatformMfaService.PURPOSE_VERIFY, 60_000);
        assertThrows(InvalidCredentialsException.class, () -> mfa.verify(token, "000000", PlatformMfaService.PURPOSE_VERIFY));
        ArgumentCaptor<Object> locked = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(contains("set failed_attempts = ?"), any(), locked.capture(), eq(userId));
        assertNotNull(locked.getValue(), "El quinto fallo bloquea la cuenta");
    }

    @Test
    void lockedAccountIsRejectedEvenWithTheRightCode() {
        String secret = Totp.newSecret();
        storedMfa(secret, true, null, 0, Instant.now().plus(10, ChronoUnit.MINUTES));
        String token = jwt.generateMfaToken(userId, "root", PlatformMfaService.PURPOSE_VERIFY, 60_000);
        assertThrows(ResponseStatusException.class, () -> mfa.verify(token,
                Totp.code(secret, Totp.step(Instant.now().getEpochSecond())), PlatformMfaService.PURPOSE_VERIFY));
    }

    @Test
    void anAccessTokenIsNotAnMfaChallengeAndViceVersa() {
        String access = jwt.generateToken(userId, null, "root", List.of("platform:tenant:manage"));
        assertThrows(InvalidCredentialsException.class, () -> mfa.verify(access, "123456", PlatformMfaService.PURPOSE_VERIFY));
        String challenge = jwt.generateMfaToken(userId, "root", PlatformMfaService.PURPOSE_VERIFY, 60_000);
        assertThrows(RuntimeException.class, () -> jwt.extractAuthenticatedUser(challenge));
        String enroll = jwt.generateMfaToken(userId, "root", PlatformMfaService.PURPOSE_ENROLL, 60_000);
        assertThrows(InvalidCredentialsException.class, () -> mfa.verify(enroll, "123456", PlatformMfaService.PURPOSE_VERIFY));
    }

    @Test
    void platformLoginStopsAtTheChallenge() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.matches(anyString(), anyString())).thenReturn(true);
        when(users.findByPlatformIdentifier("root")).thenReturn(Optional.of(platformUser()));
        AuthSessionService sessions = mock(AuthSessionService.class);
        AuthService auth = new AuthService(users, mock(TenantRepository.class), mock(PlanRepository.class), encoder, jwt, sessions,
                mock(AccessTokenRevocationService.class));
        PlatformRoleService roles = mock(PlatformRoleService.class);
        when(roles.authoritiesFor(userId)).thenReturn(List.of("platform:tenant:manage"));
        auth.setPlatformRoleService(roles);
        auth.setPlatformMfaService(mfa);
        when(jdbc.queryForList(startsWith("select enabled_at"), eq(userId))).thenReturn(List.of());
        AuthRequest request = new AuthRequest();
        request.setUsernameOrEmail("root");
        request.setPassword("x");

        AuthResponse response = auth.login(request);

        assertNull(response.getToken());
        assertTrue(response.isMfaRequired());
        verify(sessions, never()).issue(any(), anyString(), anyLong());
    }

    @Test
    void platformAccountWithoutRoleCannotLogIn() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.matches(anyString(), anyString())).thenReturn(true);
        when(users.findByPlatformIdentifier("root")).thenReturn(Optional.of(platformUser()));
        AuthService auth = new AuthService(users, mock(TenantRepository.class), mock(PlanRepository.class), encoder, jwt,
                mock(AuthSessionService.class), mock(AccessTokenRevocationService.class));
        PlatformRoleService roles = mock(PlatformRoleService.class);
        when(roles.authoritiesFor(userId)).thenReturn(List.of());
        auth.setPlatformRoleService(roles);
        AuthRequest request = new AuthRequest();
        request.setUsernameOrEmail("root");
        request.setPassword("x");
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> auth.login(request));
    }
}
