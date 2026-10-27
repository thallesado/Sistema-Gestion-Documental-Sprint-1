\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 62);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '062_audit_chain_v2') AS already_applied \gset
\if :already_applied
  \echo '062_audit_chain_v2 ya aplicada'
\else

  -- C3 v2: el hash de cada evento cubre también quién actuó como administrador de plataforma, el agente de
  -- usuario y la hora del cliente (C1). Las filas existentes conservan la versión 1 y su hash no cambia:
  -- ADD COLUMN con un valor constante no reescribe filas ni dispara los triggers de inmutabilidad.
  ALTER TABLE public.audit_events
    ADD COLUMN IF NOT EXISTS hash_version smallint NOT NULL DEFAULT 1;

  CREATE OR REPLACE FUNCTION app.canonical_audit_payload_v2(
    p_chain_seq bigint,
    p_previous_hash text,
    p_tenant_id uuid,
    p_user_id uuid,
    p_action text,
    p_entity_type text,
    p_entity_id uuid,
    p_occurred_at timestamptz,
    p_result text,
    p_ip_address inet,
    p_details jsonb,
    p_platform_actor_id uuid,
    p_user_agent text,
    p_client_timestamp timestamptz,
    p_client_timezone text
  ) RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
    SELECT concat_ws('|',
      app.canonical_audit_payload(p_chain_seq, p_previous_hash, p_tenant_id, p_user_id, p_action, p_entity_type,
                                  p_entity_id, p_occurred_at, p_result, p_ip_address, p_details),
      'v2',
      COALESCE(p_platform_actor_id::text, ''),
      COALESCE(p_user_agent, ''),
      COALESCE((EXTRACT(EPOCH FROM date_trunc('milliseconds', p_client_timestamp)) * 1000)::bigint::text, ''),
      COALESCE(p_client_timezone, '')
    );
  $$;

  -- El trigger es SECURITY DEFINER de nexodocs_security (041/045): necesita ejecutar la función nueva.
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexodocs_security') THEN
      GRANT EXECUTE ON FUNCTION app.canonical_audit_payload_v2(bigint, text, uuid, uuid, text, text, uuid,
        timestamptz, text, inet, jsonb, uuid, text, timestamptz, text) TO nexodocs_security;
    END IF;
  END;
  $$;

  -- Mismo trigger que 041 (bloqueo por tenant, secuencia y hash previo); solo cambia el contenido canónico.
  -- La versión la fija el trigger: la aplicación no puede insertar un evento con el formato anterior.
  CREATE OR REPLACE FUNCTION app.trg_audit_events_chain()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp, public
  AS $$
  DECLARE
    v_tenant_key text;
    v_last_seq bigint;
    v_last_hash character(64);
    v_canonical text;
    v_genesis_hash CONSTANT character(64) := '0000000000000000000000000000000000000000000000000000000000000000';
  BEGIN
    v_tenant_key := COALESCE(NEW.tenant_id::text, 'global');
    PERFORM pg_advisory_xact_lock(726395, hashtext(v_tenant_key));

    IF NEW.tenant_id IS NOT NULL THEN
      SELECT chain_seq, record_hash
        INTO v_last_seq, v_last_hash
        FROM public.audit_events
       WHERE tenant_id = NEW.tenant_id
         AND chain_seq IS NOT NULL
       ORDER BY chain_seq DESC
       LIMIT 1;
    ELSE
      SELECT chain_seq, record_hash
        INTO v_last_seq, v_last_hash
        FROM public.audit_events
       WHERE tenant_id IS NULL
         AND chain_seq IS NOT NULL
       ORDER BY chain_seq DESC
       LIMIT 1;
    END IF;

    IF v_last_seq IS NULL THEN
      NEW.chain_seq := 1;
      NEW.previous_hash := v_genesis_hash;
    ELSE
      NEW.chain_seq := v_last_seq + 1;
      NEW.previous_hash := v_last_hash;
    END IF;

    IF NEW.occurred_at IS NULL THEN
      NEW.occurred_at := clock_timestamp();
    END IF;

    IF NEW.result IS NULL THEN
      NEW.result := 'SUCCESS';
    END IF;

    IF NEW.details IS NULL THEN
      NEW.details := '{}'::jsonb;
    END IF;

    NEW.hash_version := 2;
    v_canonical := app.canonical_audit_payload_v2(
      NEW.chain_seq,
      NEW.previous_hash,
      NEW.tenant_id,
      NEW.user_id,
      NEW.action,
      NEW.entity_type,
      NEW.entity_id,
      NEW.occurred_at,
      NEW.result,
      NEW.ip_address,
      NEW.details,
      NEW.platform_actor_id,
      NEW.user_agent,
      NEW.client_timestamp,
      NEW.client_timezone
    );

    NEW.record_hash := encode(digest(v_canonical, 'sha256'), 'hex');

    RETURN NEW;
  END;
  $$;

  -- Una secuencia duplicada en la misma cadena es un error, no un caso válido. Si ya existen duplicados
  -- (instalaciones antiguas) no se crea el índice y se avisa: la verificación los seguirá reportando.
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.audit_events
       WHERE chain_seq IS NOT NULL
       GROUP BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), chain_seq
      HAVING count(*) > 1
    ) THEN
      RAISE NOTICE '062_audit_chain_v2: chain_seq duplicados; no se crea el índice único';
    ELSE
      CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_chain_seq
        ON public.audit_events (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), chain_seq)
        WHERE chain_seq IS NOT NULL;
    END IF;
  END;
  $$;

  INSERT INTO app.schema_migrations(version) VALUES ('062_audit_chain_v2');
  \echo '062_audit_chain_v2 aplicada exitosamente'
\endif

COMMIT;
