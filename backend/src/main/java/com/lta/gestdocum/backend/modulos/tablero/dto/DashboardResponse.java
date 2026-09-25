package com.lta.gestdocum.backend.modulos.tablero.dto;

import com.lta.gestdocum.backend.modulos.expedientes.dto.ExpedientResponse;
import com.lta.gestdocum.backend.modulos.organizaciones.dto.UserResponse;

import java.util.List;

public record DashboardResponse(
        UserResponse currentUser,
        List<DashboardTaskResponse> tasks,
        List<DashboardActivityResponse> recentActivity,
        List<DashboardDocumentResponse> recentDocuments,
        List<ExpedientResponse> expedients) {
}
