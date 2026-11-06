\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('071_backup_runtime_permissions'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '071_backup_runtime_permissions', applied_at FROM app.schema_migrations WHERE version = '066_backup_runtime_permissions' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '071_backup_runtime_permissions') AS already_applied \gset
\if :already_applied
  \echo '071_backup_runtime_permissions ya aplicada'
\else
  -- DML stays tenant-scoped by the restrictive tenant_context policy and each
  -- operation gets its own RBAC policy; the runtime login receives no bypass.
  CREATE POLICY backup_create_insert ON public.tenant_backups
    FOR INSERT TO nexodocs_app
    WITH CHECK (app.has_permission('backup:create'));
  CREATE POLICY backup_create_update ON public.tenant_backups
    FOR UPDATE TO nexodocs_app
    USING (app.has_permission('backup:create') OR app.has_permission('backup:restore'))
    WITH CHECK (app.has_permission('backup:create') OR app.has_permission('backup:restore'));
  GRANT INSERT (id,tenant_id,created_by,origin,status,pinned)
    ON public.tenant_backups TO nexodocs_app;
  GRANT UPDATE (status,completed_at,file_path,file_size_bytes,checksum,schema_signature,payload,error_message,pinned)
    ON public.tenant_backups TO nexodocs_app;

  CREATE POLICY backup_settings_insert ON public.tenant_backup_settings
    FOR INSERT TO nexodocs_app
    WITH CHECK (app.has_permission('backup:read') OR app.has_permission('backup:configure'));
  CREATE POLICY backup_settings_update ON public.tenant_backup_settings
    FOR UPDATE TO nexodocs_app
    USING (app.has_permission('backup:configure') OR app.has_permission('backup:create'))
    WITH CHECK (app.has_permission('backup:configure') OR app.has_permission('backup:create'));
  GRANT INSERT (tenant_id,enabled,daily_time,timezone,retention_days,last_run_date)
    ON public.tenant_backup_settings TO nexodocs_app;
  GRANT UPDATE (enabled,daily_time,timezone,retention_days,last_run_date,updated_at)
    ON public.tenant_backup_settings TO nexodocs_app;

  CREATE POLICY backup_restore_insert ON public.tenant_restore_operations
    FOR INSERT TO nexodocs_app
    WITH CHECK (app.has_permission('backup:restore'));
  CREATE POLICY backup_restore_update ON public.tenant_restore_operations
    FOR UPDATE TO nexodocs_app
    USING (app.has_permission('backup:restore') OR app.has_permission('backup:create'))
    WITH CHECK (app.has_permission('backup:restore') OR app.has_permission('backup:create'));
  GRANT INSERT (id,tenant_id,backup_id,created_by,safety_backup_id,status,stage)
    ON public.tenant_restore_operations TO nexodocs_app;
  GRANT UPDATE (safety_backup_id,status,stage,completed_at,error_message)
    ON public.tenant_restore_operations TO nexodocs_app;

  CREATE OR REPLACE FUNCTION app.backup_scheduler_actor(p_tenant uuid, p_permission text)
  RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
    SELECT u.id
    FROM public.users u
    JOIN public.user_roles ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id
    JOIN public.role_permissions rp ON rp.tenant_id=ur.tenant_id AND rp.role_id=ur.role_id
    JOIN public.permissions p ON p.id=rp.permission_id AND p.is_active
    WHERE u.tenant_id=p_tenant AND p_tenant=app.current_tenant_id()
      AND p.code=p_permission AND p_permission IN ('backup:create','backup:restore')
      AND u.status='ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_platform_admin
    ORDER BY u.created_at, u.id
    LIMIT 1
  $$;
  ALTER FUNCTION app.backup_scheduler_actor(uuid,text) OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.backup_scheduler_actor(uuid,text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.backup_scheduler_actor(uuid,text) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('071_backup_runtime_permissions');
\endif
COMMIT;
