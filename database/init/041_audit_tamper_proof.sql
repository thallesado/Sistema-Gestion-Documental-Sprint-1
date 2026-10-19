\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 41);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '041_audit_tamper_proof') AS already_applied \gset
\if :already_applied
  \echo '041_audit_tamper_proof ya aplicada'
\else

  -- 1. Agregar columnas criptográficas a audit_events
  ALTER TABLE public.audit_events
    ADD COLUMN IF NOT EXISTS chain_seq bigint,
    ADD COLUMN IF NOT EXISTS previous_hash character(64),
    ADD COLUMN IF NOT EXISTS record_hash character(64);

  CREATE INDEX IF NOT EXISTS idx_audit_chain_seq
    ON public.audit_events (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), chain_seq ASC);

  CREATE INDEX IF NOT EXISTS idx_audit_record_hash
    ON public.audit_events (record_hash);

  -- 2. Tabla para anclaje externo de hashes fuera de la base de datos
  CREATE TABLE IF NOT EXISTS public.audit_anchors (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    chain_seq bigint NOT NULL,
    record_hash character(64) NOT NULL,
    anchor_type varchar(50) NOT NULL,
    anchor_reference text NOT NULL,
    signature text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    anchored_at timestamptz NOT NULL DEFAULT now(),
    anchored_by uuid
  );

  CREATE INDEX IF NOT EXISTS idx_audit_anchors_tenant_seq
    ON public.audit_anchors(tenant_id, chain_seq DESC);

  -- 3. Función canónica para computar el contenido canónico
  CREATE OR REPLACE FUNCTION app.canonical_audit_payload(
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
    p_details jsonb
  ) RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
    SELECT concat_ws('|',
      p_chain_seq::text,
      p_previous_hash,
      COALESCE(p_tenant_id::text, ''),
      COALESCE(p_user_id::text, ''),
      COALESCE(p_action, ''),
      COALESCE(p_entity_type, ''),
      COALESCE(p_entity_id::text, ''),
      (EXTRACT(EPOCH FROM date_trunc('milliseconds', p_occurred_at)) * 1000)::bigint::text,
      COALESCE(p_result, 'SUCCESS'),
      COALESCE(host(p_ip_address), ''),
      COALESCE(p_details::text, '{}')
    );
  $$;

  -- 4. Trigger BEFORE INSERT para calcular la cadena con pg_advisory_xact_lock por tenant
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
    -- Serializar inserciones concurrentes por tenant
    v_tenant_key := COALESCE(NEW.tenant_id::text, 'global');
    PERFORM pg_advisory_xact_lock(726395, hashtext(v_tenant_key));

    -- Obtener la última secuencia y hash para este tenant
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

    v_canonical := app.canonical_audit_payload(
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
      NEW.details
    );

    NEW.record_hash := encode(digest(v_canonical, 'sha256'), 'hex');

    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS trg_audit_events_chain ON public.audit_events;
  CREATE TRIGGER trg_audit_events_chain
    BEFORE INSERT ON public.audit_events
    FOR EACH ROW
    EXECUTE FUNCTION app.trg_audit_events_chain();

  -- 5. Backfill de eventos existentes que no posean cadena de hashes
  ALTER TABLE public.audit_events DISABLE TRIGGER trg_audit_events_no_update;

  DO $$
  DECLARE
    r RECORD;
    v_curr_tenant uuid := '11111111-1111-1111-1111-111111111111'::uuid;
    v_is_first boolean := true;
    v_seq bigint := 0;
    v_prev_hash character(64);
    v_canon text;
    v_hash character(64);
    v_genesis character(64) := '0000000000000000000000000000000000000000000000000000000000000000';
  BEGIN
    FOR r IN (
      SELECT id, tenant_id, user_id, action, entity_type, entity_id, occurred_at, result, ip_address, details
        FROM public.audit_events
       WHERE chain_seq IS NULL
       ORDER BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), id ASC
    ) LOOP
      IF v_is_first OR (r.tenant_id IS DISTINCT FROM v_curr_tenant) THEN
        v_curr_tenant := r.tenant_id;
        v_is_first := false;
        v_seq := 1;
        v_prev_hash := v_genesis;
      ELSE
        v_seq := v_seq + 1;
      END IF;

      v_canon := app.canonical_audit_payload(
        v_seq,
        v_prev_hash,
        r.tenant_id,
        r.user_id,
        r.action,
        r.entity_type,
        r.entity_id,
        r.occurred_at,
        r.result,
        r.ip_address,
        r.details
      );
      v_hash := encode(digest(v_canon, 'sha256'), 'hex');

      UPDATE public.audit_events
         SET chain_seq = v_seq,
             previous_hash = v_prev_hash,
             record_hash = v_hash
       WHERE id = r.id;

      v_prev_hash := v_hash;
    END LOOP;
  END;
  $$;

  ALTER TABLE public.audit_events ENABLE TRIGGER trg_audit_events_no_update;

  -- 6. Permisos y propietarios
  ALTER FUNCTION app.canonical_audit_payload(bigint, text, uuid, uuid, text, text, uuid, timestamptz, text, inet, jsonb)
    OWNER TO nexodocs_security;
  ALTER FUNCTION app.trg_audit_events_chain()
    OWNER TO nexodocs_security;

  REVOKE ALL ON FUNCTION app.canonical_audit_payload(bigint, text, uuid, uuid, text, text, uuid, timestamptz, text, inet, jsonb) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.canonical_audit_payload(bigint, text, uuid, uuid, text, text, uuid, timestamptz, text, inet, jsonb)
    TO nexodocs_app;

  REVOKE ALL ON FUNCTION app.trg_audit_events_chain() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.trg_audit_events_chain()
    TO nexodocs_app;

  GRANT SELECT, INSERT ON public.audit_anchors TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('041_audit_tamper_proof');
\endif
COMMIT;
