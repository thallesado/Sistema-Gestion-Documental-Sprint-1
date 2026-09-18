package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.AuthSession;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.AuthSessionRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthSessionServiceTest {
    private final AuthSessionRepository repository = mock(AuthSessionRepository.class);
    private final AuthSessionService service = new AuthSessionService(repository);

    @Test
    void storesOnlyRefreshTokenHash() {
        User user = user();
        service.issue(user, "refresh-token-raw", 60_000);

        ArgumentCaptor<AuthSession> captor = ArgumentCaptor.forClass(AuthSession.class);
        verify(repository).save(captor.capture());
        assertNotEquals("refresh-token-raw", captor.getValue().getRefreshTokenHash());
        assertEquals(64, captor.getValue().getRefreshTokenHash().length());
    }

    @Test
    void rotatesOnceAndLinksReplacement() {
        User user = user();
        AuthSession current = AuthSession.builder().id(UUID.randomUUID()).userId(user.getId())
                .tenantId(user.getTenantId()).refreshTokenHash(AuthSessionService.hash("old"))
                .createdAt(OffsetDateTime.now().minusMinutes(1))
                .expiresAt(OffsetDateTime.now().plusHours(1)).build();
        when(repository.findByRefreshTokenHash(AuthSessionService.hash("old")))
                .thenReturn(Optional.of(current));

        service.rotate(user, "old", "new", 60_000);

        assertNotNull(current.getRevokedAt());
        assertNotNull(current.getReplacedBy());
        verify(repository, times(2)).save(any(AuthSession.class));
    }

    @Test
    void reuseRevokesAllSessions() {
        User user = user();
        AuthSession revoked = AuthSession.builder().id(UUID.randomUUID()).userId(user.getId())
                .tenantId(user.getTenantId()).refreshTokenHash(AuthSessionService.hash("old"))
                .createdAt(OffsetDateTime.now().minusMinutes(2))
                .expiresAt(OffsetDateTime.now().plusHours(1))
                .revokedAt(OffsetDateTime.now().minusMinutes(1)).build();
        when(repository.findByRefreshTokenHash(AuthSessionService.hash("old")))
                .thenReturn(Optional.of(revoked));

        assertThrows(InvalidCredentialsException.class,
                () -> service.rotate(user, "old", "new", 60_000));
        verify(repository).revokeAllByUserId(eq(user.getId()), any(OffsetDateTime.class));
    }

    private User user() {
        return User.builder().id(UUID.randomUUID()).tenantId(UUID.randomUUID())
                .username("test").email("test@example.com").passwordHash("hash")
                .firstName("Test").lastName("User").status(User.UserStatus.ACTIVE).build();
    }
}
