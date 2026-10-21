-- ============================================================================
-- SCRIPT DDL COMPLETO DE BASE DE DATOS PARA ENTERPRISE ARCHITECT
-- Proyecto: NexoDocs - Sistema de Gestion Documental Multi-Tenant (Sprint 1)
-- Materia: Sistemas de Informacion II (SI2)
-- Compatible con: Enterprise Architect (Import DDL / Reverse Engineering DDL)
-- Total de Tablas: 53 entidades organizadas por modulos
-- ============================================================================

-- ============================================================================
-- 1. MODULO: PLATAFORMA Y MULTI-TENENCIA (12 Tablas)
-- ============================================================================

CREATE TABLE plans (
    id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    price_yearly NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_plans PRIMARY KEY (id),
    CONSTRAINT uq_plans_code UNIQUE (code)
);

CREATE TABLE plan_limits (
    plan_id UUID NOT NULL,
    resource_key VARCHAR(80) NOT NULL,
    resource_value BIGINT NOT NULL,
    unit VARCHAR(30),
    CONSTRAINT pk_plan_limits PRIMARY KEY (plan_id, resource_key)
);

CREATE TABLE plan_features (
    plan_id UUID NOT NULL,
    feature_key VARCHAR(80) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    description VARCHAR(255),
    CONSTRAINT pk_plan_features PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE tenants (
    id UUID NOT NULL,
    plan_id UUID,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    address VARCHAR(255),
    logo_url VARCHAR(500),
    primary_color VARCHAR(20) DEFAULT '#087f7b' NOT NULL,
    settings TEXT DEFAULT '{}' NOT NULL,
    subscription_status VARCHAR(20) DEFAULT 'TRIAL' NOT NULL,
    subscription_start_date DATE,
    subscription_end_date DATE,
    billing_cycle VARCHAR(10) DEFAULT 'MONTHLY' NOT NULL,
    storage_limit_bytes BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_tenants PRIMARY KEY (id),
    CONSTRAINT uq_tenants_code UNIQUE (code),
    CONSTRAINT uq_tenants_slug UNIQUE (slug)
);

CREATE TABLE tenant_departments (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_tenant_departments PRIMARY KEY (id),
    CONSTRAINT uq_departments_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE users (
    id UUID NOT NULL,
    tenant_id UUID,
    department_id UUID,
    username VARCHAR(80) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    document_type VARCHAR(30),
    document_number VARCHAR(40),
    phone VARCHAR(30),
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    is_platform_admin BOOLEAN DEFAULT FALSE NOT NULL,
    biography VARCHAR(500),
    avatar_data BYTEA,
    avatar_content_type VARCHAR(100),
    email_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    push_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_tenant_username UNIQUE (tenant_id, username),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE roles (
    id BIGINT NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255),
    is_system BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_roles PRIMARY KEY (id),
    CONSTRAINT uq_roles_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE permissions (
    id BIGINT NOT NULL,
    code VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    criticality VARCHAR(10) DEFAULT 'MEDIUM' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_permissions PRIMARY KEY (id),
    CONSTRAINT uq_permissions_code UNIQUE (code),
    CONSTRAINT uq_permissions_module_action UNIQUE (module, action)
);

CREATE TABLE role_permissions (
    tenant_id UUID NOT NULL,
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_groups (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_user_groups PRIMARY KEY (id),
    CONSTRAINT uq_user_groups_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE user_group_members (
    tenant_id UUID NOT NULL,
    group_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_user_group_members PRIMARY KEY (group_id, user_id)
);

-- ============================================================================
-- 2. MODULO: AUTENTICACION, TOKENS Y SEGURIDAD (4 Tablas)
-- ============================================================================

CREATE TABLE auth_sessions (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    tenant_id UUID,
    refresh_token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    replaced_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    CONSTRAINT pk_auth_sessions PRIMARY KEY (id),
    CONSTRAINT uq_auth_sessions_token UNIQUE (refresh_token_hash)
);

CREATE TABLE revoked_access_tokens (
    token_hash VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL,
    tenant_id UUID,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_revoked_access_tokens PRIMARY KEY (token_hash)
);

CREATE TABLE password_recovery_requests (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_password_recovery_requests PRIMARY KEY (id),
    CONSTRAINT uq_password_recovery_token UNIQUE (token_hash)
);

CREATE TABLE user_push_tokens (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    platform VARCHAR(20) NOT NULL,
    token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    CONSTRAINT pk_user_push_tokens PRIMARY KEY (id),
    CONSTRAINT uq_user_push_tokens_token UNIQUE (token)
);

-- ============================================================================
-- 3. MODULO: GESTION DOCUMENTAL Y EXPEDIENTES (13 Tablas)
-- ============================================================================

CREATE TABLE retention_policies (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    retention_months INTEGER,
    disposition_action VARCHAR(30) DEFAULT 'REVIEW' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_retention_policies PRIMARY KEY (id),
    CONSTRAINT uq_retention_policies_name UNIQUE (tenant_id, name)
);

CREATE TABLE document_categories (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_document_categories PRIMARY KEY (id),
    CONSTRAINT uq_document_categories_code UNIQUE (tenant_id, code)
);

CREATE TABLE document_types (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    category_id UUID,
    retention_policy_id UUID,
    workflow_template_id UUID,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    metadata_schema TEXT DEFAULT '{}' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_document_types PRIMARY KEY (id),
    CONSTRAINT uq_document_types_code UNIQUE (tenant_id, code)
);

CREATE TABLE metadata_definitions (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    document_type_id UUID,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(60) NOT NULL,
    data_type VARCHAR(30) NOT NULL,
    options TEXT DEFAULT '[]' NOT NULL,
    is_required BOOLEAN DEFAULT FALSE NOT NULL,
    is_searchable BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_metadata_definitions PRIMARY KEY (id),
    CONSTRAINT uq_metadata_definitions_code UNIQUE (tenant_id, code)
);

CREATE TABLE expedient_types (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(50) NOT NULL,
    metadata_schema TEXT DEFAULT '{}' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_expedient_types PRIMARY KEY (id),
    CONSTRAINT uq_expedient_types_code UNIQUE (tenant_id, code)
);

CREATE TABLE expedients (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    expedient_type_id UUID NOT NULL,
    responsible_id UUID,
    department_id UUID,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    metadata TEXT DEFAULT '{}' NOT NULL,
    closed_at TIMESTAMP,
    archived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    CONSTRAINT pk_expedients PRIMARY KEY (id),
    CONSTRAINT uq_expedients_code UNIQUE (tenant_id, code)
);

CREATE TABLE expedient_participants (
    tenant_id UUID NOT NULL,
    expedient_id UUID NOT NULL,
    user_id UUID NOT NULL,
    participant_role VARCHAR(50) DEFAULT 'MEMBER' NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_expedient_participants PRIMARY KEY (expedient_id, user_id)
);

-- Nota: la relacion con patients se anade con ALTER TABLE al final
CREATE TABLE documents (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    expedient_id UUID,
    document_type_id UUID NOT NULL,
    author_id UUID NOT NULL,
    responsible_id UUID,
    department_id UUID,
    patient_id UUID,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    current_version INTEGER DEFAULT 1 NOT NULL,
    is_external_source BOOLEAN DEFAULT FALSE NOT NULL,
    source VARCHAR(50),
    specialty VARCHAR(100),
    institutional_process VARCHAR(100),
    metadata TEXT DEFAULT '{}' NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    archived_at TIMESTAMP,
    voided_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_documents PRIMARY KEY (id),
    CONSTRAINT uq_documents_code UNIQUE (tenant_id, code)
);

CREATE TABLE document_versions (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    author_id UUID NOT NULL,
    change_reason VARCHAR(1000) NOT NULL,
    file_path TEXT,
    file_name VARCHAR(255),
    mime_type VARCHAR(150),
    file_size_bytes BIGINT DEFAULT 0 NOT NULL,
    checksum_sha256 CHAR(64),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_document_versions PRIMARY KEY (id),
    CONSTRAINT uq_document_versions_num UNIQUE (document_id, version_number)
);

CREATE TABLE document_metadata_values (
    tenant_id UUID NOT NULL,
    document_id UUID NOT NULL,
    metadata_definition_id UUID NOT NULL,
    value TEXT NOT NULL,
    updated_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_doc_metadata_values PRIMARY KEY (document_id, metadata_definition_id)
);

CREATE TABLE tags (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_tags PRIMARY KEY (id),
    CONSTRAINT uq_tags_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE document_tags (
    tenant_id UUID NOT NULL,
    document_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    CONSTRAINT pk_document_tags PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE document_comments (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    document_id UUID NOT NULL,
    author_id UUID NOT NULL,
    parent_id UUID,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    CONSTRAINT pk_document_comments PRIMARY KEY (id)
);

-- ============================================================================
-- 4. MODULO: WORKFLOWS, PROCESOS Y TAREAS (9 Tablas)
-- ============================================================================

CREATE TABLE workflow_templates (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_workflow_templates PRIMARY KEY (id),
    CONSTRAINT uq_workflow_templates_ver UNIQUE (tenant_id, name, version)
);

CREATE TABLE workflow_template_stages (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    workflow_template_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    stage_type VARCHAR(30) NOT NULL,
    sort_order INTEGER NOT NULL,
    assignment_type VARCHAR(20),
    assignment_reference VARCHAR(100),
    due_days INTEGER,
    rules TEXT DEFAULT '{}' NOT NULL,
    CONSTRAINT pk_workflow_template_stages PRIMARY KEY (id),
    CONSTRAINT uq_stages_order UNIQUE (workflow_template_id, sort_order)
);

CREATE TABLE workflow_template_transitions (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    workflow_template_id UUID NOT NULL,
    from_stage_id UUID NOT NULL,
    to_stage_id UUID NOT NULL,
    name VARCHAR(100),
    condition TEXT DEFAULT '{}' NOT NULL,
    CONSTRAINT pk_workflow_template_trans PRIMARY KEY (id)
);

CREATE TABLE workflows (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    workflow_template_id UUID,
    expedient_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    priority SMALLINT DEFAULT 3 NOT NULL,
    creator_id UUID NOT NULL,
    current_stage_id UUID,
    started_at TIMESTAMP,
    due_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_workflows PRIMARY KEY (id)
);

CREATE TABLE workflow_documents (
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    document_id UUID NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_workflow_documents PRIMARY KEY (workflow_id, document_id)
);

CREATE TABLE workflow_tasks (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    stage_id UUID,
    document_id UUID,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_user_id UUID,
    assigned_role_id BIGINT,
    assigned_department_id UUID,
    assigned_group_id UUID,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    outcome VARCHAR(30),
    priority SMALLINT DEFAULT 3 NOT NULL,
    document_version INTEGER,
    due_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    completed_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_workflow_tasks PRIMARY KEY (id)
);

CREATE TABLE workflow_events (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    task_id UUID,
    document_id UUID,
    event_type VARCHAR(60) NOT NULL,
    performed_by UUID,
    result VARCHAR(50),
    comment TEXT,
    details TEXT DEFAULT '{}' NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_workflow_events PRIMARY KEY (id)
);

CREATE TABLE workflow_comments (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    task_id UUID,
    document_id UUID,
    author_id UUID NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    CONSTRAINT pk_workflow_comments PRIMARY KEY (id)
);

CREATE TABLE task_delegations (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    delegator_id UUID NOT NULL,
    delegate_id UUID NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_task_delegations PRIMARY KEY (id)
);

-- ============================================================================
-- 5. MODULO: OPERACIONES, OCR, AUDITORIA Y REPORTES (6 Tablas)
-- ============================================================================

CREATE TABLE ocr_jobs (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    document_id UUID,
    uploaded_by UUID NOT NULL,
    status VARCHAR(30) DEFAULT 'QUEUED' NOT NULL,
    original_file_path TEXT NOT NULL,
    file_type VARCHAR(30),
    pages_total INTEGER,
    pages_processed INTEGER DEFAULT 0 NOT NULL,
    raw_text TEXT,
    extracted_data TEXT DEFAULT '{}' NOT NULL,
    suggested_metadata TEXT DEFAULT '{}' NOT NULL,
    confidence_score NUMERIC(5, 4),
    validated_by UUID,
    validated_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_ocr_jobs PRIMARY KEY (id)
);

CREATE TABLE notifications (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    channel VARCHAR(20) DEFAULT 'IN_APP' NOT NULL,
    type VARCHAR(60) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMP,
    archived_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_notifications PRIMARY KEY (id)
);

CREATE TABLE audit_events (
    id BIGINT NOT NULL,
    tenant_id UUID,
    user_id UUID,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    result VARCHAR(30) DEFAULT 'SUCCESS' NOT NULL,
    details TEXT DEFAULT '{}' NOT NULL,
    CONSTRAINT pk_audit_events PRIMARY KEY (id)
);

CREATE TABLE report_templates (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    report_type VARCHAR(80) NOT NULL,
    selected_fields TEXT NOT NULL,
    filters TEXT DEFAULT '[]' NOT NULL,
    sort_config TEXT DEFAULT '[]' NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_report_templates PRIMARY KEY (id)
);

CREATE TABLE tenant_usage_monthly (
    tenant_id UUID NOT NULL,
    year_month DATE NOT NULL,
    api_calls BIGINT DEFAULT 0 NOT NULL,
    ocr_pages BIGINT DEFAULT 0 NOT NULL,
    documents_created BIGINT DEFAULT 0 NOT NULL,
    storage_bytes BIGINT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_tenant_usage_monthly PRIMARY KEY (tenant_id, year_month)
);

CREATE TABLE backup_history (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    backup_type VARCHAR(20) DEFAULT 'TENANT' NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    created_by UUID,
    file_path TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_backup_history PRIMARY KEY (id)
);

-- ============================================================================
-- 6. MODULO: CLINICO, NOTAS MEDICAS Y ESTUDIOS DICOM (9 Tablas)
-- ============================================================================

CREATE TABLE patients (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    document_type VARCHAR(30),
    document_number VARCHAR(40),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(30),
    phone VARCHAR(30),
    email VARCHAR(150),
    address VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    CONSTRAINT pk_patients PRIMARY KEY (id),
    CONSTRAINT uq_patients_doc UNIQUE (tenant_id, document_type, document_number)
);

CREATE TABLE clinical_staff (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    staff_type VARCHAR(30) NOT NULL,
    specialty VARCHAR(120),
    professional_license VARCHAR(80),
    service_area VARCHAR(120),
    shift VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_clinical_staff PRIMARY KEY (id),
    CONSTRAINT uq_clinical_staff_user UNIQUE (tenant_id, user_id)
);

CREATE TABLE clinical_histories (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    code VARCHAR(60) NOT NULL,
    blood_type VARCHAR(10),
    pathological_antecedents TEXT,
    non_pathological_antecedents TEXT,
    family_antecedents TEXT,
    allergies TEXT DEFAULT '[]' NOT NULL,
    chronic_conditions TEXT,
    current_medications TEXT DEFAULT '[]' NOT NULL,
    base_diagnoses TEXT DEFAULT '[]' NOT NULL,
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_clinical_histories PRIMARY KEY (id),
    CONSTRAINT uq_histories_patient UNIQUE (tenant_id, patient_id),
    CONSTRAINT uq_histories_code UNIQUE (tenant_id, code)
);

CREATE TABLE clinical_episodes (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    clinical_history_id UUID NOT NULL,
    code VARCHAR(60) NOT NULL,
    episode_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_clinical_episodes PRIMARY KEY (id),
    CONSTRAINT uq_episodes_code UNIQUE (tenant_id, code)
);

CREATE TABLE clinical_document_links (
    tenant_id UUID NOT NULL,
    document_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    clinical_history_id UUID,
    episode_id UUID,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_clinical_document_links PRIMARY KEY (document_id, patient_id)
);

CREATE TABLE medical_notes (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    clinical_history_id UUID NOT NULL,
    episode_id UUID,
    author_id UUID NOT NULL,
    note_type VARCHAR(40) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_medical_notes PRIMARY KEY (id)
);

CREATE TABLE dicom_studies (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    uploader_id UUID NOT NULL,
    study_instance_uid VARCHAR(100) NOT NULL,
    study_date DATE,
    study_description VARCHAR(255),
    accession_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_dicom_studies PRIMARY KEY (id),
    CONSTRAINT uq_dicom_studies_uid UNIQUE (tenant_id, study_instance_uid)
);

CREATE TABLE dicom_series (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    study_id UUID NOT NULL,
    series_instance_uid VARCHAR(100) NOT NULL,
    modality VARCHAR(20) NOT NULL,
    series_number INTEGER,
    series_description VARCHAR(255),
    body_part VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_dicom_series PRIMARY KEY (id),
    CONSTRAINT uq_dicom_series_uid UNIQUE (tenant_id, series_instance_uid)
);

CREATE TABLE dicom_instances (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    series_id UUID NOT NULL,
    sop_instance_uid VARCHAR(100) NOT NULL,
    instance_number INTEGER,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0 NOT NULL,
    rows_count INTEGER,
    columns_count INTEGER,
    bits_allocated INTEGER,
    window_center NUMERIC(10, 2),
    window_width NUMERIC(10, 2),
    pixel_spacing VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_dicom_instances PRIMARY KEY (id),
    CONSTRAINT uq_dicom_instances_uid UNIQUE (tenant_id, sop_instance_uid)
);

-- ============================================================================
-- DEFINICION DE CLAVES FORANEAS (RELACIONES UML PARA ENTERPRISE ARCHITECT)
-- ============================================================================

-- Modulo Plataforma
ALTER TABLE plan_limits ADD CONSTRAINT fk_plan_limits_plan
    FOREIGN KEY (plan_id) REFERENCES plans (id);

ALTER TABLE plan_features ADD CONSTRAINT fk_plan_features_plan
    FOREIGN KEY (plan_id) REFERENCES plans (id);

ALTER TABLE tenants ADD CONSTRAINT fk_tenants_plan
    FOREIGN KEY (plan_id) REFERENCES plans (id);

ALTER TABLE tenant_departments ADD CONSTRAINT fk_departments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE users ADD CONSTRAINT fk_users_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE users ADD CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES tenant_departments (id);

ALTER TABLE roles ADD CONSTRAINT fk_roles_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles (id);

ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_perm
    FOREIGN KEY (permission_id) REFERENCES permissions (id);

ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles (id);

ALTER TABLE user_groups ADD CONSTRAINT fk_user_groups_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE user_group_members ADD CONSTRAINT fk_group_members_group
    FOREIGN KEY (group_id) REFERENCES user_groups (id);

ALTER TABLE user_group_members ADD CONSTRAINT fk_group_members_user
    FOREIGN KEY (user_id) REFERENCES users (id);

-- Modulo Autenticacion y Seguridad
ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_replaced
    FOREIGN KEY (replaced_by) REFERENCES auth_sessions (id);

ALTER TABLE revoked_access_tokens ADD CONSTRAINT fk_revoked_tokens_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE revoked_access_tokens ADD CONSTRAINT fk_revoked_tokens_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE password_recovery_requests ADD CONSTRAINT fk_pwd_recovery_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE password_recovery_requests ADD CONSTRAINT fk_pwd_recovery_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE user_push_tokens ADD CONSTRAINT fk_push_tokens_user
    FOREIGN KEY (user_id) REFERENCES users (id);

-- Modulo Documental y Expedientes
ALTER TABLE retention_policies ADD CONSTRAINT fk_retention_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE document_categories ADD CONSTRAINT fk_doc_categories_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE document_categories ADD CONSTRAINT fk_doc_categories_parent
    FOREIGN KEY (parent_id) REFERENCES document_categories (id);

ALTER TABLE document_types ADD CONSTRAINT fk_doc_types_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE document_types ADD CONSTRAINT fk_doc_types_category
    FOREIGN KEY (category_id) REFERENCES document_categories (id);

ALTER TABLE document_types ADD CONSTRAINT fk_doc_types_retention
    FOREIGN KEY (retention_policy_id) REFERENCES retention_policies (id);

ALTER TABLE document_types ADD CONSTRAINT fk_doc_types_workflow
    FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates (id);

ALTER TABLE metadata_definitions ADD CONSTRAINT fk_metadata_def_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE metadata_definitions ADD CONSTRAINT fk_metadata_def_type
    FOREIGN KEY (document_type_id) REFERENCES document_types (id);

ALTER TABLE expedient_types ADD CONSTRAINT fk_expedient_types_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE expedients ADD CONSTRAINT fk_expedients_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE expedients ADD CONSTRAINT fk_expedients_type
    FOREIGN KEY (expedient_type_id) REFERENCES expedient_types (id);

ALTER TABLE expedients ADD CONSTRAINT fk_expedients_responsible
    FOREIGN KEY (responsible_id) REFERENCES users (id);

ALTER TABLE expedients ADD CONSTRAINT fk_expedients_department
    FOREIGN KEY (department_id) REFERENCES tenant_departments (id);

ALTER TABLE expedient_participants ADD CONSTRAINT fk_exp_participants_exp
    FOREIGN KEY (expedient_id) REFERENCES expedients (id);

ALTER TABLE expedient_participants ADD CONSTRAINT fk_exp_participants_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_expedient
    FOREIGN KEY (expedient_id) REFERENCES expedients (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_type
    FOREIGN KEY (document_type_id) REFERENCES document_types (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_author
    FOREIGN KEY (author_id) REFERENCES users (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_responsible
    FOREIGN KEY (responsible_id) REFERENCES users (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_department
    FOREIGN KEY (department_id) REFERENCES tenant_departments (id);

ALTER TABLE documents ADD CONSTRAINT fk_documents_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id);

ALTER TABLE document_versions ADD CONSTRAINT fk_doc_versions_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE document_versions ADD CONSTRAINT fk_doc_versions_author
    FOREIGN KEY (author_id) REFERENCES users (id);

ALTER TABLE document_metadata_values ADD CONSTRAINT fk_doc_meta_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE document_metadata_values ADD CONSTRAINT fk_doc_meta_def
    FOREIGN KEY (metadata_definition_id) REFERENCES metadata_definitions (id);

ALTER TABLE document_metadata_values ADD CONSTRAINT fk_doc_meta_user
    FOREIGN KEY (updated_by) REFERENCES users (id);

ALTER TABLE tags ADD CONSTRAINT fk_tags_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE document_tags ADD CONSTRAINT fk_doc_tags_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE document_tags ADD CONSTRAINT fk_doc_tags_tag
    FOREIGN KEY (tag_id) REFERENCES tags (id);

ALTER TABLE document_comments ADD CONSTRAINT fk_doc_comments_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE document_comments ADD CONSTRAINT fk_doc_comments_author
    FOREIGN KEY (author_id) REFERENCES users (id);

ALTER TABLE document_comments ADD CONSTRAINT fk_doc_comments_parent
    FOREIGN KEY (parent_id) REFERENCES document_comments (id);

-- Modulo Workflows y Tareas
ALTER TABLE workflow_templates ADD CONSTRAINT fk_wf_templates_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE workflow_templates ADD CONSTRAINT fk_wf_templates_creator
    FOREIGN KEY (created_by) REFERENCES users (id);

ALTER TABLE workflow_template_stages ADD CONSTRAINT fk_wf_stages_template
    FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates (id);

ALTER TABLE workflow_template_transitions ADD CONSTRAINT fk_wf_trans_template
    FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates (id);

ALTER TABLE workflow_template_transitions ADD CONSTRAINT fk_wf_trans_from
    FOREIGN KEY (from_stage_id) REFERENCES workflow_template_stages (id);

ALTER TABLE workflow_template_transitions ADD CONSTRAINT fk_wf_trans_to
    FOREIGN KEY (to_stage_id) REFERENCES workflow_template_stages (id);

ALTER TABLE workflows ADD CONSTRAINT fk_workflows_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE workflows ADD CONSTRAINT fk_workflows_template
    FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates (id);

ALTER TABLE workflows ADD CONSTRAINT fk_workflows_expedient
    FOREIGN KEY (expedient_id) REFERENCES expedients (id);

ALTER TABLE workflows ADD CONSTRAINT fk_workflows_creator
    FOREIGN KEY (creator_id) REFERENCES users (id);

ALTER TABLE workflows ADD CONSTRAINT fk_workflows_stage
    FOREIGN KEY (current_stage_id) REFERENCES workflow_template_stages (id);

ALTER TABLE workflow_documents ADD CONSTRAINT fk_wf_docs_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows (id);

ALTER TABLE workflow_documents ADD CONSTRAINT fk_wf_docs_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_stage
    FOREIGN KEY (stage_id) REFERENCES workflow_template_stages (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_user
    FOREIGN KEY (assigned_user_id) REFERENCES users (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_role
    FOREIGN KEY (assigned_role_id) REFERENCES roles (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_dept
    FOREIGN KEY (assigned_department_id) REFERENCES tenant_departments (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_group
    FOREIGN KEY (assigned_group_id) REFERENCES user_groups (id);

ALTER TABLE workflow_tasks ADD CONSTRAINT fk_wf_tasks_completed_by
    FOREIGN KEY (completed_by) REFERENCES users (id);

ALTER TABLE workflow_events ADD CONSTRAINT fk_wf_events_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows (id);

ALTER TABLE workflow_events ADD CONSTRAINT fk_wf_events_task
    FOREIGN KEY (task_id) REFERENCES workflow_tasks (id);

ALTER TABLE workflow_events ADD CONSTRAINT fk_wf_events_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE workflow_events ADD CONSTRAINT fk_wf_events_user
    FOREIGN KEY (performed_by) REFERENCES users (id);

ALTER TABLE workflow_comments ADD CONSTRAINT fk_wf_comments_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows (id);

ALTER TABLE workflow_comments ADD CONSTRAINT fk_wf_comments_task
    FOREIGN KEY (task_id) REFERENCES workflow_tasks (id);

ALTER TABLE workflow_comments ADD CONSTRAINT fk_wf_comments_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE workflow_comments ADD CONSTRAINT fk_wf_comments_author
    FOREIGN KEY (author_id) REFERENCES users (id);

ALTER TABLE task_delegations ADD CONSTRAINT fk_delegations_delegator
    FOREIGN KEY (delegator_id) REFERENCES users (id);

ALTER TABLE task_delegations ADD CONSTRAINT fk_delegations_delegate
    FOREIGN KEY (delegate_id) REFERENCES users (id);

-- Modulo Operaciones, OCR, Auditoria y Reportes
ALTER TABLE ocr_jobs ADD CONSTRAINT fk_ocr_jobs_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE ocr_jobs ADD CONSTRAINT fk_ocr_jobs_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users (id);

ALTER TABLE ocr_jobs ADD CONSTRAINT fk_ocr_jobs_validator
    FOREIGN KEY (validated_by) REFERENCES users (id);

ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE report_templates ADD CONSTRAINT fk_report_templates_owner
    FOREIGN KEY (owner_id) REFERENCES users (id);

ALTER TABLE tenant_usage_monthly ADD CONSTRAINT fk_tenant_usage_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE backup_history ADD CONSTRAINT fk_backup_history_creator
    FOREIGN KEY (created_by) REFERENCES users (id);

-- Modulo Clinico y DICOM
ALTER TABLE patients ADD CONSTRAINT fk_patients_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (id);

ALTER TABLE clinical_staff ADD CONSTRAINT fk_clinical_staff_user
    FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE clinical_histories ADD CONSTRAINT fk_clinical_histories_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id);

ALTER TABLE clinical_episodes ADD CONSTRAINT fk_episodes_history
    FOREIGN KEY (clinical_history_id) REFERENCES clinical_histories (id);

ALTER TABLE clinical_document_links ADD CONSTRAINT fk_clin_doc_doc
    FOREIGN KEY (document_id) REFERENCES documents (id);

ALTER TABLE clinical_document_links ADD CONSTRAINT fk_clin_doc_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id);

ALTER TABLE clinical_document_links ADD CONSTRAINT fk_clin_doc_history
    FOREIGN KEY (clinical_history_id) REFERENCES clinical_histories (id);

ALTER TABLE clinical_document_links ADD CONSTRAINT fk_clin_doc_episode
    FOREIGN KEY (episode_id) REFERENCES clinical_episodes (id);

ALTER TABLE medical_notes ADD CONSTRAINT fk_medical_notes_history
    FOREIGN KEY (clinical_history_id) REFERENCES clinical_histories (id);

ALTER TABLE medical_notes ADD CONSTRAINT fk_medical_notes_episode
    FOREIGN KEY (episode_id) REFERENCES clinical_episodes (id);

ALTER TABLE medical_notes ADD CONSTRAINT fk_medical_notes_author
    FOREIGN KEY (author_id) REFERENCES users (id);

ALTER TABLE dicom_studies ADD CONSTRAINT fk_dicom_studies_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id);

ALTER TABLE dicom_studies ADD CONSTRAINT fk_dicom_studies_uploader
    FOREIGN KEY (uploader_id) REFERENCES users (id);

ALTER TABLE dicom_series ADD CONSTRAINT fk_dicom_series_study
    FOREIGN KEY (study_id) REFERENCES dicom_studies (id);

ALTER TABLE dicom_instances ADD CONSTRAINT fk_dicom_instances_series
    FOREIGN KEY (series_id) REFERENCES dicom_series (id);
