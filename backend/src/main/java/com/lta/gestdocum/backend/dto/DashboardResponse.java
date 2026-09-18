package com.lta.gestdocum.backend.dto;

import java.util.List;

public record DashboardResponse(
        UserResponse currentUser,
        List<DashboardTaskResponse> tasks,
        List<DashboardActivityResponse> recentActivity,
        List<DashboardDocumentResponse> recentDocuments,
        List<ExpedientResponse> expedients) {
}
