import os
import re

ddl_file = r"c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\schema_enterprise_architect.sql"
output_dir = r"c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\java_classes\com\nexodocs\model"
os.makedirs(output_dir, exist_ok=True)

with open(ddl_file, "r", encoding="utf-8") as f:
    sql_text = f.read()

# Helper for snake_to_camel and PascalCase
def to_camel(s):
    parts = s.split('_')
    return parts[0] + ''.join(x.capitalize() for x in parts[1:])

def to_pascal(s):
    # special singularizations
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
    if s in singles:
        return singles[s]
    return ''.join(x.capitalize() for x in s.split('_'))

def sql_type_to_java(t):
    t_upper = t.upper()
    if 'UUID' in t_upper:
        return 'UUID'
    if 'VARCHAR' in t_upper or 'TEXT' in t_upper or 'CHAR' in t_upper:
        return 'String'
    if 'BIGINT' in t_upper:
        return 'Long'
    if 'SMALLINT' in t_upper:
        return 'Short'
    if 'INTEGER' in t_upper or 'INT' in t_upper:
        return 'Integer'
    if 'BOOLEAN' in t_upper or 'BOOL' in t_upper:
        return 'Boolean'
    if 'TIMESTAMP' in t_upper:
        return 'Date'
    if 'DATE' in t_upper:
        return 'Date'
    if 'NUMERIC' in t_upper or 'DECIMAL' in t_upper:
        return 'BigDecimal'
    if 'BYTEA' in t_upper:
        return 'byte[]'
    return 'String'

# Parse tables
tables = {}
table_blocks = re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\);', sql_text, re.DOTALL)
for tname, body in table_blocks:
    fields = []
    lines = [l.strip() for l in body.split('\n') if l.strip()]
    for line in lines:
        if line.startswith('CONSTRAINT') or line.startswith('--'):
            continue
        # match field_name type ...
        m = re.match(r'(\w+)\s+([A-Za-z0-9_(),\s]+?)(?:DEFAULT|NOT NULL|NULL|,|$)', line)
        if m:
            fname = m.group(1)
            ftype = m.group(2).strip()
            fields.append((fname, ftype))
    tables[tname] = fields

# Parse foreign keys
# ALTER TABLE table_name ADD CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES ref_table (ref_col);
fks = re.findall(r'ALTER TABLE (\w+) ADD CONSTRAINT (\w+)\s+FOREIGN KEY\s*\((.*?)\)\s*REFERENCES\s*(\w+)\s*\((.*?)\);', sql_text)

fk_map = {} # table -> list of (col, ref_table, ref_col)
for tbl, cname, col, ref_tbl, ref_col in fks:
    col = col.strip()
    ref_tbl = ref_tbl.strip()
    ref_col = ref_col.strip()
    if tbl not in fk_map:
        fk_map[tbl] = []
    fk_map[tbl].append((col, ref_tbl, ref_col))

print(f"Found {len(tables)} tables and {len(fks)} foreign keys.")

# Generate Java classes
for tname, cols in tables.items():
    cname = to_pascal(tname)
    class_code = []
    class_code.append("package com.nexodocs.model;")
    class_code.append("")
    class_code.append("import java.util.Date;")
    class_code.append("import java.util.UUID;")
    class_code.append("import java.math.BigDecimal;")
    class_code.append("")
    class_code.append("/**")
    class_code.append(f" * Entidad UML generada para Enterprise Architect: {cname}")
    class_code.append(f" * Mapea la tabla relacional: {tname}")
    class_code.append(" */")
    class_code.append(f"public class {cname} {{")
    class_code.append("")

    # Fields
    # Check FK columns
    table_fks = fk_map.get(tname, [])
    fk_cols = {f[0]: f[1] for f in table_fks}

    for fname, ftype in cols:
        jtype = sql_type_to_java(ftype)
        camel_name = to_camel(fname)
        class_code.append(f"    private {jtype} {camel_name};")

    # Add Object References for Foreign Keys (EA recognizes these as associations!)
    if table_fks:
        class_code.append("")
        class_code.append("    // Relaciones de asociacion UML (Claves Foraneas)")
        for col, ref_tbl, ref_col in table_fks:
            ref_class = to_pascal(ref_tbl)
            ref_var_name = to_camel(ref_tbl)
            if col != 'tenant_id' or tname in ['users', 'tenants']: # keep relations descriptive
                if col.endswith('_id'):
                    ref_var_name = to_camel(col[:-3])
                class_code.append(f"    private {ref_class} {ref_var_name};")

    # Constructor
    class_code.append("")
    class_code.append(f"    public {cname}() {{")
    class_code.append("    }")
    class_code.append("")

    # Getters and Setters
    for fname, ftype in cols:
        jtype = sql_type_to_java(ftype)
        camel_name = to_camel(fname)
        pascal_prop = camel_name[0].upper() + camel_name[1:]
        # Getter
        class_code.append(f"    public {jtype} get{pascal_prop}() {{")
        class_code.append(f"        return this.{camel_name};")
        class_code.append("    }")
        class_code.append("")
        # Setter
        class_code.append(f"    public void set{pascal_prop}({jtype} {camel_name}) {{")
        class_code.append(f"        this.{camel_name} = {camel_name};")
        class_code.append("    }")
        class_code.append("")

    if table_fks:
        for col, ref_tbl, ref_col in table_fks:
            ref_class = to_pascal(ref_tbl)
            ref_var_name = to_camel(ref_tbl)
            if col.endswith('_id'):
                ref_var_name = to_camel(col[:-3])
            pascal_ref = ref_var_name[0].upper() + ref_var_name[1:]
            class_code.append(f"    public {ref_class} get{pascal_ref}() {{")
            class_code.append(f"        return this.{ref_var_name};")
            class_code.append("    }")
            class_code.append("")
            class_code.append(f"    public void set{pascal_ref}({ref_class} {ref_var_name}) {{")
            class_code.append(f"        this.{ref_var_name} = {ref_var_name};")
            class_code.append("    }")
            class_code.append("")

    class_code.append("}")
    class_code.append("")

    out_path = os.path.join(output_dir, f"{cname}.java")
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write("\n".join(class_code))

print(f"Successfully generated {len(tables)} Java model classes in {output_dir}")
