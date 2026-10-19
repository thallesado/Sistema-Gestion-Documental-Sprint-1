\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 40);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '040_component_permissions'
) AS already_applied \gset

\if :already_applied
  \echo '040_component_permissions ya aplicada'
\else
  -- Privilegios por componente de formulario (B2). Cada fila restringe un componente
  -- para un grupo (rol del tenant). Sin fila, el estado es VISIBLE_EDITABLE. Si un
  -- usuario tiene varios grupos gana el estado más permisivo (se resuelve en el backend).
  -- Las claves válidas de formulario y componente las valida ComponentFormCatalog.
  CREATE TABLE IF NOT EXISTS component_permissions (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id bigint NOT NULL,
    form_key varchar(80) NOT NULL,
    component_key varchar(80) NOT NULL,
    state varchar(20) NOT NULL,
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_component_permissions PRIMARY KEY (tenant_id, role_id, form_key, component_key),
    CONSTRAINT fk_component_permissions_role FOREIGN KEY (tenant_id, role_id)
      REFERENCES roles(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_component_permissions_state
      CHECK (state IN ('VISIBLE_EDITABLE', 'VISIBLE_READONLY', 'HIDDEN')),
    CONSTRAINT ck_component_permissions_keys
      CHECK (form_key ~ '^[a-z][a-z0-9_.]*$' AND component_key ~ '^[a-z][a-z0-9_]*$')
  );
  CREATE INDEX IF NOT EXISTS idx_component_permissions_form
    ON component_permissions (tenant_id, form_key, role_id);

  -- Mismo patrón que 004: contexto de tenant restrictivo y políticas RBAC permisivas.
  -- Leer la configuración no revela datos del negocio; cualquier usuario válido del
  -- tenant la consulta para pintar sus formularios. Modificarla exige el permiso nuevo.
  ALTER TABLE component_permissions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE component_permissions FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_context ON component_permissions;
  CREATE POLICY tenant_context ON component_permissions AS RESTRICTIVE TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  DROP POLICY IF EXISTS rbac_select ON component_permissions;
  CREATE POLICY rbac_select ON component_permissions FOR SELECT TO nexodocs_app USING (true);
  DROP POLICY IF EXISTS rbac_insert ON component_permissions;
  CREATE POLICY rbac_insert ON component_permissions FOR INSERT TO nexodocs_app
    WITH CHECK ((SELECT app.has_permission('component_permission:manage')));
  DROP POLICY IF EXISTS rbac_update ON component_permissions;
  CREATE POLICY rbac_update ON component_permissions FOR UPDATE TO nexodocs_app
    USING ((SELECT app.has_permission('component_permission:manage')));
  DROP POLICY IF EXISTS rbac_delete ON component_permissions;
  CREATE POLICY rbac_delete ON component_permissions FOR DELETE TO nexodocs_app
    USING ((SELECT app.has_permission('component_permission:manage')));
  GRANT SELECT, INSERT, UPDATE, DELETE ON component_permissions TO nexodocs_app;

  -- Grupos activos del usuario del contexto. user_roles exige role:read por RLS, así que
  -- un usuario corriente no podría leer sus propios grupos; esta función solo devuelve
  -- los del usuario y tenant establecidos con set_config, igual que app.has_permission.
  CREATE OR REPLACE FUNCTION app.current_role_ids() RETURNS SETOF bigint
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
    SELECT r.id
    FROM public.user_roles ur
    JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
    WHERE app.context_is_valid()
      AND ur.tenant_id = app.current_tenant_id()
      AND ur.user_id = app.current_user_id()
  $$;
  ALTER FUNCTION app.current_role_ids() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.current_role_ids() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.current_role_ids() TO nexodocs_app;

  DROP TRIGGER IF EXISTS trg_audit_change ON component_permissions;
  CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON component_permissions
    FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();

  INSERT INTO permissions (code, module, action, description, criticality)
  VALUES ('component_permission:manage', 'component_permission', 'manage',
          'Configurar privilegios por componente de formulario', 'HIGH')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r
  JOIN permissions p ON p.code = 'component_permission:manage'
  WHERE r.name = 'Administrador de tenant'
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('040_component_permissions');
  \echo '040_component_permissions aplicada exitosamente'
\endif

COMMIT;
