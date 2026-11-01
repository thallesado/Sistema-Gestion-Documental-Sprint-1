package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.Permission;
import com.lta.gestdocum.backend.model.Role;
import com.lta.gestdocum.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Grupos por defecto desde default_role_templates (063): solo permisos existentes y habilitados por el plan. */
class TenantDefaultGroupsTest {
    private final RoleRepository roles = mock(RoleRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);

    @SuppressWarnings("unchecked")
    private TenantService service() {
        ObjectProvider<JavaMailSender> mail = mock(ObjectProvider.class);
        ObjectProvider<JdbcTemplate> jdbcProvider = mock(ObjectProvider.class);
        when(jdbcProvider.getIfAvailable()).thenReturn(jdbc);
        return new TenantService(mock(TenantRepository.class), mock(PlanRepository.class), mock(UserRepository.class), roles,
                mock(PermissionRepository.class), mock(PasswordEncoder.class), mail, jdbcProvider);
    }

    private static Permission permission(long id, String code) {
        Permission permission = mock(Permission.class);
        when(permission.getId()).thenReturn(id);
        when(permission.getCode()).thenReturn(code);
        return permission;
    }

    @Test
    void groupsGetOnlyTheirTemplatePermissionsAllowedByThePlan() {
        UUID tenant = UUID.randomUUID();
        when(jdbc.queryForList(contains("from default_role_templates"))).thenReturn(List.of(Map.of(
                "name", "Gestor documental", "description", "Alta de documentos",
                "permission_codes", new String[] {"document:read", "workflow:read", "document:teleport"})));
        when(roles.save(any(Role.class))).thenAnswer(inv -> { Role r = inv.getArgument(0); r.setId(42L); return r; });

        // El plan no habilita workflows: workflow:read no está entre los permitidos.
        service().createDefaultGroups(tenant, List.of(permission(1L, "document:read"), permission(2L, "document:create")));

        ArgumentCaptor<Role> saved = ArgumentCaptor.forClass(Role.class);
        verify(roles).save(saved.capture());
        assertEquals("Gestor documental", saved.getValue().getName());
        assertEquals(tenant, saved.getValue().getTenantId());
        verify(roles).grantPermission(tenant, 42L, 1L);
        verify(roles, times(1)).grantPermission(any(), any(), any());
    }

    @Test
    void withoutTheTemplatesTableNoGroupIsCreated() {
        when(jdbc.queryForList(contains("from default_role_templates"))).thenThrow(new DataAccessResourceFailureException("sin 063"));
        service().createDefaultGroups(UUID.randomUUID(), List.of());
        verifyNoInteractions(roles);
    }
}
