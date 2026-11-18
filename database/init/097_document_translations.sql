\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,97);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='097_document_translations') AS already_applied \gset
\if :already_applied
  \echo '097_document_translations ya aplicada'
\else
INSERT INTO permissions(code,action,module,description) VALUES
 ('translation:read','read','translation','Consultar solicitudes y traducciones documentales'),
 ('translation:create','create','translation','Solicitar traducción de versiones documentales'),
 ('translation:review','review','translation','Revisar y corregir segmentos de traducción'),
 ('translation:publish','publish','translation','Publicar copia documental traducida'),
 ('translation:configure','configure','translation','Administrar políticas de traducción y glosarios') ON CONFLICT(code) DO NOTHING;

INSERT INTO role_permissions(tenant_id,role_id,permission_id)
 SELECT DISTINCT rp.tenant_id,rp.role_id,p.id FROM role_permissions rp
 JOIN permissions a ON a.id=rp.permission_id AND a.code = 'backup:configure'
 CROSS JOIN permissions p WHERE p.module='translation' ON CONFLICT DO NOTHING;

CREATE TABLE translation_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 document_id uuid NOT NULL,
 version_id uuid NOT NULL,
 version_number integer NOT NULL CHECK(version_number >= 1),
 source_language varchar(10) NOT NULL DEFAULT 'en',
 target_language varchar(10) NOT NULL DEFAULT 'es',
 status varchar(35) NOT NULL DEFAULT 'REVIEW_PENDING' CHECK(status IN('QUEUED','EXTRACTING','TRANSLATING','REVIEW_PENDING','CHANGES_REQUESTED','PUBLISHED','FAILED','CANCELLED')),
 source_hash varchar(64) NOT NULL,
 page_count integer NOT NULL DEFAULT 1 CHECK(page_count >= 1),
 char_count integer NOT NULL DEFAULT 0 CHECK(char_count >= 0),
 provider varchar(50) NOT NULL DEFAULT 'gemini',
 model varchar(100) DEFAULT 'gemini-1.5-flash',
 requested_by uuid NOT NULL,
 reviewed_by uuid,
 derived_document_id uuid,
 derived_version_id uuid,
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id),
 FOREIGN KEY(tenant_id,version_id) REFERENCES document_versions(tenant_id,id),
 FOREIGN KEY(tenant_id,requested_by) REFERENCES users(tenant_id,id)
);

CREATE INDEX idx_translation_requests_doc ON translation_requests(tenant_id, document_id, created_at DESC);
CREATE INDEX idx_translation_requests_status ON translation_requests(tenant_id, status);

CREATE TABLE translation_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 request_id uuid NOT NULL,
 segment_order integer NOT NULL CHECK(segment_order >= 0),
 source_text text NOT NULL CHECK(length(source_text) > 0),
 translated_text text NOT NULL CHECK(length(translated_text) > 0),
 reviewed_text text,
 status varchar(30) NOT NULL DEFAULT 'TRANSLATED' CHECK(status IN('PENDING','TRANSLATED','ACCEPTED','MODIFIED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,request_id,segment_order),
 FOREIGN KEY(tenant_id,request_id) REFERENCES translation_requests(tenant_id,id) ON DELETE CASCADE
);

CREATE INDEX idx_translation_segments_req ON translation_segments(tenant_id, request_id, segment_order);

CREATE TABLE translation_glossary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 source_term varchar(200) NOT NULL CHECK(length(btrim(source_term)) > 0),
 target_term varchar(200) NOT NULL CHECK(length(btrim(target_term)) > 0),
 source_language varchar(10) NOT NULL DEFAULT 'en',
 target_language varchar(10) NOT NULL DEFAULT 'es',
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,source_language,target_language,source_term)
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['translation_requests','translation_segments','translation_glossary'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE TO nexodocs_app USING(tenant_id=app.current_tenant_id() AND app.context_is_valid()) WITH CHECK(tenant_id=app.current_tenant_id() AND app.context_is_valid())',t);
  EXECUTE format('CREATE POLICY translation_read ON %I FOR SELECT TO nexodocs_app USING(app.has_permission(''translation:read'') OR app.has_permission(''translation:create'') OR app.has_permission(''translation:review'') OR app.has_permission(''translation:publish'') OR app.has_permission(''translation:configure''))',t);
  EXECUTE format('CREATE POLICY translation_write ON %I FOR ALL TO nexodocs_app USING(app.has_permission(''translation:create'') OR app.has_permission(''translation:review'') OR app.has_permission(''translation:publish'') OR app.has_permission(''translation:configure'')) WITH CHECK(app.has_permission(''translation:create'') OR app.has_permission(''translation:review'') OR app.has_permission(''translation:publish'') OR app.has_permission(''translation:configure''))',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO nexodocs_app',t);
  EXECUTE format('CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes()',t);
 END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON translation_requests,translation_segments,translation_glossary TO nexodocs_platform_admin;
ALTER FUNCTION app.backup_tables() RENAME TO backup_tables_before_translations;
CREATE FUNCTION app.backup_tables() RETURNS SETOF text LANGUAGE sql STABLE AS $$
 SELECT x FROM app.backup_tables_before_translations() x WHERE x NOT IN('translation_requests','translation_segments','translation_glossary')
$$;

INSERT INTO app.schema_migrations(version) VALUES('097_document_translations');
\endif
COMMIT;
