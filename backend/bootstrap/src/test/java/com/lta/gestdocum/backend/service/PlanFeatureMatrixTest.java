package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class PlanFeatureMatrixTest {

    private static final Set<String> BASIC_FEATURES = Set.of();
    private static final Set<String> PRO_FEATURES = Set.of("workflows", "ocr_scanning", "custom_branding", "advanced_analytics");
    private static final Set<String> ENTERPRISE_FEATURES = Set.of(
            "workflows", "ocr_scanning", "custom_branding", "advanced_analytics", "clinical_module", "dicom_imaging"
    );

    @Test
    void coreDmsPermissionsAlwaysAllowedInBasicPlan() {
        List<String> coreCodes = List.of(
                "document:read", "document:create", "document:update", "document:delete", "document:archive",
                "document_version:read", "document_version:create",
                "expedient:read", "expedient:create", "expedient_type:create",
                "user:read", "user:create", "user:manage",
                "role:read", "role:create", "role:assign",
                "audit:read_tenant", "configuration:read", "configuration:update",
                "task:create", "notification:read", "component_permission:manage"
        );

        for (String code : coreCodes) {
            String module = code.split(":")[0];
            assertTrue(PlanFeatureMatrix.isPermissionAllowed(module, code, BASIC_FEATURES),
                    "Core DMS permission " + code + " should be allowed in BASIC plan");
        }
    }

    @Test
    void advancedFeaturesBlockedInBasicPlan() {
        List<String> forbiddenInBasic = List.of(
                "workflow:read", "workflow:create", "workflow:approve", "workflow_template:create",
                "ocr:read", "ocr:create",
                "patient:read", "patient:create", "medical_note:read", "medical_note:create", "clinical_history:read",
                "dicom:read", "dicom:create",
                "report:read", "report:create"
        );

        for (String code : forbiddenInBasic) {
            String module = code.split(":")[0];
            assertFalse(PlanFeatureMatrix.isPermissionAllowed(module, code, BASIC_FEATURES),
                    "Permission " + code + " MUST be blocked in BASIC plan");
        }
    }

    @Test
    void proPlanAllowsWorkflowsAndOcrAndAnalyticsButBlocksClinicalAndDicom() {
        List<String> allowedInPro = List.of(
                "workflow:read", "workflow:create", "workflow:approve", "workflow_template:create",
                "ocr:read", "ocr:create",
                "report:read", "report:create",
                "document:read", "expedient:read", "user:read"
        );

        for (String code : allowedInPro) {
            String module = code.split(":")[0];
            assertTrue(PlanFeatureMatrix.isPermissionAllowed(module, code, PRO_FEATURES),
                    "Permission " + code + " should be allowed in PRO plan");
        }

        List<String> forbiddenInPro = List.of(
                "patient:read", "patient:create", "medical_note:read", "medical_note:create",
                "clinical_history:read", "clinical_history:create",
                "dicom:read", "dicom:create"
        );

        for (String code : forbiddenInPro) {
            String module = code.split(":")[0];
            assertFalse(PlanFeatureMatrix.isPermissionAllowed(module, code, PRO_FEATURES),
                    "Clinical/DICOM permission " + code + " MUST be blocked in PRO plan");
        }
    }

    @Test
    void enterprisePlanAllowsAllPermissions() {
        List<String> allCodes = List.of(
                "document:read", "workflow:read", "ocr:read", "report:read",
                "patient:read", "medical_note:read", "clinical_history:read", "dicom:read"
        );

        for (String code : allCodes) {
            String module = code.split(":")[0];
            assertTrue(PlanFeatureMatrix.isPermissionAllowed(module, code, ENTERPRISE_FEATURES),
                    "Enterprise should allow " + code);
        }
    }
}
