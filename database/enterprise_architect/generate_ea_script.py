import os
import re

ddl_file = r"c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\schema_enterprise_architect.sql"
output_js = r"c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\ea_import_script.js"

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

js = []
js.append("!INC Local Scripts.EAConstants-JScript")
js.append("/*")
js.append(" * SCRIPT AUTOMATIZADO PARA ENTERPRISE ARCHITECT")
js.append(" * Genera el Diagrama de Clases UML completo de NexoDocs (53 clases + relaciones)")
js.append(" *")
js.append(" * MODO DE USO EN ENTERPRISE ARCHITECT:")
js.append(" * 1. Abrir Enterprise Architect y seleccionar un Paquete en el Project Browser.")
js.append(" * 2. Ir a la ventana Scripting: Ribbon 'Develop' > 'Tools' > 'Scripting' (o 'Specialize' > 'Tools' > 'Scripting').")
js.append(" * 3. Crear un nuevo script de tipo JScript, pegar este contenido completo.")
js.append(" * 4. Presionar 'Run' (Boton Play o F5).")
js.append(" */")
js.append("")
js.append("function Main() {")
js.append("    Repository.EnsureOutputVisible('Script');")
js.append("    Session.Output('Iniciando generacion de Diagrama de Clases UML en Enterprise Architect...');")
js.append("")
js.append("    var targetPackage = Repository.GetTreeSelectedPackage();")
js.append("    if (targetPackage == null) {")
js.append("        Session.Prompt('Por favor selecciona un Paquete en el Explorador del Proyecto (Project Browser).', promptOK);")
js.append("        return;")
js.append("    }")
js.append("")
js.append("    // 1. Crear el diagrama de clases")
js.append("    var diagrams = targetPackage.Diagrams;")
js.append("    var classDiagram = diagrams.AddNew('NexoDocs - Diagrama de Clases Completo', 'Logical');")
js.append("    classDiagram.Update();")
js.append("")
js.append("    var elementMap = {};")
js.append("    var elements = targetPackage.Elements;")
js.append("")

# Table data
import json
tbl_json = {}
for tname, cols in tables.items():
    cname = to_pascal(tname)
    col_list = [{"name": fname, "type": sql_type_to_uml(ftype)} for fname, ftype in cols]
    tbl_json[cname] = col_list

js.append(f"    var tablesData = {json.dumps(tbl_json, indent=4)};")
js.append("")

fk_list = []
for tbl, cname, col, ref_tbl, ref_col in fks:
    src_class = to_pascal(tbl)
    tgt_class = to_pascal(ref_tbl)
    fk_list.append({"src": src_class, "tgt": tgt_class, "label": col.strip()})

js.append(f"    var relationsData = {json.dumps(fk_list, indent=4)};")
js.append("")

js.append("    // 2. Crear Clases y Atributos")
js.append("    var x = 50, y = 50;")
js.append("    var colCount = 0;")
js.append("    for (var className in tablesData) {")
js.append("        Session.Output('Creando clase: ' + className);")
js.append("        var newClass = elements.AddNew(className, 'Class');")
js.append("        newClass.Update();")
js.append("        elementMap[className] = newClass;")
js.append("")
js.append("        var cols = tablesData[className];")
js.append("        for (var i = 0; i < cols.length; i++) {")
js.append("            var attr = newClass.Attributes.AddNew(cols[i].name, cols[i].type);")
js.append("            attr.Visibility = 'Private';")
js.append("            attr.Update();")
js.append("        }")
js.append("        newClass.Attributes.Refresh();")
js.append("        newClass.Update();")
js.append("")
js.append("        // Colocar la clase en el diagrama")
js.append("        var diagObj = classDiagram.DiagramObjects.AddNew('', '');")
js.append("        diagObj.ElementID = newClass.ElementID;")
js.append("        diagObj.left = x;")
js.append("        diagObj.top = -y;")
js.append("        diagObj.right = x + 200;")
js.append("        diagObj.bottom = -(y + 180);")
js.append("        diagObj.Update();")
js.append("")
js.append("        x += 240;")
js.append("        colCount++;")
js.append("        if (colCount >= 5) {")
js.append("            colCount = 0;")
js.append("            x = 50;")
js.append("            y += 240;")
js.append("        }")
js.append("    }")
js.append("    elements.Refresh();")
js.append("    classDiagram.DiagramObjects.Refresh();")
js.append("")
js.append("    // 3. Crear Conectores de Asociacion")
js.append("    Session.Output('Creando relaciones de asociacion...');")
js.append("    for (var r = 0; r < relationsData.length; r++) {")
js.append("        var rel = relationsData[r];")
js.append("        var srcEl = elementMap[rel.src];")
js.append("        var tgtEl = elementMap[rel.tgt];")
js.append("        if (srcEl != null && tgtEl != null) {")
js.append("            var conn = srcEl.Connectors.AddNew(rel.label, 'Association');")
js.append("            conn.SupplierID = tgtEl.ElementID;")
js.append("            conn.Direction = 'Source -> Destination';")
js.append("            conn.Update();")
js.append("            srcEl.Connectors.Refresh();")
js.append("        }")
js.append("    }")
js.append("")
js.append("    classDiagram.Update();")
js.append("    Repository.ReloadDiagram(classDiagram.DiagramID);")
js.append("    Repository.OpenDiagram(classDiagram.DiagramID);")
js.append("    Session.Output('¡Diagrama de clases generado exitosamente!');")
js.append("    Session.Prompt('¡Diagrama de Clases generado exitosamente con 53 clases y sus asociaciones!', promptOK);")
js.append("}")
js.append("")
js.append("Main();")

with open(output_js, "w", encoding="utf-8") as f:
    f.write("\n".join(js))

print(f"Generated EA JScript automation file: {output_js}")
