\set ON_ERROR_STOP on
-- Fixtures independientes del seed. Se revierte toda escritura al terminar.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('app.tenant_id','',true), set_config('app.user_id','',true);
CREATE FUNCTION pg_temp.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('f0000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid
$$;
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT: %', message; END IF; END;
$$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Se esperaba %, se recibió %: %; SQL: %', expected_state, SQLSTATE, SQLERRM, statement;
  END;
  RAISE EXCEPTION 'La operación debía fallar con %: %', expected_state, statement;
END;
$$;
DO $$ BEGIN
  PERFORM pg_temp.assert_true((SELECT count(*) >= 49 FROM pg_tables WHERE schemaname='public'), 'mínimo 49 tablas del dominio');
  PERFORM pg_temp.assert_true((SELECT count(*) >= 45 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity), 'mínimo 45 tablas con ENABLE/FORCE RLS');
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='004_saas_hardening'), 'migración registrada');
  PERFORM pg_temp.assert_true(NOT pg_has_role('nexodocs_app','nexodocs_platform_admin','MEMBER'), 'sin rol de plataforma');
  PERFORM pg_temp.assert_true(NOT pg_has_role('nexodocs_app','nexodocs_security','MEMBER'), 'sin rol interno');
  PERFORM pg_temp.assert_true(NOT (SELECT rolbypassrls OR rolsuper OR rolcreaterole FROM pg_roles WHERE rolname='nexodocs_app'), 'sin privilegios de evasión');
  PERFORM pg_temp.assert_true(NOT has_schema_privilege('nexodocs_app','app','CREATE'), 'funciones protegidas');
  PERFORM pg_temp.assert_true(NOT has_table_privilege('nexodocs_app','app.schema_migrations','INSERT'), 'migraciones protegidas');
  PERFORM pg_temp.assert_true(to_regclass('public.revoked_access_tokens') IS NOT NULL, 'tabla de revocaciones de access token');
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='017_revoked_access_tokens'), 'migración de revocaciones registrada');
  PERFORM pg_temp.assert_true(
    (SELECT array_agg(column_name::text ORDER BY column_name)
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='revoked_access_tokens')
    = ARRAY['expires_at','revoked_at','tenant_id','token_hash','user_id']::text[],
    'revocaciones guardan únicamente hash y trazabilidad, nunca token crudo'
  );
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='revoked_access_tokens'
        AND column_name='tenant_id' AND is_nullable='YES'
    ),
    'tenant nullable para usuarios de plataforma'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='revoked_access_tokens'
        AND c.relrowsecurity
    ),
    'sin RLS para el chequeo de revocación del filtro de seguridad'
  );
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.revoked_access_tokens'::regclass
        AND conname='pk_revoked_access_tokens' AND contype='p'
    )
    AND EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.revoked_access_tokens'::regclass
        AND conname='fk_revoked_access_tokens_user' AND contype='f'
    ),
    'clave de hash y FK de usuario para revocaciones'
  );
  PERFORM pg_temp.assert_true(
    to_regclass('public.idx_revoked_access_tokens_expiry') IS NOT NULL,
    'índice de limpieza de revocaciones vencidas'
  );
  PERFORM pg_temp.assert_true(
    has_table_privilege('nexodocs_app','revoked_access_tokens','SELECT')
    AND has_table_privilege('nexodocs_app','revoked_access_tokens','INSERT')
    AND has_table_privilege('nexodocs_app','revoked_access_tokens','DELETE')
    AND NOT has_table_privilege('nexodocs_app','revoked_access_tokens','UPDATE')
    AND NOT has_table_privilege('nexodocs_app','revoked_access_tokens','TRUNCATE')
    AND NOT has_table_privilege('nexodocs_app','revoked_access_tokens','REFERENCES')
    AND NOT has_table_privilege('nexodocs_app','revoked_access_tokens','TRIGGER'),
    'privilegios mínimos de revocaciones para nexodocs_app'
  );
END $$;

-- 101/102: tenants; 201..204: usuarios; 301/302: tipos; 401..403: documentos.
INSERT INTO tenants(id,name,code,slug,email,subscription_status) VALUES
(pg_temp.id(101),'Prueba A','FIXTURE-A','test-fixture-a','a@example.test','ACTIVE'),
(pg_temp.id(102),'Prueba B','FIXTURE-B','test-fixture-b','b@example.test','ACTIVE');
INSERT INTO users(id,tenant_id,username,email,password_hash,first_name,last_name) VALUES
(pg_temp.id(201),pg_temp.id(101),'test.admin','admin@a.test','!disabled-test','Admin','A'),
(pg_temp.id(202),pg_temp.id(101),'test.operator','operator@a.test','!disabled-test','Operator','A'),
(pg_temp.id(203),pg_temp.id(101),'test.blocked','blocked@a.test','!disabled-test','Blocked','A'),
(pg_temp.id(204),pg_temp.id(102),'test.admin','admin@b.test','!disabled-test','Admin','B');
UPDATE users SET status='BLOCKED' WHERE id=pg_temp.id(203);
INSERT INTO users(id,username,email,password_hash,first_name,last_name,is_platform_admin)
VALUES (pg_temp.id(205),'fixture.platform','platform@fixture.test','!disabled-test','Platform','Admin',true);
INSERT INTO revoked_access_tokens(token_hash,user_id,tenant_id,expires_at)
VALUES
  (repeat('a',64),pg_temp.id(201),pg_temp.id(101),now() + interval '1 hour'),
  (repeat('b',64),pg_temp.id(205),NULL,now() + interval '1 hour');
INSERT INTO roles(tenant_id,name) VALUES (pg_temp.id(101),'FIXTURE_ADMIN'),(pg_temp.id(101),'FIXTURE_OPERATOR'),(pg_temp.id(102),'FIXTURE_ADMIN');
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.tenant_id IN (pg_temp.id(101),pg_temp.id(102))
AND (r.name='FIXTURE_ADMIN' OR (r.name='FIXTURE_OPERATOR' AND p.module IN ('document','document_version','notification','report') AND p.action IN ('read','create','update')));
INSERT INTO user_roles(tenant_id,user_id,role_id)
SELECT u.tenant_id,u.id,r.id FROM users u JOIN roles r ON r.tenant_id=u.tenant_id
WHERE u.id IN (pg_temp.id(201),pg_temp.id(202),pg_temp.id(204))
AND r.name=CASE WHEN u.username='test.operator' THEN 'FIXTURE_OPERATOR' ELSE 'FIXTURE_ADMIN' END;
INSERT INTO document_types(id,tenant_id,name,code) VALUES (pg_temp.id(301),pg_temp.id(101),'Prueba','TEST'),(pg_temp.id(302),pg_temp.id(102),'Prueba','TEST');
INSERT INTO documents(id,tenant_id,document_type_id,author_id,code,name) VALUES
(pg_temp.id(401),pg_temp.id(101),pg_temp.id(301),pg_temp.id(201),'TEST-1','Documento A'),
(pg_temp.id(402),pg_temp.id(102),pg_temp.id(302),pg_temp.id(204),'TEST-1','Documento B'),
(pg_temp.id(403),pg_temp.id(101),pg_temp.id(301),pg_temp.id(201),'TEST-2','Borrador vacío');
INSERT INTO document_versions(tenant_id,document_id,author_id,change_reason,content)
SELECT tenant_id,id,author_id,'Inicial','{}'::jsonb FROM documents WHERE id IN (pg_temp.id(401),pg_temp.id(402));
INSERT INTO workflow_templates(id,tenant_id,name,created_by) VALUES
(pg_temp.id(501),pg_temp.id(101),'TEST-1',pg_temp.id(201)),(pg_temp.id(502),pg_temp.id(101),'TEST-2',pg_temp.id(201));
INSERT INTO workflow_templates(id,tenant_id,name,created_by) VALUES (pg_temp.id(503),pg_temp.id(101),'Unused',pg_temp.id(201));
INSERT INTO workflow_template_stages(tenant_id,workflow_template_id,name,stage_type,sort_order,assignment_type,assigned_user_id)
VALUES (pg_temp.id(101),pg_temp.id(503),'Asignación tipada','TASK',1,'USER',pg_temp.id(201));
INSERT INTO workflow_template_stages(id,tenant_id,workflow_template_id,name,stage_type,sort_order) VALUES
(pg_temp.id(511),pg_temp.id(101),pg_temp.id(501),'Revisión','REVIEW',1),
(pg_temp.id(512),pg_temp.id(101),pg_temp.id(502),'Revisión','REVIEW',1);
INSERT INTO workflows(id,tenant_id,workflow_template_id,title,creator_id,current_stage_id) VALUES
(pg_temp.id(601),pg_temp.id(101),pg_temp.id(501),'TEST-1',pg_temp.id(201),pg_temp.id(511)),
(pg_temp.id(602),pg_temp.id(101),pg_temp.id(502),'TEST-2',pg_temp.id(201),pg_temp.id(512));
INSERT INTO workflow_documents(tenant_id,workflow_id,document_id) VALUES (pg_temp.id(101),pg_temp.id(601),pg_temp.id(401));
INSERT INTO workflow_tasks(id,tenant_id,workflow_id,stage_id,document_id,document_version,title,assigned_user_id) VALUES
(pg_temp.id(611),pg_temp.id(101),pg_temp.id(601),pg_temp.id(511),pg_temp.id(401),1,'TEST',pg_temp.id(201));
INSERT INTO workflow_events(tenant_id,workflow_id,task_id,event_type) VALUES (pg_temp.id(101),pg_temp.id(601),pg_temp.id(611),'TEST');
INSERT INTO document_comments(id,tenant_id,document_id,author_id,comment_text) VALUES (pg_temp.id(621),pg_temp.id(101),pg_temp.id(401),pg_temp.id(201),'TEST');
INSERT INTO notifications(tenant_id,user_id,type,title,message)
SELECT tenant_id,id,'TEST','TEST','TEST' FROM users WHERE id IN (pg_temp.id(201),pg_temp.id(202),pg_temp.id(204));
INSERT INTO user_push_tokens(tenant_id,user_id,platform,token)
SELECT tenant_id,id,'WEB','test-token-' || id FROM users WHERE id IN (pg_temp.id(201),pg_temp.id(202));
INSERT INTO report_templates(tenant_id,owner_id,name,report_type,selected_fields,is_shared) VALUES
(pg_temp.id(101),pg_temp.id(201),'Propio','TEST','[]',false),
(pg_temp.id(101),pg_temp.id(202),'Privado ajeno','TEST','[]',false),
(pg_temp.id(101),pg_temp.id(202),'Compartido','TEST','[]',true);
INSERT INTO patients(id,tenant_id,first_name,last_name) VALUES (pg_temp.id(701),pg_temp.id(101),'Test','A');
INSERT INTO clinical_histories(id,tenant_id,patient_id,code) VALUES (pg_temp.id(711),pg_temp.id(101),pg_temp.id(701),'TEST');
INSERT INTO clinical_episodes(id,tenant_id,clinical_history_id,code,episode_type,started_at) VALUES (pg_temp.id(721),pg_temp.id(101),pg_temp.id(711),'TEST','TEST',now());
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

DO $$ DECLARE t text; BEGIN
  PERFORM pg_temp.assert_true((SELECT current_version=1 FROM documents WHERE id=pg_temp.id(401)), 'primera versión automática');
  PERFORM pg_temp.assert_true((SELECT current_version IS NULL FROM documents WHERE id=pg_temp.id(403)), 'borrador sin versión ficticia');
  PERFORM pg_temp.expect_error('UPDATE documents SET document_type_id=pg_temp.id(302) WHERE id=pg_temp.id(401)','23503');
  PERFORM pg_temp.expect_error('UPDATE documents SET tenant_id=pg_temp.id(102) WHERE id=pg_temp.id(403)','23514');
  PERFORM pg_temp.expect_error($q$UPDATE users SET email=' ADMIN@A.TEST ' WHERE id=pg_temp.id(202)$q$,'23505');
  PERFORM pg_temp.expect_error($q$UPDATE tenants SET settings='[]' WHERE id=pg_temp.id(101)$q$,'23514');
  PERFORM pg_temp.expect_error('UPDATE workflows SET current_stage_id=pg_temp.id(512) WHERE id=pg_temp.id(601)','23503');
  PERFORM pg_temp.expect_error('UPDATE workflows SET workflow_template_id=NULL WHERE id=pg_temp.id(601)','23514');
  PERFORM pg_temp.expect_error('UPDATE workflow_tasks SET stage_id=pg_temp.id(512) WHERE id=pg_temp.id(611)','23503');
  PERFORM pg_temp.expect_error('UPDATE workflow_tasks SET document_version=99 WHERE id=pg_temp.id(611)','23503');
  PERFORM pg_temp.expect_error('UPDATE workflow_tasks SET document_id=NULL WHERE id=pg_temp.id(611)','23514');
  PERFORM pg_temp.expect_error($q$UPDATE workflow_tasks SET status='COMPLETED' WHERE id=pg_temp.id(611)$q$,'23514');
  PERFORM pg_temp.expect_error($q$UPDATE workflow_template_stages SET name='Alterada' WHERE id=pg_temp.id(511)$q$,'55000');
  PERFORM pg_temp.expect_error($q$UPDATE workflow_templates SET description='Alterada' WHERE id=pg_temp.id(501)$q$,'55000');
  PERFORM pg_temp.expect_error($q$INSERT INTO workflow_template_stages(tenant_id,workflow_template_id,name,stage_type,sort_order,assignment_type,assigned_user_id) VALUES (pg_temp.id(101),pg_temp.id(503),'TEST','TASK',2,'USER',pg_temp.id(204))$q$,'23503');
  PERFORM pg_temp.expect_error($q$INSERT INTO workflow_template_stages(tenant_id,workflow_template_id,name,stage_type,sort_order,assignment_type,assigned_user_id) VALUES (pg_temp.id(101),pg_temp.id(503),'TEST','TASK',2,'ROLE',pg_temp.id(201))$q$,'23514');
  PERFORM pg_temp.expect_error($q$INSERT INTO audit_events(tenant_id,platform_actor_id,action,entity_type) VALUES (pg_temp.id(101),pg_temp.id(201),'INVALID','TEST')$q$,'23514');
  PERFORM pg_temp.expect_error($q$INSERT INTO workflow_comments(tenant_id,workflow_id,task_id,author_id,comment_text) VALUES (pg_temp.id(101),pg_temp.id(602),pg_temp.id(611),pg_temp.id(201),'TEST')$q$,'23503');
  PERFORM pg_temp.expect_error($q$INSERT INTO workflow_events(tenant_id,workflow_id,task_id,event_type) VALUES (pg_temp.id(101),pg_temp.id(602),pg_temp.id(611),'TEST')$q$,'23503');
  PERFORM pg_temp.expect_error($q$INSERT INTO document_comments(tenant_id,document_id,parent_id,author_id,comment_text) VALUES (pg_temp.id(101),pg_temp.id(403),pg_temp.id(621),pg_temp.id(201),'TEST')$q$,'23503');
  PERFORM pg_temp.expect_error('INSERT INTO clinical_document_links(tenant_id,document_id,patient_id,episode_id) VALUES (pg_temp.id(101),pg_temp.id(401),pg_temp.id(701),pg_temp.id(721))','23514');
  PERFORM pg_temp.expect_error($q$INSERT INTO ocr_jobs(tenant_id,uploaded_by,original_file_path,pages_total,pages_processed) VALUES (pg_temp.id(101),pg_temp.id(201),'test.pdf',1,2)$q$,'23514');
  PERFORM pg_temp.expect_error($q$INSERT INTO ocr_jobs(tenant_id,uploaded_by,original_file_path,status) VALUES (pg_temp.id(101),pg_temp.id(201),'test.pdf','VALIDATED')$q$,'23514');
  FOREACH t IN ARRAY ARRAY['document_versions','audit_events','workflow_events'] LOOP
    PERFORM pg_temp.expect_error(format('UPDATE %I SET tenant_id=tenant_id',t),'55000');
    PERFORM pg_temp.expect_error(format('DELETE FROM %I',t),'55000');
    PERFORM pg_temp.assert_true(NOT has_table_privilege('nexodocs_app',t,'TRUNCATE'),'TRUNCATE revocado: ' || t);
  END LOOP;
  PERFORM pg_temp.expect_error('TRUNCATE audit_events','55000');
  PERFORM pg_temp.expect_error('TRUNCATE workflow_events','55000');
  PERFORM pg_temp.expect_error('TRUNCATE document_versions','0A000');
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM revoked_access_tokens
      WHERE token_hash=repeat('b',64) AND user_id=pg_temp.id(205)
        AND tenant_id IS NULL
    ),
    'la revocación de usuario de plataforma no requiere tenant'
  );
  PERFORM pg_temp.expect_error(
    $q$INSERT INTO revoked_access_tokens(token_hash,user_id,tenant_id,expires_at)
       VALUES ('plain-access-token',pg_temp.id(201),pg_temp.id(101),now() + interval '1 hour')$q$,
    '23514'
  );
  PERFORM pg_temp.expect_error(
    $q$INSERT INTO revoked_access_tokens(token_hash,user_id,tenant_id,expires_at)
       VALUES (repeat('c',64),pg_temp.id(201),pg_temp.id(102),now() + interval '1 hour')$q$,
    '23514'
  );
  PERFORM pg_temp.expect_error(
    $q$UPDATE revoked_access_tokens
         SET expires_at=expires_at
       WHERE token_hash=repeat('a',64)$q$,
    '55000'
  );
  PERFORM pg_temp.expect_error(
    $q$DELETE FROM revoked_access_tokens WHERE token_hash=repeat('a',64)$q$,
    '55000'
  );
END $$;
\echo 'Integridad relacional e históricos: OK'

SELECT set_config('app.user_id',pg_temp.id(205)::text,true);
UPDATE documents SET name='Intervención global auditada' WHERE id=pg_temp.id(401);
DO $$ BEGIN
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM audit_events WHERE tenant_id=pg_temp.id(101) AND platform_actor_id=pg_temp.id(205) AND user_id IS NULL),'actor global separado del usuario del tenant');
END $$;
SELECT set_config('app.user_id','',true);

SET LOCAL ROLE nexodocs_app;
DO $$ DECLARE r record; visible bigint; BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',r.relname) INTO visible;
    PERFORM pg_temp.assert_true(visible=0,'sin contexto no hay filas en ' || r.relname);
  END LOOP;
END $$;
DO $$ BEGIN
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM revoked_access_tokens
      WHERE token_hash=repeat('a',64) AND expires_at > now()
    ),
    'el filtro de seguridad consulta revocaciones sin contexto RLS'
  );
END $$;
SELECT set_config('app.tenant_id',pg_temp.id(101)::text,true);
DO $$ BEGIN PERFORM pg_temp.assert_true((SELECT count(*)=0 FROM documents),'tenant sin usuario no da acceso'); END $$;
SELECT set_config('app.user_id',pg_temp.id(204)::text,true);
DO $$ BEGIN PERFORM pg_temp.assert_true((SELECT count(*)=0 FROM documents),'usuario de otro tenant no da acceso'); END $$;
SELECT set_config('app.user_id',pg_temp.id(203)::text,true);
DO $$ BEGIN PERFORM pg_temp.assert_true((SELECT count(*)=0 FROM documents),'usuario bloqueado no da acceso'); END $$;
SELECT set_config('app.user_id',pg_temp.id(201)::text,true);
DO $$ DECLARE affected integer; BEGIN
  PERFORM pg_temp.assert_true(app.context_is_valid() AND app.has_permission('document:read'),'contexto y RBAC válidos');
  PERFORM app.record_http_access(
    'HTTP_GET'::text, 'PATIENTS'::text, pg_temp.id(701), 'SUCCESS'::text,
    '127.0.0.1'::inet, 'database-test'::text,
    '{"path":"/api/v1/patients"}'::jsonb
  );
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM audit_events WHERE action='HTTP_GET' AND entity_type='PATIENTS'),'lectura HTTP auditada con actor');
  PERFORM pg_temp.assert_true((SELECT count(*)=2 FROM documents),'solo documentos A');
  PERFORM pg_temp.assert_true((SELECT count(*)=1 FROM tenants),'solo tenant A');
  PERFORM pg_temp.assert_true((SELECT count(*)=1 FROM notifications),'notificaciones propias');
  PERFORM pg_temp.assert_true((SELECT count(*)=1 FROM user_push_tokens),'tokens propios');
  PERFORM pg_temp.assert_true((SELECT count(*)=2 FROM report_templates),'reportes propios y compartidos');
  UPDATE notifications SET is_read=true,read_at=now() WHERE user_id=pg_temp.id(202);
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.assert_true(affected=0,'no modificar notificaciones ajenas');
  UPDATE notifications SET is_read=true,read_at=now();
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.assert_true(affected=1,'lectura propia');
  -- El backend necesita el hash para autenticar y la entidad JPA lo
  -- selecciona al consultar /auth/me. La migración 014 concede solo esta
  -- columna; RLS sigue limitando la fila al contexto autenticado.
  PERFORM pg_temp.assert_true(
    (SELECT password_hash IS NOT NULL FROM users
     WHERE id = app.current_user_id()),
    'el rol de aplicación puede leer el hash del usuario autenticado'
  );
  PERFORM pg_temp.expect_error('UPDATE users SET is_platform_admin=true','42501');
  PERFORM pg_temp.expect_error('UPDATE tenants SET storage_limit_bytes=-1','42501');
  PERFORM pg_temp.expect_error($q$UPDATE tenants SET subscription_status='ACTIVE'$q$,'42501');
  PERFORM pg_temp.expect_error('UPDATE tenant_usage_monthly SET api_calls=0','42501');
  PERFORM pg_temp.expect_error('DELETE FROM documents','42501');
  PERFORM pg_temp.expect_error('UPDATE document_versions SET change_reason=change_reason','42501');
  PERFORM pg_temp.expect_error('DELETE FROM audit_events','42501');
  INSERT INTO revoked_access_tokens(token_hash,user_id,tenant_id,expires_at,revoked_at)
  VALUES (repeat('d',64),pg_temp.id(201),pg_temp.id(101),now() + interval '1 hour',now());
  PERFORM pg_temp.assert_true(
    EXISTS (SELECT 1 FROM revoked_access_tokens WHERE token_hash=repeat('d',64)),
    'el rol de aplicación registra el hash de revocación'
  );
  PERFORM pg_temp.expect_error(
    $q$UPDATE revoked_access_tokens SET expires_at=expires_at WHERE token_hash=repeat('d',64)$q$,
    '42501'
  );
  PERFORM pg_temp.expect_error('CREATE TABLE app.forbidden(id integer)','42501');
  PERFORM pg_temp.expect_error($q$INSERT INTO documents(tenant_id,document_type_id,author_id,code,name) VALUES (pg_temp.id(102),pg_temp.id(302),pg_temp.id(204),'FORBIDDEN','TEST')$q$,'42501');
  PERFORM pg_temp.expect_error($q$INSERT INTO audit_events(tenant_id,user_id,action,entity_type) VALUES (pg_temp.id(101),pg_temp.id(202),'FORGED','TEST')$q$,'42501');
END $$;
INSERT INTO document_versions(tenant_id,document_id,author_id,change_reason,content) VALUES
(pg_temp.id(101),pg_temp.id(401),pg_temp.id(201),'Segunda versión','{"private_content":"no debe aparecer en auditoría"}');
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
DO $$ BEGIN
  PERFORM pg_temp.assert_true((SELECT current_version=2 FROM documents WHERE id=pg_temp.id(401)),'puntero actualizado');
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM audit_events WHERE tenant_id=app.current_tenant_id() AND user_id=app.current_user_id() AND action='DOCUMENT_VERSIONS_INSERT'),'auditoría con actor');
  PERFORM pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM audit_events WHERE details::text LIKE '%private_content%' OR details::text LIKE '%disabled-test%' OR details::text LIKE '%test-token-%'),'auditoría sin secretos');
  PERFORM pg_temp.expect_error($q$INSERT INTO document_versions(tenant_id,document_id,version_number,author_id,change_reason) VALUES (pg_temp.id(101),pg_temp.id(401),4,pg_temp.id(201),'Salto')$q$,'23514');
  PERFORM pg_temp.expect_error($q$INSERT INTO document_versions(tenant_id,document_id,author_id,change_reason) VALUES (pg_temp.id(101),pg_temp.id(401),pg_temp.id(202),'Autor falso')$q$,'42501');
  PERFORM pg_temp.expect_error('UPDATE documents SET current_version=1 WHERE id=pg_temp.id(401); SET CONSTRAINTS ALL IMMEDIATE','23514');
  PERFORM pg_temp.expect_error($q$UPDATE documents SET status='APPROVED' WHERE id=pg_temp.id(403); SET CONSTRAINTS ALL IMMEDIATE$q$,'23514');
END $$;
UPDATE documents SET status='APPROVED' WHERE id=pg_temp.id(401);
INSERT INTO document_versions(tenant_id,document_id,author_id,change_reason,content) VALUES (pg_temp.id(101),pg_temp.id(401),pg_temp.id(201),'Contenido nuevo','{}');
DO $$ BEGIN
  PERFORM pg_temp.assert_true((SELECT current_version=3 AND status='DRAFT' FROM documents WHERE id=pg_temp.id(401)),'nuevo contenido requiere nueva aprobación');
END $$;
SELECT set_config('app.user_id',pg_temp.id(202)::text,true);
DO $$ BEGIN
  PERFORM pg_temp.assert_true(app.has_permission('document:update') AND NOT app.has_permission('document:approve'),'operador limitado');
  PERFORM pg_temp.assert_true((SELECT count(*)=0 FROM roles),'RBAC administrativo oculto');
  PERFORM pg_temp.assert_true((SELECT count(*)=0 FROM audit_events),'auditoría oculta');
  PERFORM pg_temp.expect_error($q$UPDATE documents SET status='APPROVED' WHERE id=pg_temp.id(401)$q$,'42501');
  PERFORM pg_temp.expect_error('UPDATE documents SET deleted_at=now() WHERE id=pg_temp.id(401)','42501');
  PERFORM pg_temp.expect_error('UPDATE documents SET author_id=pg_temp.id(202) WHERE id=pg_temp.id(401)','23514');
  PERFORM pg_temp.expect_error($q$INSERT INTO roles(tenant_id,name) VALUES (pg_temp.id(101),'Escalamiento')$q$,'42501');
END $$;
UPDATE documents SET name='Edición autorizada' WHERE id=pg_temp.id(401);
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
SELECT set_config('app.tenant_id',pg_temp.id(102)::text,true),set_config('app.user_id',pg_temp.id(204)::text,true);
DO $$ BEGIN PERFORM pg_temp.assert_true((SELECT count(*)=1 FROM documents),'tenant B aislado'); END $$;
SELECT set_config('app.tenant_id','invalid-uuid',true);
DO $$ BEGIN PERFORM pg_temp.expect_error('SELECT count(*) FROM documents','22P02'); END $$;
RESET ROLE;
SELECT set_config('app.tenant_id','',true),set_config('app.user_id','',true);
UPDATE tenants SET subscription_status='SUSPENDED' WHERE id=pg_temp.id(101);
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id',pg_temp.id(101)::text,true),set_config('app.user_id',pg_temp.id(201)::text,true);
DO $$ BEGIN PERFORM pg_temp.assert_true((SELECT count(*)=0 FROM documents),'tenant suspendido'); END $$;
RESET ROLE;
SELECT set_config('app.tenant_id','',true),set_config('app.user_id','',true);
SET CONSTRAINTS ALL IMMEDIATE;
\echo 'RLS, RBAC, privacidad, versionado y auditoría: OK'
ROLLBACK;
SELECT 'VALIDATION_OK' AS result;
