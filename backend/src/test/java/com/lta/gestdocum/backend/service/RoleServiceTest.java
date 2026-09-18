package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.Role;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoleServiceTest {
    @Test
    void listsOnlyActiveRolesFromAuthenticatedTenant() {
        RoleRepository repository = mock(RoleRepository.class);
        AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
        UUID tenantId = UUID.randomUUID();
        when(context.requireTenantId()).thenReturn(tenantId);
        when(repository.findByTenantIdAndIsActiveTrueOrderByNameAsc(tenantId)).thenReturn(List.of(
                Role.builder().id(7L).tenantId(tenantId).name("Médico").isActive(true).build()));

        var result = new RoleService(repository, context).activeRoles();

        assertThat(result).singleElement().satisfies(role -> {
            assertThat(role.id()).isEqualTo(7L);
            assertThat(role.name()).isEqualTo("Médico");
        });
        verify(context).establishDatabaseContext();
    }
}
