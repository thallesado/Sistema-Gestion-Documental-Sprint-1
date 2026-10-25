\set ON_ERROR_STOP on
BEGIN;
-- Regression: the application role must be able to INSERT every users column that
-- Hibernate maps, and the SECURITY DEFINER usage function must be able to write
-- tenant_usage_monthly through its owner (nexodocs_security).
DO $$
BEGIN
  IF NOT has_column_privilege('nexodocs_app', 'public.users', 'preferred_language', 'INSERT')
     OR NOT has_column_privilege('nexodocs_app', 'public.users', 'must_change_password', 'INSERT') THEN
    RAISE EXCEPTION 'nexodocs_app cannot INSERT users.preferred_language / must_change_password';
  END IF;
  IF NOT has_table_privilege('nexodocs_security', 'public.tenant_usage_monthly', 'INSERT')
     OR NOT has_table_privilege('nexodocs_security', 'public.tenant_usage_monthly', 'UPDATE') THEN
    RAISE EXCEPTION 'nexodocs_security cannot write tenant_usage_monthly';
  END IF;
END $$;

-- Exercise the real code path as the application role: counters must accumulate.
DO $$
DECLARE
  v_tenant uuid;
  v_documents int;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE NOTICE 'No tenant available; skipping the usage function check';
    RETURN;
  END IF;
  SET LOCAL ROLE nexodocs_app;
  PERFORM app.record_tenant_monthly_usage(v_tenant, 1, 10, 0);
  PERFORM app.record_tenant_monthly_usage(v_tenant, 1, 10, 0);
  RESET ROLE;
  SELECT documents_created INTO v_documents FROM public.tenant_usage_monthly
  WHERE tenant_id = v_tenant AND year_month = date_trunc('month', now())::date;
  IF v_documents < 2 THEN
    RAISE EXCEPTION 'Usage counter did not accumulate: %', v_documents;
  END IF;
END $$;
ROLLBACK;
