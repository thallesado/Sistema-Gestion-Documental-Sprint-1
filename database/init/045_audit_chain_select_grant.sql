\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 45);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '045_audit_chain_select_grant'
) AS already_applied \gset

\if :already_applied
  \echo '045_audit_chain_select_grant ya aplicada'
\else
  -- 041_audit_tamper_proof crea app.trg_audit_events_chain() como SECURITY DEFINER de
  -- nexodocs_security, que solo tenía INSERT en audit_events. El trigger lee el último
  -- eslabón de la cadena del tenant, así que toda escritura auditada (alta de usuarios,
  -- documentos, roles...) fallaba con "permission denied for table audit_events".
  -- Se concede SELECT solo sobre las columnas que lee el trigger.
  GRANT SELECT (tenant_id, chain_seq, record_hash) ON public.audit_events TO nexodocs_security;

  INSERT INTO app.schema_migrations(version) VALUES ('045_audit_chain_select_grant');
  \echo '045_audit_chain_select_grant aplicada exitosamente'
\endif

COMMIT;
