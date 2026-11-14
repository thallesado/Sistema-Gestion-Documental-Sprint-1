\set ON_ERROR_STOP on
-- Ejecutar exclusivamente sobre la preparación sintética de docs/evidencias/hu17.
BEGIN;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id','e315ea65-e3e9-4577-93eb-dde327a03a9f',true),
       set_config('app.user_id','0faf0a14-5cfc-4a48-92c2-bf8add6ae039',true);
DO $$
DECLARE x uuid; blocked integer:=0;
BEGIN
 SELECT t.id INTO STRICT x FROM document_transfers t JOIN documents d ON d.id=t.document_id AND d.tenant_id=t.tenant_id
 WHERE d.code='HU17-APTO' AND t.status='EXECUTED' AND t.to_level='CENTRAL';
 BEGIN UPDATE document_transfers SET status='APPROVED' WHERE id=x;
 EXCEPTION WHEN check_violation THEN blocked:=blocked+1; END;
 BEGIN UPDATE document_transfers SET reason='Evidencia alterada' WHERE id=x;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1; END;
 BEGIN DELETE FROM document_transfers WHERE id=x;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1; END;
 IF blocked<>3 THEN RAISE EXCEPTION 'Fallaron protecciones de evidencia: %',blocked; END IF;
 IF NOT EXISTS(SELECT 1 FROM documents WHERE code='HU17-APTO' AND archive_level='HISTORICAL' AND current_version=1) THEN
   RAISE EXCEPTION 'El documento no conserva nivel historico y version';
 END IF;
 IF (SELECT count(*) FROM document_transfers t JOIN documents d ON d.id=t.document_id AND d.tenant_id=t.tenant_id WHERE d.code='HU17-APTO' AND t.status='EXECUTED')<>2 THEN
   RAISE EXCEPTION 'No se conservaron ambas transferencias';
 END IF;
 RAISE NOTICE 'Evidencia inmutable: tres mutaciones bloqueadas; documento historico conserva v1 y ambos movimientos';
END $$;
SELECT set_config('app.user_id','344d189e-aee2-45d7-a032-01461bccafd3',true);
DO $$ DECLARE n integer; BEGIN
 UPDATE document_transfers SET status='APPROVED' WHERE tenant_id=app.current_tenant_id();GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Un lector modifico transferencias sin permiso'; END IF;
 RAISE NOTICE 'Usuario sin permiso de archivo: ninguna fila modificada';
END $$;
SELECT set_config('app.tenant_id','20000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM document_transfers) THEN RAISE EXCEPTION 'Fuga entre tenants'; END IF;
 RAISE NOTICE 'Contexto de otra organizacion: cero transferencias visibles';
END $$;
ROLLBACK;
