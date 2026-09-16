package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.exception.TenantMismatchException;
import com.lta.gestdocum.backend.repository.ClinicalStaffRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;


import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceSecurityTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private ClinicalStaffRepository clinicalStaffRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticatedUserContext authenticatedUserContext;

    @InjectMocks
    private UserService userService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsCreationForAnotherTenantBeforePersistence() {
        UUID authenticatedTenant = UUID.randomUUID();
        when(authenticatedUserContext.requireTenantId()).thenReturn(authenticatedTenant);

        UserCreateRequest request = new UserCreateRequest();
        request.setTenantId(UUID.randomUUID());

        assertThrows(TenantMismatchException.class, () -> userService.createUser(request));
        verifyNoInteractions(userRepository, clinicalStaffRepository, passwordEncoder);
    }

    @Test
    void typedContextRejectsRequestsWithoutToken() {
        SecurityContextHolder.clearContext();
        AuthenticatedUserContext context = new AuthenticatedUserContext();

        assertThrows(RuntimeException.class, context::require);
    }
}
