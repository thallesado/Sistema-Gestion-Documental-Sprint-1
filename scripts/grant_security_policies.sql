DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE format('CREATE POLICY nexodocs_security_all ON public.%I FOR ALL TO nexodocs_security USING (true) WITH CHECK (true)', r.tablename);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
