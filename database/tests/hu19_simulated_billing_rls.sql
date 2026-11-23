-- Prueba automatizada de pagos simulados, funciones SECURITY DEFINER y RLS (Parte 1 Sprint HU-19..24)
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.tenant_id','',false), set_config('app.user_id','',false);

-- Fixture
CREATE TEMPORARY TABLE IF NOT EXISTS sim_fixture (
  tenant_a uuid,
  tenant_b uuid,
  admin_a uuid,
  admin_b uuid,
  plan_id uuid
);
DELETE FROM sim_fixture;

INSERT INTO sim_fixture VALUES (
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'f0000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid
);

-- Crear tenant_a mediante onboarding seguro
SELECT set_config('app.user_id', '', true);
SELECT app.create_public_tenant_onboarding(
  f.tenant_a, 'Org Sim A', 'ORGA', 'org-sim-a', 'a@sim.test',
  f.plan_id, now(), now() + interval '12 days',
  f.admin_a, 'admin_sim_a', 'admin@sim-a.test',
  '2a10abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
  'Admin', 'SimA', ARRAY[1::bigint]
) FROM sim_fixture f;

-- Crear tenant_b mediante onboarding seguro
SELECT set_config('app.user_id', '', true);
SELECT app.create_public_tenant_onboarding(
  f.tenant_b, 'Org Sim B', 'ORGB', 'org-sim-b', 'b@sim.test',
  f.plan_id, now(), now() + interval '12 days',
  f.admin_b, 'admin_sim_b', 'admin@sim-b.test',
  '2a10abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
  'Admin', 'SimB', ARRAY[1::bigint]
) FROM sim_fixture f;

-- Registrar pago simulado para tenant A (session sim_test_a)
SELECT app.record_simulated_signup_payment(
  f.tenant_a, f.plan_id, 'MONTHLY', 'Org Sim A', 'a@sim.test',
  'Admin SimA', 'admin@sim-a.test', 'sim_test_a', 29.00
) FROM sim_fixture f;

-- Registrar pago simulado para tenant B (session sim_test_b)
SELECT app.record_simulated_signup_payment(
  f.tenant_b, f.plan_id, 'ANNUAL', 'Org Sim B', 'b@sim.test',
  'Admin SimB', 'admin@sim-b.test', 'sim_test_b', 290.00
) FROM sim_fixture f;

-- Verificar consulta de estado público simulado
DO $$
DECLARE
  v_status record;
BEGIN
  SELECT * INTO v_status FROM app.get_simulated_signup_status('sim_test_a');
  IF v_status.status <> 'COMPLETED' OR v_status.tenant_name <> 'Org Sim A' THEN
    RAISE EXCEPTION 'Estado de pago simulado incorrecto para session A';
  END IF;
END $$;

-- Conceder permisos sobre la tabla temporal a nexodocs_app
GRANT ALL ON sim_fixture TO nexodocs_app;

-- Cambiar a rol nexodocs_app (restringido de aplicación con RLS activo)
SET LOCAL ROLE nexodocs_app;

-- 1. nexodocs_app NO puede insertar ni leer directamente tenant_signups
DO $$
BEGIN
  BEGIN
    INSERT INTO tenant_signups(id, plan_id, billing_period, tenant_name, company_email, administrator_name, admin_email, password_hash, status)
    VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'MONTHLY', 'Hacker', 'h@h.test', 'Hacker', 'h@h.test', '', 'COMPLETED');
    RAISE EXCEPTION 'Debería haber fallado inserción directa en tenant_signups';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Éxito esperado: permisos denegados
  END;

  BEGIN
    PERFORM count(*) FROM tenant_signups;
    RAISE EXCEPTION 'Debería haber fallado lectura directa en tenant_signups';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Éxito esperado: permisos denegados
  END;
END $$;

-- 2. Con contexto de Tenant A: solo ve pagos y transacciones del Tenant A
SELECT set_config('app.tenant_id', f.tenant_a::text, true), set_config('app.user_id', f.admin_a::text, true) FROM sim_fixture f;

DO $$
DECLARE
  v_payments_count integer;
  v_tx_count integer;
BEGIN
  SELECT count(*) INTO v_payments_count FROM subscription_payments;
  IF v_payments_count <> 1 THEN
    RAISE EXCEPTION 'RLS falló: Tenant A ve % pagos (esperado 1)', v_payments_count;
  END IF;

  SELECT count(*) INTO v_tx_count FROM billing_transactions;
  IF v_tx_count <> 1 THEN
    RAISE EXCEPTION 'RLS falló: Tenant A ve % transacciones (esperado 1)', v_tx_count;
  END IF;
END $$;

-- 3. Con contexto de Tenant B: solo ve pagos y transacciones del Tenant B
SELECT set_config('app.tenant_id', f.tenant_b::text, true), set_config('app.user_id', f.admin_b::text, true) FROM sim_fixture f;

DO $$
DECLARE
  v_payments_count integer;
  v_tx_count integer;
BEGIN
  SELECT count(*) INTO v_payments_count FROM subscription_payments;
  IF v_payments_count <> 1 THEN
    RAISE EXCEPTION 'RLS falló: Tenant B ve % pagos (esperado 1)', v_payments_count;
  END IF;

  SELECT count(*) INTO v_tx_count FROM billing_transactions;
  IF v_tx_count <> 1 THEN
    RAISE EXCEPTION 'RLS falló: Tenant B ve % transacciones (esperado 1)', v_tx_count;
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
\echo 'Pruebas de pagos simulados y RLS completadas exitosamente.'
