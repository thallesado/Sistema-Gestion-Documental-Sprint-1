package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PlatformPlanDtos.RoleTemplateSave;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformRoleTemplateServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private PlatformRoleTemplateService service;

    @BeforeEach
    void setUp() {
        service = new PlatformRoleTemplateService(jdbc, audit);
        when(jdbc.queryForList(contains("select code from permissions"), eq(String.class)))
                .thenReturn(List.of("document:read", "expedient:read"));
    }

    @Test
    void templatesOnlyUseExistingPermissions() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.create(
                new RoleTemplateSave("Archivo", null, List.of("document:read", "document:teleport"), true, 1, "Grupo de archivo")));
        assertTrue(error.getMessage().contains("document:teleport"));
        assertThrows(IllegalArgumentException.class, () -> service.create(
                new RoleTemplateSave("Archivo", null, List.of(), true, 1, "Grupo de archivo")));
        verify(jdbc, never()).update(contains("insert into default_role_templates"), any(Object[].class));
    }

    @Test
    void theTenantAdministratorGroupCannotBeTemplated() {
        assertThrows(IllegalArgumentException.class, () -> PlatformRoleTemplateService.validName(" administrador DE tenant "));
        assertThrows(IllegalArgumentException.class, () -> PlatformRoleTemplateService.validName("ab"));
        assertEquals("Consulta clínica", PlatformRoleTemplateService.validName("  Consulta   clínica "));
    }

    @Test
    void createIsAuditedWithReason() {
        service.create(new RoleTemplateSave("Archivo", "Solo lectura", List.of("expedient:read", "document:read", "document:read"),
                true, 1, "Grupo de archivo"));
        verify(jdbc).update(contains("insert into default_role_templates"), any(), eq("Archivo"), eq("Solo lectura"),
                eq(new String[] {"document:read", "expedient:read"}), eq(true), eq(1));
        verify(audit).record(eq("ROLE_TEMPLATE_CREATED"), isNull(), eq("Grupo de archivo"), isNull(),
                argThat(m -> List.of("document:read", "expedient:read").equals(m.get("permissions"))));
        assertThrows(IllegalArgumentException.class, () -> service.create(
                new RoleTemplateSave("Archivo", null, List.of("document:read"), true, 1, "")));
    }
}
