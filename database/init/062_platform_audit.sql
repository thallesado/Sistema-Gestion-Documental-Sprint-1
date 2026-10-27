\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 62);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '062_platform_audit') AS already_applied \gset
\if :already_applied
  \echo '062_platform_audit ya aplicada'
\else
  -- Auditoría propia del administrador global: cada acción de plataforma (alta, suspensión, prueba
  -- extendida, cambio de plan, respaldo completo) deja una fila con su motivo. Tabla global, sin
  -- tenant obligatorio: la escribe y la lee el backend con su usuario de conexión, como tenant_signups
  -- en 059. nexodocs_app no recibe privilegios: un tenant no ve ni altera las acciones de plataforma.
  CREATE TABLE IF NOT EXISTS public.platform_audit_events (
    id bigserial PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_user_id uuid NOT NULL REFERENCES users(id),
    actor_username varchar(150) NOT NULL,
    action varchar(80) NOT NULL,
    tenant_id uuid REFERENCES tenants(id),
    reason varchar(1000) NOT NULL,
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    CONSTRAINT ck_platform_audit_reason CHECK (char_length(btrim(reason)) >= 5),
    CONSTRAINT ck_platform_audit_action CHECK (action ~ '^[A-Z][A-Z_]{2,79}$')
  );
  CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant ON public.platform_audit_events (tenant_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_platform_audit_actor ON public.platform_audit_events (actor_user_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON public.platform_audit_events (action, occurred_at DESC);

  -- Inmutable, igual que audit_events (001): ni el backend puede editar ni borrar una acción registrada.
  DROP TRIGGER IF EXISTS trg_platform_audit_events_no_update ON public.platform_audit_events;
  DROP TRIGGER IF EXISTS trg_platform_audit_events_no_delete ON public.platform_audit_events;
  CREATE TRIGGER trg_platform_audit_events_no_update BEFORE UPDATE ON public.platform_audit_events
    FOR EACH ROW EXECUTE FUNCTION app.block_mutation();
  CREATE TRIGGER trg_platform_audit_events_no_delete BEFORE DELETE ON public.platform_audit_events
    FOR EACH ROW EXECUTE FUNCTION app.block_mutation();
  -- TRUNCATE no dispara triggers por fila: se bloquea con uno por sentencia.
  DROP TRIGGER IF EXISTS trg_platform_audit_events_no_truncate ON public.platform_audit_events;
  CREATE TRIGGER trg_platform_audit_events_no_truncate BEFORE TRUNCATE ON public.platform_audit_events
    FOR EACH STATEMENT EXECUTE FUNCTION app.block_mutation();

  REVOKE ALL ON public.platform_audit_events FROM PUBLIC;
  REVOKE ALL ON public.platform_audit_events FROM nexodocs_app;
  REVOKE ALL ON SEQUENCE public.platform_audit_events_id_seq FROM PUBLIC;
  REVOKE ALL ON SEQUENCE public.platform_audit_events_id_seq FROM nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('062_platform_audit');
  \echo '062_platform_audit aplicada exitosamente'
\endif

COMMIT;
