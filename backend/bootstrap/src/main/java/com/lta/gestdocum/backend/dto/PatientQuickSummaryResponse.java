package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.AllergyEntry;
import com.lta.gestdocum.backend.model.BaseDiagnosisEntry;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PatientQuickSummaryResponse(
        UUID patientId,
        String patientName,
        String document,
        UUID clinicalHistoryId,
        String historyCode,
        List<AllergyEntry> allergies,
        List<BaseDiagnosisEntry> baseDiagnoses,
        List<RecentNote> recentNotes) {
    public record RecentNote(UUID id, String type, String content, OffsetDateTime createdAt) {
    }
}
