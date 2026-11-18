package com.lta.gestdocum.backend.dto;

import java.util.List;

/**
 * Borrador de nota médica generado por IA a partir de un dictado de voz.
 * No se persiste: la app lo muestra como formulario editable y el médico decide si guarda.
 */
public record MedicalNoteAiDraftResponse(
        String transcript,
        String noteType,
        String subjective,
        String objective,
        String assessment,
        String plan,
        List<Warning> warnings) {

    /**
     * Coincidencia determinista entre el dictado y la historia clínica.
     * type: ALLERGY (allergies[].allergen) o MEDICATION (currentMedications[].name).
     */
    public record Warning(String type, String term) {}
}
