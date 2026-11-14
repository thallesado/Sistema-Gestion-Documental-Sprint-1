\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 59);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '059_tenant_database_lifecycle') AS already_applied \gset
\if :already_applied
  \echo '059_tenant_database_lifecycle ya aplicada'
\else
  -- This registry is control-plane metadata. Tenant content remains in the existing
  -- shared database until a separately backed-up migration moves it to an isolated DB.
  CREATE TABLE app.tenant_database_registry (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
    database_name text,
    storage_mode text NOT NULL DEFAULT 'LEGACY_SHARED',
    lifecycle_state text NOT NULL DEFAULT 'LEGACY_SHARED',
    trial_started_at timestamptz NOT NULL,
    trial_ends_at timestamptz NOT NULL,
    grace_ends_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deletion_started_at timestamptz,
    deleted_at timestamptz,
    last_error_code text,
    CONSTRAINT tenant_database_registry_mode_check
      CHECK (storage_mode IN ('LEGACY_SHARED', 'ISOLATED')),
    CONSTRAINT tenant_database_registry_state_check
      CHECK (lifecycle_state IN (
        'LEGACY_SHARED', 'PROVISIONING', 'TRIAL', 'GRACE_READ_ONLY',
        'ACTIVE', 'DELETING', 'DELETED', 'PROVISIONING_FAILED', 'DELETION_FAILED'
      )),
    CONSTRAINT tenant_database_registry_name_check
      CHECK (database_name IS NULL OR database_name ~ '^nexodocs_t_[0-9a-f]{32}$'),
    CONSTRAINT tenant_database_registry_mode_name_check
      CHECK ((storage_mode = 'LEGACY_SHARED' AND database_name IS NULL)
          OR (storage_mode = 'ISOLATED' AND database_name IS NOT NULL)),
    CONSTRAINT tenant_database_registry_trial_window_check
      CHECK (trial_ends_at > trial_started_at AND grace_ends_at > trial_ends_at)
  );

  INSERT INTO app.tenant_database_registry
    (tenant_id, database_name, storage_mode, lifecycle_state,
     trial_started_at, trial_ends_at, grace_ends_at)
  SELECT id, NULL, 'LEGACY_SHARED', 'LEGACY_SHARED',
         coalesce(trial_start_at, created_at, now()),
         coalesce(trial_ends_at, coalesce(trial_start_at, created_at, now()) + interval '12 days'),
         coalesce(trial_ends_at, coalesce(trial_start_at, created_at, now()) + interval '12 days') + interval '3 days'
    FROM public.tenants
  ON CONFLICT (tenant_id) DO NOTHING;

  CREATE TABLE app.tenant_lifecycle_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL CHECK (event_type IN (
      'REGISTERED', 'DATABASE_PROVISIONING_STARTED', 'DATABASE_PROVISIONED',
      'TRIAL_ENDED', 'GRACE_STARTED', 'PAYMENT_ACTIVATED',
      'DELETION_STARTED', 'DATABASE_ARCHIVED', 'DATABASE_DELETED',
      'PROVISIONING_FAILED', 'DELETION_FAILED'
    )),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_user_id uuid,
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE INDEX tenant_lifecycle_events_tenant_time_idx
    ON app.tenant_lifecycle_events (tenant_id, occurred_at DESC, id DESC);

  -- Detailed business audit must survive destruction of a tenant database.
  -- A cleanup worker copies verified chain rows here before dropping that database.
  CREATE TABLE app.tenant_audit_archive (
    tenant_id uuid NOT NULL,
    source_event_id bigint NOT NULL,
    user_id uuid,
    action varchar(80) NOT NULL,
    entity_type varchar(60) NOT NULL,
    entity_id uuid,
    occurred_at timestamptz NOT NULL,
    ip_address inet,
    user_agent text,
    result varchar(30) NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    chain_seq bigint,
    previous_hash character(64),
    record_hash character(64),
    archived_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, source_event_id)
  );
  CREATE INDEX tenant_audit_archive_tenant_time_idx
    ON app.tenant_audit_archive (tenant_id, occurred_at DESC, source_event_id DESC);

  CREATE OR REPLACE FUNCTION app.reject_tenant_audit_archive_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'archived tenant audit events are immutable';
  END;
  $$;
  CREATE TRIGGER tenant_audit_archive_immutable
    BEFORE UPDATE OR DELETE ON app.tenant_audit_archive
    FOR EACH ROW EXECUTE FUNCTION app.reject_tenant_audit_archive_mutation();

  CREATE OR REPLACE FUNCTION app.reject_tenant_lifecycle_event_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'tenant lifecycle events are immutable';
  END;
  $$;
  CREATE TRIGGER tenant_lifecycle_events_immutable
    BEFORE UPDATE OR DELETE ON app.tenant_lifecycle_events
    FOR EACH ROW EXECUTE FUNCTION app.reject_tenant_lifecycle_event_mutation();

  REVOKE ALL ON app.tenant_database_registry, app.tenant_lifecycle_events FROM PUBLIC;
  REVOKE ALL ON app.tenant_audit_archive FROM PUBLIC;
  GRANT SELECT, INSERT, UPDATE ON app.tenant_database_registry TO nexodocs_app;
  GRANT SELECT, INSERT ON app.tenant_lifecycle_events TO nexodocs_app;
  GRANT USAGE, SELECT ON SEQUENCE app.tenant_lifecycle_events_id_seq TO nexodocs_app;
  GRANT SELECT, INSERT ON app.tenant_audit_archive TO nexodocs_security;

  INSERT INTO app.schema_migrations(version) VALUES ('059_tenant_database_lifecycle');
\endif
COMMIT;
