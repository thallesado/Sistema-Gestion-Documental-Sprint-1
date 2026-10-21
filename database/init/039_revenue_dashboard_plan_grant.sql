\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 39);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '039_revenue_dashboard_plan_grant') AS already_applied \gset
\if :already_applied
  \echo '039_revenue_dashboard_plan_grant ya aplicada'
\else
  -- app.revenue_dashboard is owned by nexodocs_security and joins the public
  -- plan catalog. This is read-only and does not grant the application role
  -- direct access to billing rows.
  GRANT SELECT ON plans TO nexodocs_security;
  INSERT INTO app.schema_migrations(version) VALUES ('039_revenue_dashboard_plan_grant');
\endif
COMMIT;
