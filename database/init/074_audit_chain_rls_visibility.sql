\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('074_audit_chain_rls_visibility'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '074_audit_chain_rls_visibility', applied_at FROM app.schema_migrations WHERE version = '069_audit_chain_rls_visibility' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '074_audit_chain_rls_visibility') AS already_applied \gset
\if :already_applied
  \echo '074_audit_chain_rls_visibility ya aplicada'
\else
  -- The SECURITY DEFINER chain trigger can only read the tenant's chain metadata.
  -- Column grants remain limited to tenant_id, chain_seq and record_hash.
  CREATE POLICY audit_security_chain_context ON public.audit_events
    FOR SELECT TO nexodocs_security
    USING (tenant_id IS NOT DISTINCT FROM app.current_tenant_id());

  INSERT INTO app.schema_migrations(version) VALUES ('074_audit_chain_rls_visibility');
\endif
COMMIT;
