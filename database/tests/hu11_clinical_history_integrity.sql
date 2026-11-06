-- Use only a synthetic deleted history in a disposable test database.
-- psql -v ON_ERROR_STOP=1 -v history_id=<uuid> -f hu11_clinical_history_integrity.sql
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('qa.history_id', :'history_id', true);
DO $$
DECLARE h public.clinical_histories%ROWTYPE; event_id bigint; blocked integer := 0;
BEGIN
  SELECT * INTO STRICT h FROM public.clinical_histories
   WHERE id = current_setting('qa.history_id')::uuid;
  IF h.deleted_at IS NULL OR h.deleted_by IS NULL OR length(btrim(h.deletion_reason)) < 10 THEN
    RAISE EXCEPTION 'Expected a justified soft-deleted history';
  END IF;
  SELECT id INTO STRICT event_id FROM public.audit_events
   WHERE tenant_id = h.tenant_id AND entity_id = h.id AND action = 'CLINICAL_HISTORY_DELETED';
  IF NOT EXISTS (SELECT 1 FROM public.audit_events WHERE id = event_id
                 AND user_id = h.deleted_by AND details->>'reason' = h.deletion_reason) THEN
    RAISE EXCEPTION 'Audit reason or actor does not match the deletion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinical_document_links WHERE clinical_history_id = h.id) THEN
    RAISE EXCEPTION 'Expected historical document links to be retained';
  END IF;
  BEGIN DELETE FROM public.clinical_histories WHERE id = h.id;
  EXCEPTION WHEN check_violation THEN blocked := blocked + 1; END;
  BEGIN UPDATE public.clinical_histories SET deletion_reason = 'tampered evidence' WHERE id = h.id;
  EXCEPTION WHEN check_violation THEN blocked := blocked + 1; END;
  BEGIN UPDATE public.clinical_histories SET deleted_at = NULL WHERE id = h.id;
  EXCEPTION WHEN check_violation THEN blocked := blocked + 1; END;
  BEGIN UPDATE public.audit_events SET details = '{}'::jsonb WHERE id = event_id;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN blocked := blocked + 1; END;
  BEGIN DELETE FROM public.audit_events WHERE id = event_id;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN blocked := blocked + 1; END;
  BEGIN
    INSERT INTO public.medical_notes(tenant_id, clinical_history_id, author_id, note_type, content)
    VALUES(h.tenant_id, h.id, h.deleted_by, 'EVOLUTION', 'must be rejected');
  EXCEPTION WHEN check_violation THEN blocked := blocked + 1; END;
  IF blocked <> 6 THEN RAISE EXCEPTION 'Expected six blocked mutations, got %', blocked; END IF;
  RAISE NOTICE 'HU11: history and links retained, audit matches, six invalid mutations blocked';
END $$;
ROLLBACK;
