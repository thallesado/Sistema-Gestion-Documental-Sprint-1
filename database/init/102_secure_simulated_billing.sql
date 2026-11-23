\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 102);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '102_secure_simulated_billing') AS already_applied \gset
\if :already_applied
  \echo '102_secure_simulated_billing ya aplicada, actualizando funciones'
\endif

  -- Otorgar privilegios necesarios al rol de seguridad nexodocs_security
  GRANT USAGE ON SCHEMA public, app TO nexodocs_security;
  GRANT SELECT, INSERT, UPDATE ON public.tenant_signups TO nexodocs_security;
  GRANT SELECT, INSERT, UPDATE ON public.subscription_payments TO nexodocs_security;
  GRANT SELECT, INSERT, UPDATE ON public.billing_transactions TO nexodocs_security;
  GRANT SELECT, UPDATE ON public.tenants TO nexodocs_security;
  GRANT SELECT ON public.plans TO nexodocs_security;

  -- 1. Función para registrar el alta simulada y pago en tenant_signups, subscription_payments y billing_transactions
  CREATE OR REPLACE FUNCTION app.record_simulated_signup_payment(
    p_tenant_id uuid,
    p_plan_id uuid,
    p_billing_period text,
    p_tenant_name text,
    p_company_email text,
    p_administrator_name text,
    p_admin_email text,
    p_session_id text,
    p_amount numeric
  ) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
  DECLARE
    v_signup_id uuid := gen_random_uuid();
    v_payment_id uuid := gen_random_uuid();
    v_tx_id uuid := gen_random_uuid();
    v_period_interval interval;
  BEGIN
    IF p_tenant_id IS NULL OR p_plan_id IS NULL OR p_session_id IS NULL THEN
      RAISE EXCEPTION 'Parámetros inválidos para pago simulado' USING ERRCODE = '22023';
    END IF;

    -- Registrar en tenant_signups
    INSERT INTO public.tenant_signups(
      id, plan_id, billing_period, tenant_name, company_email,
      administrator_name, admin_email, password_hash, status,
      stripe_checkout_id, tenant_id, created_at, updated_at
    ) VALUES (
      v_signup_id, p_plan_id, p_billing_period, p_tenant_name, p_company_email,
      p_administrator_name, p_admin_email, '', 'COMPLETED',
      p_session_id, p_tenant_id, now(), now()
    );

    -- Registrar en subscription_payments
    INSERT INTO public.subscription_payments(
      id, tenant_id, plan_id, company_name, admin_email,
      amount_usd, currency, payment_method, billing_period,
      status, simulated, transaction_reference, created_at
    ) VALUES (
      v_payment_id, p_tenant_id, p_plan_id, p_tenant_name, p_admin_email,
      p_amount, 'USD', 'SIMULATED_CARD', p_billing_period,
      'COMPLETED', true, p_session_id, now()
    );

    -- Registrar en billing_transactions
    INSERT INTO public.billing_transactions(
      id, tenant_id, plan_id, amount_usd, currency,
      payment_method, status, external_reference, billing_period,
      metadata_json, created_at, completed_at
    ) VALUES (
      v_tx_id, p_tenant_id, p_plan_id, p_amount, 'USD',
      'STRIPE_CARD', 'COMPLETED', p_session_id, p_billing_period,
      jsonb_build_object('mode', 'simulated', 'kind', 'tenant_signup', 'sessionId', p_session_id),
      now(), now()
    );

    -- Activar suscripción en tenants (asegurar contexto limpio para auditoría de fila)
    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
    PERFORM set_config('app.user_id', '', true);
    v_period_interval := CASE WHEN p_billing_period = 'ANNUAL' THEN interval '365 days' ELSE interval '30 days' END;
    UPDATE public.tenants
    SET subscription_status = 'ACTIVE',
        current_period_end = now() + v_period_interval,
        billing_cycle_v2 = p_billing_period,
        preferred_payment_method = 'SIMULATED_CARD'
    WHERE id = p_tenant_id;

    RETURN v_signup_id;
  END;
  $$;

  ALTER FUNCTION app.record_simulated_signup_payment(uuid, uuid, text, text, text, text, text, text, numeric) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.record_simulated_signup_payment(uuid, uuid, text, text, text, text, text, text, numeric) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_simulated_signup_payment(uuid, uuid, text, text, text, text, text, text, numeric) TO nexodocs_app;

  -- 2. Función para consultar el estado de la sesión simulada sin exponer tenant_signups directamente
  CREATE OR REPLACE FUNCTION app.get_simulated_signup_status(
    p_session_id text
  ) RETURNS TABLE(
    status varchar(20),
    tenant_name varchar(160),
    tenant_id uuid
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
    SELECT status, tenant_name, tenant_id
    FROM public.tenant_signups
    WHERE stripe_checkout_id = p_session_id
    LIMIT 1;
  $$;

  ALTER FUNCTION app.get_simulated_signup_status(text) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.get_simulated_signup_status(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.get_simulated_signup_status(text) TO nexodocs_app;

  -- 3. Función para registrar pagos simulados en checkout u órdenes manuales
  CREATE OR REPLACE FUNCTION app.record_simulated_payment(
    p_transaction_id uuid,
    p_external_reference text
  ) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
  DECLARE
    tx public.billing_transactions%ROWTYPE;
    period_end timestamptz;
  BEGIN
    SELECT * INTO tx FROM public.billing_transactions WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF tx.status = 'COMPLETED' THEN RETURN true; END IF;

    period_end := now() + CASE WHEN tx.billing_period = 'ANNUAL' THEN interval '365 days' ELSE interval '30 days' END;

    UPDATE public.billing_transactions
    SET status = 'COMPLETED',
        completed_at = now(),
        external_reference = coalesce(p_external_reference, tx.external_reference),
        metadata_json = metadata_json || jsonb_build_object('mode', 'simulated', 'status', 'COMPLETED')
    WHERE id = tx.id;

    -- Registrar en subscription_payments
    INSERT INTO public.subscription_payments(
      id, tenant_id, plan_id, company_name, admin_email,
      amount_usd, currency, payment_method, billing_period,
      status, simulated, transaction_reference, created_at
    )
    SELECT gen_random_uuid(), tx.tenant_id, tx.plan_id, t.name, t.email,
           tx.amount_usd, 'USD', tx.payment_method, tx.billing_period,
           'COMPLETED', true, coalesce(p_external_reference, tx.external_reference), now()
    FROM public.tenants t WHERE t.id = tx.tenant_id;

    -- Actualizar tenant si corresponde
    UPDATE public.tenants
    SET plan_id = tx.plan_id,
        subscription_status = 'ACTIVE',
        current_period_end = period_end,
        billing_cycle_v2 = tx.billing_period,
        preferred_payment_method = tx.payment_method
    WHERE id = tx.tenant_id;

    RETURN true;
  END;
  $$;

  ALTER FUNCTION app.record_simulated_payment(uuid, text) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.record_simulated_payment(uuid, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_simulated_payment(uuid, text) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('102_secure_simulated_billing')
  ON CONFLICT (version) DO NOTHING;
  \echo '102_secure_simulated_billing aplicada exitosamente'
COMMIT;
