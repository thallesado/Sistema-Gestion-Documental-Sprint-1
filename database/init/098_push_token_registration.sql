\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,98);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='098_push_token_registration') AS already_applied \gset
\if :already_applied
  \echo '098_push_token_registration ya aplicada'
\else
-- Búsqueda de tokens activos por tenant y usuario al enviar un aviso push (PushService).
-- La tabla user_push_tokens, su RLS y sus grants vienen de 001/002/004; no cambian aquí.
CREATE INDEX IF NOT EXISTS user_push_tokens_active_user_idx
  ON user_push_tokens(tenant_id, user_id) WHERE is_active;
INSERT INTO app.schema_migrations(version) VALUES('098_push_token_registration');
\endif
COMMIT;
