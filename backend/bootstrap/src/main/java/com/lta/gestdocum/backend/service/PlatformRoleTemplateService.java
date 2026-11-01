package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PlatformPlanDtos.*;
import com.lta.gestdocum.backend.exception.NotFoundException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Plantillas de los grupos que se crean en cada organización nueva (default_role_templates, 063).
 * Solo combinan permisos existentes: el catálogo de permisos sigue en código y migraciones porque cada
 * permiso corresponde a una comprobación del backend. No afectan a organizaciones ya creadas.
 */
@Service
public class PlatformRoleTemplateService {
    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;

    public PlatformRoleTemplateService(JdbcTemplate jdbc, PlatformAuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public RoleTemplateCatalog catalog() {
        audit.requirePlatformAccount();
        List<PermissionOption> permissions = jdbc.queryForList(
                "select code, module, description from permissions where is_active order by module, code").stream()
                .map(r -> new PermissionOption((String) r.get("code"), (String) r.get("module"), (String) r.get("description"),
                        PlanFeatureMatrix.requiredFeature((String) r.get("module"), (String) r.get("code"))))
                .toList();
        return new RoleTemplateCatalog(templates(), permissions);
    }

    @Transactional
    public RoleTemplateCatalog create(RoleTemplateSave request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        String name = validName(request.name());
        List<String> codes = validCodes(request.permissionCodes());
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    insert into default_role_templates (id, name, description, permission_codes, is_active, sort_order)
                    values (?, ?, ?, ?, ?, ?)
                    """, id, name, blankToNull(request.description()), codes.toArray(String[]::new), request.active(), request.sortOrder());
        } catch (DuplicateKeyException duplicate) {
            throw new IllegalArgumentException("Ya existe una plantilla con ese nombre");
        }
        audit.record("ROLE_TEMPLATE_CREATED", null, reason, null, state(name, codes, request.active()));
        return catalog();
    }

    @Transactional
    public RoleTemplateCatalog update(UUID id, RoleTemplateSave request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        RoleTemplateView before = find(id);
        String name = validName(request.name());
        List<String> codes = validCodes(request.permissionCodes());
        try {
            jdbc.update("""
                    update default_role_templates set name = ?, description = ?, permission_codes = ?, is_active = ?,
                      sort_order = ?, updated_at = now() where id = ?
                    """, name, blankToNull(request.description()), codes.toArray(String[]::new), request.active(),
                    request.sortOrder(), id);
        } catch (DuplicateKeyException duplicate) {
            throw new IllegalArgumentException("Ya existe una plantilla con ese nombre");
        }
        audit.record("ROLE_TEMPLATE_UPDATED", null, reason, state(before.name(), before.permissionCodes(), before.active()),
                state(name, codes, request.active()));
        return catalog();
    }

    @Transactional
    public RoleTemplateCatalog delete(UUID id, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        RoleTemplateView before = find(id);
        jdbc.update("delete from default_role_templates where id = ?", id);
        audit.record("ROLE_TEMPLATE_DELETED", null, reason, state(before.name(), before.permissionCodes(), before.active()), null);
        return catalog();
    }

    private List<RoleTemplateView> templates() {
        return jdbc.queryForList("""
                select id, name, description, permission_codes, is_active, sort_order
                from default_role_templates order by sort_order, name
                """).stream().map(PlatformRoleTemplateService::view).toList();
    }

    private RoleTemplateView find(UUID id) {
        return jdbc.queryForList("""
                select id, name, description, permission_codes, is_active, sort_order
                from default_role_templates where id = ? for update
                """, id).stream().map(PlatformRoleTemplateService::view).findFirst()
                .orElseThrow(() -> new NotFoundException("Plantilla no encontrada"));
    }

    private static RoleTemplateView view(Map<String, Object> r) {
        return new RoleTemplateView((UUID) r.get("id"), (String) r.get("name"), (String) r.get("description"),
                TenantService.permissionCodes(r.get("permission_codes")), Boolean.TRUE.equals(r.get("is_active")),
                ((Number) r.get("sort_order")).intValue());
    }

    static String validName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.length() < 3) throw new IllegalArgumentException("El nombre del grupo debe tener al menos 3 caracteres");
        if ("administrador de tenant".equalsIgnoreCase(name)) {
            throw new IllegalArgumentException("«Administrador de tenant» se crea siempre con todos los permisos del plan");
        }
        return name;
    }

    /** Solo códigos del catálogo de permisos; no se crean permisos desde pantalla. */
    private List<String> validCodes(List<String> requested) {
        List<String> codes = requested.stream().filter(Objects::nonNull).map(String::trim).filter(c -> !c.isEmpty())
                .distinct().sorted().toList();
        if (codes.isEmpty()) throw new IllegalArgumentException("Elige al menos un permiso");
        Set<String> known = new HashSet<>(jdbc.queryForList("select code from permissions where is_active", String.class));
        List<String> unknown = codes.stream().filter(c -> !known.contains(c)).toList();
        if (!unknown.isEmpty()) throw new IllegalArgumentException("Permisos inexistentes: " + String.join(", ", unknown));
        return codes;
    }

    private static Map<String, Object> state(String name, List<String> codes, boolean active) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", name);
        map.put("active", active);
        map.put("permissions", codes);
        return map;
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
