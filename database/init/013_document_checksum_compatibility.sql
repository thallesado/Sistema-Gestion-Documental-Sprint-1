\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 13);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '013_document_checksum_compatibility'
) AS already_applied \gset

\if :already_applied
  \echo '013_document_checksum_compatibility ya aplicada'
\else
  ALTER TABLE document_versions
    ALTER COLUMN checksum_sha256 TYPE varchar(64)
    USING NULLIF(btrim(checksum_sha256), '')::varchar(64);

  INSERT INTO app.schema_migrations(version)
    VALUES ('013_document_checksum_compatibility');
\endif
COMMIT;
