package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.ComponentState;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Acceso JDBC a component_permissions. Debe usarse dentro de una transacción con el contexto
 * de base de datos ya establecido: RLS limita las filas al tenant y la escritura a
 * component_permission:manage.
 */
@Repository
public class ComponentPermissionRepository {

    public record Row(long roleId, String componentKey, ComponentState state) { }

    private final NamedParameterJdbcTemplate db;

    public ComponentPermissionRepository(NamedParameterJdbcTemplate db) {
        this.db = db;
    }

    /** Grupos activos del usuario del contexto (función SECURITY DEFINER de la migración 040). */
    public List<Long> currentRoleIds() {
        return db.getJdbcTemplate().queryForList("SELECT * FROM app.current_role_ids()", Long.class);
    }

    public List<Row> findByRoles(UUID tenantId, String formKey, Collection<Long> roleIds) {
        if (roleIds.isEmpty()) return List.of();
        return db.query("""
                SELECT role_id, component_key, state FROM component_permissions
                WHERE tenant_id = :tenantId AND form_key = :formKey AND role_id IN (:roleIds)
                """,
                new MapSqlParameterSource("tenantId", tenantId).addValue("formKey", formKey).addValue("roleIds", roleIds),
                (rs, rowNum) -> new Row(rs.getLong("role_id"), rs.getString("component_key"),
                        ComponentState.valueOf(rs.getString("state"))));
    }

    public Map<String, ComponentState> findByRole(UUID tenantId, String formKey, long roleId) {
        Map<String, ComponentState> states = new LinkedHashMap<>();
        findByRoles(tenantId, formKey, List.of(roleId)).forEach(row -> states.put(row.componentKey(), row.state()));
        return states;
    }

    /** Sustituye la matriz de un grupo y formulario; solo se guardan los estados distintos del predeterminado. */
    public void replace(UUID tenantId, String formKey, long roleId, Map<String, ComponentState> states, UUID updatedBy) {
        MapSqlParameterSource scope = new MapSqlParameterSource("tenantId", tenantId)
                .addValue("formKey", formKey).addValue("roleId", roleId);
        db.update("DELETE FROM component_permissions WHERE tenant_id = :tenantId AND form_key = :formKey AND role_id = :roleId",
                scope);
        states.forEach((componentKey, state) -> {
            if (state == ComponentState.DEFAULT) return;
            db.update("""
                    INSERT INTO component_permissions (tenant_id, role_id, form_key, component_key, state, updated_by)
                    VALUES (:tenantId, :roleId, :formKey, :componentKey, :state, :updatedBy)
                    """,
                    new MapSqlParameterSource(scope.getValues())
                            .addValue("componentKey", componentKey)
                            .addValue("state", state.name())
                            .addValue("updatedBy", updatedBy));
        });
    }
}
