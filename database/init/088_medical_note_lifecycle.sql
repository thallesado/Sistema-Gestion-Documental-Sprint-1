\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 88);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations
  WHERE version = '088_medical_note_lifecycle') AS already_applied \gset
\if :already_applied
  \echo '088_medical_note_lifecycle ya aplicada'
\else
CREATE FUNCTION app.enforce_medical_note_lifecycle() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Toda nota médica debe crearse como BORRADOR' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las notas médicas no pueden eliminarse' USING ERRCODE = '23514';
  END IF;
  IF OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Una nota VIGENTE o ANULADA es inmutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status NOT IN ('APPROVED', 'VOIDED')
     OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Solo se permite emitir o anular un borrador sin alterar su contenido' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.enforce_medical_note_lifecycle() FROM PUBLIC;
CREATE TRIGGER trg_medical_note_lifecycle
BEFORE INSERT OR UPDATE OR DELETE ON public.medical_notes
FOR EACH ROW EXECUTE FUNCTION app.enforce_medical_note_lifecycle();
INSERT INTO app.schema_migrations(version) VALUES ('088_medical_note_lifecycle');
\endif
COMMIT;
