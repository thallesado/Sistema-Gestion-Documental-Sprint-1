package com.lta.gestdocum.tablero.application.dto;

import com.lta.gestdocum.documentos.application.dto.DocumentResponse;

import com.lta.gestdocum.expedientes.application.dto.ExpedientResponse;

import com.lta.gestdocum.usuarios.application.dto.UserResponse;

import java.util.List;

public record DashboardResponse(
        UserResponse currentUser,
        List<DashboardTaskResponse> tasks,
        List<DashboardActivityResponse> recentActivity,
        List<DashboardDocumentResponse> recentDocuments,
        List<ExpedientResponse> expedients) {
}
