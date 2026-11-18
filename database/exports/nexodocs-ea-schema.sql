--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_status AS ENUM (
    'DRAFT',
    'PENDING',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'CORRECTED',
    'CURRENT',
    'ARCHIVED',
    'VOIDED',
    'TRASHED'
);


--
-- Name: documentstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.documentstatus AS ENUM (
    'APPROVED',
    'ARCHIVED',
    'CORRECTED',
    'CURRENT',
    'DRAFT',
    'IN_REVIEW',
    'PENDING',
    'REJECTED',
    'TRASHED',
    'VOIDED'
);


--
-- Name: expedient_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expedient_status AS ENUM (
    'ACTIVE',
    'CLOSED',
    'ARCHIVED',
    'BLOCKED'
);


--
-- Name: expedientstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expedientstatus AS ENUM (
    'ACTIVE',
    'ARCHIVED',
    'BLOCKED',
    'CLOSED'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'IN_APP',
    'EMAIL',
    'PUSH'
);


--
-- Name: ocr_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ocr_status AS ENUM (
    'QUEUED',
    'PROCESSING',
    'REQUIRES_VALIDATION',
    'VALIDATED',
    'INDEXED',
    'FAILED',
    'REJECTED'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED',
    'EXPIRED'
);


--
-- Name: task_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_outcome AS ENUM (
    'APPROVED',
    'REJECTED',
    'CHANGES_REQUESTED',
    'ACKNOWLEDGED'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'OVERDUE',
    'CANCELED',
    'REJECTED',
    'RETURNED',
    'EXPIRED'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'INVITED',
    'ACTIVE',
    'INACTIVE',
    'BLOCKED',
    'SUSPENDED'
);


--
-- Name: userstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userstatus AS ENUM (
    'ACTIVE',
    'BLOCKED',
    'INACTIVE',
    'INVITED',
    'SUSPENDED'
);


--
-- Name: workflow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_status AS ENUM (
    'DRAFT',
    'STARTED',
    'IN_PROGRESS',
    'PAUSED',
    'COMPLETED',
    'CANCELED'
);


--
-- Name: CAST (public.documentstatus AS character varying); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (public.documentstatus AS character varying) WITH INOUT AS IMPLICIT;


--
-- Name: CAST (public.expedientstatus AS character varying); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (public.expedientstatus AS character varying) WITH INOUT AS IMPLICIT;


--
-- Name: CAST (public.userstatus AS character varying); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (public.userstatus AS character varying) WITH INOUT AS IMPLICIT;


--
-- Name: CAST (character varying AS public.documentstatus); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (character varying AS public.documentstatus) WITH INOUT AS IMPLICIT;


--
-- Name: CAST (character varying AS public.expedientstatus); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (character varying AS public.expedientstatus) WITH INOUT AS IMPLICIT;


--
-- Name: CAST (character varying AS public.userstatus); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (character varying AS public.userstatus) WITH INOUT AS IMPLICIT;


--
-- Name: advance_document_version(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.advance_document_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  -- Una aprobación previa no aprueba automáticamente contenido nuevo.
  UPDATE public.documents SET current_version = NEW.version_number,
    status = CASE WHEN NEW.version_number > 1 THEN 'DRAFT'::public.document_status ELSE status END
    WHERE tenant_id = NEW.tenant_id AND id = NEW.document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar el documento' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;


--
-- Name: apply_due_tenant_addon_changes(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.apply_due_tenant_addon_changes() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  DECLARE changed integer;
  DECLARE total_changed integer := 0;
  BEGIN
    UPDATE public.tenant_addons
    SET status = CASE WHEN pending_units = 0 THEN 'ENDED' ELSE status END,
        units = CASE WHEN pending_units > 0 THEN pending_units ELSE units END,
        pending_units = NULL, pending_at = NULL, updated_at = now()
    WHERE status = 'ACTIVE' AND pending_at <= now();
    GET DIAGNOSTICS changed = ROW_COUNT;
    total_changed := total_changed + changed;

    UPDATE public.tenant_addons
    SET status = 'EXPIRED', updated_at = now()
    WHERE status = 'ACTIVE' AND expires_at <= now();
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN total_changed + changed;
  END;
  $$;


--
-- Name: apply_scheduled_subscription_changes(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.apply_scheduled_subscription_changes() RETURNS TABLE(tenant_id uuid, plan_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
    UPDATE public.tenants t
    SET plan_id = t.scheduled_plan_id,
        billing_cycle_v2 = coalesce(t.scheduled_billing_cycle, t.billing_cycle_v2),
        scheduled_plan_id = NULL, scheduled_billing_cycle = NULL, scheduled_change_at = NULL
    WHERE t.stripe_subscription_id IS NULL AND t.scheduled_change_at <= now()
      AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
    RETURNING t.id, t.plan_id;
  $$;


--
-- Name: audit_row_change(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.audit_row_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $_$
DECLARE row_data jsonb; verb text; actor uuid; platform_actor uuid; scope_id uuid; changed_fields jsonb;
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN RETURN NEW; END IF;
  actor := app.current_user_id();
  scope_id := CASE WHEN TG_TABLE_NAME = 'tenants' THEN (row_data->>'id')::uuid ELSE (row_data->>'tenant_id')::uuid END;
  IF actor IS NOT NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = actor AND tenant_id IS NULL AND is_platform_admin) THEN
    platform_actor := actor; actor := NULL;
  END IF;
  IF actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor AND tenant_id IS NOT DISTINCT FROM scope_id) THEN
    RAISE EXCEPTION 'Actor de auditoría ajeno al tenant' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_agg(n.key ORDER BY n.key) INTO changed_fields FROM jsonb_each(to_jsonb(NEW)) n
    WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM (to_jsonb(OLD)->n.key);
  END IF;
  verb := upper(TG_TABLE_NAME) || '_' || TG_OP;
  INSERT INTO public.audit_events(tenant_id, user_id, platform_actor_id, action, entity_type, entity_id, details)
  VALUES (scope_id, actor, platform_actor, verb, TG_TABLE_NAME,
    CASE WHEN row_data->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN (row_data->>'id')::uuid ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'record_id', row_data->'id', 'changed_fields', changed_fields,
      'document_id', row_data->'document_id', 'role_id', row_data->'role_id', 'user_id', row_data->'user_id',
      'permission_id', row_data->'permission_id'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$_$;


--
-- Name: authorized_tenant_audit_archive_count(uuid, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.authorized_tenant_audit_archive_count(p_actor uuid, p_tenant uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'app', 'public'
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_actor AND u.tenant_id IS NULL AND u.is_platform_admin
        AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'platform audit access denied' USING ERRCODE = '42501';
    END IF;
    RETURN (SELECT count(*) FROM app.tenant_audit_archive a WHERE a.tenant_id = p_tenant);
  END;
  $$;


--
-- Name: authorized_tenant_audit_archive_page(uuid, uuid, integer, bigint); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.authorized_tenant_audit_archive_page(p_actor uuid, p_tenant uuid, p_limit integer, p_offset bigint) RETURNS TABLE(source_event_id bigint, tenant_id uuid, user_id uuid, platform_actor_id uuid, action character varying, entity_type character varying, entity_id uuid, occurred_at timestamp with time zone, client_timestamp timestamp with time zone, client_timezone character varying, ip_address inet, user_agent text, result character varying, details jsonb, chain_seq bigint, previous_hash character, record_hash character)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'app', 'public'
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_actor AND u.tenant_id IS NULL AND u.is_platform_admin
        AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'platform audit access denied' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
      SELECT a.source_event_id, a.tenant_id, a.user_id, a.platform_actor_id,
             a.action, a.entity_type, a.entity_id, a.occurred_at,
             a.client_timestamp, a.client_timezone, a.ip_address,
             a.user_agent, a.result, a.details, a.chain_seq,
             a.previous_hash, a.record_hash
      FROM app.tenant_audit_archive a
      WHERE a.tenant_id = p_tenant
      ORDER BY a.occurred_at DESC, a.source_event_id DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0);
  END;
  $$;


--
-- Name: backup_is_restoring(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.backup_is_restoring() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
    SELECT EXISTS (SELECT 1 FROM public.tenant_restore_evidence e
                   WHERE e.id::text = current_setting('app.restore_evidence', true) AND e.transaction_id = txid_current())
        OR app.tenant_purge_active()
  $$;


--
-- Name: backup_lock_writes(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.backup_lock_writes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE t uuid;
BEGIN
 IF app.backup_is_restoring() THEN RETURN COALESCE(NEW,OLD); END IF;
 t:=CASE WHEN TG_TABLE_NAME='tenants' THEN COALESCE((to_jsonb(NEW)->>'id')::uuid,(to_jsonb(OLD)->>'id')::uuid) ELSE COALESCE((to_jsonb(NEW)->>'tenant_id')::uuid,(to_jsonb(OLD)->>'tenant_id')::uuid) END;
 IF t IS NOT NULL THEN
 IF app.tenant_backup_maintenance(t) THEN RAISE EXCEPTION 'Organizaci??n en restauraci??n; modificaciones suspendidas' USING ERRCODE='55000'; END IF;
 PERFORM pg_advisory_xact_lock_shared(726396,hashtext(t::text)); END IF;
 RETURN COALESCE(NEW,OLD);
END $$;


--
-- Name: backup_scheduler_actor(uuid, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.backup_scheduler_actor(p_tenant uuid, p_permission text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
    SELECT u.id
    FROM public.users u
    JOIN public.user_roles ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id
    JOIN public.role_permissions rp ON rp.tenant_id=ur.tenant_id AND rp.role_id=ur.role_id
    JOIN public.permissions p ON p.id=rp.permission_id AND p.is_active
    WHERE u.tenant_id=p_tenant AND p_tenant=app.current_tenant_id()
      AND p.code=p_permission AND p_permission IN ('backup:create','backup:restore')
      AND u.status='ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_platform_admin
    ORDER BY u.created_at, u.id
    LIMIT 1
  $$;


--
-- Name: backup_schema_signature(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.backup_schema_signature() RETURNS text
    LANGUAGE sql STABLE
    AS $$
 SELECT md5(string_agg(c.table_name||'.'||c.column_name||':'||c.udt_name,',' ORDER BY c.table_name,c.ordinal_position))
 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name IN (SELECT app.backup_tables())
$$;


--
-- Name: backup_tables(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.backup_tables() RETURNS SETOF text
    LANGUAGE sql STABLE
    AS $$
 SELECT c.table_name::text FROM information_schema.columns c
 WHERE c.table_schema='public' AND c.column_name='tenant_id' AND EXISTS(SELECT 1 FROM information_schema.tables b WHERE b.table_schema=c.table_schema AND b.table_name=c.table_name AND b.table_type='BASE TABLE')
 AND c.table_name NOT IN ('audit_events','audit_anchors','backup_history','tenant_backups',
 'tenant_backup_settings','tenant_restore_operations','tenant_restore_evidence',
 'auth_sessions','revoked_access_tokens','password_recovery_requests',
 'billing_transactions','subscription_payments','enterprise_inquiries') ORDER BY c.table_name
$$;


--
-- Name: block_mutation(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.block_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF; RAISE EXCEPTION '% es append-only: no se permite %', TG_TABLE_NAME, TG_OP USING ERRCODE = '55000'; END;
$$;


--
-- Name: canonical_audit_payload(bigint, text, uuid, uuid, text, text, uuid, timestamp with time zone, text, inet, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.canonical_audit_payload(p_chain_seq bigint, p_previous_hash text, p_tenant_id uuid, p_user_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_occurred_at timestamp with time zone, p_result text, p_ip_address inet, p_details jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
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


--
-- Name: canonical_audit_payload_v2(bigint, text, uuid, uuid, text, text, uuid, timestamp with time zone, text, inet, jsonb, uuid, text, timestamp with time zone, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.canonical_audit_payload_v2(p_chain_seq bigint, p_previous_hash text, p_tenant_id uuid, p_user_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_occurred_at timestamp with time zone, p_result text, p_ip_address inet, p_details jsonb, p_platform_actor_id uuid, p_user_agent text, p_client_timestamp timestamp with time zone, p_client_timezone text) RETURNS text
    LANGUAGE sql IMMUTABLE
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


--
-- Name: capture_tenant_backup(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.capture_tenant_backup(t uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
DECLARE n text; rows jsonb; result jsonb:='{}';
BEGIN
 IF t IS DISTINCT FROM app.current_tenant_id() OR NOT app.has_permission('backup:create') THEN RAISE EXCEPTION 'Respaldo no autorizado' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(726396,hashtext(t::text));
 FOR n IN SELECT app.backup_tables() LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM public.%I x WHERE tenant_id=$1',n) INTO rows USING t;
 result:=result||jsonb_build_object(n,rows);
 END LOOP;
 SELECT result||jsonb_build_object('_tenant',to_jsonb(x)) INTO result FROM public.tenants x WHERE id=t;
 RETURN result;
END $_$;


--
-- Name: check_document_status_permission(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.check_document_status_permission() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE required_permission text;
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_OP = 'UPDATE' AND NEW.author_id <> OLD.author_id THEN
    RAISE EXCEPTION 'El autor original del documento es inmutable' USING ERRCODE = '23514';
  END IF;
  IF NOT pg_has_role(current_user, 'nexodocs_app', 'USAGE') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT app.has_permission('document:delete') THEN
    RAISE EXCEPTION 'Permiso requerido: document:delete' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  required_permission := CASE NEW.status
    WHEN 'APPROVED' THEN 'document:approve' WHEN 'CURRENT' THEN 'document:approve'
    WHEN 'REJECTED' THEN 'document:reject' WHEN 'ARCHIVED' THEN 'document:archive'
    WHEN 'VOIDED' THEN 'document:delete' WHEN 'TRASHED' THEN 'document:delete' ELSE NULL END;
  IF required_permission IS NOT NULL AND NOT app.has_permission(required_permission) THEN
    RAISE EXCEPTION 'Permiso requerido: %', required_permission USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: complete_stripe_payment(uuid, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.complete_stripe_payment(p_transaction_id uuid, p_payment_intent_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
  DECLARE tx billing_transactions%ROWTYPE; period_end timestamptz;
  BEGIN
    SELECT * INTO tx FROM billing_transactions WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND OR tx.payment_method <> 'STRIPE_CARD' THEN RETURN false; END IF;
    IF tx.status = 'COMPLETED' THEN RETURN tx.external_reference = p_payment_intent_id; END IF;
    IF tx.status <> 'PENDING' OR tx.external_reference <> p_payment_intent_id THEN RETURN false; END IF;
    period_end := now() + CASE WHEN tx.billing_period = 'ANNUAL' THEN interval '365 days' ELSE interval '30 days' END;
    UPDATE billing_transactions SET status = 'COMPLETED', completed_at = now(),
      metadata_json = metadata_json || jsonb_build_object('stripePaymentIntentId', p_payment_intent_id, 'settledBy', 'stripe_webhook')
      WHERE id = tx.id;
    UPDATE tenants SET plan_id = tx.plan_id, subscription_status = 'ACTIVE', current_period_end = period_end,
      billing_cycle_v2 = tx.billing_period, preferred_payment_method = 'STRIPE_CARD' WHERE id = tx.tenant_id;
    RETURN true;
  END;
  $$;


--
-- Name: consume_ocr_pack_pages(bigint); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.consume_ocr_pack_pages(p_pages bigint) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  DECLARE
    pending bigint := greatest(coalesce(p_pages, 0), 0);
    consumed bigint := 0;
    pack record;
    take bigint;
  BEGIN
    IF pending = 0 THEN RETURN 0; END IF;
    IF NOT app.context_is_valid() THEN RAISE EXCEPTION 'Contexto de tenant no válido' USING ERRCODE = '42501'; END IF;
    FOR pack IN
      SELECT ta.id, ta.remaining_quantity FROM public.tenant_addons ta JOIN public.addons a ON a.id = ta.addon_id
      WHERE ta.tenant_id = app.current_tenant_id() AND ta.status = 'ACTIVE' AND a.kind = 'CONSUMABLE'
        AND ta.remaining_quantity > 0 AND (ta.expires_at IS NULL OR ta.expires_at > now())
      ORDER BY ta.expires_at NULLS LAST, ta.created_at
      FOR UPDATE OF ta
    LOOP
      EXIT WHEN pending = 0;
      take := least(pending, pack.remaining_quantity);
      UPDATE public.tenant_addons SET remaining_quantity = remaining_quantity - take, updated_at = now() WHERE id = pack.id;
      pending := pending - take;
      consumed := consumed + take;
    END LOOP;
    RETURN consumed;
  END $$;


--
-- Name: context_is_valid(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.context_is_valid() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = app.current_user_id() AND u.tenant_id = app.current_tenant_id()
      AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_platform_admin
      AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
  )
$$;


--
-- Name: create_public_tenant_onboarding(uuid, text, text, text, text, uuid, timestamp with time zone, timestamp with time zone, uuid, text, text, text, text, text, bigint[]); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.create_public_tenant_onboarding(p_tenant_id uuid, p_name text, p_code text, p_slug text, p_email text, p_plan_id uuid, p_trial_start timestamp with time zone, p_trial_end timestamp with time zone, p_admin_id uuid, p_username text, p_admin_email text, p_password_hash text, p_first_name text, p_last_name text, p_permission_ids bigint[]) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  DECLARE new_role_id bigint;
  BEGIN
    IF p_tenant_id IS NULL OR p_admin_id IS NULL OR p_trial_end <= p_trial_start
       OR p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
      RAISE EXCEPTION 'Datos de alta inválidos' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
    INSERT INTO public.tenants (
      id, plan_id, name, code, slug, email, primary_color, subscription_status,
      trial_start_at, trial_ends_at, billing_cycle_v2, currency, timezone,
      date_format, default_language
    ) VALUES (
      p_tenant_id, p_plan_id, left(trim(p_name),150), left(trim(p_code),50),
      left(trim(p_slug),80), left(lower(trim(p_email)),150), '#087f7b',
      'TRIAL', p_trial_start, p_trial_end, 'MONTHLY', 'USD',
      'America/La_Paz', 'YYYY-MM-DD', 'es'
    );

    INSERT INTO public.users (
      id, tenant_id, username, email, password_hash, first_name, last_name,
      status, is_platform_admin, preferred_language, must_change_password
    ) VALUES (
      p_admin_id, p_tenant_id, left(trim(p_username),80),
      left(lower(trim(p_admin_email)),150), p_password_hash,
      left(trim(p_first_name),100), left(trim(p_last_name),100),
      'ACTIVE', false, 'es', false
    );

    PERFORM set_config('app.user_id', p_admin_id::text, true);
    INSERT INTO public.roles (tenant_id, name, description, is_system, is_active)
    VALUES (p_tenant_id, 'Administrador de tenant',
            'Administrador inicial creado durante el alta de la organización', true, true)
    RETURNING id INTO new_role_id;

    INSERT INTO public.user_roles (tenant_id, user_id, role_id)
    VALUES (p_tenant_id, p_admin_id, new_role_id);

    INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
    SELECT p_tenant_id, new_role_id, p.id
    FROM public.permissions p
    WHERE p.is_active AND p.id = ANY(COALESCE(p_permission_ids, ARRAY[]::bigint[]))
    ON CONFLICT DO NOTHING;

    RETURN new_role_id;
  END;
  $$;


--
-- Name: current_role_ids(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.current_role_ids() RETURNS SETOF bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
    SELECT r.id
    FROM public.user_roles ur
    JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
    WHERE app.context_is_valid()
      AND ur.tenant_id = app.current_tenant_id()
      AND ur.user_id = app.current_user_id()
  $$;


--
-- Name: current_role_names(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.current_role_names() RETURNS SETOF text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
    SELECT r.name::text
    FROM public.user_roles ur
    JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
    WHERE app.context_is_valid()
      AND ur.tenant_id = app.current_tenant_id()
      AND ur.user_id = app.current_user_id()
  $$;


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;


--
-- Name: current_user_id(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;


--
-- Name: delete_expired_revoked_access_token(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.delete_expired_revoked_access_token() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  BEGIN
    IF OLD.expires_at > statement_timestamp() THEN
      RAISE EXCEPTION 'Solo se pueden eliminar revocaciones vencidas'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END;
  $$;


--
-- Name: document_has_active_workflow(uuid, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.document_has_active_workflow(scope uuid, document uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT EXISTS(SELECT 1 FROM public.workflow_documents wd JOIN public.workflows w
    ON w.id=wd.workflow_id AND w.tenant_id=wd.tenant_id
    WHERE wd.tenant_id=scope AND scope=nullif(current_setting('app.tenant_id',true),'')::uuid
      AND wd.document_id=document AND w.status IN ('STARTED','IN_PROGRESS','PAUSED') AND w.deleted_at IS NULL)
$$;


--
-- Name: enforce_medical_note_lifecycle(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.enforce_medical_note_lifecycle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Toda nota médica debe crearse como BORRADOR' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las notas médicas no pueden eliminarse' USING ERRCODE = '23514';
  END IF;
  IF OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Una nota VIGENTE o ANULADA es inmutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status NOT IN ('APPROVED', 'VOIDED')
     OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Solo se permite emitir o anular un borrador sin alterar su contenido' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_tenant_admin_presence(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.enforce_tenant_admin_presence() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE admin_count integer;
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r
       ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id
       WHERE ur.tenant_id=OLD.tenant_id AND ur.user_id=OLD.id
         AND r.name='Administrador de tenant' AND r.is_active)
     AND (TG_OP='DELETE' OR NEW.status <> 'ACTIVE') THEN
    SELECT count(*) INTO admin_count FROM public.user_roles ur JOIN public.roles r
      ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id
      JOIN public.users u ON u.id=ur.user_id AND u.tenant_id=ur.tenant_id
      WHERE ur.tenant_id=OLD.tenant_id AND r.name='Administrador de tenant'
        AND r.is_active AND u.status='ACTIVE' AND u.deleted_at IS NULL
        AND u.id <> OLD.id;
    IF admin_count = 0 THEN
      RAISE EXCEPTION 'El tenant debe conservar al menos un administrador activo' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;


--
-- Name: finish_nonrenewed_subscriptions(integer); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.finish_nonrenewed_subscriptions(p_retention_days integer) RETURNS TABLE(tenant_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  BEGIN
    IF p_retention_days IS NULL OR p_retention_days < 1 OR p_retention_days > 3650 THEN
      RAISE EXCEPTION 'Período de retención inválido' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
      UPDATE public.tenants t
      SET subscription_status = 'CANCELED', canceled_at = now(),
          cancellation_reason = coalesce(cancellation_reason, 'No renovada al terminar el período'),
          deletion_scheduled_at = now() + make_interval(days => p_retention_days),
          cancel_at_period_end = false
      WHERE t.cancel_at_period_end AND t.stripe_subscription_id IS NULL
        AND t.current_period_end <= now()
        AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
      RETURNING t.id;
  END;
  $$;


--
-- Name: grant_addon_from_payment(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.grant_addon_from_payment(p_transaction uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  DECLARE
    tx public.billing_transactions;
    addon public.addons;
    units integer;
    months integer;
  BEGIN
    IF NOT app.context_is_valid() THEN RAISE EXCEPTION 'Contexto de tenant no válido' USING ERRCODE = '42501'; END IF;
    SELECT * INTO tx FROM public.billing_transactions
      WHERE id = p_transaction AND tenant_id = app.current_tenant_id() FOR UPDATE;
    IF NOT FOUND OR tx.status <> 'COMPLETED' OR tx.metadata_json->>'kind' IS DISTINCT FROM 'addon' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM public.tenant_addons WHERE billing_transaction_id = tx.id) THEN RETURN true; END IF;
    SELECT * INTO addon FROM public.addons WHERE id = (tx.metadata_json->>'addonId')::uuid;
    IF NOT FOUND THEN RETURN false; END IF;
    units := (tx.metadata_json->>'units')::integer;
    months := CASE WHEN addon.kind = 'CONSUMABLE' THEN addon.validity_months
                   WHEN tx.billing_period = 'ANNUAL' THEN 12 ELSE 1 END;
    INSERT INTO public.tenant_addons (tenant_id, addon_id, units, source, billing_transaction_id, remaining_quantity, expires_at)
    VALUES (tx.tenant_id, addon.id, units, 'MANUAL_PAYMENT', tx.id,
            CASE WHEN addon.kind = 'CONSUMABLE' THEN units::bigint * addon.unit_quantity END,
            coalesce(tx.completed_at, now()) + make_interval(months => months));
    RETURN true;
  END $$;


--
-- Name: guard_document_transfer(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.guard_document_transfer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'app'
    AS $$
BEGIN
 IF OLD.status='EXECUTED' OR NOT ((OLD.status='REQUESTED' AND NEW.status='APPROVED') OR (OLD.status='APPROVED' AND NEW.status='EXECUTED')) THEN
   RAISE EXCEPTION 'Transicion de transferencia no permitida' USING ERRCODE='23514';
 END IF;
 IF NEW.status='APPROVED' AND (NEW.approved_by IS DISTINCT FROM app.current_user_id() OR NEW.approved_at IS NULL) THEN
   RAISE EXCEPTION 'Aprobador invalido' USING ERRCODE='23514';
 END IF;
 IF NEW.status='EXECUTED' AND (NEW.executed_by IS DISTINCT FROM app.current_user_id() OR NEW.executed_at IS NULL) THEN
   RAISE EXCEPTION 'Ejecutor invalido' USING ERRCODE='23514';
 END IF;
 IF NEW.status='EXECUTED' AND NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.document_id AND d.archive_level=NEW.to_level AND d.archive_level_since=current_date) THEN
   RAISE EXCEPTION 'La transferencia debe actualizar el nivel del documento en la misma transaccion' USING ERRCODE='23514';
 END IF;
 IF OLD.status='APPROVED' AND (NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
   RAISE EXCEPTION 'La evidencia de aprobacion no puede alterarse' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: guard_users_customize_update(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.guard_users_customize_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  DECLARE
    allowed text[] := ARRAY['phone', 'biography', 'email_notifications', 'push_notifications',
                            'must_change_password', 'preferred_language', 'updated_at'];
  BEGIN
    IF current_user = 'nexodocs_app'
       AND NEW.id IS DISTINCT FROM app.current_user_id()
       AND NOT app.has_permission('user:update')
       AND (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
      RAISE EXCEPTION 'Changing account data of another user requires user:update'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END;
  $$;


--
-- Name: guard_users_self_update(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.guard_users_self_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  BEGIN
    IF current_user = 'nexodocs_app'
       AND NOT app.has_permission('user:update')
       AND (NEW.status IS DISTINCT FROM OLD.status
            OR NEW.department_id IS DISTINCT FROM OLD.department_id
            OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
            OR NEW.username IS DISTINCT FROM OLD.username) THEN
      RAISE EXCEPTION 'Changing status, department, username or deletion mark requires user:update'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END;
  $$;


--
-- Name: has_permission(text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.has_permission(permission_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT app.context_is_valid() AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active
    JOIN public.tenants t ON t.id = ur.tenant_id
    WHERE ur.tenant_id = app.current_tenant_id() AND ur.user_id = app.current_user_id() AND p.code = permission_code
      AND (
        (p.module IN ('workflow', 'workflow_template') AND EXISTS (
          SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'workflows' AND pf.is_enabled = true
        ))
        OR
        (p.module = 'ocr' AND EXISTS (
          SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'ocr_scanning' AND pf.is_enabled = true
        ))
        OR
        (p.module IN ('patient', 'medical_note', 'clinical', 'clinical_history', 'clinical_staff') AND EXISTS (
          SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'clinical_module' AND pf.is_enabled = true
        ))
        OR
        (p.module = 'dicom' AND EXISTS (
          SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'dicom_imaging' AND pf.is_enabled = true
        ))
        OR
        (p.module = 'report' AND EXISTS (
          SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'advanced_analytics' AND pf.is_enabled = true
        ))
        OR
        (p.module NOT IN ('workflow', 'workflow_template', 'ocr', 'patient', 'medical_note', 'clinical', 'clinical_history', 'clinical_staff', 'dicom', 'report'))
      )
  )
$$;


--
-- Name: list_login_tenants(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.list_login_tenants() RETURNS TABLE(id uuid, name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
    SELECT t.id, t.name::text
    FROM public.tenants t
    WHERE t.subscription_status IN ('TRIAL', 'ACTIVE')
    ORDER BY t.name
  $$;


--
-- Name: list_platform_technical_logs(text, uuid, integer, bigint); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.list_platform_technical_logs(p_level text, p_tenant_id uuid, p_limit integer, p_offset bigint) RETURNS TABLE(id bigint, occurred_at timestamp with time zone, level text, tenant_id uuid, actor_id uuid, category text, summary text, request_method text, request_path text, http_status integer, exception_type text, total_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'app', 'public'
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = app.current_user_id() AND u.tenant_id IS NULL
        AND u.is_platform_admin AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT l.id,l.occurred_at,l.level,l.tenant_id,l.actor_id,l.category,l.summary,
           l.request_method,l.request_path,l.http_status,l.exception_type,
           count(*) OVER() AS total_count
    FROM public.platform_technical_logs l
    WHERE (p_level IS NULL OR l.level=p_level)
      AND (p_tenant_id IS NULL OR l.tenant_id=p_tenant_id)
    ORDER BY l.occurred_at DESC,l.id DESC
    LIMIT greatest(1,least(coalesce(p_limit,25),100))
    OFFSET greatest(coalesce(p_offset,0),0);
  END;
  $$;


--
-- Name: lock_workflow_template(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.lock_workflow_template() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  IF NEW.workflow_template_id IS NOT NULL THEN
    PERFORM 1 FROM public.workflow_templates WHERE tenant_id = NEW.tenant_id AND id = NEW.workflow_template_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plantilla no disponible' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: lookup_password_recovery(text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.lookup_password_recovery(p_token_hash text) RETURNS TABLE(id uuid, user_id uuid, tenant_id uuid, token_hash character varying, expires_at timestamp with time zone, used_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $_$
  DECLARE found_user uuid; found_tenant uuid;
  BEGIN
    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
    PERFORM set_config('app.recovery_token_hash', p_token_hash, true);
    SELECT r.user_id, r.tenant_id INTO found_user, found_tenant
      FROM public.password_recovery_requests r WHERE r.token_hash=p_token_hash
      FOR UPDATE;
    IF found_user IS NULL OR found_tenant IS NULL THEN RETURN; END IF;
    PERFORM set_config('app.tenant_id', found_tenant::text, true);
    PERFORM set_config('app.user_id', found_user::text, true);
    RETURN QUERY SELECT r.id, r.user_id, r.tenant_id, r.token_hash,
                        r.expires_at, r.used_at, r.created_at
      FROM public.password_recovery_requests r
      WHERE r.token_hash=p_token_hash AND r.user_id=found_user AND r.tenant_id=found_tenant;
  END;
  $_$;


--
-- Name: lookup_tenant_login(uuid, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.lookup_tenant_login(p_tenant_id uuid, p_identifier text) RETURNS TABLE(id uuid, tenant_id uuid, username character varying, email character varying, password_hash character varying, first_name character varying, last_name character varying, status public.user_status, deleted_at timestamp with time zone, is_platform_admin boolean, preferred_language character varying, must_change_password boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  DECLARE matched_user_id uuid;
  BEGIN
    IF p_tenant_id IS NULL OR p_identifier IS NULL OR length(p_identifier) > 150 THEN
      RETURN;
    END IF;
    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
    SELECT u.id INTO matched_user_id
      FROM public.users u
     WHERE u.tenant_id = p_tenant_id
       AND (lower(u.username) = lower(p_identifier) OR lower(u.email) = lower(p_identifier))
     ORDER BY u.id
     LIMIT 1;
    IF matched_user_id IS NULL THEN RETURN; END IF;
    PERFORM set_config('app.user_id', matched_user_id::text, true);
    RETURN QUERY
      SELECT u.id, u.tenant_id, u.username, u.email, u.password_hash,
             u.first_name, u.last_name, u.status, u.deleted_at,
             u.is_platform_admin, u.preferred_language, u.must_change_password
        FROM public.users u WHERE u.id = matched_user_id AND u.tenant_id = p_tenant_id;
  END;
  $$;


--
-- Name: prepare_document_version(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.prepare_document_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE latest integer; document_state public.document_status; removed_at timestamptz;
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  SELECT d.current_version, d.status, d.deleted_at INTO latest, document_state, removed_at FROM public.documents d WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE = '23503'; END IF;
  IF document_state IN ('ARCHIVED','VOIDED','TRASHED') OR removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reabrir el documento antes de agregar contenido' USING ERRCODE = '23514';
  END IF;
  SELECT max(v.version_number) INTO latest FROM public.document_versions v WHERE v.tenant_id = NEW.tenant_id AND v.document_id = NEW.document_id;
  NEW.version_number := coalesce(NEW.version_number, coalesce(latest, 0) + 1);
  IF NEW.version_number <> coalesce(latest, 0) + 1 THEN
    RAISE EXCEPTION 'Versión desactualizada: se esperaba %', coalesce(latest, 0) + 1 USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: process_workflow_deadlines(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.process_workflow_deadlines() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
DECLARE item record; processed integer:=0; event_name text;
BEGIN
  FOR item IN
    SELECT q.id AS task_id,q.tenant_id,q.workflow_id,q.workflow_step_id,q.document_id,
      q.assigned_user_id,q.title AS task_title,q.due_at,q.status AS task_status,
      w.title AS workflow_title,w.code AS workflow_code,w.status AS workflow_status,
      w.expedient_id,w.current_stage_id
    FROM public.workflow_tasks q
    JOIN public.workflows w ON w.tenant_id=q.tenant_id AND w.id=q.workflow_id
    WHERE w.status IN ('STARTED','IN_PROGRESS') AND w.deleted_at IS NULL
      AND q.due_at IS NOT NULL AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')
      AND ((q.due_at<=clock_timestamp() AND q.expired_notified_at IS NULL)
        OR (q.due_at>clock_timestamp() AND q.due_at<=clock_timestamp()+interval '24 hours' AND q.due_soon_notified_at IS NULL))
    ORDER BY q.due_at
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    IF item.due_at<=clock_timestamp() THEN
      event_name:='TASK_EXPIRED';
      UPDATE public.workflow_tasks SET status='OVERDUE',expired_notified_at=clock_timestamp(),updated_at=clock_timestamp()
        WHERE tenant_id=item.tenant_id AND id=item.task_id;
      INSERT INTO public.notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id)
      VALUES(item.tenant_id,item.assigned_user_id,'TASK_EXPIRED','Tarea vencida',item.task_title||' ?? '||item.workflow_title,'workflow_task',item.task_id);
    ELSE
      event_name:='TASK_DUE_SOON';
      UPDATE public.workflow_tasks SET due_soon_notified_at=clock_timestamp(),updated_at=clock_timestamp()
        WHERE tenant_id=item.tenant_id AND id=item.task_id;
      INSERT INTO public.notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id)
      VALUES(item.tenant_id,item.assigned_user_id,'TASK_DUE_SOON','Tarea pr??xima a vencer',item.task_title||' ?? '||item.workflow_title,'workflow_task',item.task_id);
    END IF;
    INSERT INTO public.workflow_events(tenant_id,workflow_id,task_id,document_id,event_type,result,details)
    VALUES(item.tenant_id,item.workflow_id,item.task_id,item.document_id,event_name,item.task_status::text,
      jsonb_build_object('scheduled',true,'dueAt',item.due_at,'fromStatus',item.task_status,'toStatus',
        CASE WHEN event_name='TASK_EXPIRED' THEN 'OVERDUE' ELSE item.task_status::text END,
        'workflowId',item.workflow_id,'taskId',item.task_id,'stepId',item.workflow_step_id,
        'documentId',item.document_id,'expedientId',item.expedient_id,'tenant',item.tenant_id,'timestamp',clock_timestamp()));
    INSERT INTO public.audit_events(tenant_id,action,entity_type,entity_id,details)
    VALUES(item.tenant_id,'WORKFLOW_'||event_name,'WORKFLOW',item.workflow_id,
      jsonb_build_object('workflowId',item.workflow_id,'taskId',item.task_id,'stepId',item.workflow_step_id,
        'documentId',item.document_id,'expedientId',item.expedient_id,'fromStatus',item.task_status,
        'toStatus',CASE WHEN event_name='TASK_EXPIRED' THEN 'OVERDUE' ELSE item.task_status::text END,
        'user',NULL,'timestamp',clock_timestamp(),'tenant',item.tenant_id,'dueAt',item.due_at,'scheduled',true));
    processed:=processed+1;
  END LOOP;
  RETURN processed;
END;
$$;


--
-- Name: protect_backup_evidence(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.protect_backup_evidence() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    IF app.tenant_purge_active() THEN RETURN COALESCE(NEW, OLD); END IF;
    IF OLD.pinned AND OLD.status = 'COMPLETED' AND (TG_OP = 'DELETE' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)) THEN
      RAISE EXCEPTION 'El respaldo es evidencia protegida' USING ERRCODE = '55000';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END $$;


--
-- Name: protect_clinical_history(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.protect_clinical_history() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'La historia clínica solo admite baja lógica justificada' USING ERRCODE = '23514';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'La evidencia de una historia dada de baja es inmutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    IF NEW.deleted_by IS NULL OR NEW.deletion_reason IS NULL
       OR length(btrim(NEW.deletion_reason)) NOT BETWEEN 10 AND 500 THEN
      RAISE EXCEPTION 'La baja exige autor y motivo de 10 a 500 caracteres' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.deleted_by AND u.tenant_id = NEW.tenant_id) THEN
      RAISE EXCEPTION 'El autor de la baja debe pertenecer al tenant' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_row_identity(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.protect_row_identity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  IF (to_jsonb(NEW)->'tenant_id') IS DISTINCT FROM (to_jsonb(OLD)->'tenant_id') OR (to_jsonb(NEW)->'id') IS DISTINCT FROM (to_jsonb(OLD)->'id') THEN
    RAISE EXCEPTION 'La identidad y el tenant de una fila son inmutables' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_used_template(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.protect_used_template() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE template_id uuid; scope_id uuid;
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_TABLE_NAME='workflow_templates' THEN
    template_id:=OLD.id;scope_id:=OLD.tenant_id;
    IF TG_OP='UPDATE' AND
      (to_jsonb(NEW)-ARRAY['is_active','updated_at','publication_status'])=
      (to_jsonb(OLD)-ARRAY['is_active','updated_at','publication_status']) THEN RETURN NEW; END IF;
  ELSE
    IF TG_OP='INSERT' THEN template_id:=NEW.workflow_template_id;scope_id:=NEW.tenant_id;
    ELSE template_id:=OLD.workflow_template_id;scope_id:=OLD.tenant_id; END IF;
    IF TG_OP='UPDATE' AND NEW.workflow_template_id<>OLD.workflow_template_id THEN
      RAISE EXCEPTION 'No se permite trasladar etapas/transiciones a otra plantilla' USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM public.workflow_templates WHERE tenant_id=scope_id AND id=template_id FOR UPDATE;
  END IF;
  IF EXISTS(SELECT 1 FROM public.workflows WHERE tenant_id=scope_id AND workflow_template_id=template_id) THEN
    RAISE EXCEPTION 'Plantilla utilizada: crear una nueva versión antes de editarla' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;


--
-- Name: purge_tenant(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.purge_tenant(t uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
  DECLARE
    proof uuid := gen_random_uuid();
    target public.tenants;
    n text;
    affected bigint;
    summary jsonb := '{}'::jsonb;
  BEGIN
    SELECT * INTO target FROM public.tenants WHERE id = t FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Organización inexistente' USING ERRCODE = '02000'; END IF;
    IF target.purged_at IS NOT NULL THEN RETURN jsonb_build_object('alreadyPurged', true); END IF;
    IF target.subscription_status <> 'CANCELED' OR target.deletion_scheduled_at IS NULL
       OR target.deletion_scheduled_at > now() THEN
      RAISE EXCEPTION 'La organización no está programada para eliminarse' USING ERRCODE = '55000';
    END IF;
    PERFORM pg_advisory_xact_lock(726396, hashtext(t::text));
    INSERT INTO app.tenant_purges (id, tenant_id, transaction_id) VALUES (proof, t, txid_current());
    PERFORM set_config('app.tenant_purge', proof::text, true);
    SET CONSTRAINTS ALL DEFERRED;

    FOR n IN SELECT x FROM app.backup_tables() x WHERE x <> 'users' LOOP
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', n) USING t;
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected > 0 THEN summary := summary || jsonb_build_object(n, affected); END IF;
    END LOOP;
    DELETE FROM public.auth_sessions WHERE tenant_id = t;
    DELETE FROM public.password_recovery_requests WHERE tenant_id = t;
    UPDATE public.tenant_backups SET payload = NULL, file_path = NULL, status = 'EXPIRED', pinned = false
      WHERE tenant_id = t;

    -- Las identidades siguen referenciadas por auditoría y facturación: se anonimizan, no se borran.
    UPDATE public.users SET
      username = 'eliminado-' || replace(id::text, '-', ''),
      email = 'eliminado+' || id::text || '@nexodocs.invalid',
      first_name = 'Usuario', last_name = 'eliminado',
      password_hash = '!purged', phone = NULL, biography = NULL, document_number = NULL, department_id = NULL,
      avatar_data = NULL, avatar_content_type = NULL,
      status = 'INACTIVE', deleted_at = COALESCE(deleted_at, now())
    WHERE tenant_id = t;
    UPDATE public.tenants SET
      email = 'eliminado+' || id::text || '@nexodocs.invalid',
      phone = NULL, address = NULL, logo_url = NULL, settings = '{}'::jsonb,
      scheduled_plan_id = NULL, scheduled_change_at = NULL, purged_at = now()
    WHERE id = t;

    SET CONSTRAINTS ALL IMMEDIATE;
    PERFORM set_config('app.tenant_purge', '', true);
    INSERT INTO public.audit_events (tenant_id, action, entity_type, entity_id, result, details)
    VALUES (t, 'TENANT_PURGED', 'tenants', t, 'SUCCESS',
            jsonb_build_object('deletedRows', summary, 'canceledAt', target.canceled_at,
                               'reason', target.cancellation_reason));
    RETURN summary;
  END $_$;


--
-- Name: record_failed_authentication(uuid, text, inet, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_failed_authentication(p_tenant_id uuid, p_attempted_identifier text, p_ip_address inet, p_user_agent text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  DECLARE scoped_tenant uuid;
  BEGIN
    IF p_tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
      scoped_tenant := p_tenant_id;
    END IF;
    INSERT INTO public.audit_events(
      tenant_id, action, entity_type, result, ip_address, user_agent, details
    ) VALUES (
      scoped_tenant,
      'LOGIN_FAILED',
      'AUTHENTICATION',
      'FAILURE',
      p_ip_address,
      left(COALESCE(p_user_agent, ''), 1000),
      jsonb_build_object('attemptedIdentifier', left(COALESCE(p_attempted_identifier, ''), 150))
    );
  END;
  $$;


--
-- Name: record_http_access(text, text, uuid, text, inet, text, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_http_access(p_action text, p_entity_type text, p_entity_id uuid, p_result text, p_ip_address inet, p_user_agent text, p_details jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $_$
    SELECT app.record_http_access($1, $2, $3, $4, $5, $6, $7, NULL::timestamptz, NULL::text);
  $_$;


--
-- Name: record_http_access(text, text, uuid, text, inet, text, jsonb, timestamp with time zone, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_http_access(p_action text, p_entity_type text, p_entity_id uuid, p_result text, p_ip_address inet, p_user_agent text, p_details jsonb, p_client_timestamp timestamp with time zone, p_client_timezone text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  BEGIN
    IF NOT app.context_is_valid() THEN
      RAISE EXCEPTION 'Contexto autenticado inv?lido' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.audit_events(
      tenant_id, user_id, action, entity_type, entity_id,
      result, ip_address, user_agent, details,
      client_timestamp, client_timezone
    ) VALUES (
      app.current_tenant_id(), app.current_user_id(),
      left(p_action, 80), left(p_entity_type, 60), p_entity_id,
      left(p_result, 30), p_ip_address, left(p_user_agent, 1000),
      COALESCE(p_details, '{}'::jsonb),
      p_client_timestamp, left(p_client_timezone, 100)
    );
  END;
  $$;


--
-- Name: record_platform_technical_log(text, uuid, uuid, text, text, text, text, integer, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_platform_technical_log(p_level text, p_tenant_id uuid, p_actor_id uuid, p_category text, p_summary text, p_method text, p_path text, p_status integer, p_exception_type text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'app', 'public'
    AS $$
  DECLARE actor_tenant uuid;
  BEGIN
    IF p_actor_id IS NOT NULL THEN
      SELECT u.tenant_id INTO actor_tenant FROM public.users u
      WHERE u.id=p_actor_id AND u.status='ACTIVE' AND u.deleted_at IS NULL;
      IF NOT FOUND OR p_tenant_id IS DISTINCT FROM actor_tenant THEN
        RAISE EXCEPTION 'Invalid technical log actor scope' USING ERRCODE = '42501';
      END IF;
    ELSIF p_tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Tenant-scoped logs require an authenticated actor' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.platform_technical_logs(level,tenant_id,actor_id,category,summary,request_method,request_path,http_status,exception_type)
    VALUES (p_level,p_tenant_id,p_actor_id,p_category,p_summary,p_method,p_path,p_status,p_exception_type);
    RETURN true;
  END;
  $$;


--
-- Name: record_tenant_lifecycle_audit(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_tenant_lifecycle_audit(p_tenant_id uuid, p_actor_id uuid, p_action text, p_details jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $$
  BEGIN
    IF p_tenant_id IS NULL OR p_action NOT IN (
      'SUBSCRIPTION_UPGRADED','SUBSCRIPTION_CHANGE_SCHEDULED','SUBSCRIPTION_CHANGE_UNSCHEDULED',
      'SUBSCRIPTION_RENEWAL_RESUMED','SUBSCRIPTION_RENEWAL_STOPPED','SUBSCRIPTION_CANCELED',
      'SUBSCRIPTION_ENDED','SUBSCRIPTION_CHANGE_APPLIED'
    ) THEN
      RAISE EXCEPTION 'Evento de suscripción inválido' USING ERRCODE = '22023';
    END IF;
    IF p_actor_id IS NULL THEN
      IF p_action NOT IN ('SUBSCRIPTION_ENDED','SUBSCRIPTION_CHANGE_APPLIED')
         OR app.current_tenant_id() IS NOT NULL OR app.current_user_id() IS NOT NULL THEN
        RAISE EXCEPTION 'Contexto de sistema inválido' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF app.current_tenant_id() IS DISTINCT FROM p_tenant_id
         OR app.current_user_id() IS DISTINCT FROM p_actor_id
         OR NOT (app.has_permission('tenant:update') OR app.has_permission('tenant:manage')) THEN
        RAISE EXCEPTION 'Permiso de suscripción requerido' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
      RAISE EXCEPTION 'Organización no disponible' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.audit_events(tenant_id,user_id,action,entity_type,entity_id,result,details)
    VALUES (p_tenant_id,p_actor_id,p_action,'TENANT',p_tenant_id,'SUCCESS',coalesce(p_details,'{}'::jsonb));
    RETURN true;
  END;
  $$;


--
-- Name: record_tenant_monthly_usage(uuid, integer, bigint, integer); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_tenant_monthly_usage(p_tenant_id uuid, p_documents integer DEFAULT 0, p_storage_bytes bigint DEFAULT 0, p_ocr_pages integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
  DECLARE
    current_month date := date_trunc('month', now())::date;
  BEGIN
    INSERT INTO public.tenant_usage_monthly (
      tenant_id, year_month, api_calls, ocr_pages, documents_created, storage_bytes, updated_at
    ) VALUES (
      p_tenant_id, current_month, 0, GREATEST(0, p_ocr_pages), GREATEST(0, p_documents), GREATEST(0, p_storage_bytes), now()
    )
    ON CONFLICT (tenant_id, year_month)
    DO UPDATE SET
      documents_created = public.tenant_usage_monthly.documents_created + GREATEST(0, p_documents),
      storage_bytes = public.tenant_usage_monthly.storage_bytes + GREATEST(0, p_storage_bytes),
      ocr_pages = public.tenant_usage_monthly.ocr_pages + GREATEST(0, p_ocr_pages),
      updated_at = now();
  END;
  $$;


--
-- Name: record_workflow_audit(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_workflow_audit(p_action text, p_workflow_id uuid, p_task_id uuid, p_step_id uuid, p_document_id uuid, p_expedient_id uuid, p_from_status text, p_to_status text, p_metadata jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'app', 'pg_temp'
    AS $_$
BEGIN
  IF NOT app.context_is_valid() OR app.current_tenant_id() IS NULL OR app.current_user_id() IS NULL THEN
    RAISE EXCEPTION 'Contexto de tenant requerido' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action !~ '^WORKFLOW_[A-Z0-9_]{1,70}$' THEN
    RAISE EXCEPTION 'Acci??n de auditor??a inv??lida' USING ERRCODE='22023';
  END IF;
  IF p_action LIKE 'WORKFLOW_TEMPLATE_%' THEN
    IF NOT (app.has_permission('workflow_template:create') OR app.has_permission('workflow_template:update')
      OR app.has_permission('workflow_template:delete') OR app.has_permission('workflow:designer')) THEN
      RAISE EXCEPTION 'Permiso requerido para auditar plantilla' USING ERRCODE='42501';
    END IF;
  ELSIF NOT (app.has_permission('workflow:create') OR app.has_permission('workflow:start')
      OR app.has_permission('workflow:update') OR app.has_permission('workflow:pause')
      OR app.has_permission('workflow:cancel') OR app.has_permission('task:create')
      OR app.has_permission('task:update') OR app.has_permission('workflow:approve')
      OR app.has_permission('workflow:review') OR app.has_permission('workflow:reject')
      OR app.has_permission('workflow:return')) THEN
    RAISE EXCEPTION 'Permiso requerido para auditar workflow' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.audit_events(tenant_id,user_id,action,entity_type,entity_id,details)
  VALUES(app.current_tenant_id(),app.current_user_id(),p_action,'WORKFLOW',p_workflow_id,
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'workflowId',p_workflow_id,'taskId',p_task_id,'stepId',p_step_id,
      'documentId',p_document_id,'expedientId',p_expedient_id,
      'fromStatus',p_from_status,'toStatus',p_to_status,
      'user',app.current_user_id(),'timestamp',clock_timestamp(),
      'tenant',app.current_tenant_id()));
END;
$_$;


--
-- Name: reject_tenant_audit_archive_mutation(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.reject_tenant_audit_archive_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RAISE EXCEPTION 'archived tenant audit events are immutable';
  END;
  $$;


--
-- Name: reject_tenant_lifecycle_event_mutation(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.reject_tenant_lifecycle_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RAISE EXCEPTION 'tenant lifecycle events are immutable';
  END;
  $$;


--
-- Name: restore_tenant_backup(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.restore_tenant_backup(op uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
DECLARE operation public.tenant_restore_operations; b public.tenant_backups; n text; cols text; assignments text; evidence uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT operation FROM public.tenant_restore_operations WHERE id=op AND tenant_id=app.current_tenant_id() AND status='RUNNING';
 IF NOT app.has_permission('backup:restore') THEN RAISE EXCEPTION 'Restauraci??n no autorizada' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(726396,hashtext(operation.tenant_id::text));
 SELECT * INTO STRICT b FROM public.tenant_backups WHERE id=operation.backup_id AND tenant_id=operation.tenant_id AND status='COMPLETED';
 IF b.schema_signature<>app.backup_schema_signature() THEN RAISE EXCEPTION 'Esquema incompatible'; END IF;
 FOR n IN SELECT app.backup_tables() LOOP
 IF NOT b.payload ? n OR jsonb_typeof(b.payload->n)<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload->n) v WHERE (v->>'tenant_id')::uuid IS DISTINCT FROM operation.tenant_id) THEN RAISE EXCEPTION 'Contenido del respaldo fuera de alcance'; END IF;
 END LOOP;
 IF operation.safety_backup_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenant_backups WHERE id=operation.safety_backup_id AND pinned AND status='COMPLETED' AND tenant_id=operation.tenant_id) THEN RAISE EXCEPTION 'Falta respaldo de seguridad'; END IF;
 INSERT INTO public.tenant_restore_evidence(id,tenant_id,operation_id,safety_backup_id,transaction_id) VALUES(evidence,operation.tenant_id,op,operation.safety_backup_id,txid_current());
 PERFORM set_config('app.restore_evidence',evidence::text,true);
 SET CONSTRAINTS ALL DEFERRED;
 FOR n IN SELECT x FROM app.backup_tables() x WHERE x<>'users' LOOP
 EXECUTE format('DELETE FROM public.%I WHERE tenant_id=$1',n) USING operation.tenant_id;
 END LOOP;
 -- Retain identities referenced by audit, but deactivate users absent from the snapshot.
 UPDATE public.users SET deleted_at=now() WHERE tenant_id=operation.tenant_id AND id NOT IN(SELECT (v->>'id')::uuid FROM jsonb_array_elements(b.payload->'users') v);
 FOR n IN SELECT app.backup_tables() LOOP
 SELECT string_agg(quote_ident(column_name),',' ORDER BY ordinal_position),string_agg(format('%I=EXCLUDED.%I',column_name,column_name),',' ORDER BY ordinal_position) FILTER(WHERE column_name NOT IN('id','tenant_id') AND (n<>'users' OR column_name<>'password_hash'))
 INTO cols,assignments FROM information_schema.columns WHERE table_schema='public' AND table_name=n AND is_generated='NEVER';
 IF n='users' THEN
 EXECUTE format('INSERT INTO public.users(%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::public.users,$1) ON CONFLICT(id) DO UPDATE SET %s',cols,cols,assignments) USING b.payload->n;
 ELSE
 EXECUTE format('INSERT INTO public.%I(%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::public.%I,$1)',n,cols,cols,n) USING b.payload->n;
 END IF;
 END LOOP;
 UPDATE public.tenants SET name=b.payload->'_tenant'->>'name',email=b.payload->'_tenant'->>'email',phone=b.payload->'_tenant'->>'phone',address=b.payload->'_tenant'->>'address',settings=b.payload->'_tenant'->'settings',logo_url=b.payload->'_tenant'->>'logo_url',primary_color=b.payload->'_tenant'->>'primary_color',currency=b.payload->'_tenant'->>'currency',timezone=b.payload->'_tenant'->>'timezone',date_format=b.payload->'_tenant'->>'date_format',default_language=b.payload->'_tenant'->>'default_language' WHERE id=operation.tenant_id;
 SET CONSTRAINTS ALL IMMEDIATE;
 PERFORM set_config('app.restore_evidence','',true);
 UPDATE public.tenant_restore_operations SET status='COMPLETED',stage='COMPLETED',completed_at=now() WHERE id=op;
END $_$;


--
-- Name: revenue_dashboard(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.revenue_dashboard() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
    SELECT jsonb_build_object(
      'totalRevenueUsd', coalesce(sum(amount_usd) FILTER (WHERE status = 'COMPLETED'), 0),
      'mrrUsd', coalesce(sum(amount_usd) FILTER (WHERE status = 'COMPLETED' AND billing_period = 'MONTHLY' AND completed_at >= now() - interval '31 days'), 0),
      'arrUsd', coalesce(sum(amount_usd) FILTER (WHERE status = 'COMPLETED' AND billing_period = 'MONTHLY' AND completed_at >= now() - interval '31 days'), 0) * 12,
      'activeSubscriptions', (SELECT count(*) FROM tenants WHERE subscription_status = 'ACTIVE'),
      'trialSubscriptions', (SELECT count(*) FROM tenants WHERE subscription_status = 'TRIAL'),
      'conversionRate', (SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE subscription_status = 'ACTIVE') / count(*), 2) END FROM tenants WHERE subscription_status IN ('ACTIVE','TRIAL')),
      'revenueByMethod', (SELECT coalesce(jsonb_object_agg(payment_method, total), '{}'::jsonb) FROM (SELECT payment_method, sum(amount_usd) total FROM billing_transactions WHERE status='COMPLETED' GROUP BY payment_method) m),
      'revenueByPlan', (SELECT coalesce(jsonb_object_agg(code, total), '{}'::jsonb) FROM (SELECT p.code, sum(bt.amount_usd) total FROM billing_transactions bt JOIN plans p ON p.id=bt.plan_id WHERE bt.status='COMPLETED' GROUP BY p.code) p),
      'transactions', coalesce(jsonb_agg(jsonb_build_object('id', id, 'tenantName', tenant_name, 'planCode', plan_code, 'amountUsd', amount_usd, 'paymentMethod', payment_method, 'status', status, 'externalReference', external_reference, 'createdAt', created_at) ORDER BY created_at DESC) FILTER (WHERE id IS NOT NULL), '[]'::jsonb)
    )
    FROM (SELECT bt.*, t.name AS tenant_name, p.code AS plan_code FROM billing_transactions bt JOIN tenants t ON t.id = bt.tenant_id JOIN plans p ON p.id = bt.plan_id) revenue;
  $$;


--
-- Name: set_task_template(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.set_task_template() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  SELECT w.workflow_template_id INTO NEW.workflow_template_id
    FROM public.workflows w WHERE w.tenant_id = NEW.tenant_id AND w.id = NEW.workflow_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow no disponible' USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: tenant_backup_maintenance(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.tenant_backup_maintenance(t uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.tenant_restore_operations WHERE tenant_id=t AND status='RUNNING')
$$;


--
-- Name: tenant_purge_active(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.tenant_purge_active() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
    SELECT EXISTS (SELECT 1 FROM app.tenant_purges p
                   WHERE p.id::text = current_setting('app.tenant_purge', true) AND p.transaction_id = txid_current())
  $$;


--
-- Name: trg_audit_events_chain(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.trg_audit_events_chain() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp', 'public'
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


--
-- Name: user_storage_bytes(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.user_storage_bytes(target uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
    SELECT COALESCE(SUM(v.file_size_bytes), 0)::bigint
    FROM public.document_versions v
    WHERE app.context_is_valid()
      AND (target = app.current_user_id() OR app.has_permission('user:customize'))
      AND v.tenant_id = app.current_tenant_id()
      AND v.author_id = target
  $$;


--
-- Name: validate_active_clinical_history(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_active_clinical_history() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE history_patient uuid; document_patient uuid;
BEGIN
  SELECT h.patient_id INTO history_patient FROM public.clinical_histories h
   WHERE h.id = NEW.clinical_history_id AND h.tenant_id = NEW.tenant_id AND h.deleted_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La historia clínica no existe o está dada de baja' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'clinical_document_links' THEN
    SELECT d.patient_id INTO document_patient FROM public.documents d
     WHERE d.id = NEW.document_id AND d.tenant_id = NEW.tenant_id AND d.deleted_at IS NULL;
    IF NOT FOUND OR NEW.patient_id <> history_patient
       OR (document_patient IS NOT NULL AND document_patient <> history_patient) THEN
      RAISE EXCEPTION 'El documento y el vínculo deben corresponder al paciente de la historia' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_audit_actor(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_audit_actor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
  IF NEW.platform_actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.platform_actor_id AND tenant_id IS NULL AND is_platform_admin) THEN
    RAISE EXCEPTION 'platform_actor_id debe identificar a un administrador global' USING ERRCODE = '23514';
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND tenant_id IS NULL AND is_platform_admin) THEN
    RAISE EXCEPTION 'Un actor de tenant no puede atribuirse un evento global' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_current_version(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_current_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE current_row record; latest integer;
BEGIN
 IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN ('audit_events','tenant_restore_evidence') THEN RETURN COALESCE(NEW,OLD); END IF;
  SELECT d.current_version, d.status INTO current_row FROM public.documents d WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT max(v.version_number) INTO latest FROM public.document_versions v WHERE v.tenant_id = NEW.tenant_id AND v.document_id = NEW.id;
  IF current_row.current_version IS DISTINCT FROM latest OR (latest IS NULL AND current_row.status NOT IN ('DRAFT','PENDING','TRASHED')) THEN
    RAISE EXCEPTION 'current_version debe reflejar la última versión; un documento publicado necesita contenido' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: validate_revoked_access_token_scope(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_revoked_access_token_scope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
  DECLARE
    subject_tenant_id uuid;
    subject_is_platform_admin boolean;
  BEGIN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Las revocaciones de access token son inmutables'
        USING ERRCODE = '55000';
    END IF;

    SELECT u.tenant_id, u.is_platform_admin
      INTO subject_tenant_id, subject_is_platform_admin
      FROM public.users u
     WHERE u.id = NEW.user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe el usuario de la revocaci??n'
        USING ERRCODE = '23503';
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM subject_tenant_id
       OR (NEW.tenant_id IS NULL AND NOT subject_is_platform_admin) THEN
      RAISE EXCEPTION 'El tenant de la revocaci??n no corresponde al usuario'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END;
  $$;


--
-- Name: validate_tenant_user_status(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_tenant_user_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
  BEGIN
    IF TG_TABLE_NAME = 'tenants' THEN
      IF NEW.subscription_status NOT IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELED','EXPIRED') THEN
        RAISE EXCEPTION 'Estado de tenant no permitido: %', NEW.subscription_status
          USING ERRCODE = '23514';
      END IF;
    ELSIF TG_TABLE_NAME = 'users' THEN
      IF NEW.status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN
        RAISE EXCEPTION 'Estado de usuario no permitido: %', NEW.status
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: schema_migrations; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_audit_archive; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tenant_audit_archive (
    tenant_id uuid NOT NULL,
    source_event_id bigint NOT NULL,
    user_id uuid,
    action character varying(80) NOT NULL,
    entity_type character varying(60) NOT NULL,
    entity_id uuid,
    occurred_at timestamp with time zone NOT NULL,
    ip_address inet,
    user_agent text,
    result character varying(30) NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    chain_seq bigint,
    previous_hash character(64),
    record_hash character(64),
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    platform_actor_id uuid,
    client_timestamp timestamp with time zone,
    client_timezone character varying(80)
);


--
-- Name: tenant_database_registry; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tenant_database_registry (
    tenant_id uuid NOT NULL,
    database_name text,
    storage_mode text DEFAULT 'LEGACY_SHARED'::text NOT NULL,
    lifecycle_state text DEFAULT 'LEGACY_SHARED'::text NOT NULL,
    trial_started_at timestamp with time zone NOT NULL,
    trial_ends_at timestamp with time zone NOT NULL,
    grace_ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deletion_started_at timestamp with time zone,
    deleted_at timestamp with time zone,
    last_error_code text,
    CONSTRAINT tenant_database_registry_mode_check CHECK ((storage_mode = ANY (ARRAY['LEGACY_SHARED'::text, 'ISOLATED'::text]))),
    CONSTRAINT tenant_database_registry_mode_name_check CHECK ((((storage_mode = 'LEGACY_SHARED'::text) AND (database_name IS NULL)) OR ((storage_mode = 'ISOLATED'::text) AND (database_name IS NOT NULL)))),
    CONSTRAINT tenant_database_registry_name_check CHECK (((database_name IS NULL) OR (database_name ~ '^nexodocs_t_[0-9a-f]{32}$'::text))),
    CONSTRAINT tenant_database_registry_state_check CHECK ((lifecycle_state = ANY (ARRAY['LEGACY_SHARED'::text, 'PROVISIONING'::text, 'TRIAL'::text, 'GRACE_READ_ONLY'::text, 'ACTIVE'::text, 'DELETING'::text, 'DELETED'::text, 'PROVISIONING_FAILED'::text, 'DELETION_FAILED'::text]))),
    CONSTRAINT tenant_database_registry_trial_window_check CHECK (((trial_ends_at > trial_started_at) AND (grace_ends_at > trial_ends_at)))
);


--
-- Name: tenant_lifecycle_events; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tenant_lifecycle_events (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT tenant_lifecycle_events_event_type_check CHECK ((event_type = ANY (ARRAY['REGISTERED'::text, 'DATABASE_PROVISIONING_STARTED'::text, 'DATABASE_PROVISIONED'::text, 'TRIAL_ENDED'::text, 'GRACE_STARTED'::text, 'PAYMENT_ACTIVATED'::text, 'DELETION_STARTED'::text, 'DATABASE_ARCHIVED'::text, 'DATABASE_DELETED'::text, 'PROVISIONING_FAILED'::text, 'DELETION_FAILED'::text])))
);


--
-- Name: tenant_lifecycle_events_id_seq; Type: SEQUENCE; Schema: app; Owner: -
--

ALTER TABLE app.tenant_lifecycle_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME app.tenant_lifecycle_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tenant_payment_routes; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tenant_payment_routes (
    payment_transaction_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    consumed_at timestamp with time zone
);


--
-- Name: tenant_purges; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tenant_purges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    transaction_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: addon_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addon_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    addon_id uuid NOT NULL,
    billing_cycle character varying(10) NOT NULL,
    amount_usd numeric(12,2) NOT NULL,
    stripe_price_id character varying(80),
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT addon_prices_amount_usd_check CHECK ((amount_usd > (0)::numeric)),
    CONSTRAINT addon_prices_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying, 'ONE_TIME'::character varying])::text[]))),
    CONSTRAINT addon_prices_stripe_price_id_check CHECK (((stripe_price_id IS NULL) OR ((stripe_price_id)::text ~~ 'price\_%'::text)))
);


--
-- Name: addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    resource_key character varying(40) NOT NULL,
    unit_quantity bigint NOT NULL,
    kind character varying(12) NOT NULL,
    validity_months integer,
    plan_codes text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT addons_kind_check CHECK (((kind)::text = ANY ((ARRAY['RECURRING'::character varying, 'CONSUMABLE'::character varying])::text[]))),
    CONSTRAINT addons_resource_key_check CHECK (((resource_key)::text = ANY ((ARRAY['maxUsers'::character varying, 'maxStorageMB'::character varying, 'maxOcrPagesPerMonth'::character varying])::text[]))),
    CONSTRAINT addons_unit_quantity_check CHECK ((unit_quantity > 0)),
    CONSTRAINT ck_addons_code CHECK (((code)::text ~ '^[A-Z][A-Z0-9_]{2,49}$'::text)),
    CONSTRAINT ck_addons_kind CHECK (((((kind)::text = 'RECURRING'::text) AND (validity_months IS NULL)) OR (((kind)::text = 'CONSUMABLE'::text) AND ((resource_key)::text = 'maxOcrPagesPerMonth'::text) AND ((validity_months >= 1) AND (validity_months <= 36)))))
);


--
-- Name: audit_anchors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_anchors (
    id bigint NOT NULL,
    tenant_id uuid,
    chain_seq bigint NOT NULL,
    record_hash character(64) NOT NULL,
    anchor_type character varying(50) NOT NULL,
    anchor_reference text NOT NULL,
    signature text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    anchored_at timestamp with time zone DEFAULT now() NOT NULL,
    anchored_by uuid
);


--
-- Name: audit_anchors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_anchors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_anchors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id bigint NOT NULL,
    tenant_id uuid,
    user_id uuid,
    action character varying(80) NOT NULL,
    entity_type character varying(60) NOT NULL,
    entity_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address inet,
    user_agent text,
    result character varying(30) DEFAULT 'SUCCESS'::character varying NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    platform_actor_id uuid,
    client_timestamp timestamp with time zone,
    client_timezone text,
    chain_seq bigint,
    previous_hash character(64),
    record_hash character(64),
    hash_version smallint DEFAULT 1 NOT NULL,
    CONSTRAINT ck_audit_events_details CHECK ((jsonb_typeof(details) = 'object'::text)),
    CONSTRAINT ck_audit_one_actor CHECK ((num_nonnulls(user_id, platform_actor_id) <= 1))
);

ALTER TABLE ONLY public.audit_events FORCE ROW LEVEL SECURITY;


--
-- Name: audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid,
    refresh_token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    CONSTRAINT ck_auth_session_expiry CHECK ((expires_at > created_at))
);

ALTER TABLE ONLY public.auth_sessions FORCE ROW LEVEL SECURITY;


--
-- Name: backup_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    backup_type character varying(20) DEFAULT 'TENANT'::character varying NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_by uuid,
    file_path text,
    file_size_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_history_backup_type_check CHECK (((backup_type)::text = ANY ((ARRAY['TENANT'::character varying, 'FULL'::character varying])::text[]))),
    CONSTRAINT backup_history_file_size_bytes_check CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
    CONSTRAINT backup_history_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);

ALTER TABLE ONLY public.backup_history FORCE ROW LEVEL SECURITY;


--
-- Name: billing_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    amount_usd numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'USD'::bpchar NOT NULL,
    payment_method character varying(30) NOT NULL,
    status character varying(20) NOT NULL,
    external_reference character varying(160) NOT NULL,
    billing_period character varying(10) NOT NULL,
    metadata_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT billing_transactions_amount_usd_check CHECK ((amount_usd > (0)::numeric)),
    CONSTRAINT billing_transactions_billing_period_check CHECK (((billing_period)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying])::text[]))),
    CONSTRAINT billing_transactions_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['STRIPE_CARD'::character varying, 'BANK_QR'::character varying, 'CRYPTO_USDT'::character varying])::text[]))),
    CONSTRAINT billing_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);

ALTER TABLE ONLY public.billing_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_document_links (
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    clinical_history_id uuid,
    episode_id uuid,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_clinical_episode_history CHECK (((episode_id IS NULL) OR (clinical_history_id IS NOT NULL)))
);

ALTER TABLE ONLY public.clinical_document_links FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_episodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    clinical_history_id uuid NOT NULL,
    code character varying(60) NOT NULL,
    episode_type character varying(50) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_episode_dates CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT clinical_episodes_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'CLOSED'::character varying, 'CANCELED'::character varying])::text[])))
);

ALTER TABLE ONLY public.clinical_episodes FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_histories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    code character varying(60) NOT NULL,
    blood_type character varying(10),
    pathological_antecedents text,
    non_pathological_antecedents text,
    family_antecedents text,
    allergies jsonb DEFAULT '[]'::jsonb NOT NULL,
    chronic_conditions text,
    current_medications jsonb DEFAULT '[]'::jsonb NOT NULL,
    observations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    base_diagnoses jsonb DEFAULT '[]'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deletion_reason text,
    deleted_by uuid,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT ck_clinical_histories_allergies CHECK ((jsonb_typeof(allergies) = 'array'::text)),
    CONSTRAINT ck_clinical_histories_base_diagnoses CHECK ((jsonb_typeof(base_diagnoses) = 'array'::text)),
    CONSTRAINT ck_clinical_histories_current_medications CHECK ((jsonb_typeof(current_medications) = 'array'::text))
);

ALTER TABLE ONLY public.clinical_histories FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_history_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_history_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    clinical_history_id uuid NOT NULL,
    revision_number integer NOT NULL,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    change_summary text NOT NULL,
    snapshot_data jsonb NOT NULL
);

ALTER TABLE ONLY public.clinical_history_revisions FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    staff_type character varying(30) NOT NULL,
    specialty character varying(120),
    professional_license character varying(80),
    service_area character varying(120),
    shift character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinical_staff_staff_type_check CHECK (((staff_type)::text = ANY ((ARRAY['PHYSICIAN'::character varying, 'NURSE'::character varying, 'DIAGNOSTIC_TECH'::character varying, 'MEDICAL_AUDITOR'::character varying, 'BILLING'::character varying])::text[])))
);

ALTER TABLE ONLY public.clinical_staff FORCE ROW LEVEL SECURITY;


--
-- Name: component_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_permissions (
    tenant_id uuid NOT NULL,
    role_id bigint NOT NULL,
    form_key character varying(80) NOT NULL,
    component_key character varying(80) NOT NULL,
    state character varying(20) NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_component_permissions_keys CHECK ((((form_key)::text ~ '^[a-z][a-z0-9_.]*$'::text) AND ((component_key)::text ~ '^[a-z][a-z0-9_]*$'::text))),
    CONSTRAINT ck_component_permissions_state CHECK (((state)::text = ANY ((ARRAY['VISIBLE_EDITABLE'::character varying, 'VISIBLE_READONLY'::character varying, 'HIDDEN'::character varying])::text[])))
);

ALTER TABLE ONLY public.component_permissions FORCE ROW LEVEL SECURITY;


--
-- Name: default_role_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.default_role_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(255),
    permission_codes text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_role_templates_name CHECK ((char_length(btrim((name)::text)) >= 3)),
    CONSTRAINT ck_role_templates_not_admin CHECK ((lower(btrim((name)::text)) <> 'administrador de tenant'::text))
);


--
-- Name: dicom_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dicom_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    series_id uuid NOT NULL,
    sop_instance_uid character varying(100) NOT NULL,
    instance_number integer,
    file_path text NOT NULL,
    file_size_bytes bigint DEFAULT 0 NOT NULL,
    rows integer,
    columns integer,
    bits_allocated integer,
    window_center numeric,
    window_width numeric,
    pixel_spacing numeric[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dicom_instances_file_size_bytes_check CHECK ((file_size_bytes >= 0))
);

ALTER TABLE ONLY public.dicom_instances FORCE ROW LEVEL SECURITY;


--
-- Name: dicom_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dicom_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    study_id uuid NOT NULL,
    series_instance_uid character varying(100) NOT NULL,
    modality character varying(20) NOT NULL,
    series_number integer,
    series_description character varying(255),
    body_part character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.dicom_series FORCE ROW LEVEL SECURITY;


--
-- Name: dicom_studies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dicom_studies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    uploader_id uuid NOT NULL,
    study_instance_uid character varying(100) NOT NULL,
    study_date date,
    study_description character varying(255),
    accession_number character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.dicom_studies FORCE ROW LEVEL SECURITY;


--
-- Name: document_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    name character varying(120) NOT NULL,
    code character varying(50) NOT NULL,
    description character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.document_categories FORCE ROW LEVEL SECURITY;


--
-- Name: document_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_id uuid,
    comment_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT ck_comment_not_self CHECK (((parent_id IS NULL) OR (parent_id <> id)))
);

ALTER TABLE ONLY public.document_comments FORCE ROW LEVEL SECURITY;


--
-- Name: document_metadata_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_metadata_values (
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    metadata_definition_id uuid NOT NULL,
    value jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.document_metadata_values FORCE ROW LEVEL SECURITY;


--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tags (
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

ALTER TABLE ONLY public.document_tags FORCE ROW LEVEL SECURITY;


--
-- Name: document_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    retention_months integer NOT NULL,
    eligible_on date NOT NULL,
    from_level character varying(20) NOT NULL,
    to_level character varying(20) NOT NULL,
    reason character varying(1000) NOT NULL,
    status character varying(20) DEFAULT 'REQUESTED'::character varying NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    executed_by uuid,
    executed_at timestamp with time zone,
    CONSTRAINT document_transfers_check CHECK (((((from_level)::text = 'MANAGEMENT'::text) AND ((to_level)::text = 'CENTRAL'::text)) OR (((from_level)::text = 'CENTRAL'::text) AND ((to_level)::text = 'HISTORICAL'::text)))),
    CONSTRAINT document_transfers_check1 CHECK (((((status)::text = 'REQUESTED'::text) AND (approved_by IS NULL) AND (approved_at IS NULL) AND (executed_by IS NULL) AND (executed_at IS NULL)) OR (((status)::text = 'APPROVED'::text) AND (approved_by IS NOT NULL) AND (approved_at IS NOT NULL) AND (executed_by IS NULL) AND (executed_at IS NULL)) OR (((status)::text = 'EXECUTED'::text) AND (approved_by IS NOT NULL) AND (approved_at IS NOT NULL) AND (executed_by IS NOT NULL) AND (executed_at IS NOT NULL)))),
    CONSTRAINT document_transfers_reason_check CHECK (((length(btrim((reason)::text)) >= 10) AND (length(btrim((reason)::text)) <= 1000))),
    CONSTRAINT document_transfers_retention_months_check CHECK ((retention_months >= 0)),
    CONSTRAINT document_transfers_status_check CHECK (((status)::text = ANY ((ARRAY['REQUESTED'::character varying, 'APPROVED'::character varying, 'EXECUTED'::character varying])::text[])))
);

ALTER TABLE ONLY public.document_transfers FORCE ROW LEVEL SECURITY;


--
-- Name: document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    category_id uuid,
    retention_policy_id uuid,
    name character varying(120) NOT NULL,
    code character varying(50) NOT NULL,
    description character varying(255),
    metadata_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workflow_template_id uuid,
    CONSTRAINT ck_document_types_metadata_schema CHECK ((jsonb_typeof(metadata_schema) = 'object'::text))
);

ALTER TABLE ONLY public.document_types FORCE ROW LEVEL SECURITY;


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    author_id uuid NOT NULL,
    change_reason character varying(1000) NOT NULL,
    file_path text,
    file_name character varying(255),
    mime_type character varying(150),
    file_size_bytes bigint DEFAULT 0 NOT NULL,
    checksum_sha256 character varying(64),
    content jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_sha256_format CHECK (((checksum_sha256 IS NULL) OR ((checksum_sha256)::text ~ '^[0-9a-fA-F]{64}$'::text))),
    CONSTRAINT ck_version_reason CHECK ((btrim((change_reason)::text) <> ''::text)),
    CONSTRAINT document_versions_file_size_bytes_check CHECK ((file_size_bytes >= 0)),
    CONSTRAINT document_versions_version_number_check CHECK ((version_number > 0))
);

ALTER TABLE ONLY public.document_versions FORCE ROW LEVEL SECURITY;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    expedient_id uuid,
    document_type_id uuid NOT NULL,
    author_id uuid NOT NULL,
    responsible_id uuid,
    department_id uuid,
    code character varying(60) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status public.document_status DEFAULT 'DRAFT'::public.document_status NOT NULL,
    current_version integer,
    is_external_source boolean DEFAULT false NOT NULL,
    source character varying(50),
    issue_date date,
    expiry_date date,
    archived_at timestamp with time zone,
    voided_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_id uuid,
    specialty character varying(100),
    institutional_process character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    archive_level character varying(20) DEFAULT 'MANAGEMENT'::character varying NOT NULL,
    archive_level_since date,
    CONSTRAINT ck_documents_expiry CHECK (((expiry_date IS NULL) OR (issue_date IS NULL) OR (expiry_date >= issue_date))),
    CONSTRAINT ck_documents_labels CHECK (((btrim((code)::text) <> ''::text) AND (btrim((name)::text) <> ''::text))),
    CONSTRAINT documents_archive_level_check CHECK (((archive_level)::text = ANY ((ARRAY['MANAGEMENT'::character varying, 'CENTRAL'::character varying, 'HISTORICAL'::character varying])::text[]))),
    CONSTRAINT documents_current_version_check CHECK ((current_version > 0))
);

ALTER TABLE ONLY public.documents FORCE ROW LEVEL SECURITY;


--
-- Name: enterprise_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enterprise_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_name character varying(255) NOT NULL,
    contact_name character varying(160) NOT NULL,
    email character varying(254) NOT NULL,
    phone character varying(60),
    estimated_users integer NOT NULL,
    requires_dicom boolean DEFAULT false NOT NULL,
    requires_bulk_ocr boolean DEFAULT false NOT NULL,
    requires_interoperability boolean DEFAULT false NOT NULL,
    message character varying(4000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enterprise_inquiries_estimated_users_check CHECK ((estimated_users > 0))
);

ALTER TABLE ONLY public.enterprise_inquiries FORCE ROW LEVEL SECURITY;


--
-- Name: expedient_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expedient_participants (
    tenant_id uuid NOT NULL,
    expedient_id uuid NOT NULL,
    user_id uuid NOT NULL,
    participant_role character varying(50) DEFAULT 'MEMBER'::character varying NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.expedient_participants FORCE ROW LEVEL SECURITY;


--
-- Name: expedient_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expedient_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    code character varying(50) NOT NULL,
    metadata_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_expedient_types_metadata_schema CHECK ((jsonb_typeof(metadata_schema) = 'object'::text))
);

ALTER TABLE ONLY public.expedient_types FORCE ROW LEVEL SECURITY;


--
-- Name: expedients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expedients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    expedient_type_id uuid NOT NULL,
    responsible_id uuid,
    department_id uuid,
    code character varying(60) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    status public.expedient_status DEFAULT 'ACTIVE'::public.expedient_status NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    closed_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT ck_expedients_metadata CHECK ((jsonb_typeof(metadata) = 'object'::text))
);

ALTER TABLE ONLY public.expedients FORCE ROW LEVEL SECURITY;


--
-- Name: medical_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    clinical_history_id uuid NOT NULL,
    episode_id uuid,
    author_id uuid NOT NULL,
    note_type character varying(40) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.document_status DEFAULT 'DRAFT'::public.document_status NOT NULL,
    CONSTRAINT chk_medical_notes_status CHECK ((status = ANY (ARRAY['DRAFT'::public.document_status, 'APPROVED'::public.document_status, 'VOIDED'::public.document_status]))),
    CONSTRAINT medical_notes_content_check CHECK ((btrim(content) <> ''::text))
);

ALTER TABLE ONLY public.medical_notes FORCE ROW LEVEL SECURITY;


--
-- Name: metadata_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_type_id uuid,
    name character varying(100) NOT NULL,
    code character varying(60) NOT NULL,
    data_type character varying(30) NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    is_searchable boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_metadata_definitions_options CHECK ((jsonb_typeof(options) = 'array'::text)),
    CONSTRAINT metadata_definitions_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['TEXT'::character varying, 'NUMBER'::character varying, 'DATE'::character varying, 'BOOLEAN'::character varying, 'SELECT'::character varying, 'MULTISELECT'::character varying, 'USER'::character varying, 'REFERENCE'::character varying])::text[])))
);

ALTER TABLE ONLY public.metadata_definitions FORCE ROW LEVEL SECURITY;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    channel public.notification_channel DEFAULT 'IN_APP'::public.notification_channel NOT NULL,
    type character varying(60) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    related_entity_type character varying(50),
    related_entity_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    archived_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_notification_read CHECK ((is_read = (read_at IS NOT NULL)))
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;


--
-- Name: ocr_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ocr_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid,
    uploaded_by uuid NOT NULL,
    status public.ocr_status DEFAULT 'QUEUED'::public.ocr_status NOT NULL,
    original_file_path text NOT NULL,
    file_type character varying(30),
    pages_total integer,
    pages_processed integer DEFAULT 0 NOT NULL,
    raw_text text,
    extracted_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    suggested_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    confidence_score numeric(5,4),
    validated_by uuid,
    validated_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    original_filename character varying(255),
    file_size_bytes bigint,
    model_used character varying(100),
    processing_ms integer,
    final_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ck_ocr_failed_has_reason CHECK (((status <> 'FAILED'::public.ocr_status) OR (error_message IS NOT NULL))),
    CONSTRAINT ck_ocr_file_size CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
    CONSTRAINT ck_ocr_final_metadata_object CHECK ((jsonb_typeof(final_metadata) = 'object'::text)),
    CONSTRAINT ck_ocr_human_validation CHECK (((status <> ALL (ARRAY['VALIDATED'::public.ocr_status, 'INDEXED'::public.ocr_status])) OR ((validated_by IS NOT NULL) AND (validated_at IS NOT NULL)))),
    CONSTRAINT ck_ocr_indexed_has_document CHECK (((status <> 'INDEXED'::public.ocr_status) OR (document_id IS NOT NULL))),
    CONSTRAINT ck_ocr_jobs_extracted_data CHECK ((jsonb_typeof(extracted_data) = 'object'::text)),
    CONSTRAINT ck_ocr_jobs_suggested_metadata CHECK ((jsonb_typeof(suggested_metadata) = 'object'::text)),
    CONSTRAINT ck_ocr_page_progress CHECK (((pages_total IS NULL) OR (pages_processed <= pages_total))),
    CONSTRAINT ck_ocr_processing_ms CHECK (((processing_ms IS NULL) OR (processing_ms >= 0))),
    CONSTRAINT ocr_jobs_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT ocr_jobs_pages_processed_check CHECK ((pages_processed >= 0)),
    CONSTRAINT ocr_jobs_pages_total_check CHECK (((pages_total IS NULL) OR (pages_total >= 0)))
);

ALTER TABLE ONLY public.ocr_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: password_recovery_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_recovery_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.password_recovery_requests FORCE ROW LEVEL SECURITY;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_type character varying(30),
    document_number character varying(40),
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    birth_date date,
    gender character varying(30),
    phone character varying(30),
    email character varying(150),
    address character varying(255),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.patients FORCE ROW LEVEL SECURITY;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id bigint NOT NULL,
    code character varying(100) NOT NULL,
    module character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    description character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    criticality character varying(10),
    CONSTRAINT ck_permissions_criticality CHECK (((criticality)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying])::text[])))
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_features (
    plan_id uuid NOT NULL,
    feature_key character varying(80) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    description character varying(255)
);


--
-- Name: plan_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_limits (
    plan_id uuid NOT NULL,
    resource_key character varying(80) NOT NULL,
    resource_value bigint NOT NULL,
    unit character varying(30),
    CONSTRAINT plan_limits_resource_value_check CHECK ((resource_value >= '-1'::integer))
);


--
-- Name: plan_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    billing_cycle character varying(10) NOT NULL,
    amount_usd numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'USD'::bpchar NOT NULL,
    stripe_price_id character varying(80),
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_plan_prices_stripe_id CHECK (((stripe_price_id IS NULL) OR ((stripe_price_id)::text ~~ 'price\_%'::text))),
    CONSTRAINT plan_prices_amount_usd_check CHECK ((amount_usd >= (0)::numeric)),
    CONSTRAINT plan_prices_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying])::text[])))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price_monthly numeric(12,2) DEFAULT 0 NOT NULL,
    price_yearly numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_price_monthly_check CHECK ((price_monthly >= (0)::numeric)),
    CONSTRAINT plans_price_yearly_check CHECK ((price_yearly >= (0)::numeric))
);


--
-- Name: platform_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_audit_events (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid NOT NULL,
    actor_username character varying(150) NOT NULL,
    action character varying(80) NOT NULL,
    tenant_id uuid,
    reason character varying(1000) NOT NULL,
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    CONSTRAINT ck_platform_audit_action CHECK (((action)::text ~ '^[A-Z][A-Z_]{2,79}$'::text)),
    CONSTRAINT ck_platform_audit_reason CHECK ((char_length(btrim((reason)::text)) >= 5))
);


--
-- Name: platform_audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_audit_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_audit_events_id_seq OWNED BY public.platform_audit_events.id;


--
-- Name: platform_technical_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_technical_logs (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    level text NOT NULL,
    tenant_id uuid,
    actor_id uuid,
    category text NOT NULL,
    summary text NOT NULL,
    request_method text,
    request_path text,
    http_status integer,
    exception_type text,
    CONSTRAINT platform_technical_logs_category_check CHECK (((length(category) >= 1) AND (length(category) <= 80))),
    CONSTRAINT platform_technical_logs_level_check CHECK ((level = ANY (ARRAY['WARN'::text, 'ERROR'::text]))),
    CONSTRAINT platform_technical_logs_summary_check CHECK (((length(summary) >= 1) AND (length(summary) <= 240)))
);


--
-- Name: platform_technical_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_technical_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_technical_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_technical_logs_id_seq OWNED BY public.platform_technical_logs.id;


--
-- Name: report_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    description character varying(500),
    report_type character varying(80) NOT NULL,
    selected_fields jsonb NOT NULL,
    filters jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_config jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_shared boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_report_templates_filters CHECK ((jsonb_typeof(filters) = 'array'::text)),
    CONSTRAINT ck_report_templates_selected_fields CHECK ((jsonb_typeof(selected_fields) = 'array'::text)),
    CONSTRAINT ck_report_templates_sort_config CHECK ((jsonb_typeof(sort_config) = 'array'::text))
);

ALTER TABLE ONLY public.report_templates FORCE ROW LEVEL SECURITY;


--
-- Name: retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    retention_months integer,
    disposition_action character varying(30) DEFAULT 'REVIEW'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT retention_policies_disposition_action_check CHECK (((disposition_action)::text = ANY ((ARRAY['REVIEW'::character varying, 'ARCHIVE'::character varying, 'ANONYMIZE'::character varying, 'DELETE'::character varying, 'KEEP'::character varying, 'TRANSFER'::character varying])::text[]))),
    CONSTRAINT retention_policies_retention_months_check CHECK (((retention_months IS NULL) OR (retention_months >= 0)))
);

ALTER TABLE ONLY public.retention_policies FORCE ROW LEVEL SECURITY;


--
-- Name: revoked_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revoked_access_tokens (
    token_hash character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_revoked_access_tokens_expiry CHECK ((expires_at > revoked_at)),
    CONSTRAINT ck_revoked_access_tokens_token_hash_sha256 CHECK (((token_hash)::text ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    tenant_id uuid NOT NULL,
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.role_permissions FORCE ROW LEVEL SECURITY;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(255),
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_rank smallint DEFAULT 10 NOT NULL,
    workflow_owner boolean DEFAULT false NOT NULL,
    CONSTRAINT roles_approval_rank_check CHECK (((approval_rank >= 0) AND (approval_rank <= 100)))
);

ALTER TABLE ONLY public.roles FORCE ROW LEVEL SECURITY;


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    plan_id uuid,
    company_name character varying(150) NOT NULL,
    admin_email character varying(150) NOT NULL,
    amount_usd numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    payment_method character varying(30) DEFAULT 'SIMULATED_CARD'::character varying NOT NULL,
    billing_period character varying(10) DEFAULT 'MONTHLY'::character varying NOT NULL,
    status character varying(20) DEFAULT 'COMPLETED'::character varying NOT NULL,
    simulated boolean DEFAULT true NOT NULL,
    transaction_reference character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_payments_billing_period_check CHECK (((billing_period)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying])::text[])))
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    color character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tags FORCE ROW LEVEL SECURITY;


--
-- Name: task_delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_delegations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_delegation_dates CHECK (((ends_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT ck_delegation_users CHECK ((delegator_id <> delegate_id))
);

ALTER TABLE ONLY public.task_delegations FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    addon_id uuid NOT NULL,
    units integer NOT NULL,
    pending_units integer,
    pending_at timestamp with time zone,
    status character varying(16) DEFAULT 'ACTIVE'::character varying NOT NULL,
    source character varying(16) NOT NULL,
    stripe_subscription_item_id character varying(80),
    stripe_checkout_id character varying(255),
    billing_transaction_id uuid,
    remaining_quantity bigint,
    expires_at timestamp with time zone,
    reason character varying(1000),
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_tenant_addons_courtesy CHECK ((((source)::text <> 'COURTESY'::text) OR ((expires_at IS NOT NULL) AND (reason IS NOT NULL)))),
    CONSTRAINT ck_tenant_addons_pending CHECK (((pending_units IS NULL) = (pending_at IS NULL))),
    CONSTRAINT tenant_addons_pending_units_check CHECK ((pending_units >= 0)),
    CONSTRAINT tenant_addons_remaining_quantity_check CHECK ((remaining_quantity >= 0)),
    CONSTRAINT tenant_addons_source_check CHECK (((source)::text = ANY ((ARRAY['PURCHASE'::character varying, 'MANUAL_PAYMENT'::character varying, 'COURTESY'::character varying])::text[]))),
    CONSTRAINT tenant_addons_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ENDED'::character varying, 'EXPIRED'::character varying])::text[]))),
    CONSTRAINT tenant_addons_units_check CHECK ((units >= 1))
);

ALTER TABLE ONLY public.tenant_addons FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_backup_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_backup_settings (
    tenant_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    daily_time time without time zone DEFAULT '02:00:00'::time without time zone NOT NULL,
    timezone text DEFAULT 'America/La_Paz'::text NOT NULL,
    retention_days integer DEFAULT 30 NOT NULL,
    last_run_date date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_backup_settings_retention_days_check CHECK (((retention_days >= 1) AND (retention_days <= 365)))
);

ALTER TABLE ONLY public.tenant_backup_settings FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    created_by uuid NOT NULL,
    origin text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    file_path text,
    file_size_bytes bigint,
    checksum text,
    schema_signature text,
    payload jsonb,
    error_message text,
    pinned boolean DEFAULT false NOT NULL,
    CONSTRAINT tenant_backups_origin_check CHECK ((origin = ANY (ARRAY['MANUAL'::text, 'AUTOMATIC'::text, 'SAFETY'::text]))),
    CONSTRAINT tenant_backups_status_check CHECK ((status = ANY (ARRAY['RUNNING'::text, 'COMPLETED'::text, 'FAILED'::text, 'EXPIRED'::text])))
);

ALTER TABLE ONLY public.tenant_backups FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    code character varying(40) NOT NULL,
    description character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tenant_departments FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_restore_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_restore_evidence (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    safety_backup_id uuid NOT NULL,
    transaction_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_restore_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_restore_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    backup_id uuid NOT NULL,
    created_by uuid NOT NULL,
    safety_backup_id uuid,
    status text DEFAULT 'RUNNING'::text NOT NULL,
    stage text DEFAULT 'VALIDATING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    error_message text
);

ALTER TABLE ONLY public.tenant_restore_operations FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    billing_period character varying(10) NOT NULL,
    tenant_name character varying(160) NOT NULL,
    company_email character varying(150) NOT NULL,
    administrator_name character varying(160) NOT NULL,
    admin_email character varying(150) NOT NULL,
    password_hash text DEFAULT ''::text NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    tenant_id uuid,
    stripe_checkout_id character varying(120),
    stripe_customer_id character varying(80),
    stripe_subscription_id character varying(80),
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_signups_billing_period_check CHECK (((billing_period)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying])::text[]))),
    CONSTRAINT tenant_signups_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROVISIONING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'EXPIRED'::character varying])::text[])))
);


--
-- Name: tenant_usage_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_usage_monthly (
    tenant_id uuid NOT NULL,
    year_month date NOT NULL,
    api_calls bigint DEFAULT 0 NOT NULL,
    ocr_pages bigint DEFAULT 0 NOT NULL,
    documents_created bigint DEFAULT 0 NOT NULL,
    storage_bytes bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_usage_monthly_api_calls_check CHECK ((api_calls >= 0)),
    CONSTRAINT tenant_usage_monthly_documents_created_check CHECK ((documents_created >= 0)),
    CONSTRAINT tenant_usage_monthly_ocr_pages_check CHECK ((ocr_pages >= 0)),
    CONSTRAINT tenant_usage_monthly_storage_bytes_check CHECK ((storage_bytes >= 0)),
    CONSTRAINT tenant_usage_monthly_year_month_check CHECK (((date_trunc('month'::text, (year_month)::timestamp with time zone))::date = year_month))
);

ALTER TABLE ONLY public.tenant_usage_monthly FORCE ROW LEVEL SECURITY;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    name character varying(150) NOT NULL,
    code character varying(50) NOT NULL,
    slug character varying(80) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(30),
    address character varying(255),
    logo_url character varying(500),
    primary_color character varying(20) DEFAULT '#087f7b'::character varying NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    subscription_status public.subscription_status DEFAULT 'TRIAL'::public.subscription_status NOT NULL,
    subscription_start_date date,
    subscription_end_date date,
    billing_cycle character varying(10) DEFAULT 'MONTHLY'::character varying NOT NULL,
    storage_limit_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_start_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    current_period_end timestamp with time zone,
    preferred_payment_method character varying(30),
    billing_cycle_v2 character varying(10) DEFAULT 'MONTHLY'::character varying NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    timezone character varying(50) DEFAULT 'America/La_Paz'::character varying NOT NULL,
    date_format character varying(20) DEFAULT 'YYYY-MM-DD'::character varying NOT NULL,
    default_language character varying(10) DEFAULT 'es'::character varying NOT NULL,
    stripe_customer_id character varying(80),
    stripe_subscription_id character varying(80),
    stripe_subscription_status character varying(30),
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    scheduled_plan_id uuid,
    scheduled_billing_cycle character varying(10),
    scheduled_change_at timestamp with time zone,
    stripe_schedule_id character varying(255),
    canceled_at timestamp with time zone,
    cancellation_reason character varying(500),
    deletion_scheduled_at timestamp with time zone,
    purged_at timestamp with time zone,
    plan_price_id uuid,
    price_change_price_id uuid,
    price_change_at timestamp with time zone,
    CONSTRAINT ck_tenants_price_change CHECK (((price_change_price_id IS NULL) = (price_change_at IS NULL))),
    CONSTRAINT ck_tenants_scheduled_change CHECK (((scheduled_plan_id IS NULL) = (scheduled_change_at IS NULL))),
    CONSTRAINT ck_tenants_scheduled_cycle CHECK (((scheduled_billing_cycle IS NULL) OR ((scheduled_billing_cycle)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying])::text[])))),
    CONSTRAINT ck_tenants_settings CHECK ((jsonb_typeof(settings) = 'object'::text)),
    CONSTRAINT ck_tenants_slug_nonempty CHECK ((btrim((slug)::text) <> ''::text)),
    CONSTRAINT ck_tenants_subscription_dates CHECK (((subscription_end_date IS NULL) OR (subscription_start_date IS NULL) OR (subscription_end_date >= subscription_start_date))),
    CONSTRAINT tenants_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['MONTHLY'::character varying, 'YEARLY'::character varying])::text[]))),
    CONSTRAINT tenants_billing_cycle_v2_check CHECK (((billing_cycle_v2)::text = ANY ((ARRAY['MONTHLY'::character varying, 'ANNUAL'::character varying])::text[]))),
    CONSTRAINT tenants_storage_limit_bytes_check CHECK (((storage_limit_bytes IS NULL) OR (storage_limit_bytes >= '-1'::integer)))
);

ALTER TABLE ONLY public.tenants FORCE ROW LEVEL SECURITY;


--
-- Name: user_allowed_document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_allowed_document_types (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    document_type_id uuid NOT NULL
);

ALTER TABLE ONLY public.user_allowed_document_types FORCE ROW LEVEL SECURITY;


--
-- Name: user_customizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_customizations (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_title character varying(120),
    language character varying(5),
    landing_page character varying(40),
    access_expires_on date,
    access_weekdays character varying(13),
    access_start_time time without time zone,
    access_end_time time without time zone,
    max_upload_mb integer,
    storage_quota_mb integer,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_user_customizations_hours CHECK ((((access_start_time IS NULL) AND (access_end_time IS NULL)) OR ((access_start_time IS NOT NULL) AND (access_end_time IS NOT NULL) AND (access_start_time <> access_end_time)))),
    CONSTRAINT ck_user_customizations_landing CHECK (((landing_page IS NULL) OR ((landing_page)::text ~ '^/[a-z0-9/_-]*$'::text))),
    CONSTRAINT ck_user_customizations_language CHECK (((language IS NULL) OR ((language)::text = ANY ((ARRAY['es'::character varying, 'en'::character varying, 'fr'::character varying, 'zh'::character varying])::text[])))),
    CONSTRAINT ck_user_customizations_quota CHECK (((storage_quota_mb IS NULL) OR ((storage_quota_mb >= 1) AND (storage_quota_mb <= 10000000)))),
    CONSTRAINT ck_user_customizations_upload CHECK (((max_upload_mb IS NULL) OR ((max_upload_mb >= 1) AND (max_upload_mb <= 25)))),
    CONSTRAINT ck_user_customizations_weekdays CHECK (((access_weekdays IS NULL) OR ((access_weekdays)::text ~ '^[1-7](,[1-7]){0,6}$'::text)))
);

ALTER TABLE ONLY public.user_customizations FORCE ROW LEVEL SECURITY;


--
-- Name: user_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_group_members (
    tenant_id uuid NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_group_members FORCE ROW LEVEL SECURITY;


--
-- Name: user_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_groups FORCE ROW LEVEL SECURITY;


--
-- Name: user_push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    platform character varying(20) NOT NULL,
    token text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    CONSTRAINT user_push_tokens_platform_check CHECK (((platform)::text = ANY ((ARRAY['WEB'::character varying, 'ANDROID'::character varying, 'IOS'::character varying])::text[])))
);

ALTER TABLE ONLY public.user_push_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id bigint NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_roles FORCE ROW LEVEL SECURITY;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    department_id uuid,
    username character varying(80) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    document_type character varying(30),
    document_number character varying(40),
    phone character varying(30),
    status public.user_status DEFAULT 'ACTIVE'::public.user_status NOT NULL,
    is_platform_admin boolean DEFAULT false NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    avatar_content_type character varying(100),
    avatar_data bytea,
    biography character varying(500),
    email_notifications boolean DEFAULT true NOT NULL,
    push_notifications boolean DEFAULT true NOT NULL,
    preferred_language character varying(10) DEFAULT 'es'::character varying NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT ck_users_identity_nonempty CHECK (((btrim((email)::text) <> ''::text) AND (btrim((username)::text) <> ''::text))),
    CONSTRAINT ck_users_platform_separation CHECK ((((tenant_id IS NULL) AND is_platform_admin AND (department_id IS NULL)) OR ((tenant_id IS NOT NULL) AND (NOT is_platform_admin)))),
    CONSTRAINT ck_users_scope CHECK (((tenant_id IS NOT NULL) OR is_platform_admin))
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    step_id uuid NOT NULL,
    task_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    decision character varying(20) NOT NULL,
    comment text,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    document_version integer,
    CONSTRAINT workflow_approvals_decision_check CHECK (((decision)::text = ANY ((ARRAY['APPROVED'::character varying, 'REJECTED'::character varying, 'RETURNED'::character varying])::text[])))
);

ALTER TABLE ONLY public.workflow_approvals FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    step_id uuid NOT NULL,
    task_id uuid NOT NULL,
    label character varying(500) NOT NULL,
    required boolean DEFAULT true NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_checklist_items_check CHECK (((completed AND (completed_by IS NOT NULL) AND (completed_at IS NOT NULL)) OR ((NOT completed) AND (completed_by IS NULL) AND (completed_at IS NULL))))
);

ALTER TABLE ONLY public.workflow_checklist_items FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_codes (
    tenant_id uuid NOT NULL,
    next_number bigint DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY public.workflow_codes FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    task_id uuid,
    document_id uuid,
    author_id uuid NOT NULL,
    comment_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

ALTER TABLE ONLY public.workflow_comments FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_documents (
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    document_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.workflow_documents FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    task_id uuid,
    document_id uuid,
    event_type character varying(60) NOT NULL,
    performed_by uuid,
    result character varying(50),
    comment text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_workflow_events_details CHECK ((jsonb_typeof(details) = 'object'::text))
);

ALTER TABLE ONLY public.workflow_events FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    template_step_id uuid,
    name character varying(200) NOT NULL,
    description text,
    step_type character varying(30) NOT NULL,
    order_index integer NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    result character varying(50),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_steps_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'COMPLETED'::character varying, 'CANCELED'::character varying, 'SKIPPED'::character varying])::text[])))
);

ALTER TABLE ONLY public.workflow_steps FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    stage_id uuid,
    document_id uuid,
    title character varying(200) NOT NULL,
    description text,
    assigned_user_id uuid,
    assigned_role_id bigint,
    assigned_department_id uuid,
    assigned_group_id uuid,
    status public.task_status DEFAULT 'PENDING'::public.task_status NOT NULL,
    outcome public.task_outcome,
    priority smallint DEFAULT 3 NOT NULL,
    document_version integer,
    due_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workflow_template_id uuid,
    checklist_results jsonb DEFAULT '{}'::jsonb NOT NULL,
    return_stage_id uuid,
    correction boolean DEFAULT false NOT NULL,
    workflow_step_id uuid,
    due_soon_notified_at timestamp with time zone,
    expired_notified_at timestamp with time zone,
    CONSTRAINT ck_task_assignee CHECK ((num_nonnulls(assigned_user_id, assigned_role_id, assigned_department_id, assigned_group_id) = 1)),
    CONSTRAINT ck_task_completion CHECK ((((status = ANY (ARRAY['COMPLETED'::public.task_status, 'REJECTED'::public.task_status, 'RETURNED'::public.task_status])) AND (completed_at IS NOT NULL) AND (completed_by IS NOT NULL)) OR ((status <> ALL (ARRAY['COMPLETED'::public.task_status, 'REJECTED'::public.task_status, 'RETURNED'::public.task_status])) AND (completed_at IS NULL) AND (completed_by IS NULL) AND (outcome IS NULL)))),
    CONSTRAINT ck_task_dates CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT ck_task_document_version CHECK (((document_version IS NULL) OR ((document_id IS NOT NULL) AND (document_version > 0)))),
    CONSTRAINT ck_task_stage_template CHECK (((stage_id IS NULL) OR (workflow_template_id IS NOT NULL))),
    CONSTRAINT workflow_tasks_priority_check CHECK (((priority >= 1) AND (priority <= 5)))
);

ALTER TABLE ONLY public.workflow_tasks FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_template_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_template_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_template_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    stage_type character varying(30) NOT NULL,
    sort_order integer NOT NULL,
    assignment_type character varying(20),
    assignment_reference character varying(100),
    due_days integer,
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    assigned_user_id uuid,
    assigned_role_id bigint,
    assigned_department_id uuid,
    assigned_group_id uuid,
    CONSTRAINT ck_stage_order CHECK ((sort_order >= 0)),
    CONSTRAINT ck_stage_typed_assignment CHECK ((((assignment_type IS NULL) AND (assignment_reference IS NULL) AND (num_nonnulls(assigned_user_id, assigned_role_id, assigned_department_id, assigned_group_id) = 0)) OR ((num_nonnulls(assigned_user_id, assigned_role_id, assigned_department_id, assigned_group_id) = 1) AND
CASE assignment_type
    WHEN 'USER'::text THEN (assigned_user_id IS NOT NULL)
    WHEN 'ROLE'::text THEN (assigned_role_id IS NOT NULL)
    WHEN 'DEPARTMENT'::text THEN (assigned_department_id IS NOT NULL)
    WHEN 'GROUP'::text THEN (assigned_group_id IS NOT NULL)
    ELSE false
END))),
    CONSTRAINT ck_workflow_template_stages_rules CHECK ((jsonb_typeof(rules) = 'object'::text)),
    CONSTRAINT workflow_template_stages_assignment_type_check CHECK (((assignment_type)::text = ANY ((ARRAY['USER'::character varying, 'ROLE'::character varying, 'DEPARTMENT'::character varying, 'GROUP'::character varying])::text[]))),
    CONSTRAINT workflow_template_stages_due_days_check CHECK (((due_days IS NULL) OR (due_days >= 0))),
    CONSTRAINT workflow_template_stages_stage_type_check CHECK (((stage_type)::text = ANY ((ARRAY['START'::character varying, 'TASK'::character varying, 'REVIEW'::character varying, 'APPROVAL'::character varying, 'DECISION'::character varying, 'NOTIFICATION'::character varying, 'ARCHIVE'::character varying, 'END'::character varying])::text[])))
);

ALTER TABLE ONLY public.workflow_template_stages FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_template_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_template_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_template_id uuid NOT NULL,
    from_stage_id uuid NOT NULL,
    to_stage_id uuid NOT NULL,
    name character varying(100),
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ck_transition_different_stages CHECK ((from_stage_id <> to_stage_id)),
    CONSTRAINT ck_workflow_template_transitions_condition CHECK ((jsonb_typeof(condition) = 'object'::text))
);

ALTER TABLE ONLY public.workflow_template_transitions FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category character varying(100) DEFAULT 'Documental'::character varying NOT NULL,
    origin_type character varying(20) DEFAULT 'ANY'::character varying NOT NULL,
    family_id uuid NOT NULL,
    document_status_rules jsonb DEFAULT '{"ON_START": "UNCHANGED", "ON_REJECT": "REJECTED", "ON_RETURN": "DRAFT", "ON_REVIEW": "IN_REVIEW", "ON_APPROVE": "APPROVED", "ON_ARCHIVE": "ARCHIVED"}'::jsonb NOT NULL,
    publication_status character varying(12) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT ck_template_version CHECK ((version > 0)),
    CONSTRAINT ck_workflow_template_publication_status CHECK (((publication_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))),
    CONSTRAINT workflow_templates_origin_type_check CHECK (((origin_type)::text = ANY ((ARRAY['ANY'::character varying, 'DOCUMENT'::character varying, 'EXPEDIENT'::character varying, 'INDEPENDENT'::character varying])::text[])))
);

ALTER TABLE ONLY public.workflow_templates FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_transitions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workflow_transitions WITH (security_invoker='true') AS
 SELECT id,
    tenant_id,
    workflow_id,
    (NULLIF((details ->> 'fromStage'::text), ''::text))::uuid AS from_step_id,
    (NULLIF((details ->> 'toStage'::text), ''::text))::uuid AS to_step_id,
    event_type AS action,
    performed_by,
    comment,
    details AS metadata,
    performed_at AS created_at
   FROM public.workflow_events;


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_template_id uuid,
    expedient_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status public.workflow_status DEFAULT 'DRAFT'::public.workflow_status NOT NULL,
    priority smallint DEFAULT 3 NOT NULL,
    creator_id uuid NOT NULL,
    current_stage_id uuid,
    started_at timestamp with time zone,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    code character varying(40),
    category character varying(100) DEFAULT 'Documental'::character varying NOT NULL,
    department_id uuid,
    assignments jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    last_outcome character varying(30) DEFAULT 'DEFAULT'::character varying NOT NULL,
    current_step_instance_id uuid,
    document_status_rules jsonb DEFAULT '{"ON_START": "UNCHANGED", "ON_REJECT": "REJECTED", "ON_RETURN": "DRAFT", "ON_REVIEW": "IN_REVIEW", "ON_APPROVE": "APPROVED", "ON_ARCHIVE": "ARCHIVED"}'::jsonb NOT NULL,
    CONSTRAINT ck_workflow_dates CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT ck_workflow_stage_template CHECK (((current_stage_id IS NULL) OR (workflow_template_id IS NOT NULL))),
    CONSTRAINT workflows_priority_check CHECK (((priority >= 1) AND (priority <= 5)))
);

ALTER TABLE ONLY public.workflows FORCE ROW LEVEL SECURITY;


--
-- Name: platform_audit_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_events ALTER COLUMN id SET DEFAULT nextval('public.platform_audit_events_id_seq'::regclass);


--
-- Name: platform_technical_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_technical_logs ALTER COLUMN id SET DEFAULT nextval('public.platform_technical_logs_id_seq'::regclass);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenant_audit_archive tenant_audit_archive_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_audit_archive
    ADD CONSTRAINT tenant_audit_archive_pkey PRIMARY KEY (tenant_id, source_event_id);


--
-- Name: tenant_database_registry tenant_database_registry_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_database_registry
    ADD CONSTRAINT tenant_database_registry_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_lifecycle_events tenant_lifecycle_events_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_lifecycle_events
    ADD CONSTRAINT tenant_lifecycle_events_pkey PRIMARY KEY (id);


--
-- Name: tenant_payment_routes tenant_payment_routes_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_payment_routes
    ADD CONSTRAINT tenant_payment_routes_pkey PRIMARY KEY (payment_transaction_id);


--
-- Name: tenant_purges tenant_purges_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_purges
    ADD CONSTRAINT tenant_purges_pkey PRIMARY KEY (id);


--
-- Name: addon_prices addon_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_prices
    ADD CONSTRAINT addon_prices_pkey PRIMARY KEY (id);


--
-- Name: addon_prices addon_prices_stripe_price_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_prices
    ADD CONSTRAINT addon_prices_stripe_price_id_key UNIQUE (stripe_price_id);


--
-- Name: addons addons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_code_key UNIQUE (code);


--
-- Name: addons addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_pkey PRIMARY KEY (id);


--
-- Name: audit_anchors audit_anchors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_anchors
    ADD CONSTRAINT audit_anchors_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: backup_history backup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id);


--
-- Name: backup_history backup_history_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: billing_transactions billing_transactions_external_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transactions
    ADD CONSTRAINT billing_transactions_external_reference_key UNIQUE (external_reference);


--
-- Name: billing_transactions billing_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transactions
    ADD CONSTRAINT billing_transactions_pkey PRIMARY KEY (id);


--
-- Name: clinical_document_links clinical_document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_links
    ADD CONSTRAINT clinical_document_links_pkey PRIMARY KEY (document_id, patient_id);


--
-- Name: clinical_episodes clinical_episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_episodes
    ADD CONSTRAINT clinical_episodes_pkey PRIMARY KEY (id);


--
-- Name: clinical_episodes clinical_episodes_tenant_id_clinical_history_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_episodes
    ADD CONSTRAINT clinical_episodes_tenant_id_clinical_history_id_id_key UNIQUE (tenant_id, clinical_history_id, id);


--
-- Name: clinical_episodes clinical_episodes_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_episodes
    ADD CONSTRAINT clinical_episodes_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: clinical_episodes clinical_episodes_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_episodes
    ADD CONSTRAINT clinical_episodes_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: clinical_histories clinical_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_pkey PRIMARY KEY (id);


--
-- Name: clinical_histories clinical_histories_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: clinical_histories clinical_histories_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: clinical_histories clinical_histories_tenant_id_patient_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_tenant_id_patient_id_id_key UNIQUE (tenant_id, patient_id, id);


--
-- Name: clinical_histories clinical_histories_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);


--
-- Name: clinical_history_revisions clinical_history_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_history_revisions
    ADD CONSTRAINT clinical_history_revisions_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: clinical_staff clinical_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_staff
    ADD CONSTRAINT clinical_staff_pkey PRIMARY KEY (id);


--
-- Name: clinical_staff clinical_staff_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_staff
    ADD CONSTRAINT clinical_staff_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: clinical_staff clinical_staff_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_staff
    ADD CONSTRAINT clinical_staff_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: default_role_templates default_role_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.default_role_templates
    ADD CONSTRAINT default_role_templates_pkey PRIMARY KEY (id);


--
-- Name: dicom_instances dicom_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_instances
    ADD CONSTRAINT dicom_instances_pkey PRIMARY KEY (id);


--
-- Name: dicom_instances dicom_instances_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_instances
    ADD CONSTRAINT dicom_instances_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: dicom_instances dicom_instances_tenant_id_sop_instance_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_instances
    ADD CONSTRAINT dicom_instances_tenant_id_sop_instance_uid_key UNIQUE (tenant_id, sop_instance_uid);


--
-- Name: dicom_series dicom_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_series
    ADD CONSTRAINT dicom_series_pkey PRIMARY KEY (id);


--
-- Name: dicom_series dicom_series_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_series
    ADD CONSTRAINT dicom_series_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: dicom_series dicom_series_tenant_id_series_instance_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_series
    ADD CONSTRAINT dicom_series_tenant_id_series_instance_uid_key UNIQUE (tenant_id, series_instance_uid);


--
-- Name: dicom_studies dicom_studies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_studies
    ADD CONSTRAINT dicom_studies_pkey PRIMARY KEY (id);


--
-- Name: dicom_studies dicom_studies_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_studies
    ADD CONSTRAINT dicom_studies_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: dicom_studies dicom_studies_tenant_id_study_instance_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_studies
    ADD CONSTRAINT dicom_studies_tenant_id_study_instance_uid_key UNIQUE (tenant_id, study_instance_uid);


--
-- Name: document_categories document_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_pkey PRIMARY KEY (id);


--
-- Name: document_categories document_categories_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: document_categories document_categories_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: document_comments document_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_pkey PRIMARY KEY (id);


--
-- Name: document_comments document_comments_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: document_metadata_values document_metadata_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata_values
    ADD CONSTRAINT document_metadata_values_pkey PRIMARY KEY (document_id, metadata_definition_id);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (document_id, tag_id);


--
-- Name: document_transfers document_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_pkey PRIMARY KEY (id);


--
-- Name: document_transfers document_transfers_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: document_types document_types_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: document_versions document_versions_document_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_version_number_key UNIQUE (document_id, version_number);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: documents documents_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: enterprise_inquiries enterprise_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_inquiries
    ADD CONSTRAINT enterprise_inquiries_pkey PRIMARY KEY (id);


--
-- Name: enterprise_inquiries enterprise_inquiries_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_inquiries
    ADD CONSTRAINT enterprise_inquiries_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: expedient_participants expedient_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_participants
    ADD CONSTRAINT expedient_participants_pkey PRIMARY KEY (expedient_id, user_id);


--
-- Name: expedient_types expedient_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_types
    ADD CONSTRAINT expedient_types_pkey PRIMARY KEY (id);


--
-- Name: expedient_types expedient_types_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_types
    ADD CONSTRAINT expedient_types_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: expedient_types expedient_types_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_types
    ADD CONSTRAINT expedient_types_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: expedients expedients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_pkey PRIMARY KEY (id);


--
-- Name: expedients expedients_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: expedients expedients_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: medical_notes medical_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_notes
    ADD CONSTRAINT medical_notes_pkey PRIMARY KEY (id);


--
-- Name: medical_notes medical_notes_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_notes
    ADD CONSTRAINT medical_notes_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: metadata_definitions metadata_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_definitions
    ADD CONSTRAINT metadata_definitions_pkey PRIMARY KEY (id);


--
-- Name: metadata_definitions metadata_definitions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_definitions
    ADD CONSTRAINT metadata_definitions_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: metadata_definitions metadata_definitions_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_definitions
    ADD CONSTRAINT metadata_definitions_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: ocr_jobs ocr_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_pkey PRIMARY KEY (id);


--
-- Name: ocr_jobs ocr_jobs_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: password_recovery_requests password_recovery_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_recovery_requests
    ADD CONSTRAINT password_recovery_requests_pkey PRIMARY KEY (id);


--
-- Name: password_recovery_requests password_recovery_requests_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_recovery_requests
    ADD CONSTRAINT password_recovery_requests_token_hash_key UNIQUE (token_hash);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: patients patients_tenant_id_document_type_document_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_document_type_document_number_key UNIQUE (tenant_id, document_type, document_number);


--
-- Name: patients patients_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_module_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_module_action_key UNIQUE (module, action);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: component_permissions pk_component_permissions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_permissions
    ADD CONSTRAINT pk_component_permissions PRIMARY KEY (tenant_id, role_id, form_key, component_key);


--
-- Name: revoked_access_tokens pk_revoked_access_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_access_tokens
    ADD CONSTRAINT pk_revoked_access_tokens PRIMARY KEY (token_hash);


--
-- Name: user_allowed_document_types pk_user_allowed_document_types; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_document_types
    ADD CONSTRAINT pk_user_allowed_document_types PRIMARY KEY (tenant_id, user_id, document_type_id);


--
-- Name: user_customizations pk_user_customizations; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_customizations
    ADD CONSTRAINT pk_user_customizations PRIMARY KEY (tenant_id, user_id);


--
-- Name: plan_features plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_pkey PRIMARY KEY (plan_id, feature_key);


--
-- Name: plan_limits plan_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_limits
    ADD CONSTRAINT plan_limits_pkey PRIMARY KEY (plan_id, resource_key);


--
-- Name: plan_prices plan_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_pkey PRIMARY KEY (id);


--
-- Name: plan_prices plan_prices_stripe_price_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_stripe_price_id_key UNIQUE (stripe_price_id);


--
-- Name: plans plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: platform_audit_events platform_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_events
    ADD CONSTRAINT platform_audit_events_pkey PRIMARY KEY (id);


--
-- Name: platform_technical_logs platform_technical_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_technical_logs
    ADD CONSTRAINT platform_technical_logs_pkey PRIMARY KEY (id);


--
-- Name: report_templates report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_pkey PRIMARY KEY (id);


--
-- Name: report_templates report_templates_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: retention_policies retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_pkey PRIMARY KEY (id);


--
-- Name: retention_policies retention_policies_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: retention_policies retention_policies_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: roles roles_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: subscription_payments subscription_payments_transaction_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_transaction_reference_key UNIQUE (transaction_reference);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: tags tags_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: task_delegations task_delegations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_delegations
    ADD CONSTRAINT task_delegations_pkey PRIMARY KEY (id);


--
-- Name: task_delegations task_delegations_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_delegations
    ADD CONSTRAINT task_delegations_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: tenant_addons tenant_addons_billing_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_billing_transaction_id_key UNIQUE (billing_transaction_id);


--
-- Name: tenant_addons tenant_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_pkey PRIMARY KEY (id);


--
-- Name: tenant_addons tenant_addons_stripe_checkout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_stripe_checkout_id_key UNIQUE (stripe_checkout_id);


--
-- Name: tenant_addons tenant_addons_stripe_subscription_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_stripe_subscription_item_id_key UNIQUE (stripe_subscription_item_id);


--
-- Name: tenant_backup_settings tenant_backup_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_backup_settings
    ADD CONSTRAINT tenant_backup_settings_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_backups tenant_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_backups
    ADD CONSTRAINT tenant_backups_pkey PRIMARY KEY (id);


--
-- Name: tenant_departments tenant_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_pkey PRIMARY KEY (id);


--
-- Name: tenant_departments tenant_departments_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: tenant_departments tenant_departments_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: tenant_restore_evidence tenant_restore_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_evidence
    ADD CONSTRAINT tenant_restore_evidence_pkey PRIMARY KEY (id);


--
-- Name: tenant_restore_operations tenant_restore_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_operations
    ADD CONSTRAINT tenant_restore_operations_pkey PRIMARY KEY (id);


--
-- Name: tenant_signups tenant_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_signups
    ADD CONSTRAINT tenant_signups_pkey PRIMARY KEY (id);


--
-- Name: tenant_signups tenant_signups_stripe_checkout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_signups
    ADD CONSTRAINT tenant_signups_stripe_checkout_id_key UNIQUE (stripe_checkout_id);


--
-- Name: tenant_signups tenant_signups_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_signups
    ADD CONSTRAINT tenant_signups_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenant_usage_monthly tenant_usage_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_monthly
    ADD CONSTRAINT tenant_usage_monthly_pkey PRIMARY KEY (tenant_id, year_month);


--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: document_comments uq_comments_document; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT uq_comments_document UNIQUE (tenant_id, document_id, id);


--
-- Name: workflow_tasks uq_tasks_workflow; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT uq_tasks_workflow UNIQUE (tenant_id, workflow_id, id);


--
-- Name: tenant_addons uq_tenant_addons_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT uq_tenant_addons_tenant_id UNIQUE (tenant_id, id);


--
-- Name: document_versions uq_version_tenant_document_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT uq_version_tenant_document_number UNIQUE (tenant_id, document_id, version_number);


--
-- Name: workflow_documents uq_workflow_documents_scope; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_documents
    ADD CONSTRAINT uq_workflow_documents_scope UNIQUE (tenant_id, workflow_id, document_id);


--
-- Name: workflows uq_workflows_template; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT uq_workflows_template UNIQUE (tenant_id, id, workflow_template_id);


--
-- Name: user_group_members user_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT user_group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- Name: user_groups user_groups_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: user_groups user_groups_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: user_push_tokens user_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_push_tokens user_push_tokens_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: user_push_tokens user_push_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_token_key UNIQUE (token);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);


--
-- Name: users users_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: users users_tenant_id_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_username_key UNIQUE (tenant_id, username);


--
-- Name: workflow_approvals workflow_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_pkey PRIMARY KEY (id);


--
-- Name: workflow_approvals workflow_approvals_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_approvals workflow_approvals_tenant_id_task_id_approver_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_task_id_approver_user_id_key UNIQUE (tenant_id, task_id, approver_user_id);


--
-- Name: workflow_checklist_items workflow_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_task_id_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_task_id_label_key UNIQUE (tenant_id, task_id, label);


--
-- Name: workflow_codes workflow_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_codes
    ADD CONSTRAINT workflow_codes_pkey PRIMARY KEY (tenant_id);


--
-- Name: workflow_comments workflow_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_pkey PRIMARY KEY (id);


--
-- Name: workflow_comments workflow_comments_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_documents workflow_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_documents
    ADD CONSTRAINT workflow_documents_pkey PRIMARY KEY (workflow_id, document_id);


--
-- Name: workflow_events workflow_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_pkey PRIMARY KEY (id);


--
-- Name: workflow_events workflow_events_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_steps workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_steps workflow_steps_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_tasks workflow_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_pkey PRIMARY KEY (id);


--
-- Name: workflow_tasks workflow_tasks_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_template_stages workflow_template_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT workflow_template_stages_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_stages workflow_template_stages_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT workflow_template_stages_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_template_stages workflow_template_stages_tenant_id_workflow_template_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT workflow_template_stages_tenant_id_workflow_template_id_id_key UNIQUE (tenant_id, workflow_template_id, id);


--
-- Name: workflow_template_stages workflow_template_stages_workflow_template_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT workflow_template_stages_workflow_template_id_sort_order_key UNIQUE (workflow_template_id, sort_order);


--
-- Name: workflow_template_transitions workflow_template_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_transitions
    ADD CONSTRAINT workflow_template_transitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_transitions workflow_template_transitions_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_transitions
    ADD CONSTRAINT workflow_template_transitions_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: workflow_templates workflow_templates_tenant_id_name_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_name_version_key UNIQUE (tenant_id, name, version);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_tenant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_id_key UNIQUE (tenant_id, id);


--
-- Name: tenant_audit_archive_tenant_time_idx; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX tenant_audit_archive_tenant_time_idx ON app.tenant_audit_archive USING btree (tenant_id, occurred_at DESC, source_event_id DESC);


--
-- Name: tenant_lifecycle_events_tenant_time_idx; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX tenant_lifecycle_events_tenant_time_idx ON app.tenant_lifecycle_events USING btree (tenant_id, occurred_at DESC, id DESC);


--
-- Name: tenant_payment_routes_tenant_idx; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX tenant_payment_routes_tenant_idx ON app.tenant_payment_routes USING btree (tenant_id, created_at DESC);


--
-- Name: document_transfers_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_transfers_pending ON public.document_transfers USING btree (tenant_id, document_id) WHERE ((status)::text = ANY ((ARRAY['REQUESTED'::character varying, 'APPROVED'::character varying])::text[]));


--
-- Name: idx_audit_anchors_tenant_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_anchors_tenant_seq ON public.audit_anchors USING btree (tenant_id, chain_seq DESC);


--
-- Name: idx_audit_chain_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_chain_seq ON public.audit_events USING btree (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), chain_seq);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_events USING btree (tenant_id, entity_type, entity_id);


--
-- Name: idx_audit_record_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_record_hash ON public.audit_events USING btree (record_hash);


--
-- Name: idx_audit_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_tenant_date ON public.audit_events USING btree (tenant_id, occurred_at DESC);


--
-- Name: idx_auth_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_sessions_user_active ON public.auth_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_billing_transactions_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_transactions_status_created ON public.billing_transactions USING btree (status, created_at DESC);


--
-- Name: idx_billing_transactions_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_transactions_tenant_created ON public.billing_transactions USING btree (tenant_id, created_at DESC);


--
-- Name: idx_clinical_histories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_histories_active ON public.clinical_histories USING btree (tenant_id, patient_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_clinical_history_revisions_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_history_revisions_history ON public.clinical_history_revisions USING btree (tenant_id, clinical_history_id, revision_number DESC);


--
-- Name: idx_clinical_links_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_links_patient ON public.clinical_document_links USING btree (tenant_id, patient_id, document_id);


--
-- Name: idx_component_permissions_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_permissions_form ON public.component_permissions USING btree (tenant_id, form_key, role_id);


--
-- Name: idx_dicom_instances_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dicom_instances_series ON public.dicom_instances USING btree (tenant_id, series_id, instance_number);


--
-- Name: idx_dicom_series_study; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dicom_series_study ON public.dicom_series USING btree (tenant_id, study_id);


--
-- Name: idx_dicom_studies_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dicom_studies_patient ON public.dicom_studies USING btree (tenant_id, patient_id, study_date DESC);


--
-- Name: idx_document_comments_timeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_comments_timeline ON public.document_comments USING btree (tenant_id, document_id, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: idx_document_metadata_definition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_metadata_definition ON public.document_metadata_values USING btree (tenant_id, metadata_definition_id, document_id);


--
-- Name: idx_document_tags_reverse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_tags_reverse ON public.document_tags USING btree (tenant_id, tag_id, document_id);


--
-- Name: idx_documents_author_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_author_page ON public.documents USING btree (tenant_id, author_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_documents_expedient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_expedient ON public.documents USING btree (tenant_id, expedient_id);


--
-- Name: idx_documents_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_expiry ON public.documents USING btree (tenant_id, expiry_date, id) WHERE ((deleted_at IS NULL) AND (expiry_date IS NOT NULL) AND (status <> ALL (ARRAY['ARCHIVED'::public.document_status, 'VOIDED'::public.document_status, 'TRASHED'::public.document_status])));


--
-- Name: idx_documents_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_page ON public.documents USING btree (tenant_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_documents_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_patient ON public.documents USING btree (tenant_id, patient_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_documents_process; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_process ON public.documents USING btree (tenant_id, institutional_process) WHERE (deleted_at IS NULL);


--
-- Name: idx_documents_specialty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_specialty ON public.documents USING btree (tenant_id, specialty) WHERE (deleted_at IS NULL);


--
-- Name: idx_documents_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_tenant_status ON public.documents USING btree (tenant_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.documents USING btree (tenant_id, document_type_id);


--
-- Name: idx_enterprise_inquiries_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enterprise_inquiries_tenant_created ON public.enterprise_inquiries USING btree (tenant_id, created_at DESC);


--
-- Name: idx_expedients_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expedients_page ON public.expedients USING btree (tenant_id, status, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_group_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_user ON public.user_group_members USING btree (tenant_id, user_id, group_id);


--
-- Name: idx_medical_notes_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_notes_history_created ON public.medical_notes USING btree (tenant_id, clinical_history_id, created_at DESC);


--
-- Name: idx_medical_notes_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_notes_tenant_status ON public.medical_notes USING btree (tenant_id, status);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (tenant_id, user_id, is_read, created_at DESC);


--
-- Name: idx_ocr_jobs_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ocr_jobs_tenant_created ON public.ocr_jobs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_ocr_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ocr_queue ON public.ocr_jobs USING btree (tenant_id, status, created_at, id) WHERE (status = ANY (ARRAY['QUEUED'::public.ocr_status, 'PROCESSING'::public.ocr_status, 'REQUIRES_VALIDATION'::public.ocr_status]));


--
-- Name: idx_plan_prices_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_prices_plan ON public.plan_prices USING btree (plan_id, billing_cycle, effective_from DESC);


--
-- Name: idx_platform_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_action ON public.platform_audit_events USING btree (action, occurred_at DESC);


--
-- Name: idx_platform_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_actor ON public.platform_audit_events USING btree (actor_user_id, occurred_at DESC);


--
-- Name: idx_platform_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_tenant ON public.platform_audit_events USING btree (tenant_id, occurred_at DESC);


--
-- Name: idx_revoked_access_tokens_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revoked_access_tokens_expiry ON public.revoked_access_tokens USING btree (expires_at);


--
-- Name: idx_role_permissions_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_scope ON public.role_permissions USING btree (tenant_id, role_id, permission_id);


--
-- Name: idx_subscription_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payments_status ON public.subscription_payments USING btree (status, created_at DESC);


--
-- Name: idx_subscription_payments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payments_tenant ON public.subscription_payments USING btree (tenant_id, created_at DESC);


--
-- Name: idx_tenant_addons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_addons_active ON public.tenant_addons USING btree (tenant_id, addon_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_tenant_addons_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_addons_due ON public.tenant_addons USING btree (pending_at) WHERE (pending_at IS NOT NULL);


--
-- Name: idx_tenant_signups_status_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_signups_status_updated ON public.tenant_signups USING btree (status, updated_at);


--
-- Name: idx_tenants_pending_deletion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_pending_deletion ON public.tenants USING btree (deletion_scheduled_at) WHERE ((deletion_scheduled_at IS NOT NULL) AND (purged_at IS NULL));


--
-- Name: idx_user_roles_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_scope ON public.user_roles USING btree (tenant_id, user_id, role_id);


--
-- Name: idx_users_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant_status ON public.users USING btree (tenant_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_workflow_approvals_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_approvals_approver ON public.workflow_approvals USING btree (tenant_id, approver_user_id, decided_at DESC);


--
-- Name: idx_workflow_approvals_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_approvals_task ON public.workflow_approvals USING btree (tenant_id, task_id, decided_at DESC);


--
-- Name: idx_workflow_checklist_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_checklist_task ON public.workflow_checklist_items USING btree (tenant_id, task_id, required, completed);


--
-- Name: idx_workflow_events_timeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_events_timeline ON public.workflow_events USING btree (tenant_id, workflow_id, performed_at, id);


--
-- Name: idx_workflow_steps_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_steps_instance ON public.workflow_steps USING btree (tenant_id, workflow_id, created_at);


--
-- Name: idx_workflow_tasks_department_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_tasks_department_queue ON public.workflow_tasks USING btree (tenant_id, assigned_department_id, due_at, id) WHERE ((assigned_department_id IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::public.task_status, 'IN_PROGRESS'::public.task_status, 'OVERDUE'::public.task_status])));


--
-- Name: idx_workflow_tasks_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_tasks_due ON public.workflow_tasks USING btree (tenant_id, due_at) WHERE (status = ANY (ARRAY['PENDING'::public.task_status, 'IN_PROGRESS'::public.task_status, 'OVERDUE'::public.task_status]));


--
-- Name: idx_workflow_tasks_group_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_tasks_group_queue ON public.workflow_tasks USING btree (tenant_id, assigned_group_id, due_at, id) WHERE ((assigned_group_id IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::public.task_status, 'IN_PROGRESS'::public.task_status, 'OVERDUE'::public.task_status])));


--
-- Name: idx_workflow_tasks_role_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_tasks_role_queue ON public.workflow_tasks USING btree (tenant_id, assigned_role_id, due_at, id) WHERE ((assigned_role_id IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::public.task_status, 'IN_PROGRESS'::public.task_status, 'OVERDUE'::public.task_status])));


--
-- Name: idx_workflow_tasks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_tasks_user ON public.workflow_tasks USING btree (tenant_id, assigned_user_id, status);


--
-- Name: idx_workflow_template_publication; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_template_publication ON public.workflow_templates USING btree (tenant_id, publication_status, family_id);


--
-- Name: idx_workflows_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_page ON public.workflows USING btree (tenant_id, created_at DESC, id DESC);


--
-- Name: idx_workflows_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_template ON public.workflows USING btree (tenant_id, workflow_template_id);


--
-- Name: idx_workflows_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_tenant_status ON public.workflows USING btree (tenant_id, status);


--
-- Name: one_restore_per_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_restore_per_tenant ON public.tenant_restore_operations USING btree (tenant_id) WHERE (status = 'RUNNING'::text);


--
-- Name: password_recovery_active_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_recovery_active_token_idx ON public.password_recovery_requests USING btree (token_hash) WHERE (used_at IS NULL);


--
-- Name: platform_technical_logs_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_technical_logs_occurred_idx ON public.platform_technical_logs USING btree (occurred_at DESC, id DESC);


--
-- Name: platform_technical_logs_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_technical_logs_tenant_idx ON public.platform_technical_logs USING btree (tenant_id, occurred_at DESC);


--
-- Name: tenant_backups_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_backups_tenant_id_created_at_idx ON public.tenant_backups USING btree (tenant_id, created_at DESC);


--
-- Name: uq_addon_prices_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_addon_prices_current ON public.addon_prices USING btree (addon_id, billing_cycle) WHERE (archived_at IS NULL);


--
-- Name: uq_default_role_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_default_role_templates_name ON public.default_role_templates USING btree (lower(btrim((name)::text)));


--
-- Name: uq_patients_tenant_identifier_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_patients_tenant_identifier_normalized ON public.patients USING btree (tenant_id, upper(btrim((document_type)::text)), upper(btrim((document_number)::text))) WHERE ((document_type IS NOT NULL) AND (document_number IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: uq_plan_prices_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_plan_prices_current ON public.plan_prices USING btree (plan_id, billing_cycle) WHERE (archived_at IS NULL);


--
-- Name: uq_platform_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_platform_users_email ON public.users USING btree (lower((email)::text)) WHERE (tenant_id IS NULL);


--
-- Name: uq_platform_users_email_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_platform_users_email_normalized ON public.users USING btree (lower(btrim((email)::text))) WHERE (tenant_id IS NULL);


--
-- Name: uq_platform_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_platform_users_username ON public.users USING btree (lower(btrim((username)::text))) WHERE (tenant_id IS NULL);


--
-- Name: uq_tenants_slug_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenants_slug_normalized ON public.tenants USING btree (lower(btrim((slug)::text)));


--
-- Name: uq_tenants_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenants_stripe_customer ON public.tenants USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- Name: uq_tenants_stripe_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenants_stripe_subscription ON public.tenants USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);


--
-- Name: uq_users_tenant_email_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_tenant_email_normalized ON public.users USING btree (tenant_id, lower(btrim((email)::text))) WHERE (tenant_id IS NOT NULL);


--
-- Name: uq_users_tenant_username_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_tenant_username_normalized ON public.users USING btree (tenant_id, lower(btrim((username)::text))) WHERE (tenant_id IS NOT NULL);


--
-- Name: uq_workflow_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_workflow_code ON public.workflows USING btree (tenant_id, code);


--
-- Name: ux_audit_chain_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_audit_chain_seq ON public.audit_events USING btree (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), chain_seq) WHERE (chain_seq IS NOT NULL);


--
-- Name: tenant_audit_archive tenant_audit_archive_immutable; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER tenant_audit_archive_immutable BEFORE DELETE OR UPDATE ON app.tenant_audit_archive FOR EACH ROW EXECUTE FUNCTION app.reject_tenant_audit_archive_mutation();


--
-- Name: tenant_lifecycle_events tenant_lifecycle_events_immutable; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER tenant_lifecycle_events_immutable BEFORE DELETE OR UPDATE ON app.tenant_lifecycle_events FOR EACH ROW EXECUTE FUNCTION app.reject_tenant_lifecycle_event_mutation();


--
-- Name: clinical_document_links backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.clinical_document_links FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: clinical_episodes backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.clinical_episodes FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: clinical_histories backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.clinical_histories FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: clinical_history_revisions backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.clinical_history_revisions FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: clinical_staff backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.clinical_staff FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: component_permissions backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.component_permissions FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: dicom_instances backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.dicom_instances FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: dicom_series backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.dicom_series FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: dicom_studies backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.dicom_studies FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_categories backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.document_categories FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_comments backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.document_comments FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_metadata_values backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.document_metadata_values FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_tags backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.document_tags FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_types backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_versions backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: documents backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: expedient_participants backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.expedient_participants FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: expedient_types backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.expedient_types FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: expedients backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.expedients FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: medical_notes backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.medical_notes FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: metadata_definitions backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.metadata_definitions FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: notifications backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: ocr_jobs backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.ocr_jobs FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: patients backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: report_templates backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: retention_policies backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.retention_policies FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: role_permissions backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: roles backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: tags backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: task_delegations backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.task_delegations FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: tenant_departments backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.tenant_departments FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: tenant_usage_monthly backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.tenant_usage_monthly FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: tenants backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: user_allowed_document_types backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.user_allowed_document_types FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: user_customizations backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.user_customizations FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: user_group_members backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.user_group_members FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: user_groups backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: user_push_tokens backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.user_push_tokens FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: user_roles backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: users backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_approvals backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_approvals FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_checklist_items backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_checklist_items FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_codes backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_codes FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_comments backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_comments FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_documents backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_documents FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_events backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_steps backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_steps FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_tasks backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_tasks FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_template_stages backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_template_stages FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_template_transitions backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_template_transitions FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflow_templates backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: workflows backup_write_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER backup_write_lock BEFORE INSERT OR DELETE OR UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();


--
-- Name: document_transfers guard_document_transfer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_document_transfer BEFORE UPDATE ON public.document_transfers FOR EACH ROW EXECUTE FUNCTION app.guard_document_transfer();


--
-- Name: tenant_restore_evidence immutable_restore_evidence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER immutable_restore_evidence BEFORE DELETE OR UPDATE ON public.tenant_restore_evidence FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: tenant_backups protect_backup_evidence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_backup_evidence BEFORE DELETE OR UPDATE ON public.tenant_backups FOR EACH ROW EXECUTE FUNCTION app.protect_backup_evidence();


--
-- Name: audit_events trg_audit_actor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_actor BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION app.validate_audit_actor();


--
-- Name: clinical_document_links trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.clinical_document_links FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: clinical_episodes trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.clinical_episodes FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: clinical_histories trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.clinical_histories FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: component_permissions trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.component_permissions FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: document_types trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: document_versions trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: documents trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: expedients trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.expedients FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: metadata_definitions trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.metadata_definitions FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: patients trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: retention_policies trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.retention_policies FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: role_permissions trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: roles trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: task_delegations trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.task_delegations FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: tenant_departments trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.tenant_departments FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: tenants trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: user_allowed_document_types trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.user_allowed_document_types FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: user_customizations trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.user_customizations FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: user_group_members trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.user_group_members FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: user_groups trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: user_roles trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: users trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: workflow_tasks trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.workflow_tasks FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: workflow_template_stages trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.workflow_template_stages FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: workflow_template_transitions trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.workflow_template_transitions FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: workflow_templates trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: workflows trg_audit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION app.audit_row_change();


--
-- Name: audit_events trg_audit_events_chain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_events_chain BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION app.trg_audit_events_chain();


--
-- Name: audit_events trg_audit_events_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_events_no_delete BEFORE DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: audit_events trg_audit_events_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_events_no_update BEFORE UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: backup_history trg_backup_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_backup_history_updated_at BEFORE UPDATE ON public.backup_history FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: clinical_episodes trg_clinical_episodes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_episodes_updated_at BEFORE UPDATE ON public.clinical_episodes FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: clinical_histories trg_clinical_histories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_histories_updated_at BEFORE UPDATE ON public.clinical_histories FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: clinical_histories trg_clinical_history_protection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_history_protection BEFORE DELETE OR UPDATE ON public.clinical_histories FOR EACH ROW EXECUTE FUNCTION app.protect_clinical_history();


--
-- Name: clinical_document_links trg_clinical_link_active_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_link_active_history BEFORE INSERT OR UPDATE ON public.clinical_document_links FOR EACH ROW EXECUTE FUNCTION app.validate_active_clinical_history();


--
-- Name: clinical_staff trg_clinical_staff_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_staff_updated_at BEFORE UPDATE ON public.clinical_staff FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: dicom_instances trg_dicom_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dicom_instances_updated_at BEFORE UPDATE ON public.dicom_instances FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: dicom_series trg_dicom_series_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dicom_series_updated_at BEFORE UPDATE ON public.dicom_series FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: dicom_studies trg_dicom_studies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dicom_studies_updated_at BEFORE UPDATE ON public.dicom_studies FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: document_categories trg_document_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_categories_updated_at BEFORE UPDATE ON public.document_categories FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: document_comments trg_document_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_comments_updated_at BEFORE UPDATE ON public.document_comments FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: documents trg_document_current_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_document_current_version AFTER INSERT OR UPDATE ON public.documents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.validate_current_version();


--
-- Name: documents trg_document_status_permission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_status_permission BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION app.check_document_status_permission();


--
-- Name: document_types trg_document_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_types_updated_at BEFORE UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: document_versions trg_document_versions_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_versions_no_delete BEFORE DELETE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: document_versions trg_document_versions_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_versions_no_update BEFORE UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: users trg_enforce_tenant_admin_presence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_tenant_admin_presence BEFORE DELETE OR UPDATE OF status ON public.users FOR EACH ROW EXECUTE FUNCTION app.enforce_tenant_admin_presence();


--
-- Name: expedient_types trg_expedient_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_expedient_types_updated_at BEFORE UPDATE ON public.expedient_types FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: expedients trg_expedients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_expedients_updated_at BEFORE UPDATE ON public.expedients FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: medical_notes trg_medical_note_active_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_medical_note_active_history BEFORE INSERT OR UPDATE ON public.medical_notes FOR EACH ROW EXECUTE FUNCTION app.validate_active_clinical_history();


--
-- Name: medical_notes trg_medical_note_lifecycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_medical_note_lifecycle BEFORE INSERT OR DELETE OR UPDATE ON public.medical_notes FOR EACH ROW EXECUTE FUNCTION app.enforce_medical_note_lifecycle();


--
-- Name: metadata_definitions trg_metadata_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metadata_definitions_updated_at BEFORE UPDATE ON public.metadata_definitions FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: audit_events trg_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON public.audit_events FOR EACH STATEMENT EXECUTE FUNCTION app.block_mutation();


--
-- Name: document_versions trg_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON public.document_versions FOR EACH STATEMENT EXECUTE FUNCTION app.block_mutation();


--
-- Name: workflow_events trg_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON public.workflow_events FOR EACH STATEMENT EXECUTE FUNCTION app.block_mutation();


--
-- Name: ocr_jobs trg_ocr_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ocr_jobs_updated_at BEFORE UPDATE ON public.ocr_jobs FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: patients trg_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: plans trg_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: platform_audit_events trg_platform_audit_events_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_platform_audit_events_no_delete BEFORE DELETE ON public.platform_audit_events FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: platform_audit_events trg_platform_audit_events_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_platform_audit_events_no_truncate BEFORE TRUNCATE ON public.platform_audit_events FOR EACH STATEMENT EXECUTE FUNCTION app.block_mutation();


--
-- Name: platform_audit_events trg_platform_audit_events_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_platform_audit_events_no_update BEFORE UPDATE ON public.platform_audit_events FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: report_templates trg_report_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_report_templates_updated_at BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: retention_policies trg_retention_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_retention_policies_updated_at BEFORE UPDATE ON public.retention_policies FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: revoked_access_tokens trg_revoked_access_tokens_delete_expired; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_revoked_access_tokens_delete_expired BEFORE DELETE ON public.revoked_access_tokens FOR EACH ROW EXECUTE FUNCTION app.delete_expired_revoked_access_token();


--
-- Name: revoked_access_tokens trg_revoked_access_tokens_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_revoked_access_tokens_scope BEFORE INSERT OR UPDATE ON public.revoked_access_tokens FOR EACH ROW EXECUTE FUNCTION app.validate_revoked_access_token_scope();


--
-- Name: roles trg_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: audit_events trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: backup_history trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.backup_history FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: clinical_document_links trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.clinical_document_links FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: clinical_episodes trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.clinical_episodes FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: clinical_histories trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.clinical_histories FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: clinical_staff trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.clinical_staff FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: dicom_instances trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.dicom_instances FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: dicom_series trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.dicom_series FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: dicom_studies trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.dicom_studies FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: document_categories trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.document_categories FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: document_comments trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.document_comments FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: document_metadata_values trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.document_metadata_values FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: document_tags trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.document_tags FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: document_types trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: document_versions trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: documents trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: expedient_participants trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.expedient_participants FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: expedient_types trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.expedient_types FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: expedients trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.expedients FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: metadata_definitions trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.metadata_definitions FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: notifications trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: ocr_jobs trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.ocr_jobs FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: patients trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: report_templates trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: retention_policies trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.retention_policies FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: role_permissions trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: roles trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: tags trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: task_delegations trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.task_delegations FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: tenant_departments trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.tenant_departments FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: tenant_usage_monthly trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.tenant_usage_monthly FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: user_group_members trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.user_group_members FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: user_groups trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: user_push_tokens trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.user_push_tokens FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: user_roles trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: users trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_comments trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_comments FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_documents trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_documents FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_events trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_tasks trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_tasks FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_template_stages trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_template_stages FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_template_transitions trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_template_transitions FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_templates trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflows trg_scope_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: workflow_tasks trg_task_template; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_template BEFORE INSERT OR UPDATE ON public.workflow_tasks FOR EACH ROW EXECUTE FUNCTION app.set_task_template();


--
-- Name: tenant_departments trg_tenant_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_departments_updated_at BEFORE UPDATE ON public.tenant_departments FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: tenants trg_tenant_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_identity BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();


--
-- Name: tenant_usage_monthly trg_tenant_usage_monthly_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_usage_monthly_updated_at BEFORE UPDATE ON public.tenant_usage_monthly FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: tenants trg_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: workflow_templates trg_used_template; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_used_template BEFORE DELETE OR UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION app.protect_used_template();


--
-- Name: workflow_template_stages trg_used_template_stage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_used_template_stage BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_template_stages FOR EACH ROW EXECUTE FUNCTION app.protect_used_template();


--
-- Name: workflow_template_transitions trg_used_template_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_used_template_transition BEFORE INSERT OR DELETE OR UPDATE ON public.workflow_template_transitions FOR EACH ROW EXECUTE FUNCTION app.protect_used_template();


--
-- Name: user_groups trg_user_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_groups_updated_at BEFORE UPDATE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: tenants trg_validate_tenant_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_tenant_status BEFORE INSERT OR UPDATE OF subscription_status ON public.tenants FOR EACH ROW EXECUTE FUNCTION app.validate_tenant_user_status();


--
-- Name: users trg_validate_user_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_user_status BEFORE INSERT OR UPDATE OF status ON public.users FOR EACH ROW EXECUTE FUNCTION app.validate_tenant_user_status();


--
-- Name: document_versions trg_version_advance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_advance AFTER INSERT ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.advance_document_version();


--
-- Name: document_versions trg_version_prepare; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_prepare BEFORE INSERT ON public.document_versions FOR EACH ROW EXECUTE FUNCTION app.prepare_document_version();


--
-- Name: workflow_checklist_items trg_workflow_checklist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_checklist_updated_at BEFORE UPDATE ON public.workflow_checklist_items FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: workflow_comments trg_workflow_comments_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_comments_no_delete BEFORE DELETE ON public.workflow_comments FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: workflow_comments trg_workflow_comments_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_comments_no_update BEFORE UPDATE ON public.workflow_comments FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: workflow_comments trg_workflow_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_comments_updated_at BEFORE UPDATE ON public.workflow_comments FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: workflow_events trg_workflow_events_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_events_no_delete BEFORE DELETE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: workflow_events trg_workflow_events_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_events_no_update BEFORE UPDATE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION app.block_mutation();


--
-- Name: workflow_tasks trg_workflow_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_tasks_updated_at BEFORE UPDATE ON public.workflow_tasks FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: workflows trg_workflow_template_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_template_lock BEFORE INSERT OR UPDATE OF workflow_template_id ON public.workflows FOR EACH ROW EXECUTE FUNCTION app.lock_workflow_template();


--
-- Name: workflow_templates trg_workflow_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_templates_updated_at BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: workflows trg_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: users users_guard_customize_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_guard_customize_update BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.guard_users_customize_update();


--
-- Name: users users_guard_self_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_guard_self_update BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.guard_users_self_update();


--
-- Name: tenant_database_registry tenant_database_registry_tenant_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_database_registry
    ADD CONSTRAINT tenant_database_registry_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: tenant_payment_routes tenant_payment_routes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_payment_routes
    ADD CONSTRAINT tenant_payment_routes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: tenant_purges tenant_purges_tenant_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_purges
    ADD CONSTRAINT tenant_purges_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: addon_prices addon_prices_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_prices
    ADD CONSTRAINT addon_prices_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.addons(id);


--
-- Name: addon_prices addon_prices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_prices
    ADD CONSTRAINT addon_prices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: audit_anchors audit_anchors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_anchors
    ADD CONSTRAINT audit_anchors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: audit_events audit_events_platform_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_platform_actor_id_fkey FOREIGN KEY (platform_actor_id) REFERENCES public.users(id);


--
-- Name: audit_events audit_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: audit_events audit_events_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id);


--
-- Name: auth_sessions auth_sessions_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.auth_sessions(id);


--
-- Name: auth_sessions auth_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: backup_history backup_history_tenant_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_tenant_id_created_by_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES public.users(tenant_id, id);


--
-- Name: backup_history backup_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: billing_transactions billing_transactions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transactions
    ADD CONSTRAINT billing_transactions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;


--
-- Name: billing_transactions billing_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transactions
    ADD CONSTRAINT billing_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: clinical_document_links clinical_document_links_tenant_id_clinical_history_id_epis_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_links
    ADD CONSTRAINT clinical_document_links_tenant_id_clinical_history_id_epis_fkey FOREIGN KEY (tenant_id, clinical_history_id, episode_id) REFERENCES public.clinical_episodes(tenant_id, clinical_history_id, id) DEFERRABLE;


--
-- Name: clinical_document_links clinical_document_links_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_links
    ADD CONSTRAINT clinical_document_links_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: clinical_document_links clinical_document_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_links
    ADD CONSTRAINT clinical_document_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: clinical_document_links clinical_document_links_tenant_id_patient_id_clinical_hist_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_links
    ADD CONSTRAINT clinical_document_links_tenant_id_patient_id_clinical_hist_fkey FOREIGN KEY (tenant_id, patient_id, clinical_history_id) REFERENCES public.clinical_histories(tenant_id, patient_id, id) DEFERRABLE;


--
-- Name: clinical_document_links clinical_document_links_tenant_id_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_links
    ADD CONSTRAINT clinical_document_links_tenant_id_patient_id_fkey FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) DEFERRABLE;


--
-- Name: clinical_episodes clinical_episodes_tenant_id_clinical_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_episodes
    ADD CONSTRAINT clinical_episodes_tenant_id_clinical_history_id_fkey FOREIGN KEY (tenant_id, clinical_history_id) REFERENCES public.clinical_histories(tenant_id, id) DEFERRABLE;


--
-- Name: clinical_episodes clinical_episodes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_episodes
    ADD CONSTRAINT clinical_episodes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: clinical_histories clinical_histories_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) DEFERRABLE;


--
-- Name: clinical_histories clinical_histories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: clinical_histories clinical_histories_tenant_id_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_histories
    ADD CONSTRAINT clinical_histories_tenant_id_patient_id_fkey FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) DEFERRABLE;


--
-- Name: clinical_history_revisions clinical_history_revisions_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_history_revisions
    ADD CONSTRAINT clinical_history_revisions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL DEFERRABLE;


--
-- Name: clinical_history_revisions clinical_history_revisions_clinical_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_history_revisions
    ADD CONSTRAINT clinical_history_revisions_clinical_history_id_fkey FOREIGN KEY (clinical_history_id) REFERENCES public.clinical_histories(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: clinical_history_revisions clinical_history_revisions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_history_revisions
    ADD CONSTRAINT clinical_history_revisions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: clinical_staff clinical_staff_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_staff
    ADD CONSTRAINT clinical_staff_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: clinical_staff clinical_staff_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_staff
    ADD CONSTRAINT clinical_staff_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: component_permissions component_permissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_permissions
    ADD CONSTRAINT component_permissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: dicom_instances dicom_instances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_instances
    ADD CONSTRAINT dicom_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: dicom_instances dicom_instances_tenant_id_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_instances
    ADD CONSTRAINT dicom_instances_tenant_id_series_id_fkey FOREIGN KEY (tenant_id, series_id) REFERENCES public.dicom_series(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: dicom_series dicom_series_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_series
    ADD CONSTRAINT dicom_series_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: dicom_series dicom_series_tenant_id_study_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_series
    ADD CONSTRAINT dicom_series_tenant_id_study_id_fkey FOREIGN KEY (tenant_id, study_id) REFERENCES public.dicom_studies(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: dicom_studies dicom_studies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_studies
    ADD CONSTRAINT dicom_studies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: dicom_studies dicom_studies_tenant_id_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_studies
    ADD CONSTRAINT dicom_studies_tenant_id_patient_id_fkey FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) DEFERRABLE;


--
-- Name: dicom_studies dicom_studies_tenant_id_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicom_studies
    ADD CONSTRAINT dicom_studies_tenant_id_uploader_id_fkey FOREIGN KEY (tenant_id, uploader_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_categories document_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_categories document_categories_tenant_id_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_tenant_id_parent_id_fkey FOREIGN KEY (tenant_id, parent_id) REFERENCES public.document_categories(tenant_id, id) DEFERRABLE;


--
-- Name: document_comments document_comments_tenant_id_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_tenant_id_author_id_fkey FOREIGN KEY (tenant_id, author_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_comments document_comments_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_comments document_comments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_comments document_comments_tenant_id_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_tenant_id_parent_id_fkey FOREIGN KEY (tenant_id, parent_id) REFERENCES public.document_comments(tenant_id, id) DEFERRABLE;


--
-- Name: document_metadata_values document_metadata_values_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata_values
    ADD CONSTRAINT document_metadata_values_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_metadata_values document_metadata_values_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata_values
    ADD CONSTRAINT document_metadata_values_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_metadata_values document_metadata_values_tenant_id_metadata_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata_values
    ADD CONSTRAINT document_metadata_values_tenant_id_metadata_definition_id_fkey FOREIGN KEY (tenant_id, metadata_definition_id) REFERENCES public.metadata_definitions(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_metadata_values document_metadata_values_tenant_id_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata_values
    ADD CONSTRAINT document_metadata_values_tenant_id_updated_by_fkey FOREIGN KEY (tenant_id, updated_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_tags document_tags_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_tags document_tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_tags document_tags_tenant_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_tenant_id_tag_id_fkey FOREIGN KEY (tenant_id, tag_id) REFERENCES public.tags(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_transfers document_transfers_tenant_id_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_approved_by_fkey FOREIGN KEY (tenant_id, approved_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_transfers document_transfers_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) DEFERRABLE;


--
-- Name: document_transfers document_transfers_tenant_id_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_executed_by_fkey FOREIGN KEY (tenant_id, executed_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_transfers document_transfers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: document_transfers document_transfers_tenant_id_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_policy_id_fkey FOREIGN KEY (tenant_id, policy_id) REFERENCES public.retention_policies(tenant_id, id) DEFERRABLE;


--
-- Name: document_transfers document_transfers_tenant_id_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_transfers
    ADD CONSTRAINT document_transfers_tenant_id_requested_by_fkey FOREIGN KEY (tenant_id, requested_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_types document_types_tenant_id_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_tenant_id_category_id_fkey FOREIGN KEY (tenant_id, category_id) REFERENCES public.document_categories(tenant_id, id) DEFERRABLE;


--
-- Name: document_types document_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: document_types document_types_tenant_id_retention_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_tenant_id_retention_policy_id_fkey FOREIGN KEY (tenant_id, retention_policy_id) REFERENCES public.retention_policies(tenant_id, id) DEFERRABLE;


--
-- Name: document_versions document_versions_tenant_id_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_tenant_id_author_id_fkey FOREIGN KEY (tenant_id, author_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: document_versions document_versions_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) DEFERRABLE;


--
-- Name: document_versions document_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: documents documents_tenant_id_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_author_id_fkey FOREIGN KEY (tenant_id, author_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: documents documents_tenant_id_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_department_id_fkey FOREIGN KEY (tenant_id, department_id) REFERENCES public.tenant_departments(tenant_id, id) DEFERRABLE;


--
-- Name: documents documents_tenant_id_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_document_type_id_fkey FOREIGN KEY (tenant_id, document_type_id) REFERENCES public.document_types(tenant_id, id) DEFERRABLE;


--
-- Name: documents documents_tenant_id_expedient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_expedient_id_fkey FOREIGN KEY (tenant_id, expedient_id) REFERENCES public.expedients(tenant_id, id) DEFERRABLE;


--
-- Name: documents documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: documents documents_tenant_id_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_responsible_id_fkey FOREIGN KEY (tenant_id, responsible_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: enterprise_inquiries enterprise_inquiries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_inquiries
    ADD CONSTRAINT enterprise_inquiries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: enterprise_inquiries enterprise_inquiries_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_inquiries
    ADD CONSTRAINT enterprise_inquiries_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id);


--
-- Name: expedient_participants expedient_participants_tenant_id_expedient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_participants
    ADD CONSTRAINT expedient_participants_tenant_id_expedient_id_fkey FOREIGN KEY (tenant_id, expedient_id) REFERENCES public.expedients(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: expedient_participants expedient_participants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_participants
    ADD CONSTRAINT expedient_participants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: expedient_participants expedient_participants_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_participants
    ADD CONSTRAINT expedient_participants_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: expedient_types expedient_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedient_types
    ADD CONSTRAINT expedient_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: expedients expedients_tenant_id_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_tenant_id_department_id_fkey FOREIGN KEY (tenant_id, department_id) REFERENCES public.tenant_departments(tenant_id, id) DEFERRABLE;


--
-- Name: expedients expedients_tenant_id_expedient_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_tenant_id_expedient_type_id_fkey FOREIGN KEY (tenant_id, expedient_type_id) REFERENCES public.expedient_types(tenant_id, id) DEFERRABLE;


--
-- Name: expedients expedients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: expedients expedients_tenant_id_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedients
    ADD CONSTRAINT expedients_tenant_id_responsible_id_fkey FOREIGN KEY (tenant_id, responsible_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: audit_events fk_audit_user_exists; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT fk_audit_user_exists FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: document_comments fk_comment_parent_document; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT fk_comment_parent_document FOREIGN KEY (tenant_id, document_id, parent_id) REFERENCES public.document_comments(tenant_id, document_id, id) DEFERRABLE;


--
-- Name: workflow_comments fk_comment_workflow_document; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT fk_comment_workflow_document FOREIGN KEY (tenant_id, workflow_id, document_id) REFERENCES public.workflow_documents(tenant_id, workflow_id, document_id) DEFERRABLE;


--
-- Name: workflow_comments fk_comment_workflow_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT fk_comment_workflow_task FOREIGN KEY (tenant_id, workflow_id, task_id) REFERENCES public.workflow_tasks(tenant_id, workflow_id, id) DEFERRABLE;


--
-- Name: component_permissions fk_component_permissions_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_permissions
    ADD CONSTRAINT fk_component_permissions_role FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: documents fk_document_current_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_document_current_version FOREIGN KEY (tenant_id, id, current_version) REFERENCES public.document_versions(tenant_id, document_id, version_number) DEFERRABLE;


--
-- Name: document_types fk_document_types_workflow_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT fk_document_types_workflow_template FOREIGN KEY (tenant_id, workflow_template_id) REFERENCES public.workflow_templates(tenant_id, id) DEFERRABLE;


--
-- Name: documents fk_documents_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_patient FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE SET NULL (patient_id) DEFERRABLE;


--
-- Name: workflow_events fk_event_workflow_document; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT fk_event_workflow_document FOREIGN KEY (tenant_id, workflow_id, document_id) REFERENCES public.workflow_documents(tenant_id, workflow_id, document_id) DEFERRABLE;


--
-- Name: workflow_events fk_event_workflow_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT fk_event_workflow_task FOREIGN KEY (tenant_id, workflow_id, task_id) REFERENCES public.workflow_tasks(tenant_id, workflow_id, id) DEFERRABLE;


--
-- Name: revoked_access_tokens fk_revoked_access_tokens_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_access_tokens
    ADD CONSTRAINT fk_revoked_access_tokens_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: revoked_access_tokens fk_revoked_access_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_access_tokens
    ADD CONSTRAINT fk_revoked_access_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: workflow_template_stages fk_stage_assigned_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT fk_stage_assigned_department FOREIGN KEY (tenant_id, assigned_department_id) REFERENCES public.tenant_departments(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_template_stages fk_stage_assigned_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT fk_stage_assigned_group FOREIGN KEY (tenant_id, assigned_group_id) REFERENCES public.user_groups(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_template_stages fk_stage_assigned_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT fk_stage_assigned_role FOREIGN KEY (tenant_id, assigned_role_id) REFERENCES public.roles(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_template_stages fk_stage_assigned_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT fk_stage_assigned_user FOREIGN KEY (tenant_id, assigned_user_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks fk_task_document_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT fk_task_document_version FOREIGN KEY (tenant_id, document_id, document_version) REFERENCES public.document_versions(tenant_id, document_id, version_number) DEFERRABLE;


--
-- Name: workflow_tasks fk_task_template_stage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT fk_task_template_stage FOREIGN KEY (tenant_id, workflow_template_id, stage_id) REFERENCES public.workflow_template_stages(tenant_id, workflow_template_id, id) DEFERRABLE;


--
-- Name: workflow_tasks fk_task_workflow_document; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT fk_task_workflow_document FOREIGN KEY (tenant_id, workflow_id, document_id) REFERENCES public.workflow_documents(tenant_id, workflow_id, document_id) DEFERRABLE;


--
-- Name: workflow_tasks fk_task_workflow_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT fk_task_workflow_template FOREIGN KEY (tenant_id, workflow_id, workflow_template_id) REFERENCES public.workflows(tenant_id, id, workflow_template_id) DEFERRABLE;


--
-- Name: user_allowed_document_types fk_user_allowed_document_types_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_document_types
    ADD CONSTRAINT fk_user_allowed_document_types_type FOREIGN KEY (tenant_id, document_type_id) REFERENCES public.document_types(tenant_id, id) ON DELETE CASCADE;


--
-- Name: user_allowed_document_types fk_user_allowed_document_types_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_document_types
    ADD CONSTRAINT fk_user_allowed_document_types_user FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE;


--
-- Name: user_customizations fk_user_customizations_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_customizations
    ADD CONSTRAINT fk_user_customizations_user FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE;


--
-- Name: users fk_users_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department FOREIGN KEY (tenant_id, department_id) REFERENCES public.tenant_departments(tenant_id, id) DEFERRABLE;


--
-- Name: users fk_users_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflows fk_workflow_current_step_instance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT fk_workflow_current_step_instance FOREIGN KEY (tenant_id, current_step_instance_id) REFERENCES public.workflow_steps(tenant_id, id) DEFERRABLE;


--
-- Name: workflows fk_workflow_current_template_stage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT fk_workflow_current_template_stage FOREIGN KEY (tenant_id, workflow_template_id, current_stage_id) REFERENCES public.workflow_template_stages(tenant_id, workflow_template_id, id) DEFERRABLE;


--
-- Name: workflows fk_workflow_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT fk_workflow_department FOREIGN KEY (tenant_id, department_id) REFERENCES public.tenant_departments(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks fk_workflow_return_stage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT fk_workflow_return_stage FOREIGN KEY (tenant_id, workflow_template_id, return_stage_id) REFERENCES public.workflow_template_stages(tenant_id, workflow_template_id, id) DEFERRABLE;


--
-- Name: workflow_tasks fk_workflow_task_step_instance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT fk_workflow_task_step_instance FOREIGN KEY (tenant_id, workflow_step_id) REFERENCES public.workflow_steps(tenant_id, id) DEFERRABLE;


--
-- Name: medical_notes medical_notes_tenant_id_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_notes
    ADD CONSTRAINT medical_notes_tenant_id_author_id_fkey FOREIGN KEY (tenant_id, author_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: medical_notes medical_notes_tenant_id_clinical_history_id_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_notes
    ADD CONSTRAINT medical_notes_tenant_id_clinical_history_id_episode_id_fkey FOREIGN KEY (tenant_id, clinical_history_id, episode_id) REFERENCES public.clinical_episodes(tenant_id, clinical_history_id, id) DEFERRABLE;


--
-- Name: medical_notes medical_notes_tenant_id_clinical_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_notes
    ADD CONSTRAINT medical_notes_tenant_id_clinical_history_id_fkey FOREIGN KEY (tenant_id, clinical_history_id) REFERENCES public.clinical_histories(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: medical_notes medical_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_notes
    ADD CONSTRAINT medical_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: metadata_definitions metadata_definitions_tenant_id_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_definitions
    ADD CONSTRAINT metadata_definitions_tenant_id_document_type_id_fkey FOREIGN KEY (tenant_id, document_type_id) REFERENCES public.document_types(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: metadata_definitions metadata_definitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_definitions
    ADD CONSTRAINT metadata_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: notifications notifications_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: ocr_jobs ocr_jobs_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) DEFERRABLE;


--
-- Name: ocr_jobs ocr_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: ocr_jobs ocr_jobs_tenant_id_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_tenant_id_uploaded_by_fkey FOREIGN KEY (tenant_id, uploaded_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: ocr_jobs ocr_jobs_tenant_id_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_tenant_id_validated_by_fkey FOREIGN KEY (tenant_id, validated_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: password_recovery_requests password_recovery_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_recovery_requests
    ADD CONSTRAINT password_recovery_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: patients patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: plan_features plan_features_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_limits plan_limits_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_limits
    ADD CONSTRAINT plan_limits_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_prices plan_prices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: plan_prices plan_prices_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: platform_audit_events platform_audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_events
    ADD CONSTRAINT platform_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: platform_audit_events platform_audit_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_events
    ADD CONSTRAINT platform_audit_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: report_templates report_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: report_templates report_templates_tenant_id_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_tenant_id_owner_id_fkey FOREIGN KEY (tenant_id, owner_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: retention_policies retention_policies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: role_permissions role_permissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: role_permissions role_permissions_tenant_id_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_tenant_id_role_id_fkey FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: roles roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: subscription_payments subscription_payments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;


--
-- Name: subscription_payments subscription_payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tags tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: task_delegations task_delegations_tenant_id_delegate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_delegations
    ADD CONSTRAINT task_delegations_tenant_id_delegate_id_fkey FOREIGN KEY (tenant_id, delegate_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: task_delegations task_delegations_tenant_id_delegator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_delegations
    ADD CONSTRAINT task_delegations_tenant_id_delegator_id_fkey FOREIGN KEY (tenant_id, delegator_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: task_delegations task_delegations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_delegations
    ADD CONSTRAINT task_delegations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: tenant_addons tenant_addons_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.addons(id);


--
-- Name: tenant_addons tenant_addons_billing_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_billing_transaction_id_fkey FOREIGN KEY (billing_transaction_id) REFERENCES public.billing_transactions(id);


--
-- Name: tenant_addons tenant_addons_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: tenant_addons tenant_addons_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_backup_settings tenant_backup_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_backup_settings
    ADD CONSTRAINT tenant_backup_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_backups tenant_backups_tenant_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_backups
    ADD CONSTRAINT tenant_backups_tenant_id_created_by_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES public.users(tenant_id, id);


--
-- Name: tenant_backups tenant_backups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_backups
    ADD CONSTRAINT tenant_backups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_departments tenant_departments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_departments
    ADD CONSTRAINT tenant_departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: tenant_restore_evidence tenant_restore_evidence_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_evidence
    ADD CONSTRAINT tenant_restore_evidence_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.tenant_restore_operations(id);


--
-- Name: tenant_restore_evidence tenant_restore_evidence_safety_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_evidence
    ADD CONSTRAINT tenant_restore_evidence_safety_backup_id_fkey FOREIGN KEY (safety_backup_id) REFERENCES public.tenant_backups(id);


--
-- Name: tenant_restore_evidence tenant_restore_evidence_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_evidence
    ADD CONSTRAINT tenant_restore_evidence_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_restore_operations tenant_restore_operations_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_operations
    ADD CONSTRAINT tenant_restore_operations_backup_id_fkey FOREIGN KEY (backup_id) REFERENCES public.tenant_backups(id);


--
-- Name: tenant_restore_operations tenant_restore_operations_safety_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_operations
    ADD CONSTRAINT tenant_restore_operations_safety_backup_id_fkey FOREIGN KEY (safety_backup_id) REFERENCES public.tenant_backups(id);


--
-- Name: tenant_restore_operations tenant_restore_operations_tenant_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_operations
    ADD CONSTRAINT tenant_restore_operations_tenant_id_created_by_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES public.users(tenant_id, id);


--
-- Name: tenant_restore_operations tenant_restore_operations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_restore_operations
    ADD CONSTRAINT tenant_restore_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_signups tenant_signups_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_signups
    ADD CONSTRAINT tenant_signups_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;


--
-- Name: tenant_signups tenant_signups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_signups
    ADD CONSTRAINT tenant_signups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: tenant_usage_monthly tenant_usage_monthly_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_monthly
    ADD CONSTRAINT tenant_usage_monthly_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: tenants tenants_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: tenants tenants_plan_price_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_plan_price_id_fkey FOREIGN KEY (plan_price_id) REFERENCES public.plan_prices(id);


--
-- Name: tenants tenants_price_change_price_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_price_change_price_id_fkey FOREIGN KEY (price_change_price_id) REFERENCES public.plan_prices(id);


--
-- Name: tenants tenants_scheduled_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_scheduled_plan_id_fkey FOREIGN KEY (scheduled_plan_id) REFERENCES public.plans(id);


--
-- Name: user_allowed_document_types user_allowed_document_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_document_types
    ADD CONSTRAINT user_allowed_document_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_customizations user_customizations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_customizations
    ADD CONSTRAINT user_customizations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_group_members user_group_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT user_group_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_group_members user_group_members_tenant_id_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT user_group_members_tenant_id_group_id_fkey FOREIGN KEY (tenant_id, group_id) REFERENCES public.user_groups(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_group_members user_group_members_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT user_group_members_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_groups user_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_push_tokens user_push_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_push_tokens user_push_tokens_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_roles user_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_roles user_roles_tenant_id_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_tenant_id_role_id_fkey FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: user_roles user_roles_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_approvals workflow_approvals_tenant_id_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_approver_user_id_fkey FOREIGN KEY (tenant_id, approver_user_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_approvals workflow_approvals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_approvals workflow_approvals_tenant_id_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_step_id_fkey FOREIGN KEY (tenant_id, step_id) REFERENCES public.workflow_steps(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_approvals workflow_approvals_tenant_id_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_task_id_fkey FOREIGN KEY (tenant_id, task_id) REFERENCES public.workflow_tasks(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_approvals workflow_approvals_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_completed_by_fkey FOREIGN KEY (tenant_id, completed_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_step_id_fkey FOREIGN KEY (tenant_id, step_id) REFERENCES public.workflow_steps(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_task_id_fkey FOREIGN KEY (tenant_id, task_id) REFERENCES public.workflow_tasks(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_checklist_items workflow_checklist_items_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_checklist_items
    ADD CONSTRAINT workflow_checklist_items_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_codes workflow_codes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_codes
    ADD CONSTRAINT workflow_codes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: workflow_comments workflow_comments_tenant_id_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_tenant_id_author_id_fkey FOREIGN KEY (tenant_id, author_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_comments workflow_comments_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_comments workflow_comments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_comments workflow_comments_tenant_id_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_tenant_id_task_id_fkey FOREIGN KEY (tenant_id, task_id) REFERENCES public.workflow_tasks(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_comments workflow_comments_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT workflow_comments_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_documents workflow_documents_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_documents
    ADD CONSTRAINT workflow_documents_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_documents workflow_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_documents
    ADD CONSTRAINT workflow_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_documents workflow_documents_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_documents
    ADD CONSTRAINT workflow_documents_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_events workflow_events_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_events workflow_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) DEFERRABLE;


--
-- Name: workflow_events workflow_events_tenant_id_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_tenant_id_performed_by_fkey FOREIGN KEY (tenant_id, performed_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_events workflow_events_tenant_id_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_tenant_id_task_id_fkey FOREIGN KEY (tenant_id, task_id) REFERENCES public.workflow_tasks(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_events workflow_events_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_steps workflow_steps_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_steps workflow_steps_tenant_id_template_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_tenant_id_template_step_id_fkey FOREIGN KEY (tenant_id, template_step_id) REFERENCES public.workflow_template_stages(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_steps workflow_steps_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_assigned_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_assigned_department_id_fkey FOREIGN KEY (tenant_id, assigned_department_id) REFERENCES public.tenant_departments(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_assigned_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_assigned_group_id_fkey FOREIGN KEY (tenant_id, assigned_group_id) REFERENCES public.user_groups(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_assigned_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_assigned_role_id_fkey FOREIGN KEY (tenant_id, assigned_role_id) REFERENCES public.roles(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_assigned_user_id_fkey FOREIGN KEY (tenant_id, assigned_user_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_completed_by_fkey FOREIGN KEY (tenant_id, completed_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.documents(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_stage_id_fkey FOREIGN KEY (tenant_id, stage_id) REFERENCES public.workflow_template_stages(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_tasks workflow_tasks_tenant_id_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_tenant_id_workflow_id_fkey FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.workflows(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_template_stages workflow_template_stages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT workflow_template_stages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_template_stages workflow_template_stages_tenant_id_workflow_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_stages
    ADD CONSTRAINT workflow_template_stages_tenant_id_workflow_template_id_fkey FOREIGN KEY (tenant_id, workflow_template_id) REFERENCES public.workflow_templates(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_template_transitions workflow_template_transition_tenant_id_workflow_template__fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_transitions
    ADD CONSTRAINT workflow_template_transition_tenant_id_workflow_template__fkey1 FOREIGN KEY (tenant_id, workflow_template_id, from_stage_id) REFERENCES public.workflow_template_stages(tenant_id, workflow_template_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_template_transitions workflow_template_transition_tenant_id_workflow_template__fkey2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_transitions
    ADD CONSTRAINT workflow_template_transition_tenant_id_workflow_template__fkey2 FOREIGN KEY (tenant_id, workflow_template_id, to_stage_id) REFERENCES public.workflow_template_stages(tenant_id, workflow_template_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_template_transitions workflow_template_transitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_transitions
    ADD CONSTRAINT workflow_template_transitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_template_transitions workflow_template_transitions_tenant_id_workflow_template__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_transitions
    ADD CONSTRAINT workflow_template_transitions_tenant_id_workflow_template__fkey FOREIGN KEY (tenant_id, workflow_template_id) REFERENCES public.workflow_templates(tenant_id, id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflow_templates workflow_templates_tenant_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_created_by_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflow_templates workflow_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflows workflows_tenant_id_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_creator_id_fkey FOREIGN KEY (tenant_id, creator_id) REFERENCES public.users(tenant_id, id) DEFERRABLE;


--
-- Name: workflows workflows_tenant_id_current_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_current_stage_id_fkey FOREIGN KEY (tenant_id, current_stage_id) REFERENCES public.workflow_template_stages(tenant_id, id) DEFERRABLE;


--
-- Name: workflows workflows_tenant_id_expedient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_expedient_id_fkey FOREIGN KEY (tenant_id, expedient_id) REFERENCES public.expedients(tenant_id, id) DEFERRABLE;


--
-- Name: workflows workflows_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: workflows workflows_tenant_id_workflow_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_workflow_template_id_fkey FOREIGN KEY (tenant_id, workflow_template_id) REFERENCES public.workflow_templates(tenant_id, id) DEFERRABLE;


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events audit_security_actor_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_security_actor_insert ON public.audit_events FOR INSERT TO nexodocs_security WITH CHECK (((tenant_id = app.current_tenant_id()) AND (user_id = app.current_user_id()) AND (platform_actor_id IS NULL)));


--
-- Name: audit_events audit_security_chain_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_security_chain_context ON public.audit_events FOR SELECT TO nexodocs_security USING ((NOT (tenant_id IS DISTINCT FROM app.current_tenant_id())));


--
-- Name: audit_events audit_security_definer_system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_security_definer_system_insert ON public.audit_events FOR INSERT TO nexodocs_security WITH CHECK ((user_id IS NULL));


--
-- Name: auth_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_sessions auth_sessions_scoped_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_sessions_scoped_update ON public.auth_sessions FOR UPDATE TO nexodocs_app USING (((NOT (tenant_id IS DISTINCT FROM app.current_tenant_id())) AND ((user_id = app.current_user_id()) OR app.has_permission('user:update'::text)))) WITH CHECK (((NOT (tenant_id IS DISTINCT FROM app.current_tenant_id())) AND ((user_id = app.current_user_id()) OR app.has_permission('user:update'::text))));


--
-- Name: auth_sessions auth_sessions_self_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_sessions_self_insert ON public.auth_sessions FOR INSERT TO nexodocs_app WITH CHECK (((NOT (tenant_id IS DISTINCT FROM app.current_tenant_id())) AND (user_id = app.current_user_id())));


--
-- Name: auth_sessions auth_sessions_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_sessions_self_read ON public.auth_sessions FOR SELECT TO nexodocs_app USING (((NOT (tenant_id IS DISTINCT FROM app.current_tenant_id())) AND ((user_id = app.current_user_id()) OR app.has_permission('user:update'::text))));


--
-- Name: tenant_backups backup_create_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_create_insert ON public.tenant_backups FOR INSERT TO nexodocs_app WITH CHECK (app.has_permission('backup:create'::text));


--
-- Name: tenant_backups backup_create_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_create_update ON public.tenant_backups FOR UPDATE TO nexodocs_app USING ((app.has_permission('backup:create'::text) OR app.has_permission('backup:restore'::text))) WITH CHECK ((app.has_permission('backup:create'::text) OR app.has_permission('backup:restore'::text)));


--
-- Name: backup_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_backup_settings backup_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_read ON public.tenant_backup_settings FOR SELECT TO nexodocs_app USING (app.has_permission('backup:read'::text));


--
-- Name: tenant_backups backup_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_read ON public.tenant_backups FOR SELECT TO nexodocs_app USING (app.has_permission('backup:read'::text));


--
-- Name: tenant_restore_operations backup_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_read ON public.tenant_restore_operations FOR SELECT TO nexodocs_app USING (app.has_permission('backup:read'::text));


--
-- Name: tenant_restore_operations backup_restore_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_restore_insert ON public.tenant_restore_operations FOR INSERT TO nexodocs_app WITH CHECK (app.has_permission('backup:restore'::text));


--
-- Name: tenant_restore_operations backup_restore_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_restore_update ON public.tenant_restore_operations FOR UPDATE TO nexodocs_app USING ((app.has_permission('backup:restore'::text) OR app.has_permission('backup:create'::text))) WITH CHECK ((app.has_permission('backup:restore'::text) OR app.has_permission('backup:create'::text)));


--
-- Name: tenant_backup_settings backup_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_settings_insert ON public.tenant_backup_settings FOR INSERT TO nexodocs_app WITH CHECK ((app.has_permission('backup:read'::text) OR app.has_permission('backup:configure'::text)));


--
-- Name: tenant_backup_settings backup_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_settings_update ON public.tenant_backup_settings FOR UPDATE TO nexodocs_app USING ((app.has_permission('backup:configure'::text) OR app.has_permission('backup:create'::text))) WITH CHECK ((app.has_permission('backup:configure'::text) OR app.has_permission('backup:create'::text)));


--
-- Name: billing_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_transactions billing_transactions_security_functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_transactions_security_functions ON public.billing_transactions TO nexodocs_security USING (true) WITH CHECK (true);


--
-- Name: billing_transactions billing_transactions_tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_transactions_tenant_context ON public.billing_transactions TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: clinical_document_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_document_links ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_episodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_episodes ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_histories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_histories ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_history_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_history_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: component_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: users customize_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customize_update ON public.users FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('user:customize'::text) AS has_permission)) WITH CHECK (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: dicom_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dicom_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: dicom_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dicom_series ENABLE ROW LEVEL SECURITY;

--
-- Name: dicom_studies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dicom_studies ENABLE ROW LEVEL SECURITY;

--
-- Name: documents document_author; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_author ON public.documents AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK ((author_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: document_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: document_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_metadata_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_metadata_values ENABLE ROW LEVEL SECURITY;

--
-- Name: document_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: document_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: document_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

--
-- Name: document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_transfer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_transfer_update ON public.documents FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document:archive'::text) AS has_permission)) WITH CHECK (( SELECT app.has_permission('document:archive'::text) AS has_permission));


--
-- Name: enterprise_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enterprise_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: enterprise_inquiries enterprise_inquiries_tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enterprise_inquiries_tenant_context ON public.enterprise_inquiries TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: expedient_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expedient_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: expedient_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expedient_types ENABLE ROW LEVEL SECURITY;

--
-- Name: expedients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;

--
-- Name: medical_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: metadata_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metadata_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notification_delete_recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_delete_recipient ON public.notifications AS RESTRICTIVE FOR DELETE TO nexodocs_app USING ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: notifications notification_recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_recipient ON public.notifications AS RESTRICTIVE FOR SELECT TO nexodocs_app USING ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: notifications notification_update_recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_update_recipient ON public.notifications AS RESTRICTIVE FOR UPDATE TO nexodocs_app USING ((user_id = ( SELECT app.current_user_id() AS current_user_id))) WITH CHECK ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: ocr_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: enterprise_inquiries own_inquiries_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_inquiries_insert ON public.enterprise_inquiries FOR INSERT TO nexodocs_app WITH CHECK ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: enterprise_inquiries own_inquiries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_inquiries_select ON public.enterprise_inquiries FOR SELECT TO nexodocs_app USING ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: password_recovery_requests password_recovery_app_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_recovery_app_scope ON public.password_recovery_requests TO nexodocs_app USING (((tenant_id = app.current_tenant_id()) AND (user_id = app.current_user_id()))) WITH CHECK (((tenant_id = app.current_tenant_id()) AND (user_id = app.current_user_id())));


--
-- Name: password_recovery_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_recovery_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: password_recovery_requests password_recovery_security_lock; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_recovery_security_lock ON public.password_recovery_requests FOR UPDATE TO nexodocs_security USING (((token_hash)::text = current_setting('app.recovery_token_hash'::text, true))) WITH CHECK (((token_hash)::text = current_setting('app.recovery_token_hash'::text, true)));


--
-- Name: password_recovery_requests password_recovery_security_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_recovery_security_lookup ON public.password_recovery_requests FOR SELECT TO nexodocs_security USING (((token_hash)::text = current_setting('app.recovery_token_hash'::text, true)));


--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: user_push_tokens push_token_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_token_owner ON public.user_push_tokens AS RESTRICTIVE TO nexodocs_app USING ((user_id = ( SELECT app.current_user_id() AS current_user_id))) WITH CHECK ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: audit_events rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.audit_events FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('audit:delete'::text) AS has_permission));


--
-- Name: backup_history rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.backup_history FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: clinical_document_links rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.clinical_document_links FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('patient:delete'::text) AS has_permission));


--
-- Name: clinical_episodes rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.clinical_episodes FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('patient:delete'::text) AS has_permission));


--
-- Name: clinical_histories rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.clinical_histories FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('patient:delete'::text) AS has_permission));


--
-- Name: clinical_staff rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.clinical_staff FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('patient:delete'::text) AS has_permission));


--
-- Name: component_permissions rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.component_permissions FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('component_permission:manage'::text) AS has_permission));


--
-- Name: dicom_instances rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.dicom_instances FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('dicom:delete'::text) AS has_permission));


--
-- Name: dicom_series rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.dicom_series FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('dicom:delete'::text) AS has_permission));


--
-- Name: dicom_studies rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.dicom_studies FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('dicom:delete'::text) AS has_permission));


--
-- Name: document_categories rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.document_categories FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: document_comments rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.document_comments FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('document:delete'::text) AS has_permission));


--
-- Name: document_metadata_values rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.document_metadata_values FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('document:delete'::text) AS has_permission));


--
-- Name: document_tags rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.document_tags FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('document:delete'::text) AS has_permission));


--
-- Name: document_types rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.document_types FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: document_versions rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.document_versions FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('document_version:delete'::text) AS has_permission));


--
-- Name: documents rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.documents FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('document:delete'::text) AS has_permission));


--
-- Name: expedient_participants rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.expedient_participants FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('expedient:delete'::text) AS has_permission));


--
-- Name: expedient_types rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.expedient_types FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: expedients rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.expedients FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('expedient:delete'::text) AS has_permission));


--
-- Name: metadata_definitions rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.metadata_definitions FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: notifications rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.notifications FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('notification:delete'::text) AS has_permission));


--
-- Name: ocr_jobs rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.ocr_jobs FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('ocr:delete'::text) AS has_permission));


--
-- Name: patients rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.patients FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('patient:delete'::text) AS has_permission));


--
-- Name: report_templates rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.report_templates FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('report:delete'::text) AS has_permission));


--
-- Name: retention_policies rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.retention_policies FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: role_permissions rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.role_permissions FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('role:delete'::text) AS has_permission));


--
-- Name: roles rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.roles FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('role:delete'::text) AS has_permission));


--
-- Name: tags rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.tags FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: task_delegations rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.task_delegations FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('task:delegate'::text) AS has_permission));


--
-- Name: tenant_departments rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.tenant_departments FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('configuration:delete'::text) AS has_permission));


--
-- Name: tenant_usage_monthly rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.tenant_usage_monthly FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('report:delete'::text) AS has_permission));


--
-- Name: tenants rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.tenants FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('tenant:delete'::text) AS has_permission));


--
-- Name: user_allowed_document_types rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.user_allowed_document_types FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: user_customizations rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.user_customizations FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: user_group_members rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.user_group_members FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('user:delete'::text) AS has_permission));


--
-- Name: user_groups rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.user_groups FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('user:delete'::text) AS has_permission));


--
-- Name: user_push_tokens rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.user_push_tokens FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('notification:delete'::text) AS has_permission));


--
-- Name: user_roles rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.user_roles FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('role:delete'::text) AS has_permission));


--
-- Name: users rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.users FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('user:delete'::text) AS has_permission));


--
-- Name: workflow_comments rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_comments FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: workflow_documents rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_documents FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: workflow_events rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_events FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: workflow_tasks rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_tasks FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('task:delete'::text) AS has_permission));


--
-- Name: workflow_template_stages rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_template_stages FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: workflow_template_transitions rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_template_transitions FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: workflow_templates rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflow_templates FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: workflows rbac_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_delete ON public.workflows FOR DELETE TO nexodocs_app USING (( SELECT app.has_permission('workflow:delete'::text) AS has_permission));


--
-- Name: audit_events rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.audit_events FOR INSERT TO nexodocs_app WITH CHECK ((user_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: backup_history rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.backup_history FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: clinical_document_links rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.clinical_document_links FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('patient:create'::text) AS has_permission));


--
-- Name: clinical_episodes rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.clinical_episodes FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('patient:create'::text) AS has_permission));


--
-- Name: clinical_histories rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.clinical_histories FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('patient:create'::text) AS has_permission));


--
-- Name: clinical_staff rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.clinical_staff FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('patient:create'::text) AS has_permission));


--
-- Name: component_permissions rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.component_permissions FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('component_permission:manage'::text) AS has_permission));


--
-- Name: dicom_instances rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.dicom_instances FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('dicom:create'::text) AS has_permission));


--
-- Name: dicom_series rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.dicom_series FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('dicom:create'::text) AS has_permission));


--
-- Name: dicom_studies rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.dicom_studies FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('dicom:create'::text) AS has_permission));


--
-- Name: document_categories rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.document_categories FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: document_comments rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.document_comments FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('document:create'::text) AS has_permission));


--
-- Name: document_metadata_values rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.document_metadata_values FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('document:create'::text) AS has_permission));


--
-- Name: document_tags rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.document_tags FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('document:create'::text) AS has_permission));


--
-- Name: document_types rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.document_types FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: document_versions rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.document_versions FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('document_version:create'::text) AS has_permission));


--
-- Name: documents rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.documents FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('document:create'::text) AS has_permission));


--
-- Name: expedient_participants rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.expedient_participants FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('expedient:create'::text) AS has_permission));


--
-- Name: expedient_types rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.expedient_types FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: expedients rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.expedients FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('expedient:create'::text) AS has_permission));


--
-- Name: metadata_definitions rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.metadata_definitions FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: notifications rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.notifications FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('notification:create'::text) AS has_permission));


--
-- Name: ocr_jobs rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.ocr_jobs FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('ocr:create'::text) AS has_permission));


--
-- Name: patients rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.patients FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('patient:create'::text) AS has_permission));


--
-- Name: report_templates rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.report_templates FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('report:create'::text) AS has_permission));


--
-- Name: retention_policies rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.retention_policies FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: role_permissions rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.role_permissions FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('role:create'::text) AS has_permission));


--
-- Name: roles rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.roles FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('role:create'::text) AS has_permission));


--
-- Name: tags rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.tags FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: task_delegations rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.task_delegations FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('task:delegate'::text) AS has_permission));


--
-- Name: tenant_departments rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.tenant_departments FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('configuration:create'::text) AS has_permission));


--
-- Name: tenant_usage_monthly rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.tenant_usage_monthly FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('report:create'::text) AS has_permission));


--
-- Name: tenants rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.tenants FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('tenant:create'::text) AS has_permission));


--
-- Name: user_allowed_document_types rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.user_allowed_document_types FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: user_customizations rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.user_customizations FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: user_group_members rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.user_group_members FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('user:create'::text) AS has_permission));


--
-- Name: user_groups rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.user_groups FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('user:create'::text) AS has_permission));


--
-- Name: user_push_tokens rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.user_push_tokens FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('notification:create'::text) AS has_permission));


--
-- Name: user_roles rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.user_roles FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('role:create'::text) AS has_permission));


--
-- Name: users rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.users FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('user:create'::text) AS has_permission));


--
-- Name: workflow_comments rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_comments FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: workflow_documents rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_documents FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: workflow_events rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_events FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: workflow_tasks rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_tasks FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('task:create'::text) AS has_permission));


--
-- Name: workflow_template_stages rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_template_stages FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: workflow_template_transitions rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_template_transitions FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: workflow_templates rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflow_templates FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: workflows rbac_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_insert ON public.workflows FOR INSERT TO nexodocs_app WITH CHECK (( SELECT app.has_permission('workflow:create'::text) AS has_permission));


--
-- Name: audit_events rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.audit_events FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('audit:read'::text) AS has_permission));


--
-- Name: backup_history rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.backup_history FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: clinical_document_links rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.clinical_document_links FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('patient:read'::text) AS has_permission));


--
-- Name: clinical_episodes rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.clinical_episodes FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('patient:read'::text) AS has_permission));


--
-- Name: clinical_histories rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.clinical_histories FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('patient:read'::text) AS has_permission));


--
-- Name: clinical_staff rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.clinical_staff FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('patient:read'::text) AS has_permission));


--
-- Name: component_permissions rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.component_permissions FOR SELECT TO nexodocs_app USING (true);


--
-- Name: dicom_instances rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.dicom_instances FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('dicom:read'::text) AS has_permission));


--
-- Name: dicom_series rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.dicom_series FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('dicom:read'::text) AS has_permission));


--
-- Name: dicom_studies rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.dicom_studies FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('dicom:read'::text) AS has_permission));


--
-- Name: document_categories rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.document_categories FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: document_comments rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.document_comments FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('document:read'::text) AS has_permission));


--
-- Name: document_metadata_values rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.document_metadata_values FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('document:read'::text) AS has_permission));


--
-- Name: document_tags rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.document_tags FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('document:read'::text) AS has_permission));


--
-- Name: document_types rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.document_types FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: document_versions rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.document_versions FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('document_version:read'::text) AS has_permission));


--
-- Name: documents rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.documents FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('document:read'::text) AS has_permission));


--
-- Name: expedient_participants rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.expedient_participants FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('expedient:read'::text) AS has_permission));


--
-- Name: expedient_types rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.expedient_types FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: expedients rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.expedients FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('expedient:read'::text) AS has_permission));


--
-- Name: metadata_definitions rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.metadata_definitions FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: notifications rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.notifications FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('notification:read'::text) AS has_permission));


--
-- Name: ocr_jobs rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.ocr_jobs FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('ocr:read'::text) AS has_permission));


--
-- Name: patients rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.patients FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('patient:read'::text) AS has_permission));


--
-- Name: report_templates rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.report_templates FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('report:read'::text) AS has_permission));


--
-- Name: retention_policies rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.retention_policies FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: role_permissions rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.role_permissions FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('role:read'::text) AS has_permission));


--
-- Name: roles rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.roles FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('role:read'::text) AS has_permission));


--
-- Name: tags rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.tags FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: task_delegations rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.task_delegations FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('task:read'::text) AS has_permission));


--
-- Name: tenant_departments rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.tenant_departments FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('configuration:read'::text) AS has_permission));


--
-- Name: tenant_usage_monthly rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.tenant_usage_monthly FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('report:read'::text) AS has_permission));


--
-- Name: tenants rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.tenants FOR SELECT TO nexodocs_app USING (true);


--
-- Name: user_allowed_document_types rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.user_allowed_document_types FOR SELECT TO nexodocs_app USING (((user_id = ( SELECT app.current_user_id() AS current_user_id)) OR ( SELECT app.has_permission('user:customize'::text) AS has_permission)));


--
-- Name: user_customizations rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.user_customizations FOR SELECT TO nexodocs_app USING (((user_id = ( SELECT app.current_user_id() AS current_user_id)) OR ( SELECT app.has_permission('user:customize'::text) AS has_permission)));


--
-- Name: user_group_members rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.user_group_members FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('user:read'::text) AS has_permission));


--
-- Name: user_groups rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.user_groups FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('user:read'::text) AS has_permission));


--
-- Name: user_push_tokens rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.user_push_tokens FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('notification:read'::text) AS has_permission));


--
-- Name: user_roles rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.user_roles FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('role:read'::text) AS has_permission));


--
-- Name: users rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.users FOR SELECT TO nexodocs_app USING (((id = ( SELECT app.current_user_id() AS current_user_id)) OR ( SELECT app.has_permission('user:read'::text) AS has_permission)));


--
-- Name: workflow_comments rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_comments FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: workflow_documents rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_documents FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: workflow_events rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_events FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: workflow_tasks rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_tasks FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('task:read'::text) AS has_permission));


--
-- Name: workflow_template_stages rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_template_stages FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: workflow_template_transitions rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_template_transitions FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: workflow_templates rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflow_templates FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: workflows rbac_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_select ON public.workflows FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('workflow:read'::text) AS has_permission));


--
-- Name: audit_events rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.audit_events FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('audit:update'::text) AS has_permission));


--
-- Name: backup_history rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.backup_history FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: clinical_document_links rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.clinical_document_links FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('patient:update'::text) AS has_permission));


--
-- Name: clinical_episodes rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.clinical_episodes FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('patient:update'::text) AS has_permission));


--
-- Name: clinical_histories rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.clinical_histories FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('patient:update'::text) AS has_permission));


--
-- Name: clinical_staff rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.clinical_staff FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('patient:update'::text) AS has_permission));


--
-- Name: component_permissions rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.component_permissions FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('component_permission:manage'::text) AS has_permission));


--
-- Name: dicom_instances rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.dicom_instances FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('dicom:update'::text) AS has_permission));


--
-- Name: dicom_series rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.dicom_series FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('dicom:update'::text) AS has_permission));


--
-- Name: dicom_studies rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.dicom_studies FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('dicom:update'::text) AS has_permission));


--
-- Name: document_categories rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.document_categories FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: document_comments rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.document_comments FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document:update'::text) AS has_permission));


--
-- Name: document_metadata_values rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.document_metadata_values FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document:update'::text) AS has_permission));


--
-- Name: document_tags rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.document_tags FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document:update'::text) AS has_permission));


--
-- Name: document_types rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.document_types FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: document_versions rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.document_versions FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document_version:update'::text) AS has_permission));


--
-- Name: documents rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.documents FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document:update'::text) AS has_permission));


--
-- Name: expedient_participants rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.expedient_participants FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('expedient:update'::text) AS has_permission));


--
-- Name: expedient_types rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.expedient_types FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: expedients rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.expedients FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('expedient:update'::text) AS has_permission));


--
-- Name: metadata_definitions rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.metadata_definitions FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: notifications rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.notifications FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('notification:update'::text) AS has_permission));


--
-- Name: ocr_jobs rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.ocr_jobs FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('ocr:update'::text) AS has_permission));


--
-- Name: patients rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.patients FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('patient:update'::text) AS has_permission));


--
-- Name: report_templates rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.report_templates FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('report:update'::text) AS has_permission));


--
-- Name: retention_policies rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.retention_policies FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: role_permissions rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.role_permissions FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('role:update'::text) AS has_permission));


--
-- Name: roles rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.roles FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('role:update'::text) AS has_permission));


--
-- Name: tags rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.tags FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: task_delegations rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.task_delegations FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('task:delegate'::text) AS has_permission));


--
-- Name: tenant_departments rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.tenant_departments FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: tenant_usage_monthly rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.tenant_usage_monthly FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('report:update'::text) AS has_permission));


--
-- Name: tenants rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.tenants FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('configuration:update'::text) AS has_permission));


--
-- Name: user_allowed_document_types rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.user_allowed_document_types FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: user_customizations rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.user_customizations FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('user:customize'::text) AS has_permission));


--
-- Name: user_group_members rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.user_group_members FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('user:update'::text) AS has_permission));


--
-- Name: user_groups rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.user_groups FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('user:update'::text) AS has_permission));


--
-- Name: user_push_tokens rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.user_push_tokens FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('notification:update'::text) AS has_permission));


--
-- Name: user_roles rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.user_roles FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('role:update'::text) AS has_permission));


--
-- Name: users rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.users FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('user:update'::text) AS has_permission));


--
-- Name: workflow_comments rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_comments FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: workflow_documents rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_documents FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: workflow_events rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_events FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: workflow_tasks rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_tasks FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('task:update'::text) AS has_permission));


--
-- Name: workflow_template_stages rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_template_stages FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: workflow_template_transitions rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_template_transitions FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: workflow_templates rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflow_templates FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: workflows rbac_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rbac_update ON public.workflows FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('workflow:update'::text) AS has_permission));


--
-- Name: report_templates report_creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY report_creator ON public.report_templates AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK ((owner_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: report_templates report_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY report_editor ON public.report_templates AS RESTRICTIVE FOR UPDATE TO nexodocs_app USING ((owner_id = ( SELECT app.current_user_id() AS current_user_id))) WITH CHECK ((owner_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: report_templates report_reader; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY report_reader ON public.report_templates AS RESTRICTIVE FOR SELECT TO nexodocs_app USING (((owner_id = ( SELECT app.current_user_id() AS current_user_id)) OR is_shared));


--
-- Name: report_templates report_remover; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY report_remover ON public.report_templates AS RESTRICTIVE FOR DELETE TO nexodocs_app USING ((owner_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: report_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: retention_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_security_tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permissions_security_tenant_context ON public.role_permissions FOR SELECT TO nexodocs_security USING ((tenant_id = app.current_tenant_id()));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_security_tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_security_tenant_context ON public.roles FOR SELECT TO nexodocs_security USING ((tenant_id = app.current_tenant_id()));


--
-- Name: users self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY self_update ON public.users FOR UPDATE TO nexodocs_app USING ((id = ( SELECT app.current_user_id() AS current_user_id))) WITH CHECK ((id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: subscription_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_payments subscription_payments_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscription_payments_tenant_policy ON public.subscription_payments TO nexodocs_app USING (((tenant_id IS NULL) OR (tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)))) WITH CHECK (((tenant_id IS NULL) OR (tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id))));


--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: task_delegations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_delegations ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_addons tenant_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_addons_read ON public.tenant_addons FOR SELECT TO nexodocs_app USING (true);


--
-- Name: tenant_addons tenant_addons_security_maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_addons_security_maintenance ON public.tenant_addons TO nexodocs_security USING (true) WITH CHECK (true);


--
-- Name: tenant_backup_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_backup_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_backups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.audit_events AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: backup_history tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.backup_history AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: clinical_document_links tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.clinical_document_links AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: clinical_episodes tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.clinical_episodes AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: clinical_histories tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.clinical_histories AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: clinical_staff tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.clinical_staff AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: component_permissions tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.component_permissions AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: dicom_instances tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.dicom_instances AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: dicom_series tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.dicom_series AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: dicom_studies tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.dicom_studies AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_categories tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_categories AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_comments tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_comments AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_metadata_values tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_metadata_values AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_tags tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_tags AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_transfers tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_transfers AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_types tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_types AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: document_versions tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.document_versions AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: documents tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.documents AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: enterprise_inquiries tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.enterprise_inquiries AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: expedient_participants tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.expedient_participants AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: expedient_types tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.expedient_types AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: expedients tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.expedients AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: metadata_definitions tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.metadata_definitions AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: notifications tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.notifications AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: ocr_jobs tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.ocr_jobs AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: patients tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.patients AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: report_templates tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.report_templates AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: retention_policies tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.retention_policies AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: role_permissions tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.role_permissions AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: roles tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.roles AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: tags tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tags AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: task_delegations tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.task_delegations AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: tenant_addons tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenant_addons AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: tenant_backup_settings tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenant_backup_settings AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = app.current_tenant_id()) AND app.context_is_valid())) WITH CHECK (((tenant_id = app.current_tenant_id()) AND app.context_is_valid()));


--
-- Name: tenant_backups tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenant_backups AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = app.current_tenant_id()) AND app.context_is_valid())) WITH CHECK (((tenant_id = app.current_tenant_id()) AND app.context_is_valid()));


--
-- Name: tenant_departments tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenant_departments AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: tenant_restore_operations tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenant_restore_operations AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = app.current_tenant_id()) AND app.context_is_valid())) WITH CHECK (((tenant_id = app.current_tenant_id()) AND app.context_is_valid()));


--
-- Name: tenant_usage_monthly tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenant_usage_monthly AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: tenants tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.tenants AS RESTRICTIVE TO nexodocs_app USING (((id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: user_allowed_document_types tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.user_allowed_document_types AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: user_customizations tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.user_customizations AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: user_group_members tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.user_group_members AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: user_groups tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.user_groups AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: user_push_tokens tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.user_push_tokens AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: user_roles tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.user_roles AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: users tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.users AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_comments tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_comments AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_documents tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_documents AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_events tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_events AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_tasks tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_tasks AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_template_stages tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_template_stages AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_template_transitions tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_template_transitions AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflow_templates tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflow_templates AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: workflows tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_context ON public.workflows AS RESTRICTIVE TO nexodocs_app USING (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid))) WITH CHECK (((tenant_id = ( SELECT app.current_tenant_id() AS current_tenant_id)) AND ( SELECT app.context_is_valid() AS context_is_valid)));


--
-- Name: tenant_departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_departments ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_history_revisions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clinical_history_revisions USING ((tenant_id = app.current_tenant_id())) WITH CHECK ((tenant_id = app.current_tenant_id()));


--
-- Name: medical_notes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.medical_notes USING ((tenant_id = app.current_tenant_id())) WITH CHECK ((tenant_id = app.current_tenant_id()));


--
-- Name: tenant_restore_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_restore_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_usage_monthly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_usage_monthly ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants tenants_security_functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenants_security_functions ON public.tenants TO nexodocs_security USING (true) WITH CHECK (true);


--
-- Name: document_transfers transfers_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfers_create ON public.document_transfers FOR INSERT TO nexodocs_app WITH CHECK ((( SELECT app.has_permission('document:archive'::text) AS has_permission) AND (requested_by = ( SELECT app.current_user_id() AS current_user_id))));


--
-- Name: document_transfers transfers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfers_read ON public.document_transfers FOR SELECT TO nexodocs_app USING (( SELECT app.has_permission('document:read'::text) AS has_permission));


--
-- Name: document_transfers transfers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfers_update ON public.document_transfers FOR UPDATE TO nexodocs_app USING (( SELECT app.has_permission('document:archive'::text) AS has_permission));


--
-- Name: user_allowed_document_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_allowed_document_types ENABLE ROW LEVEL SECURITY;

--
-- Name: user_customizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_customizations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: user_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: user_push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_security_tenant_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_security_tenant_context ON public.user_roles FOR SELECT TO nexodocs_security USING ((tenant_id = app.current_tenant_id()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_security_actor_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_security_actor_context ON public.users FOR SELECT TO nexodocs_security USING ((id = app.current_user_id()));


--
-- Name: users users_security_tenant_login; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_security_tenant_login ON public.users FOR SELECT TO nexodocs_security USING ((tenant_id = app.current_tenant_id()));


--
-- Name: document_versions version_author; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY version_author ON public.document_versions AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK ((author_id = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: workflow_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_approvals workflow_approvals_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_approvals_tenant ON public.workflow_approvals USING (((tenant_id = app.current_tenant_id()) AND app.context_is_valid() AND app.has_permission('workflow:read'::text))) WITH CHECK (((tenant_id = app.current_tenant_id()) AND app.context_is_valid() AND (approver_user_id = app.current_user_id()) AND (app.has_permission('workflow:approve'::text) OR app.has_permission('workflow:reject'::text) OR app.has_permission('workflow:return'::text))));


--
-- Name: workflow_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_checklist_items workflow_checklist_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_checklist_tenant ON public.workflow_checklist_items USING (((tenant_id = app.current_tenant_id()) AND app.context_is_valid() AND (app.has_permission('task:read'::text) OR app.has_permission('workflow:read'::text)))) WITH CHECK (((tenant_id = app.current_tenant_id()) AND app.context_is_valid() AND (app.has_permission('task:create'::text) OR app.has_permission('task:update'::text))));


--
-- Name: workflow_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_codes workflow_codes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_codes_tenant ON public.workflow_codes USING ((tenant_id = app.current_tenant_id())) WITH CHECK ((tenant_id = app.current_tenant_id()));


--
-- Name: workflow_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_events workflow_event_actor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_event_actor ON public.workflow_events AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK ((performed_by = ( SELECT app.current_user_id() AS current_user_id)));


--
-- Name: workflow_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_steps workflow_steps_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_steps_tenant ON public.workflow_steps USING ((tenant_id = app.current_tenant_id())) WITH CHECK ((tenant_id = app.current_tenant_id()));


--
-- Name: workflow_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_template_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_template_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_template_transitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_template_transitions ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


