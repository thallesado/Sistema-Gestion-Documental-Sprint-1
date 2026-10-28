package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCustomizationDtos.UserCustomizationRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.UserCustomizationRepository;
import com.lta.gestdocum.backend.repository.UserCustomizationRepository.Row;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Personalización de usuarios (user:customize): validación, aplicación de acceso y límites documentales. */
class UserCustomizationServiceTest {

    private static final ZoneId LA_PAZ = ZoneId.of("America/La_Paz");
    private final UUID tenantId = UUID.randomUUID();
    private final UUID adminId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();

    private UserCustomizationRepository repository;
    private UserRepository users;
    private AuthenticatedUserContext context;
    private AuthSessionService sessions;
    private UserCustomizationService service;
    private User target;

    @BeforeEach
    void setUp() {
        repository = mock(UserCustomizationRepository.class);
        users = mock(UserRepository.class);
        context = mock(AuthenticatedUserContext.class);
        sessions = mock(AuthSessionService.class);
        service = new UserCustomizationService(repository, users, context, sessions);
        target = User.builder().id(targetId).tenantId(tenantId).username("ana").email("ana@org.test")
                .firstName("Ana").lastName("Pérez").passwordHash("hash").status(UserStatus.ACTIVE).build();
        when(context.requireTenantId()).thenReturn(tenantId);
        when(context.requireUserId()).thenReturn(adminId);
        when(users.findByIdAndTenantIdAndDeletedAtIsNull(targetId, tenantId)).thenReturn(Optional.of(target));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(repository.find(tenantId, targetId)).thenReturn(Optional.empty());
        when(repository.findAllowedDocumentTypes(any(), any())).thenReturn(Set.of());
        when(repository.tenantTimezone(tenantId)).thenReturn(Optional.of("America/La_Paz"));
    }

    private UserCustomizationRequest request(LocalDate expires, Set<Integer> days, LocalTime start, LocalTime end,
                                             String landing, Set<UUID> types, boolean mustChange) {
        return new UserCustomizationRequest("Archivista", "+591 700", "Bio", "en", landing, false, true, mustChange,
                expires, days, start, end, 10, 500, types);
    }

    @Test
    void policyRejectsExpiredAccessAndOutsideSchedule() {
        UserAccessPolicy policy = new UserAccessPolicy(LocalDate.of(2026, 10, 30), Set.of(1, 2, 3, 4, 5),
                LocalTime.of(8, 0), LocalTime.of(18, 0));
        // Martes 27/10/2026 a las 10:00: dentro.
        assertNull(policy.denialReason(ZonedDateTime.of(2026, 10, 27, 10, 0, 0, 0, LA_PAZ)));
        // Martes a las 19:00: fuera de hora.
        assertNotNull(policy.denialReason(ZonedDateTime.of(2026, 10, 27, 19, 0, 0, 0, LA_PAZ)));
        // Sábado 31/10: vencido (y además fin de semana).
        assertTrue(policy.denialReason(ZonedDateTime.of(2026, 10, 31, 10, 0, 0, 0, LA_PAZ)).contains("venció"));
        // Domingo 25/10 a las 10:00: día no permitido.
        assertNotNull(policy.denialReason(ZonedDateTime.of(2026, 10, 25, 10, 0, 0, 0, LA_PAZ)));
    }

    @Test
    void overnightScheduleBelongsToTheStartingDay() {
        UserAccessPolicy night = new UserAccessPolicy(null, Set.of(5), LocalTime.of(22, 0), LocalTime.of(6, 0));
        // Viernes 30/10 23:00 y sábado 31/10 03:00 pertenecen al turno del viernes.
        assertNull(night.denialReason(ZonedDateTime.of(2026, 10, 30, 23, 0, 0, 0, LA_PAZ)));
        assertNull(night.denialReason(ZonedDateTime.of(2026, 10, 31, 3, 0, 0, 0, LA_PAZ)));
        // Viernes 03:00 pertenece al turno del jueves, que no está permitido.
        assertNotNull(night.denialReason(ZonedDateTime.of(2026, 10, 30, 3, 0, 0, 0, LA_PAZ)));
    }

    @Test
    void loginIsDeniedWhenAccessExpired() {
        when(repository.find(tenantId, targetId)).thenReturn(Optional.of(new Row(null, null, null,
                LocalDate.now(LA_PAZ).minusDays(1), Set.of(), null, null, null, null)));
        AccessDeniedException error = assertThrows(AccessDeniedException.class, () -> service.assertAccessAllowed(target));
        assertTrue(error.getMessage().contains("venció"));
    }

    @Test
    void loginWithoutCustomizationIsAllowed() {
        assertDoesNotThrow(() -> service.assertAccessAllowed(target));
    }

    @Test
    void updateStoresValuesAndRevokesSessionsWhenAccessChanges() {
        UUID typeId = UUID.randomUUID();
        when(repository.countActiveDocumentTypes(eq(tenantId), anyCollection())).thenReturn(1);
        service.update(targetId, request(LocalDate.now().plusDays(30), Set.of(1, 2), LocalTime.of(8, 0),
                LocalTime.of(17, 0), "/documents", Set.of(typeId), true));

        verify(repository).upsert(eq(tenantId), eq(targetId), argThat(row -> "Archivista".equals(row.jobTitle())
                && "/documents".equals(row.landingPage()) && row.maxUploadMb() == 10
                && row.accessWeekdays().equals(Set.of(1, 2))), eq(adminId));
        verify(repository).replaceAllowedDocumentTypes(tenantId, targetId, Set.of(typeId));
        verify(sessions).revokeAll(targetId);
        assertTrue(target.isMustChangePassword());
        assertFalse(target.isEmailNotifications());
        assertEquals("+591 700", target.getPhone());
        assertEquals("en", target.getPreferredLanguage());
    }

    @Test
    void updateWithoutAccessChangesKeepsSessions() {
        service.update(targetId, request(null, Set.of(), null, null, null, Set.of(), false));
        verify(sessions, never()).revokeAll(any());
    }

    @Test
    void sevenWeekdaysMeanNoRestriction() {
        service.update(targetId, request(null, Set.of(1, 2, 3, 4, 5, 6, 7), null, null, null, Set.of(), false));
        verify(repository).upsert(eq(tenantId), eq(targetId), argThat(row -> row.accessWeekdays().isEmpty()), eq(adminId));
        verify(sessions, never()).revokeAll(any());
    }

    @Test
    void rejectsInvalidValues() {
        assertThrows(IllegalArgumentException.class, () -> service.update(targetId,
                request(null, Set.of(), LocalTime.of(8, 0), null, null, Set.of(), false)));
        assertThrows(IllegalArgumentException.class, () -> service.update(targetId,
                request(null, Set.of(), null, null, "/settings/backups", Set.of(), false)));
        when(repository.countActiveDocumentTypes(eq(tenantId), anyCollection())).thenReturn(0);
        assertThrows(IllegalArgumentException.class, () -> service.update(targetId,
                request(null, Set.of(), null, null, null, Set.of(UUID.randomUUID()), false)));
        verify(repository, never()).upsert(any(), any(), any(), any());
    }

    @Test
    void anAdministratorCannotRestrictTheirOwnAccess() {
        when(context.requireUserId()).thenReturn(targetId);
        assertThrows(IllegalArgumentException.class, () -> service.update(targetId,
                request(LocalDate.now().plusDays(1), Set.of(), null, null, null, Set.of(), false)));
        assertThrows(IllegalArgumentException.class, () -> service.revokeSessions(targetId));
        // Cambiar solo preferencias propias sí está permitido.
        assertDoesNotThrow(() -> service.update(targetId, request(null, Set.of(), null, null, null, Set.of(), false)));
    }

    @Test
    void uploadRespectsMaxFileSizeAndQuota() {
        when(repository.find(tenantId, adminId)).thenReturn(Optional.of(new Row(null, null, null, null, Set.of(),
                null, null, 2, 5)));
        long mb = 1024L * 1024L;
        assertThrows(IllegalArgumentException.class, () -> service.validateUpload(tenantId, 3 * mb));
        when(repository.storageBytes(adminId)).thenReturn(4 * mb);
        assertThrows(IllegalArgumentException.class, () -> service.validateUpload(tenantId, 2 * mb));
        assertDoesNotThrow(() -> service.validateUpload(tenantId, mb));
    }

    @Test
    void documentCreationIsLimitedToAllowedTypes() {
        UUID allowed = UUID.randomUUID();
        when(repository.findAllowedDocumentTypes(tenantId, adminId)).thenReturn(Set.of(allowed));
        assertDoesNotThrow(() -> service.validateDocumentType(tenantId, allowed));
        assertThrows(AccessDeniedException.class, () -> service.validateDocumentType(tenantId, UUID.randomUUID()));
        assertThrows(AccessDeniedException.class, () -> service.validateDocumentType(tenantId, null));
    }
}
