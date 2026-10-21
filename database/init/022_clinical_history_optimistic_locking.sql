\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 22);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '022_clinical_history_optimistic_locking'
) AS already_applied \gset

\if :already_applied
  \echo '022_clinical_history_optimistic_locking ya aplicada'
\else
  -- 1. Agregar columna version a clinical_histories para control de concurrencia optimista
  ALTER TABLE clinical_histories
    ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

  -- 2. Agregar columna version a patients para control de concurrencia optimista
  ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

  INSERT INTO app.schema_migrations(version) VALUES ('022_clinical_history_optimistic_locking');
\endif

COMMIT;
