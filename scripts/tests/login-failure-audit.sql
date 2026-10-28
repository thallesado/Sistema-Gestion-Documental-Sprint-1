\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE nexodocs_app;
SELECT app.record_failed_authentication(NULL, 'audit-fixture@example.test', '192.0.2.40', 'integration-test');
RESET ROLE;
DO $$
DECLARE event public.audit_events;
BEGIN
  SELECT * INTO STRICT event FROM public.audit_events
    WHERE action='LOGIN_FAILED' AND details->>'attemptedIdentifier'='audit-fixture@example.test'
    ORDER BY id DESC LIMIT 1;
  IF event.result <> 'FAILURE' OR event.user_id IS NOT NULL
    OR event.ip_address <> '192.0.2.40'::inet OR length(event.record_hash) <> 64
    OR event.details <> '{"attemptedIdentifier":"audit-fixture@example.test"}'::jsonb THEN
    RAISE EXCEPTION 'Invalid failed-login audit payload';
  END IF;
  RAISE NOTICE 'PASS: anonymous application role records failed login with hash and without password';
END $$;
ROLLBACK;
