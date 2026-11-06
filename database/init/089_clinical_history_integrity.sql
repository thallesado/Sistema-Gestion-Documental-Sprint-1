\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 89);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '089_clinical_history_integrity') AS already_applied \gset
\if :already_applied
  \echo '089_clinical_history_integrity ya aplicada'
\else
CREATE FUNCTION app.protect_clinical_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'La historia clínica solo admite baja lógica justificada' USING ERRCODE = '23514';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'La evidencia de una historia dada de baja es inmutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    IF NEW.deleted_by IS NULL OR NEW.deletion_reason IS NULL
       OR length(btrim(NEW.deletion_reason)) NOT BETWEEN 10 AND 500 THEN
      RAISE EXCEPTION 'La baja exige autor y motivo de 10 a 500 caracteres' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.deleted_by AND u.tenant_id = NEW.tenant_id) THEN
      RAISE EXCEPTION 'El autor de la baja debe pertenecer al tenant' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.protect_clinical_history() FROM PUBLIC;
CREATE TRIGGER trg_clinical_history_protection BEFORE UPDATE OR DELETE ON public.clinical_histories
FOR EACH ROW EXECUTE FUNCTION app.protect_clinical_history();

CREATE FUNCTION app.validate_active_clinical_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history_patient uuid; document_patient uuid;
BEGIN
  SELECT h.patient_id INTO history_patient FROM public.clinical_histories h
   WHERE h.id = NEW.clinical_history_id AND h.tenant_id = NEW.tenant_id AND h.deleted_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La historia clínica no existe o está dada de baja' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'clinical_document_links' THEN
    SELECT d.patient_id INTO document_patient FROM public.documents d
     WHERE d.id = NEW.document_id AND d.tenant_id = NEW.tenant_id AND d.deleted_at IS NULL;
    IF NOT FOUND OR NEW.patient_id <> history_patient
       OR (document_patient IS NOT NULL AND document_patient <> history_patient) THEN
      RAISE EXCEPTION 'El documento y el vínculo deben corresponder al paciente de la historia' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.validate_active_clinical_history() FROM PUBLIC;
CREATE TRIGGER trg_clinical_link_active_history BEFORE INSERT OR UPDATE ON public.clinical_document_links
FOR EACH ROW EXECUTE FUNCTION app.validate_active_clinical_history();
CREATE TRIGGER trg_medical_note_active_history BEFORE INSERT OR UPDATE ON public.medical_notes
FOR EACH ROW EXECUTE FUNCTION app.validate_active_clinical_history();
INSERT INTO app.schema_migrations(version) VALUES ('089_clinical_history_integrity');
\endif
COMMIT;
