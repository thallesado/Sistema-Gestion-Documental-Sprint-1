\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 47);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '047_enterprise_inquiries') AS already_applied \gset
\if :already_applied
  \echo '047_enterprise_inquiries ya aplicada'
\else
  -- EnterpriseInquiry (POST /api/v1/plans/enterprise-inquiry) was mapped without a table,
  -- so ddl-auto=validate stopped the backend at startup.
  CREATE TABLE IF NOT EXISTS enterprise_inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    organization_name varchar(255) NOT NULL,
    contact_name varchar(160) NOT NULL,
    email varchar(254) NOT NULL,
    phone varchar(60),
    estimated_users integer NOT NULL CHECK (estimated_users > 0),
    requires_dicom boolean NOT NULL DEFAULT false,
    requires_bulk_ocr boolean NOT NULL DEFAULT false,
    requires_interoperability boolean NOT NULL DEFAULT false,
    message varchar(4000),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_tenant_created ON enterprise_inquiries(tenant_id, created_at DESC);

  ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE enterprise_inquiries FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS enterprise_inquiries_tenant_context ON enterprise_inquiries;
  CREATE POLICY enterprise_inquiries_tenant_context ON enterprise_inquiries TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  GRANT SELECT, INSERT ON enterprise_inquiries TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('047_enterprise_inquiries');
  \echo '047_enterprise_inquiries aplicada exitosamente'
\endif
COMMIT;
