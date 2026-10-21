\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 38);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '038_billing_security_hardening') AS already_applied \gset
\if :already_applied
  \echo '038_billing_security_hardening ya aplicada'
\else
  -- SECURITY DEFINER does not bypass FORCE ROW LEVEL SECURITY for its owner.
  -- These narrowly scoped policies let only security-definer functions read and
  -- settle billing data; the application role remains tenant-isolated.
  DROP POLICY IF EXISTS billing_transactions_security_functions ON billing_transactions;
  CREATE POLICY billing_transactions_security_functions ON billing_transactions
    FOR ALL TO nexodocs_security USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS tenants_security_functions ON tenants;
  CREATE POLICY tenants_security_functions ON tenants
    FOR ALL TO nexodocs_security USING (true) WITH CHECK (true);
  GRANT SELECT, UPDATE ON billing_transactions, tenants TO nexodocs_security;

  CREATE OR REPLACE FUNCTION app.revenue_dashboard()
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
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
  ALTER FUNCTION app.revenue_dashboard() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.revenue_dashboard() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.revenue_dashboard() TO nexodocs_app;

  -- Idempotent settlement used only after a verified Stripe webhook. Keeping it
  -- in the database avoids weakening tenant RLS for unauthenticated webhooks.
  CREATE OR REPLACE FUNCTION app.complete_stripe_payment(p_transaction_id uuid, p_payment_intent_id text)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
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
  ALTER FUNCTION app.complete_stripe_payment(uuid, text) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.complete_stripe_payment(uuid, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.complete_stripe_payment(uuid, text) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('038_billing_security_hardening');
\endif
COMMIT;
