\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, hashtext('079_platform_technical_logs'));
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='079_platform_technical_logs') AS already_applied \gset
\if :already_applied
  \echo '079_platform_technical_logs ya aplicada'
\else
  CREATE TABLE public.platform_technical_logs (
    id bigserial PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    level text NOT NULL CHECK (level IN ('WARN','ERROR')),
    tenant_id uuid,
    actor_id uuid,
    category text NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
    summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 240),
    request_method text,
    request_path text,
    http_status integer,
    exception_type text
  );
  CREATE INDEX platform_technical_logs_occurred_idx ON public.platform_technical_logs(occurred_at DESC, id DESC);
  CREATE INDEX platform_technical_logs_tenant_idx ON public.platform_technical_logs(tenant_id, occurred_at DESC);
  REVOKE ALL ON public.platform_technical_logs FROM PUBLIC, nexodocs_platform_admin;
  GRANT INSERT, SELECT ON public.platform_technical_logs TO nexodocs_app;
  GRANT USAGE, SELECT ON SEQUENCE public.platform_technical_logs_id_seq TO nexodocs_app;
  INSERT INTO app.schema_migrations(version) VALUES ('079_platform_technical_logs');
\endif
COMMIT;
