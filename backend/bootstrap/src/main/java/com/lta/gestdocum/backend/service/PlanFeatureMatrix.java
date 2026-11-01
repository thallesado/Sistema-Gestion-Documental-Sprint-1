package com.lta.gestdocum.backend.service;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;

/**
 * Matriz canónica que relaciona funcionalidades de los planes SaaS (BASIC, PRO, ENTERPRISE)
 * con los módulos y códigos de permiso del sistema.
 *
 * Módulos esenciales (DMS base: document, expedient, user, role, audit, configuration, task, notification)
 * están siempre habilitados en todos los planes.
 *
 * Módulos avanzados se condicionan estrictamente a las características activas del plan:
 * - workflows -> Flujos documentales y diseñador (workflow, workflow_template)
 * - ocr_scanning -> Digitalización OCR y procesamiento (ocr)
 * - advanced_analytics -> Reportes avanzados y métricas (report)
 * - clinical_module -> Expediente clínico, pacientes, historia y notas médicas (patient, medical_note, clinical, clinical_history, clinical_staff)
 * - dicom_imaging -> Visor e indexación de imagenología médica (dicom)
 */
public final class PlanFeatureMatrix {

    public static final String FEATURE_WORKFLOWS = "workflows";
    public static final String FEATURE_OCR = "ocr_scanning";
    public static final String FEATURE_ANALYTICS = "advanced_analytics";
    public static final String FEATURE_CLINICAL = "clinical_module";
    public static final String FEATURE_DICOM = "dicom_imaging";
    public static final String FEATURE_BRANDING = "custom_branding";

    private PlanFeatureMatrix() {}

    /**
     * Evalúa si un permiso está permitido para el conjunto de funcionalidades activas del tenant.
     */
    public static boolean isPermissionAllowed(String module, String code, Collection<String> enabledFeatures) {
        Set<String> features = enabledFeatures == null ? Set.of() : Set.copyOf(enabledFeatures);
        String mod = module == null ? "" : module.trim().toLowerCase(Locale.ROOT);
        String cd = code == null ? "" : code.trim().toLowerCase(Locale.ROOT);

        // 1. Workflows
        if (isWorkflow(mod, cd)) {
            return features.contains(FEATURE_WORKFLOWS);
        }

        // 2. Digitalización OCR
        if (isOcr(mod, cd)) {
            return features.contains(FEATURE_OCR);
        }

        // 3. Módulo clínico especializado
        if (isClinical(mod, cd)) {
            return features.contains(FEATURE_CLINICAL);
        }

        // 4. Imagenología DICOM
        if (isDicom(mod, cd)) {
            return features.contains(FEATURE_DICOM);
        }

        // 5. Reportes analíticos avanzados
        if (isAnalytics(mod, cd)) {
            return features.contains(FEATURE_ANALYTICS);
        }

        // Cualquier otro permiso pertenece al DMS base (documentos, expedientes, usuarios, auditoría, configuración)
        return true;
    }

    /** Funcionalidad de plan que exige un permiso, o null si pertenece al DMS base (siempre disponible). */
    public static String requiredFeature(String module, String code) {
        String mod = module == null ? "" : module.trim().toLowerCase(Locale.ROOT);
        String cd = code == null ? "" : code.trim().toLowerCase(Locale.ROOT);
        if (isWorkflow(mod, cd)) return FEATURE_WORKFLOWS;
        if (isOcr(mod, cd)) return FEATURE_OCR;
        if (isClinical(mod, cd)) return FEATURE_CLINICAL;
        if (isDicom(mod, cd)) return FEATURE_DICOM;
        if (isAnalytics(mod, cd)) return FEATURE_ANALYTICS;
        return null;
    }

    public static boolean isWorkflow(String module, String code) {
        return "workflow".equals(module)
                || "workflow_template".equals(module)
                || code.startsWith("workflow:")
                || code.startsWith("workflow_template:");
    }

    public static boolean isOcr(String module, String code) {
        return "ocr".equals(module)
                || code.startsWith("ocr:");
    }

    public static boolean isClinical(String module, String code) {
        return "patient".equals(module)
                || "medical_note".equals(module)
                || "clinical".equals(module)
                || "clinical_history".equals(module)
                || "clinical_staff".equals(module)
                || code.startsWith("patient:")
                || code.startsWith("medical_note:")
                || code.startsWith("clinical:")
                || code.startsWith("clinical_history:")
                || code.startsWith("clinical_staff:");
    }

    public static boolean isDicom(String module, String code) {
        return "dicom".equals(module)
                || code.startsWith("dicom:");
    }

    public static boolean isAnalytics(String module, String code) {
        return "report".equals(module)
                || code.startsWith("report:");
    }
}
