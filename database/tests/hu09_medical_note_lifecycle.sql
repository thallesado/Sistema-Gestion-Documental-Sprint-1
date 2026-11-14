-- Run against a disposable database with a synthetic APPROVED note:
-- psql -v ON_ERROR_STOP=1 -v tenant_id=<fixture-tenant-uuid> -f hu09_medical_note_lifecycle.sql
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('qa.tenant_id', :'tenant_id', true);
DO $$
DECLARE
  n public.medical_notes%ROWTYPE;
  rejected integer := 0;
  draft_id uuid;
BEGIN
  SELECT * INTO STRICT n FROM public.medical_notes
   WHERE tenant_id = current_setting('qa.tenant_id')::uuid AND status = 'APPROVED' LIMIT 1;
  BEGIN
    UPDATE public.medical_notes SET content = 'illegal mutation' WHERE id = n.id;
  EXCEPTION WHEN check_violation THEN rejected := rejected + 1; END;
  BEGIN
    UPDATE public.medical_notes SET status = 'VOIDED' WHERE id = n.id;
  EXCEPTION WHEN check_violation THEN rejected := rejected + 1; END;
  BEGIN
    DELETE FROM public.medical_notes WHERE id = n.id;
  EXCEPTION WHEN check_violation THEN rejected := rejected + 1; END;
  BEGIN
    INSERT INTO public.medical_notes(tenant_id, clinical_history_id, author_id, note_type, content, status)
    VALUES(n.tenant_id, n.clinical_history_id, n.author_id, 'EVOLUTION', 'invalid initial status', 'APPROVED');
  EXCEPTION WHEN check_violation THEN rejected := rejected + 1; END;
  INSERT INTO public.medical_notes(tenant_id, clinical_history_id, author_id, note_type, content)
  VALUES(n.tenant_id, n.clinical_history_id, n.author_id, 'EVOLUTION', 'immutable draft content')
  RETURNING id INTO draft_id;
  BEGIN
    UPDATE public.medical_notes SET status = 'APPROVED', content = 'tampered during approval' WHERE id = draft_id;
  EXCEPTION WHEN check_violation THEN rejected := rejected + 1; END;
  UPDATE public.medical_notes SET status = 'VOIDED' WHERE id = draft_id;
  BEGIN
    UPDATE public.medical_notes SET status = 'APPROVED' WHERE id = draft_id;
  EXCEPTION WHEN check_violation THEN rejected := rejected + 1; END;
  IF rejected <> 6 THEN
    RAISE EXCEPTION 'Expected 6 rejected mutations, got %', rejected;
  END IF;
  RAISE NOTICE 'HU09: six invalid mutations blocked; valid DRAFT -> VOIDED persisted inside transaction';
END $$;
ROLLBACK;
