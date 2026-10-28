\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 61);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '061_subscription_lifecycle') AS already_applied \gset
\if :already_applied
  \echo '061_subscription_lifecycle ya aplicada'
\else
  -- Ciclo de vida de la suscripción: no renovar, cambio de plan programado para el próximo período,
  -- cancelación y borrado diferido de la organización. Lo escribe el backend con su usuario de conexión
  -- (como los webhooks de Stripe en 059); nexodocs_app no recibe privilegios sobre estas columnas.
  ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS scheduled_plan_id uuid REFERENCES plans(id),
    ADD COLUMN IF NOT EXISTS scheduled_billing_cycle varchar(10),
    ADD COLUMN IF NOT EXISTS scheduled_change_at timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_schedule_id varchar(255),
    ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancellation_reason varchar(500),
    ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
    ADD COLUMN IF NOT EXISTS purged_at timestamptz;
  ALTER TABLE tenants ADD CONSTRAINT ck_tenants_scheduled_cycle
    CHECK (scheduled_billing_cycle IS NULL OR scheduled_billing_cycle IN ('MONTHLY', 'ANNUAL'));
  ALTER TABLE tenants ADD CONSTRAINT ck_tenants_scheduled_change
    CHECK ((scheduled_plan_id IS NULL) = (scheduled_change_at IS NULL));
  CREATE INDEX IF NOT EXISTS idx_tenants_pending_deletion ON tenants (deletion_scheduled_at)
    WHERE deletion_scheduled_at IS NOT NULL AND purged_at IS NULL;

  -- Prueba de borrado ligada a la transacción, igual que tenant_restore_evidence en 050: una
  -- variable de sesión sola no basta porque nexodocs_app puede fijar cualquier set_config.
  CREATE TABLE IF NOT EXISTS app.tenant_purges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    transaction_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  REVOKE ALL ON app.tenant_purges FROM PUBLIC, nexodocs_app;

  CREATE OR REPLACE FUNCTION app.tenant_purge_active() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
    SELECT EXISTS (SELECT 1 FROM app.tenant_purges p
                   WHERE p.id::text = current_setting('app.tenant_purge', true) AND p.transaction_id = txid_current())
  $$;
  REVOKE ALL ON FUNCTION app.tenant_purge_active() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.tenant_purge_active() TO nexodocs_app;

  -- Los triggers reescritos en 050 (auditoría por fila, inmutabilidad, bloqueo por restauración)
  -- ya consultan esta función: el borrado controlado reutiliza la misma excepción que la restauración.
  CREATE OR REPLACE FUNCTION app.backup_is_restoring() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
    SELECT EXISTS (SELECT 1 FROM public.tenant_restore_evidence e
                   WHERE e.id::text = current_setting('app.restore_evidence', true) AND e.transaction_id = txid_current())
        OR app.tenant_purge_active()
  $$;

  CREATE OR REPLACE FUNCTION app.protect_backup_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF app.tenant_purge_active() THEN RETURN COALESCE(NEW, OLD); END IF;
    IF OLD.pinned AND OLD.status = 'COMPLETED' AND (TG_OP = 'DELETE' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)) THEN
      RAISE EXCEPTION 'El respaldo es evidencia protegida' USING ERRCODE = '55000';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END $$;

  -- Borrado definitivo al terminar el período de gracia. Elimina el contenido de la organización
  -- (documentos, expedientes, pacientes, workflows, configuración), vacía sus respaldos y anonimiza a
  -- sus usuarios. Conserva la bitácora de auditoría y la facturación, que la ley exige retener, y la
  -- fila del tenant como referencia de esos registros. Los archivos en disco los borra el backend.
  CREATE OR REPLACE FUNCTION app.purge_tenant(t uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
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
  END $$;
  REVOKE ALL ON FUNCTION app.purge_tenant(uuid) FROM PUBLIC;

  INSERT INTO app.schema_migrations(version) VALUES ('061_subscription_lifecycle');
  \echo '061_subscription_lifecycle aplicada exitosamente'
\endif

COMMIT;
