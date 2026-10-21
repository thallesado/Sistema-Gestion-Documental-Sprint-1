import os
import re

ddl_file = r"c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\schema_enterprise_architect.sql"
output_puml = r"c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\diagrama_clases.puml"

with open(ddl_file, "r", encoding="utf-8") as f:
    sql_text = f.read()

def to_pascal(s):
    singles = {
        'plans': 'Plan',
        'plan_limits': 'PlanLimit',
        'plan_features': 'PlanFeature',
        'tenants': 'Tenant',
        'tenant_departments': 'TenantDepartment',
        'users': 'User',
        'roles': 'Role',
        'permissions': 'Permission',
        'role_permissions': 'RolePermission',
        'user_roles': 'UserRole',
        'user_groups': 'UserGroup',
        'user_group_members': 'UserGroupMember',
        'auth_sessions': 'AuthSession',
        'revoked_access_tokens': 'RevokedAccessToken',
        'password_recovery_requests': 'PasswordRecoveryRequest',
        'user_push_tokens': 'UserPushToken',
        'retention_policies': 'RetentionPolicy',
        'document_categories': 'DocumentCategory',
        'document_types': 'DocumentType',
        'metadata_definitions': 'MetadataDefinition',
        'expedient_types': 'ExpedientType',
        'expedients': 'Expedient',
        'expedient_participants': 'ExpedientParticipant',
        'documents': 'Document',
        'document_versions': 'DocumentVersion',
        'document_metadata_values': 'DocumentMetadataValue',
        'tags': 'Tag',
        'document_tags': 'DocumentTag',
        'document_comments': 'DocumentComment',
        'workflow_templates': 'WorkflowTemplate',
        'workflow_template_stages': 'WorkflowTemplateStage',
        'workflow_template_transitions': 'WorkflowTemplateTransition',
        'workflows': 'Workflow',
        'workflow_documents': 'WorkflowDocument',
        'workflow_tasks': 'WorkflowTask',
        'workflow_events': 'WorkflowEvent',
        'workflow_comments': 'WorkflowComment',
        'task_delegations': 'TaskDelegation',
        'ocr_jobs': 'OcrJob',
        'notifications': 'Notification',
        'audit_events': 'AuditEvent',
        'report_templates': 'ReportTemplate',
        'tenant_usage_monthly': 'TenantUsageMonthly',
        'backup_history': 'BackupHistory',
        'patients': 'Patient',
        'clinical_staff': 'ClinicalStaff',
        'clinical_histories': 'ClinicalHistory',
        'clinical_episodes': 'ClinicalEpisode',
        'clinical_document_links': 'ClinicalDocumentLink',
        'medical_notes': 'MedicalNote',
        'dicom_studies': 'DicomStudy',
        'dicom_series': 'DicomSeries',
        'dicom_instances': 'DicomInstance'
    }
    return singles.get(s, ''.join(x.capitalize() for x in s.split('_')))

def sql_type_to_uml(t):
    t_upper = t.upper()
    if 'UUID' in t_upper:
        return 'UUID'
    if 'VARCHAR' in t_upper or 'TEXT' in t_upper or 'CHAR' in t_upper:
        return 'String'
    if 'BIGINT' in t_upper:
        return 'Long'
    if 'SMALLINT' in t_upper or 'INTEGER' in t_upper or 'INT' in t_upper:
        return 'Integer'
    if 'BOOLEAN' in t_upper:
        return 'Boolean'
    if 'TIMESTAMP' in t_upper:
        return 'DateTime'
    if 'DATE' in t_upper:
        return 'Date'
    if 'NUMERIC' in t_upper:
        return 'Decimal'
    if 'BYTEA' in t_upper:
        return 'byte[]'
    return 'String'

tables = {}
table_blocks = re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\);', sql_text, re.DOTALL)
for tname, body in table_blocks:
    fields = []
    lines = [l.strip() for l in body.split('\n') if l.strip()]
    for line in lines:
        if line.startswith('CONSTRAINT') or line.startswith('--'):
            continue
        m = re.match(r'(\w+)\s+([A-Za-z0-9_(),\s]+?)(?:DEFAULT|NOT NULL|NULL|,|$)', line)
        if m:
            fields.append((m.group(1), m.group(2).strip()))
    tables[tname] = fields

fks = re.findall(r'ALTER TABLE (\w+) ADD CONSTRAINT (\w+)\s+FOREIGN KEY\s*\((.*?)\)\s*REFERENCES\s*(\w+)\s*\((.*?)\);', sql_text)

puml = []
puml.append("@startuml NexoDocs_Diagrama_Clases")
puml.append("skinparam classAttributeIconSize 0")
puml.append("skinparam monochrome false")
puml.append("skinparam shadowing false")
puml.append("skinparam defaultFontName Arial")
puml.append("skinparam classFontSize 12")
puml.append("skinparam roundcorner 5")
puml.append("")

# Modules
module_tables = {
    "1. Plataforma y Multi-Tenencia": ['plans', 'plan_limits', 'plan_features', 'tenants', 'tenant_departments', 'users', 'roles', 'permissions', 'role_permissions', 'user_roles', 'user_groups', 'user_group_members'],
    "2. Autenticacion y Seguridad": ['auth_sessions', 'revoked_access_tokens', 'password_recovery_requests', 'user_push_tokens'],
    "3. Gestion Documental y Expedientes": ['retention_policies', 'document_categories', 'document_types', 'metadata_definitions', 'expedient_types', 'expedients', 'expedient_participants', 'documents', 'document_versions', 'document_metadata_values', 'tags', 'document_tags', 'document_comments'],
    "4. Workflows y Tareas": ['workflow_templates', 'workflow_template_stages', 'workflow_template_transitions', 'workflows', 'workflow_documents', 'workflow_tasks', 'workflow_events', 'workflow_comments', 'task_delegations'],
    "5. Operaciones y Auditoria": ['ocr_jobs', 'notifications', 'audit_events', 'report_templates', 'tenant_usage_monthly', 'backup_history'],
    "6. Dominio Clinico y DICOM": ['patients', 'clinical_staff', 'clinical_histories', 'clinical_episodes', 'clinical_document_links', 'medical_notes', 'dicom_studies', 'dicom_series', 'dicom_instances']
}

for mod_name, tbl_list in module_tables.items():
    puml.append(f'package "{mod_name}" {{')
    for tname in tbl_list:
        if tname not in tables:
            continue
        cname = to_pascal(tname)
        puml.append(f'  class {cname} {{')
        for fname, ftype in tables[tname]:
            puml.append(f'    - {fname} : {sql_type_to_uml(ftype)}')
        puml.append('  }')
    puml.append('}')
    puml.append('')

puml.append("' Relaciones de Asociacion (Foreign Keys)")
for tbl, cname, col, ref_tbl, ref_col in fks:
    src_class = to_pascal(tbl)
    tgt_class = to_pascal(ref_tbl)
    # arrow notation
    puml.append(f'{src_class} ..> {tgt_class} : "{col.strip()}"')

puml.append("")
puml.append("@enduml")

with open(output_puml, "w", encoding="utf-8") as f:
    f.write("\n".join(puml))

print(f"Generated PlantUML diagram with {len(tables)} classes in {output_puml}")
