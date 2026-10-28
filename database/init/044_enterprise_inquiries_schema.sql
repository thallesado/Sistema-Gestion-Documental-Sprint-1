\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 44);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '044_enterprise_inquiries_schema') AS already_applied \gset
\if :already_applied
  \echo '044_enterprise_inquiries_schema ya aplicada'
\else
  CREATE TABLE public.enterprise_inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL,
    organization_name varchar(255) NOT NULL,
    contact_name varchar(160) NOT NULL,
    email varchar(254) NOT NULL,
    phone varchar(60),
    estimated_users integer NOT NULL CHECK (estimated_users > 0),
    requires_dicom boolean NOT NULL DEFAULT false,
    requires_bulk_ocr boolean NOT NULL DEFAULT false,
    requires_interoperability boolean NOT NULL DEFAULT false,
    message varchar(4000),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id)
  );
  CREATE INDEX idx_enterprise_inquiries_tenant_created ON public.enterprise_inquiries(tenant_id, created_at DESC);
  ALTER TABLE public.enterprise_inquiries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.enterprise_inquiries FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_context ON public.enterprise_inquiries AS RESTRICTIVE TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  CREATE POLICY own_inquiries_select ON public.enterprise_inquiries FOR SELECT TO nexodocs_app
    USING (user_id = (SELECT app.current_user_id()));
  CREATE POLICY own_inquiries_insert ON public.enterprise_inquiries FOR INSERT TO nexodocs_app
    WITH CHECK (user_id = (SELECT app.current_user_id()));
  GRANT SELECT, INSERT ON public.enterprise_inquiries TO nexodocs_app;
  INSERT INTO app.schema_migrations(version) VALUES ('044_enterprise_inquiries_schema');
\endif
COMMIT;
