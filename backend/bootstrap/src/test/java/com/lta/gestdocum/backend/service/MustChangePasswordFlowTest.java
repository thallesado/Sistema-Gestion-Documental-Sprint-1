package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.PasswordChangeRequest;
import com.lta.gestdocum.backend.dto.PublicOnboardingRequest;
import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.exception.PlanLimitExceededException;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.ClinicalStaffRepository;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.MustChangePasswordFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Cobertura de S1 (contraseña temporal), S2 (reactivación con cupo), S3 (onboarding) y S4 (auditoría de usuarios). */
class MustChangePasswordFlowTest {

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final JwtService jwt = new JwtService("0123456789abcdef0123456789abcdef-secret", 3_600_000L, 7_200_000L);

    private UserRepository users;
    private PlanRepository plans;
    private AuthSessionService sessions;
    private AuthService auth;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        plans = mock(PlanRepository.class);
        sessions = mock(AuthSessionService.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.matches(anyString(), anyString())).thenReturn(true);
        when(plans.findEnabledFeatureKeysByTenantId(tenantId)).thenReturn(List.of());
        auth = new AuthService(users, mock(TenantRepository.class), plans, encoder, jwt, sessions,
                mock(AccessTokenRevocationService.class));
    }

    private User user(boolean mustChange) {
        return User.builder().id(userId).tenantId(tenantId).username("admin").email("a@org.test")
                .passwordHash("hash").status(UserStatus.ACTIVE).mustChangePassword(mustChange).build();
    }

    private AuthRequest request() {
        AuthRequest request = new AuthRequest();
        request.setTenantId(tenantId);
        request.setUsernameOrEmail("a@org.test");
        request.setPassword("x");
        return request;
    }

    @Test
    void loginWithTemporaryPasswordExposesFlagAndMarksTheToken() {
        when(users.findByTenantAndIdentifier(tenantId, "a@org.test")).thenReturn(Optional.of(user(true)));
        when(users.findAuthorityCodes(userId, tenantId)).thenReturn(List.of("user:read"));

        AuthResponse response = auth.login(request());

        assertTrue(response.isMustChangePassword());
        assertEquals(List.of("user:read"), response.getPermissions(), "la marca interna no se expone como permiso");
        AuthenticatedUser identity = jwt.extractAuthenticatedUser(response.getToken());
        assertTrue(identity.authorities().contains(MustChangePasswordFilter.MARKER_AUTHORITY));
    }

    @Test
    void loginWithOwnPasswordKeepsPreviousResponseAndTokenWithoutMark() {
        when(users.findByTenantAndIdentifier(tenantId, "a@org.test")).thenReturn(Optional.of(user(false)));
        when(users.findAuthorityCodes(userId, tenantId)).thenReturn(List.of("user:read"));

        AuthResponse response = auth.login(request());

        assertFalse(response.isMustChangePassword());
        assertEquals(List.of("user:read"), response.getPermissions());
        assertEquals(Set.of("user:read"), jwt.extractAuthenticatedUser(response.getToken()).authorities());
    }

    @Test
    void changingThePasswordClearsTheFlagAndClosesTheTemporarySessions() {
        AuthenticatedUserContext ctx = mock(AuthenticatedUserContext.class);
        when(ctx.requireUserId()).thenReturn(userId);
        when(ctx.require()).thenReturn(new AuthenticatedUser(userId, tenantId, "admin", Set.of("x")));
        User temporary = user(true);
        when(users.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(Optional.of(temporary));
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.matches("Temporal#1", "hash")).thenReturn(true);
        when(encoder.encode("Nueva#2026")).thenReturn("new-hash");
        UserService service = new UserService(users, mock(ClinicalStaffRepository.class), encoder, ctx, null, null,
                sessions, null, new UserFormPolicy());
        PasswordChangeRequest change = new PasswordChangeRequest();
        change.setCurrentPassword("Temporal#1");
        change.setNewPassword("Nueva#2026");

        service.changeCurrentPassword(change);

        assertFalse(temporary.isMustChangePassword());
        assertEquals("new-hash", temporary.getPasswordHash());
        verify(sessions).revokeAll(userId);
    }

    @Test
    void ordinaryPasswordChangeDoesNotCloseSessions() {
        AuthenticatedUserContext ctx = mock(AuthenticatedUserContext.class);
        when(ctx.requireUserId()).thenReturn(userId);
        when(ctx.require()).thenReturn(new AuthenticatedUser(userId, tenantId, "admin", Set.of("x")));
        when(users.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(Optional.of(user(false)));
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.matches("a", "hash")).thenReturn(true);
        when(encoder.encode("b")).thenReturn("h2");
        UserService service = new UserService(users, mock(ClinicalStaffRepository.class), encoder, ctx, null, null,
                sessions, null, new UserFormPolicy());
        PasswordChangeRequest change = new PasswordChangeRequest();
        change.setCurrentPassword("a");
        change.setNewPassword("b");

        service.changeCurrentPassword(change);

        verify(sessions, never()).revokeAll(any());
    }

    @Test
    void currentUserResponseExposesMustChangePassword() {
        AuthenticatedUserContext ctx = mock(AuthenticatedUserContext.class);
        when(ctx.requireUserId()).thenReturn(userId);
        when(ctx.require()).thenReturn(new AuthenticatedUser(userId, tenantId, "admin",
                Set.of("user:read", MustChangePasswordFilter.MARKER_AUTHORITY)));
        when(users.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(Optional.of(user(true)));
        ClinicalStaffRepository staff = mock(ClinicalStaffRepository.class);
        when(staff.findByUserIdAndTenantId(userId, tenantId)).thenReturn(Optional.empty());

        UserResponse me = new UserService(users, staff, mock(PasswordEncoder.class), ctx).getCurrentUser();

        assertTrue(me.isMustChangePassword());
        assertEquals(List.of("user:read"), me.getPermissions());
    }

    // ---- S2: reactivar respeta el cupo

    private UserService serviceWithPlan(PlanEnforcementService enforcement, AuditRecorder audit, RoleRepository roles,
                                        User existing) {
        AuthenticatedUserContext ctx = mock(AuthenticatedUserContext.class);
        when(ctx.requireTenantId()).thenReturn(tenantId);
        when(ctx.requireUserId()).thenReturn(UUID.randomUUID());
        when(ctx.hasAuthority(anyString())).thenReturn(true);
        when(users.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(Optional.of(existing));
        when(users.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        ClinicalStaffRepository staff = mock(ClinicalStaffRepository.class);
        when(staff.findByUserIdAndTenantId(userId, tenantId)).thenReturn(Optional.empty());
        UserService service = new UserService(users, staff, mock(PasswordEncoder.class), ctx, roles,
                mock(TenantRepository.class), sessions, enforcement, new UserFormPolicy());
        service.setAuditRecorder(audit);
        return service;
    }

    private UserUpdateRequest update(String status) {
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFirstName("Ana");
        request.setLastName("Perez");
        request.setEmail("ana@org.test");
        request.setStatus(status);
        return request;
    }

    @Test
    void reactivatingAUserChecksThePlanSeats() {
        PlanEnforcementService enforcement = mock(PlanEnforcementService.class);
        doThrow(new PlanLimitExceededException("cupo")).when(enforcement).validateUserLimit(tenantId);
        User inactive = user(false);
        inactive.setStatus(UserStatus.INACTIVE);
        UserService service = serviceWithPlan(enforcement, null, null, inactive);

        assertThrows(PlanLimitExceededException.class, () -> service.updateUser(userId, update("ACTIVE")));
        verify(users, never()).save(any(User.class));
    }

    @Test
    void editingAnActiveUserOrDeactivatingDoesNotConsumeASeatCheck() {
        PlanEnforcementService enforcement = mock(PlanEnforcementService.class);
        UserService active = serviceWithPlan(enforcement, null, null, user(false));
        active.updateUser(userId, update("ACTIVE"));
        active.updateUser(userId, update("INACTIVE"));
        verify(enforcement, never()).validateUserLimit(any());
    }

    // ---- S4: auditoria completa

    @Test
    @SuppressWarnings("unchecked")
    void updateAuditsBeforeAndAfterOfEveryEditableField() {
        AuditRecorder audit = mock(AuditRecorder.class);
        RoleRepository roles = mock(RoleRepository.class);
        when(roles.findIds(tenantId, userId)).thenReturn(Set.of(1L));
        when(roles.findActiveInTenant(eq(tenantId), any())).thenReturn(List.of(
                com.lta.gestdocum.backend.model.Role.builder().id(2L).tenantId(tenantId).name("Editor").build()));
        User existing = user(false);
        existing.setFirstName("Old");
        existing.setLastName("Name");
        existing.setEmail("old@org.test");
        UserService service = serviceWithPlan(mock(PlanEnforcementService.class), audit, roles, existing);
        UserUpdateRequest request = update("INACTIVE");
        request.setRoleIds(Set.of(2L));

        service.updateUser(userId, request);

        var before = org.mockito.ArgumentCaptor.forClass(Map.class);
        var after = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(audit).record(eq("UPDATE"), eq("USERS"), eq(userId), before.capture(), after.capture());
        assertEquals("Old", before.getValue().get("firstName"));
        assertEquals("Name", before.getValue().get("lastName"));
        assertEquals("old@org.test", before.getValue().get("email"));
        assertEquals("ACTIVE", before.getValue().get("status"));
        assertEquals("[1]", before.getValue().get("roleIds"));
        assertEquals("Ana", after.getValue().get("firstName"));
        assertEquals("Perez", after.getValue().get("lastName"));
        assertEquals("ana@org.test", after.getValue().get("email"));
        assertEquals("INACTIVE", after.getValue().get("status"));
        assertEquals("[2]", after.getValue().get("roleIds"));
        assertFalse(before.getValue().toString().toLowerCase().contains("password"));
    }

    // ---- S3: onboarding reutiliza TenantService

    @Test
    void onboardingDelegatesToTheSingleTenantCreationPath() {
        TenantService tenants = mock(TenantService.class);
        AuthService authService = mock(AuthService.class);
        UUID planId = UUID.randomUUID();
        Plan plan = mock(Plan.class);
        when(plan.getId()).thenReturn(planId);
        when(plans.findFirstByCodeIgnoreCaseAndActiveTrue("PRO")).thenReturn(Optional.of(plan));
        UUID newTenant = UUID.randomUUID();
        when(tenants.create(any(TenantCreateRequest.class), eq("MiClave#2026"))).thenReturn(
                new TenantResponse(newTenant, "Clinica Nube", "ORG-X", "clinica-nube", "TRIAL", planId, null, null));
        AuthResponse expected = new AuthResponse("t", "Bearer", "r", 1L, List.of());
        when(authService.login(any(AuthRequest.class))).thenReturn(expected);

        AuthResponse response = new PublicOnboardingService(plans, authService, tenants).onboard(
                new PublicOnboardingRequest("Clinica Nube", "pro", "Ana Admin", "Ana@Org.test", "MiClave#2026"));

        assertSame(expected, response);
        var created = org.mockito.ArgumentCaptor.forClass(TenantCreateRequest.class);
        verify(tenants).create(created.capture(), eq("MiClave#2026"));
        assertEquals("Clinica Nube", created.getValue().name());
        assertEquals(planId, created.getValue().planId());
        assertEquals("ana@org.test", created.getValue().adminEmail());
        assertEquals("Ana Admin", created.getValue().adminName());
        var login = org.mockito.ArgumentCaptor.forClass(AuthRequest.class);
        verify(authService).login(login.capture());
        assertEquals(newTenant, login.getValue().getTenantId());
    }

    @Test
    void onboardingRejectsUnavailablePlansAsBefore() {
        when(plans.findFirstByCodeIgnoreCaseAndActiveTrue("PRO")).thenReturn(Optional.empty());
        PublicOnboardingService service = new PublicOnboardingService(plans, mock(AuthService.class),
                mock(TenantService.class));
        assertThrows(IllegalArgumentException.class, () -> service.onboard(
                new PublicOnboardingRequest("Org", "PRO", "Ana", "a@org.test", "MiClave#2026")));
    }
}
