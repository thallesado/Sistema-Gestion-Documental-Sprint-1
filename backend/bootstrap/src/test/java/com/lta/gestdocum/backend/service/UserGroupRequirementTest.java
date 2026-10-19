package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.ClinicalStaffRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserGroupRequirementTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ClinicalStaffRepository clinicalStaffRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticatedUserContext context;

    private final UserFormPolicy policy = new UserFormPolicy();
    private final UUID tenantId = UUID.randomUUID();

    @Test
    @DisplayName("Crear un usuario exige al menos un grupo")
    void createRequiresAtLeastOneGroup() {
        assertEquals(UserFormPolicy.GROUP_REQUIRED,
                assertThrows(IllegalArgumentException.class, () -> policy.validateCreate(createRequest(null))).getMessage());
        assertThrows(IllegalArgumentException.class, () -> policy.validateCreate(createRequest(Set.of())));
        assertDoesNotThrow(() -> policy.validateCreate(createRequest(Set.of(7L))));
    }

    @Test
    @DisplayName("Editar sin roleIds conserva los grupos; una lista vacía se rechaza")
    void updateKeepsGroupsButRejectsEmptyList() {
        UserUpdateRequest keep = new UserUpdateRequest();
        assertDoesNotThrow(() -> policy.validateUpdate(existingUser(), keep));

        UserUpdateRequest empty = new UserUpdateRequest();
        empty.setRoleIds(Set.of());
        assertThrows(IllegalArgumentException.class, () -> policy.validateUpdate(existingUser(), empty));
    }

    @Test
    @DisplayName("UserService.createUser no guarda un usuario sin grupo")
    void createUserWithoutGroupIsNotPersisted() {
        when(context.requireTenantId()).thenReturn(tenantId);
        UserService service = new UserService(userRepository, clinicalStaffRepository, passwordEncoder, context);

        assertThrows(IllegalArgumentException.class, () -> service.createUser(createRequest(Set.of())));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("UserService.updateUser no deja a un usuario sin grupos")
    void updateUserWithEmptyGroupsIsRejected() {
        UUID userId = UUID.randomUUID();
        when(context.requireTenantId()).thenReturn(tenantId);
        when(userRepository.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId))
                .thenReturn(Optional.of(User.builder().id(userId).tenantId(tenantId).username("ana").build()));
        UserUpdateRequest request = new UserUpdateRequest();
        request.setRoleIds(Set.of());

        UserService service = new UserService(userRepository, clinicalStaffRepository, passwordEncoder, context);

        assertThrows(IllegalArgumentException.class, () -> service.updateUser(userId, request));
        verify(userRepository, never()).save(any(User.class));
    }

    private User existingUser() {
        return User.builder().id(UUID.randomUUID()).tenantId(tenantId).username("ana").build();
    }

    private UserCreateRequest createRequest(Set<Long> roleIds) {
        UserCreateRequest request = new UserCreateRequest();
        request.setUsername("ana");
        request.setEmail("ana@example.test");
        request.setPassword("Clave-Segura-1");
        request.setFirstName("Ana");
        request.setLastName("Prueba");
        request.setRoleIds(roleIds);
        return request;
    }
}
