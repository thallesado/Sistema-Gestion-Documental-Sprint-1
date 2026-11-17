\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('066_tenant_audit_archive_read'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '066_tenant_audit_archive_read', applied_at FROM app.schema_migrations WHERE version = '061_tenant_audit_archive_read' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '066_tenant_audit_archive_read') AS already_applied \gset
\if :already_applied
  \echo '066_tenant_audit_archive_read ya aplicada'
\else
  ALTER TABLE app.tenant_audit_archive
    ADD COLUMN platform_actor_id uuid,
    ADD COLUMN client_timestamp timestamptz,
    ADD COLUMN client_timezone varchar(80);

  GRANT SELECT ON app.tenant_audit_archive TO nexodocs_platform_admin;

  CREATE OR REPLACE FUNCTION app.authorized_tenant_audit_archive_count(p_actor uuid, p_tenant uuid)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, app, public
  AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_actor AND u.tenant_id IS NULL AND u.is_platform_admin
        AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'platform audit access denied' USING ERRCODE = '42501';
    END IF;
    RETURN (SELECT count(*) FROM app.tenant_audit_archive WHERE tenant_id = p_tenant);
  END;
  $$;
  ALTER FUNCTION app.authorized_tenant_audit_archive_count(uuid, uuid) OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.authorized_tenant_audit_archive_count(uuid, uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.authorized_tenant_audit_archive_count(uuid, uuid) TO nexodocs_app;

  CREATE OR REPLACE FUNCTION app.authorized_tenant_audit_archive_page(
    p_actor uuid, p_tenant uuid, p_limit integer, p_offset bigint
  ) RETURNS TABLE (
    source_event_id bigint, tenant_id uuid, user_id uuid, platform_actor_id uuid,
    action varchar(80), entity_type varchar(60), entity_id uuid, occurred_at timestamptz,
    client_timestamp timestamptz, client_timezone varchar(80), ip_address inet,
    user_agent text, result varchar(30), details jsonb, chain_seq bigint,
    previous_hash character(64), record_hash character(64)
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, app, public
  AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_actor AND u.tenant_id IS NULL AND u.is_platform_admin
        AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'platform audit access denied' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
      SELECT a.source_event_id, a.tenant_id, a.user_id, a.platform_actor_id,
             a.action, a.entity_type, a.entity_id, a.occurred_at,
             a.client_timestamp, a.client_timezone, a.ip_address,
             a.user_agent, a.result, a.details, a.chain_seq,
             a.previous_hash, a.record_hash
      FROM app.tenant_audit_archive a
      WHERE a.tenant_id = p_tenant
      ORDER BY a.occurred_at DESC, a.source_event_id DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0);
  END;
  $$;
  ALTER FUNCTION app.authorized_tenant_audit_archive_page(uuid, uuid, integer, bigint) OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.authorized_tenant_audit_archive_page(uuid, uuid, integer, bigint) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.authorized_tenant_audit_archive_page(uuid, uuid, integer, bigint) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('066_tenant_audit_archive_read');
\endif
COMMIT;
