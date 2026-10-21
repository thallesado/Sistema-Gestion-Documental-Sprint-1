!INC Local Scripts.EAConstants-JScript
/*
 * SCRIPT AUTOMATIZADO PARA ENTERPRISE ARCHITECT
 * Genera el Diagrama de Clases UML completo de NexoDocs (53 clases + relaciones)
 *
 * MODO DE USO EN ENTERPRISE ARCHITECT:
 * 1. Abrir Enterprise Architect y seleccionar un Paquete en el Project Browser.
 * 2. Ir a la ventana Scripting: Ribbon 'Develop' > 'Tools' > 'Scripting' (o 'Specialize' > 'Tools' > 'Scripting').
 * 3. Crear un nuevo script de tipo JScript, pegar este contenido completo.
 * 4. Presionar 'Run' (Boton Play o F5).
 */

function Main() {
    Repository.EnsureOutputVisible('Script');
    Session.Output('Iniciando generacion de Diagrama de Clases UML en Enterprise Architect...');

    var targetPackage = Repository.GetTreeSelectedPackage();
    if (targetPackage == null) {
        Session.Prompt('Por favor selecciona un Paquete en el Explorador del Proyecto (Project Browser).', promptOK);
        return;
    }

    // 1. Crear el diagrama de clases
    var diagrams = targetPackage.Diagrams;
    var classDiagram = diagrams.AddNew('NexoDocs - Diagrama de Clases Completo', 'Logical');
    classDiagram.Update();

    var elementMap = {};
    var elements = targetPackage.Elements;

    var tablesData = {
    "Plan": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "price_monthly",
            "type": "Decimal"
        },
        {
            "name": "price_yearly",
            "type": "Decimal"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "sort_order",
            "type": "Integer"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "PlanLimit": [
        {
            "name": "plan_id",
            "type": "UUID"
        },
        {
            "name": "resource_key",
            "type": "String"
        },
        {
            "name": "resource_value",
            "type": "Long"
        },
        {
            "name": "unit",
            "type": "String"
        }
    ],
    "PlanFeature": [
        {
            "name": "plan_id",
            "type": "UUID"
        },
        {
            "name": "feature_key",
            "type": "String"
        },
        {
            "name": "is_enabled",
            "type": "Boolean"
        },
        {
            "name": "description",
            "type": "String"
        }
    ],
    "Tenant": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "plan_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "slug",
            "type": "String"
        },
        {
            "name": "email",
            "type": "String"
        },
        {
            "name": "phone",
            "type": "String"
        },
        {
            "name": "address",
            "type": "String"
        },
        {
            "name": "logo_url",
            "type": "String"
        },
        {
            "name": "primary_color",
            "type": "String"
        },
        {
            "name": "settings",
            "type": "String"
        },
        {
            "name": "subscription_status",
            "type": "String"
        },
        {
            "name": "subscription_start_date",
            "type": "Date"
        },
        {
            "name": "subscription_end_date",
            "type": "Date"
        },
        {
            "name": "billing_cycle",
            "type": "String"
        },
        {
            "name": "storage_limit_bytes",
            "type": "Long"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "TenantDepartment": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "User": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "department_id",
            "type": "UUID"
        },
        {
            "name": "username",
            "type": "String"
        },
        {
            "name": "email",
            "type": "String"
        },
        {
            "name": "password_hash",
            "type": "String"
        },
        {
            "name": "first_name",
            "type": "String"
        },
        {
            "name": "last_name",
            "type": "String"
        },
        {
            "name": "document_type",
            "type": "String"
        },
        {
            "name": "document_number",
            "type": "String"
        },
        {
            "name": "phone",
            "type": "String"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "is_platform_admin",
            "type": "Boolean"
        },
        {
            "name": "biography",
            "type": "String"
        },
        {
            "name": "avatar_data",
            "type": "byte[]"
        },
        {
            "name": "avatar_content_type",
            "type": "String"
        },
        {
            "name": "email_notifications",
            "type": "Boolean"
        },
        {
            "name": "push_notifications",
            "type": "Boolean"
        },
        {
            "name": "last_login_at",
            "type": "DateTime"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        },
        {
            "name": "deleted_at",
            "type": "DateTime"
        }
    ],
    "Role": [
        {
            "name": "id",
            "type": "Long"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "is_system",
            "type": "Boolean"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "Permission": [
        {
            "name": "id",
            "type": "Long"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "module",
            "type": "String"
        },
        {
            "name": "action",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "criticality",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "RolePermission": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "role_id",
            "type": "Long"
        },
        {
            "name": "permission_id",
            "type": "Long"
        },
        {
            "name": "granted_at",
            "type": "DateTime"
        }
    ],
    "UserRole": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "role_id",
            "type": "Long"
        },
        {
            "name": "assigned_at",
            "type": "DateTime"
        }
    ],
    "UserGroup": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "UserGroupMember": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "group_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "joined_at",
            "type": "DateTime"
        }
    ],
    "AuthSession": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "refresh_token_hash",
            "type": "String"
        },
        {
            "name": "expires_at",
            "type": "DateTime"
        },
        {
            "name": "revoked_at",
            "type": "DateTime"
        },
        {
            "name": "replaced_by",
            "type": "UUID"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "last_used_at",
            "type": "DateTime"
        }
    ],
    "RevokedAccessToken": [
        {
            "name": "token_hash",
            "type": "String"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "expires_at",
            "type": "DateTime"
        },
        {
            "name": "revoked_at",
            "type": "DateTime"
        }
    ],
    "PasswordRecoveryRequest": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "token_hash",
            "type": "String"
        },
        {
            "name": "expires_at",
            "type": "DateTime"
        },
        {
            "name": "used_at",
            "type": "DateTime"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "UserPushToken": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "platform",
            "type": "String"
        },
        {
            "name": "token",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "last_used_at",
            "type": "DateTime"
        }
    ],
    "RetentionPolicy": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "retention_months",
            "type": "Integer"
        },
        {
            "name": "disposition_action",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "DocumentCategory": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "parent_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "DocumentType": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "category_id",
            "type": "UUID"
        },
        {
            "name": "retention_policy_id",
            "type": "UUID"
        },
        {
            "name": "workflow_template_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "metadata_schema",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "MetadataDefinition": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_type_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "data_type",
            "type": "String"
        },
        {
            "name": "options",
            "type": "String"
        },
        {
            "name": "is_required",
            "type": "Boolean"
        },
        {
            "name": "is_searchable",
            "type": "Boolean"
        },
        {
            "name": "sort_order",
            "type": "Integer"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "ExpedientType": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "metadata_schema",
            "type": "String"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "Expedient": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "expedient_type_id",
            "type": "UUID"
        },
        {
            "name": "responsible_id",
            "type": "UUID"
        },
        {
            "name": "department_id",
            "type": "UUID"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "metadata",
            "type": "String"
        },
        {
            "name": "closed_at",
            "type": "DateTime"
        },
        {
            "name": "archived_at",
            "type": "DateTime"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        },
        {
            "name": "deleted_at",
            "type": "DateTime"
        }
    ],
    "ExpedientParticipant": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "expedient_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "participant_role",
            "type": "String"
        },
        {
            "name": "added_at",
            "type": "DateTime"
        }
    ],
    "Document": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "expedient_id",
            "type": "UUID"
        },
        {
            "name": "document_type_id",
            "type": "UUID"
        },
        {
            "name": "author_id",
            "type": "UUID"
        },
        {
            "name": "responsible_id",
            "type": "UUID"
        },
        {
            "name": "department_id",
            "type": "UUID"
        },
        {
            "name": "patient_id",
            "type": "UUID"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "current_version",
            "type": "Integer"
        },
        {
            "name": "is_external_source",
            "type": "Boolean"
        },
        {
            "name": "source",
            "type": "String"
        },
        {
            "name": "specialty",
            "type": "String"
        },
        {
            "name": "institutional_process",
            "type": "String"
        },
        {
            "name": "metadata",
            "type": "String"
        },
        {
            "name": "issue_date",
            "type": "Date"
        },
        {
            "name": "expiry_date",
            "type": "Date"
        },
        {
            "name": "archived_at",
            "type": "DateTime"
        },
        {
            "name": "voided_at",
            "type": "DateTime"
        },
        {
            "name": "deleted_at",
            "type": "DateTime"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "DocumentVersion": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "version_number",
            "type": "Integer"
        },
        {
            "name": "author_id",
            "type": "UUID"
        },
        {
            "name": "change_reason",
            "type": "String"
        },
        {
            "name": "file_path",
            "type": "String"
        },
        {
            "name": "file_name",
            "type": "String"
        },
        {
            "name": "mime_type",
            "type": "String"
        },
        {
            "name": "file_size_bytes",
            "type": "Long"
        },
        {
            "name": "checksum_sha256",
            "type": "String"
        },
        {
            "name": "content",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "DocumentMetadataValue": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "metadata_definition_id",
            "type": "UUID"
        },
        {
            "name": "value",
            "type": "String"
        },
        {
            "name": "updated_by",
            "type": "UUID"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "Tag": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "color",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "DocumentTag": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "tag_id",
            "type": "UUID"
        }
    ],
    "DocumentComment": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "author_id",
            "type": "UUID"
        },
        {
            "name": "parent_id",
            "type": "UUID"
        },
        {
            "name": "comment_text",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        },
        {
            "name": "deleted_at",
            "type": "DateTime"
        }
    ],
    "WorkflowTemplate": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "version",
            "type": "Integer"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_by",
            "type": "UUID"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "WorkflowTemplateStage": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_template_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "stage_type",
            "type": "String"
        },
        {
            "name": "sort_order",
            "type": "Integer"
        },
        {
            "name": "assignment_type",
            "type": "String"
        },
        {
            "name": "assignment_reference",
            "type": "String"
        },
        {
            "name": "due_days",
            "type": "Integer"
        },
        {
            "name": "rules",
            "type": "String"
        }
    ],
    "WorkflowTemplateTransition": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_template_id",
            "type": "UUID"
        },
        {
            "name": "from_stage_id",
            "type": "UUID"
        },
        {
            "name": "to_stage_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "condition",
            "type": "String"
        }
    ],
    "Workflow": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_template_id",
            "type": "UUID"
        },
        {
            "name": "expedient_id",
            "type": "UUID"
        },
        {
            "name": "title",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "priority",
            "type": "Integer"
        },
        {
            "name": "creator_id",
            "type": "UUID"
        },
        {
            "name": "current_stage_id",
            "type": "UUID"
        },
        {
            "name": "started_at",
            "type": "DateTime"
        },
        {
            "name": "due_at",
            "type": "DateTime"
        },
        {
            "name": "completed_at",
            "type": "DateTime"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "WorkflowDocument": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "added_at",
            "type": "DateTime"
        }
    ],
    "WorkflowTask": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_id",
            "type": "UUID"
        },
        {
            "name": "stage_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "title",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "assigned_user_id",
            "type": "UUID"
        },
        {
            "name": "assigned_role_id",
            "type": "Long"
        },
        {
            "name": "assigned_department_id",
            "type": "UUID"
        },
        {
            "name": "assigned_group_id",
            "type": "UUID"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "outcome",
            "type": "String"
        },
        {
            "name": "priority",
            "type": "Integer"
        },
        {
            "name": "document_version",
            "type": "Integer"
        },
        {
            "name": "due_at",
            "type": "DateTime"
        },
        {
            "name": "started_at",
            "type": "DateTime"
        },
        {
            "name": "completed_at",
            "type": "DateTime"
        },
        {
            "name": "completed_by",
            "type": "UUID"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "WorkflowEvent": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_id",
            "type": "UUID"
        },
        {
            "name": "task_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "event_type",
            "type": "String"
        },
        {
            "name": "performed_by",
            "type": "UUID"
        },
        {
            "name": "result",
            "type": "String"
        },
        {
            "name": "comment",
            "type": "String"
        },
        {
            "name": "details",
            "type": "String"
        },
        {
            "name": "performed_at",
            "type": "DateTime"
        }
    ],
    "WorkflowComment": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "workflow_id",
            "type": "UUID"
        },
        {
            "name": "task_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "author_id",
            "type": "UUID"
        },
        {
            "name": "comment_text",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        },
        {
            "name": "deleted_at",
            "type": "DateTime"
        }
    ],
    "TaskDelegation": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "delegator_id",
            "type": "UUID"
        },
        {
            "name": "delegate_id",
            "type": "UUID"
        },
        {
            "name": "starts_on",
            "type": "Date"
        },
        {
            "name": "ends_on",
            "type": "Date"
        },
        {
            "name": "is_active",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "OcrJob": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "uploaded_by",
            "type": "UUID"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "original_file_path",
            "type": "String"
        },
        {
            "name": "file_type",
            "type": "String"
        },
        {
            "name": "pages_total",
            "type": "Integer"
        },
        {
            "name": "pages_processed",
            "type": "Integer"
        },
        {
            "name": "raw_text",
            "type": "String"
        },
        {
            "name": "extracted_data",
            "type": "String"
        },
        {
            "name": "suggested_metadata",
            "type": "String"
        },
        {
            "name": "confidence_score",
            "type": "Decimal"
        },
        {
            "name": "validated_by",
            "type": "UUID"
        },
        {
            "name": "validated_at",
            "type": "DateTime"
        },
        {
            "name": "error_message",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "Notification": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "channel",
            "type": "String"
        },
        {
            "name": "type",
            "type": "String"
        },
        {
            "name": "title",
            "type": "String"
        },
        {
            "name": "message",
            "type": "String"
        },
        {
            "name": "related_entity_type",
            "type": "String"
        },
        {
            "name": "related_entity_id",
            "type": "UUID"
        },
        {
            "name": "is_read",
            "type": "Boolean"
        },
        {
            "name": "read_at",
            "type": "DateTime"
        },
        {
            "name": "archived_at",
            "type": "DateTime"
        },
        {
            "name": "expires_at",
            "type": "DateTime"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "AuditEvent": [
        {
            "name": "id",
            "type": "Long"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "action",
            "type": "String"
        },
        {
            "name": "entity_type",
            "type": "String"
        },
        {
            "name": "entity_id",
            "type": "UUID"
        },
        {
            "name": "occurred_at",
            "type": "DateTime"
        },
        {
            "name": "ip_address",
            "type": "String"
        },
        {
            "name": "user_agent",
            "type": "String"
        },
        {
            "name": "result",
            "type": "String"
        },
        {
            "name": "details",
            "type": "String"
        }
    ],
    "ReportTemplate": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "owner_id",
            "type": "UUID"
        },
        {
            "name": "name",
            "type": "String"
        },
        {
            "name": "description",
            "type": "String"
        },
        {
            "name": "report_type",
            "type": "String"
        },
        {
            "name": "selected_fields",
            "type": "String"
        },
        {
            "name": "filters",
            "type": "String"
        },
        {
            "name": "sort_config",
            "type": "String"
        },
        {
            "name": "is_shared",
            "type": "Boolean"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "TenantUsageMonthly": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "year_month",
            "type": "Date"
        },
        {
            "name": "api_calls",
            "type": "Long"
        },
        {
            "name": "ocr_pages",
            "type": "Long"
        },
        {
            "name": "documents_created",
            "type": "Long"
        },
        {
            "name": "storage_bytes",
            "type": "Long"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "BackupHistory": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "backup_type",
            "type": "String"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "created_by",
            "type": "UUID"
        },
        {
            "name": "file_path",
            "type": "String"
        },
        {
            "name": "file_size_bytes",
            "type": "Long"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "completed_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "Patient": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_type",
            "type": "String"
        },
        {
            "name": "document_number",
            "type": "String"
        },
        {
            "name": "first_name",
            "type": "String"
        },
        {
            "name": "last_name",
            "type": "String"
        },
        {
            "name": "birth_date",
            "type": "Date"
        },
        {
            "name": "gender",
            "type": "String"
        },
        {
            "name": "phone",
            "type": "String"
        },
        {
            "name": "email",
            "type": "String"
        },
        {
            "name": "address",
            "type": "String"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        },
        {
            "name": "deleted_at",
            "type": "DateTime"
        }
    ],
    "ClinicalStaff": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "user_id",
            "type": "UUID"
        },
        {
            "name": "staff_type",
            "type": "String"
        },
        {
            "name": "specialty",
            "type": "String"
        },
        {
            "name": "professional_license",
            "type": "String"
        },
        {
            "name": "service_area",
            "type": "String"
        },
        {
            "name": "shift",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "ClinicalHistory": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "patient_id",
            "type": "UUID"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "blood_type",
            "type": "String"
        },
        {
            "name": "pathological_antecedents",
            "type": "String"
        },
        {
            "name": "non_pathological_antecedents",
            "type": "String"
        },
        {
            "name": "family_antecedents",
            "type": "String"
        },
        {
            "name": "allergies",
            "type": "String"
        },
        {
            "name": "chronic_conditions",
            "type": "String"
        },
        {
            "name": "current_medications",
            "type": "String"
        },
        {
            "name": "base_diagnoses",
            "type": "String"
        },
        {
            "name": "observations",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "ClinicalEpisode": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "clinical_history_id",
            "type": "UUID"
        },
        {
            "name": "code",
            "type": "String"
        },
        {
            "name": "episode_type",
            "type": "String"
        },
        {
            "name": "started_at",
            "type": "DateTime"
        },
        {
            "name": "ended_at",
            "type": "DateTime"
        },
        {
            "name": "status",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "ClinicalDocumentLink": [
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "document_id",
            "type": "UUID"
        },
        {
            "name": "patient_id",
            "type": "UUID"
        },
        {
            "name": "clinical_history_id",
            "type": "UUID"
        },
        {
            "name": "episode_id",
            "type": "UUID"
        },
        {
            "name": "linked_at",
            "type": "DateTime"
        }
    ],
    "MedicalNote": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "clinical_history_id",
            "type": "UUID"
        },
        {
            "name": "episode_id",
            "type": "UUID"
        },
        {
            "name": "author_id",
            "type": "UUID"
        },
        {
            "name": "note_type",
            "type": "String"
        },
        {
            "name": "content",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        }
    ],
    "DicomStudy": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "patient_id",
            "type": "UUID"
        },
        {
            "name": "uploader_id",
            "type": "UUID"
        },
        {
            "name": "study_instance_uid",
            "type": "String"
        },
        {
            "name": "study_date",
            "type": "Date"
        },
        {
            "name": "study_description",
            "type": "String"
        },
        {
            "name": "accession_number",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "DicomSeries": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "study_id",
            "type": "UUID"
        },
        {
            "name": "series_instance_uid",
            "type": "String"
        },
        {
            "name": "modality",
            "type": "String"
        },
        {
            "name": "series_number",
            "type": "Integer"
        },
        {
            "name": "series_description",
            "type": "String"
        },
        {
            "name": "body_part",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ],
    "DicomInstance": [
        {
            "name": "id",
            "type": "UUID"
        },
        {
            "name": "tenant_id",
            "type": "UUID"
        },
        {
            "name": "series_id",
            "type": "UUID"
        },
        {
            "name": "sop_instance_uid",
            "type": "String"
        },
        {
            "name": "instance_number",
            "type": "Integer"
        },
        {
            "name": "file_path",
            "type": "String"
        },
        {
            "name": "file_size_bytes",
            "type": "Long"
        },
        {
            "name": "rows_count",
            "type": "Integer"
        },
        {
            "name": "columns_count",
            "type": "Integer"
        },
        {
            "name": "bits_allocated",
            "type": "Integer"
        },
        {
            "name": "window_center",
            "type": "Decimal"
        },
        {
            "name": "window_width",
            "type": "Decimal"
        },
        {
            "name": "pixel_spacing",
            "type": "String"
        },
        {
            "name": "created_at",
            "type": "DateTime"
        },
        {
            "name": "updated_at",
            "type": "DateTime"
        }
    ]
};

    var relationsData = [
    {
        "src": "PlanLimit",
        "tgt": "Plan",
        "label": "plan_id"
    },
    {
        "src": "PlanFeature",
        "tgt": "Plan",
        "label": "plan_id"
    },
    {
        "src": "Tenant",
        "tgt": "Plan",
        "label": "plan_id"
    },
    {
        "src": "TenantDepartment",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "User",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "User",
        "tgt": "TenantDepartment",
        "label": "department_id"
    },
    {
        "src": "Role",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "RolePermission",
        "tgt": "Role",
        "label": "role_id"
    },
    {
        "src": "RolePermission",
        "tgt": "Permission",
        "label": "permission_id"
    },
    {
        "src": "UserRole",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "UserRole",
        "tgt": "Role",
        "label": "role_id"
    },
    {
        "src": "UserGroup",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "UserGroupMember",
        "tgt": "UserGroup",
        "label": "group_id"
    },
    {
        "src": "UserGroupMember",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "AuthSession",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "AuthSession",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "AuthSession",
        "tgt": "AuthSession",
        "label": "replaced_by"
    },
    {
        "src": "RevokedAccessToken",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "RevokedAccessToken",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "PasswordRecoveryRequest",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "PasswordRecoveryRequest",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "UserPushToken",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "RetentionPolicy",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "DocumentCategory",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "DocumentCategory",
        "tgt": "DocumentCategory",
        "label": "parent_id"
    },
    {
        "src": "DocumentType",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "DocumentType",
        "tgt": "DocumentCategory",
        "label": "category_id"
    },
    {
        "src": "DocumentType",
        "tgt": "RetentionPolicy",
        "label": "retention_policy_id"
    },
    {
        "src": "DocumentType",
        "tgt": "WorkflowTemplate",
        "label": "workflow_template_id"
    },
    {
        "src": "MetadataDefinition",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "MetadataDefinition",
        "tgt": "DocumentType",
        "label": "document_type_id"
    },
    {
        "src": "ExpedientType",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "Expedient",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "Expedient",
        "tgt": "ExpedientType",
        "label": "expedient_type_id"
    },
    {
        "src": "Expedient",
        "tgt": "User",
        "label": "responsible_id"
    },
    {
        "src": "Expedient",
        "tgt": "TenantDepartment",
        "label": "department_id"
    },
    {
        "src": "ExpedientParticipant",
        "tgt": "Expedient",
        "label": "expedient_id"
    },
    {
        "src": "ExpedientParticipant",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "Document",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "Document",
        "tgt": "Expedient",
        "label": "expedient_id"
    },
    {
        "src": "Document",
        "tgt": "DocumentType",
        "label": "document_type_id"
    },
    {
        "src": "Document",
        "tgt": "User",
        "label": "author_id"
    },
    {
        "src": "Document",
        "tgt": "User",
        "label": "responsible_id"
    },
    {
        "src": "Document",
        "tgt": "TenantDepartment",
        "label": "department_id"
    },
    {
        "src": "Document",
        "tgt": "Patient",
        "label": "patient_id"
    },
    {
        "src": "DocumentVersion",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "DocumentVersion",
        "tgt": "User",
        "label": "author_id"
    },
    {
        "src": "DocumentMetadataValue",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "DocumentMetadataValue",
        "tgt": "MetadataDefinition",
        "label": "metadata_definition_id"
    },
    {
        "src": "DocumentMetadataValue",
        "tgt": "User",
        "label": "updated_by"
    },
    {
        "src": "Tag",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "DocumentTag",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "DocumentTag",
        "tgt": "Tag",
        "label": "tag_id"
    },
    {
        "src": "DocumentComment",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "DocumentComment",
        "tgt": "User",
        "label": "author_id"
    },
    {
        "src": "DocumentComment",
        "tgt": "DocumentComment",
        "label": "parent_id"
    },
    {
        "src": "WorkflowTemplate",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "WorkflowTemplate",
        "tgt": "User",
        "label": "created_by"
    },
    {
        "src": "WorkflowTemplateStage",
        "tgt": "WorkflowTemplate",
        "label": "workflow_template_id"
    },
    {
        "src": "WorkflowTemplateTransition",
        "tgt": "WorkflowTemplate",
        "label": "workflow_template_id"
    },
    {
        "src": "WorkflowTemplateTransition",
        "tgt": "WorkflowTemplateStage",
        "label": "from_stage_id"
    },
    {
        "src": "WorkflowTemplateTransition",
        "tgt": "WorkflowTemplateStage",
        "label": "to_stage_id"
    },
    {
        "src": "Workflow",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "Workflow",
        "tgt": "WorkflowTemplate",
        "label": "workflow_template_id"
    },
    {
        "src": "Workflow",
        "tgt": "Expedient",
        "label": "expedient_id"
    },
    {
        "src": "Workflow",
        "tgt": "User",
        "label": "creator_id"
    },
    {
        "src": "Workflow",
        "tgt": "WorkflowTemplateStage",
        "label": "current_stage_id"
    },
    {
        "src": "WorkflowDocument",
        "tgt": "Workflow",
        "label": "workflow_id"
    },
    {
        "src": "WorkflowDocument",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "Workflow",
        "label": "workflow_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "WorkflowTemplateStage",
        "label": "stage_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "User",
        "label": "assigned_user_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "Role",
        "label": "assigned_role_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "TenantDepartment",
        "label": "assigned_department_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "UserGroup",
        "label": "assigned_group_id"
    },
    {
        "src": "WorkflowTask",
        "tgt": "User",
        "label": "completed_by"
    },
    {
        "src": "WorkflowEvent",
        "tgt": "Workflow",
        "label": "workflow_id"
    },
    {
        "src": "WorkflowEvent",
        "tgt": "WorkflowTask",
        "label": "task_id"
    },
    {
        "src": "WorkflowEvent",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "WorkflowEvent",
        "tgt": "User",
        "label": "performed_by"
    },
    {
        "src": "WorkflowComment",
        "tgt": "Workflow",
        "label": "workflow_id"
    },
    {
        "src": "WorkflowComment",
        "tgt": "WorkflowTask",
        "label": "task_id"
    },
    {
        "src": "WorkflowComment",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "WorkflowComment",
        "tgt": "User",
        "label": "author_id"
    },
    {
        "src": "TaskDelegation",
        "tgt": "User",
        "label": "delegator_id"
    },
    {
        "src": "TaskDelegation",
        "tgt": "User",
        "label": "delegate_id"
    },
    {
        "src": "OcrJob",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "OcrJob",
        "tgt": "User",
        "label": "uploaded_by"
    },
    {
        "src": "OcrJob",
        "tgt": "User",
        "label": "validated_by"
    },
    {
        "src": "Notification",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "AuditEvent",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "AuditEvent",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "ReportTemplate",
        "tgt": "User",
        "label": "owner_id"
    },
    {
        "src": "TenantUsageMonthly",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "BackupHistory",
        "tgt": "User",
        "label": "created_by"
    },
    {
        "src": "Patient",
        "tgt": "Tenant",
        "label": "tenant_id"
    },
    {
        "src": "ClinicalStaff",
        "tgt": "User",
        "label": "user_id"
    },
    {
        "src": "ClinicalHistory",
        "tgt": "Patient",
        "label": "patient_id"
    },
    {
        "src": "ClinicalEpisode",
        "tgt": "ClinicalHistory",
        "label": "clinical_history_id"
    },
    {
        "src": "ClinicalDocumentLink",
        "tgt": "Document",
        "label": "document_id"
    },
    {
        "src": "ClinicalDocumentLink",
        "tgt": "Patient",
        "label": "patient_id"
    },
    {
        "src": "ClinicalDocumentLink",
        "tgt": "ClinicalHistory",
        "label": "clinical_history_id"
    },
    {
        "src": "ClinicalDocumentLink",
        "tgt": "ClinicalEpisode",
        "label": "episode_id"
    },
    {
        "src": "MedicalNote",
        "tgt": "ClinicalHistory",
        "label": "clinical_history_id"
    },
    {
        "src": "MedicalNote",
        "tgt": "ClinicalEpisode",
        "label": "episode_id"
    },
    {
        "src": "MedicalNote",
        "tgt": "User",
        "label": "author_id"
    },
    {
        "src": "DicomStudy",
        "tgt": "Patient",
        "label": "patient_id"
    },
    {
        "src": "DicomStudy",
        "tgt": "User",
        "label": "uploader_id"
    },
    {
        "src": "DicomSeries",
        "tgt": "DicomStudy",
        "label": "study_id"
    },
    {
        "src": "DicomInstance",
        "tgt": "DicomSeries",
        "label": "series_id"
    }
];

    // 2. Crear Clases y Atributos
    var x = 50, y = 50;
    var colCount = 0;
    for (var className in tablesData) {
        Session.Output('Creando clase: ' + className);
        var newClass = elements.AddNew(className, 'Class');
        newClass.Update();
        elementMap[className] = newClass;

        var cols = tablesData[className];
        for (var i = 0; i < cols.length; i++) {
            var attr = newClass.Attributes.AddNew(cols[i].name, cols[i].type);
            attr.Visibility = 'Private';
            attr.Update();
        }
        newClass.Attributes.Refresh();
        newClass.Update();

        // Colocar la clase en el diagrama
        var diagObj = classDiagram.DiagramObjects.AddNew('', '');
        diagObj.ElementID = newClass.ElementID;
        diagObj.left = x;
        diagObj.top = -y;
        diagObj.right = x + 200;
        diagObj.bottom = -(y + 180);
        diagObj.Update();

        x += 240;
        colCount++;
        if (colCount >= 5) {
            colCount = 0;
            x = 50;
            y += 240;
        }
    }
    elements.Refresh();
    classDiagram.DiagramObjects.Refresh();

    // 3. Crear Conectores de Asociacion
    Session.Output('Creando relaciones de asociacion...');
    for (var r = 0; r < relationsData.length; r++) {
        var rel = relationsData[r];
        var srcEl = elementMap[rel.src];
        var tgtEl = elementMap[rel.tgt];
        if (srcEl != null && tgtEl != null) {
            var conn = srcEl.Connectors.AddNew(rel.label, 'Association');
            conn.SupplierID = tgtEl.ElementID;
            conn.Direction = 'Source -> Destination';
            conn.Update();
            srcEl.Connectors.Refresh();
        }
    }

    classDiagram.Update();
    Repository.ReloadDiagram(classDiagram.DiagramID);
    Repository.OpenDiagram(classDiagram.DiagramID);
    Session.Output('¡Diagrama de clases generado exitosamente!');
    Session.Prompt('¡Diagrama de Clases generado exitosamente con 53 clases y sus asociaciones!', promptOK);
}

Main();