\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 37);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '037_billing_rls_policy') AS already_applied \gset
\if :already_applied
  \echo '037_billing_rls_policy ya aplicada'
\else
  -- La política 036 era RESTRICTIVE sin una regla PERMISSIVE base, lo que
  -- denegaba toda fila. Esta política impone el contexto de tenant y permite
  -- a la vez la lectura/escritura que ya autorizan los privilegios y RBAC.
  DROP POLICY IF EXISTS billing_transactions_tenant_context ON billing_transactions;
  CREATE POLICY billing_transactions_tenant_context ON billing_transactions TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  INSERT INTO app.schema_migrations(version) VALUES ('037_billing_rls_policy');
\endif
COMMIT;
