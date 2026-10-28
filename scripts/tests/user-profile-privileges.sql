\set ON_ERROR_STOP on
BEGIN;
-- Regression: a newly mapped users column must also be readable by Hibernate.
DO $$
DECLARE missing_columns text;
BEGIN
  SELECT string_agg(column_name, ', ') INTO missing_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
    AND NOT has_column_privilege('nexodocs_app', 'public.users', column_name, 'SELECT');
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Application cannot read mapped users columns: %', missing_columns;
  END IF;
END $$;
SET LOCAL ROLE nexodocs_app;
-- Exercise actual column permissions without reading password or profile values.
SELECT * FROM public.users WHERE false;
ROLLBACK;
