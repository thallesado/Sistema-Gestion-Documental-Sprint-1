DO $$
DECLARE
  v_tenant_id uuid := '2ff78cc6-de74-4e18-b5b1-fff9c313f1c0';
  v_user_id uuid := gen_random_uuid();
  v_role_id bigint;
  v_plan_id uuid := '10000000-0000-0000-0000-000000000003';
  v_hash text := '$2a$06$z7etCNu7myYMtbVXbWO5M.ZOwE.WBZszls9Onoqcb8ScZVgVdNTvq';
BEGIN
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);
  PERFORM set_config('app.bypass_rls', 'on', true);

  UPDATE tenants SET subscription_status = 'ACTIVE', plan_id = v_plan_id, email = 'admin@farmacorp.test' WHERE id = v_tenant_id;

  INSERT INTO roles (tenant_id, name, description, is_system, approval_rank, workflow_owner)
  VALUES (v_tenant_id, 'Administrador de tenant', 'Rol administrativo con permisos completos del tenant', true, 100, true)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id, tenant_id)
  SELECT v_role_id, p.id, v_tenant_id FROM permissions p;

  INSERT INTO users (id, tenant_id, username, email, password_hash, first_name, last_name, status, is_platform_admin, preferred_language, must_change_password)
  VALUES (v_user_id, v_tenant_id, 'admin.farmacorp', 'admin@farmacorp.test', v_hash, 'Administrador', 'Farmacorp', 'ACTIVE', false, 'es', false);

  INSERT INTO user_roles (user_id, role_id, tenant_id)
  VALUES (v_user_id, v_role_id, v_tenant_id);
END $$;
