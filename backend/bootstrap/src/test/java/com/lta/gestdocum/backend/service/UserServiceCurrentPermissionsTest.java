package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.ClinicalStaffRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.security.PlatformAuthorities;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceCurrentPermissionsTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ClinicalStaffRepository clinicalStaffRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticatedUserContext context;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @Test
    @DisplayName("/auth/me devuelve los permisos de la sesión aunque el perfil no tenga role:read")
    void currentUserReturnsSessionPermissionsWithoutRoleRead() {
        // Perfil tipo "Médico Especialista": con RLS no puede leer user_roles ni role_permissions,
        // por lo que consultar la base devolvería una lista vacía y la web ocultaría todo el menú.
        when(context.requireUserId()).thenReturn(userId);
        when(context.require()).thenReturn(new AuthenticatedUser(userId, tenantId, "medico",
                Set.of("patient:read", "document:read", "expedient:read")));
        when(userRepository.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId))
                .thenReturn(Optional.of(User.builder().id(userId).tenantId(tenantId).username("medico").build()));
        when(clinicalStaffRepository.findByUserIdAndTenantId(userId, tenantId)).thenReturn(Optional.empty());

        UserResponse response = new UserService(userRepository, clinicalStaffRepository, passwordEncoder, context)
                .getCurrentUser();

        assertEquals(List.of("document:read", "expedient:read", "patient:read"), response.getPermissions());
        verify(context).establishDatabaseContext();
        verify(userRepository, never()).findAuthorityCodes(userId, tenantId);
    }

    @Test
    @DisplayName("/auth/me descarta las authorities ROLE_* de tokens antiguos")
    void currentUserIgnoresLegacyRoleAuthorities() {
        when(context.requireUserId()).thenReturn(userId);
        when(context.require()).thenReturn(new AuthenticatedUser(userId, tenantId, "lector",
                Set.of("ROLE_USER", "document:read")));
        when(userRepository.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId))
                .thenReturn(Optional.of(User.builder().id(userId).tenantId(tenantId).username("lector").build()));
        when(clinicalStaffRepository.findByUserIdAndTenantId(userId, tenantId)).thenReturn(Optional.empty());

        UserResponse response = new UserService(userRepository, clinicalStaffRepository, passwordEncoder, context)
                .getCurrentUser();

        assertEquals(List.of("document:read"), response.getPermissions());
    }

    @Test
    @DisplayName("/auth/me de una cuenta de plataforma devuelve sus authorities fijas sin consultar RBAC")
    void platformAdminGetsPlatformAuthorities() {
        when(context.requireUserId()).thenReturn(userId);
        when(context.require()).thenReturn(new AuthenticatedUser(userId, null, "root", Set.copyOf(PlatformAuthorities.CODES)));
        when(userRepository.findByIdAndDeletedAtIsNull(userId))
                .thenReturn(Optional.of(User.builder().id(userId).username("root").isPlatformAdmin(true).build()));
        when(clinicalStaffRepository.findByUserIdAndTenantIdIsNull(userId)).thenReturn(Optional.empty());

        UserResponse response = new UserService(userRepository, clinicalStaffRepository, passwordEncoder, context)
                .getCurrentUser();

        assertEquals(PlatformAuthorities.CODES, response.getPermissions());
        verify(userRepository, never()).findAuthorityCodes(userId, null);
    }
}
