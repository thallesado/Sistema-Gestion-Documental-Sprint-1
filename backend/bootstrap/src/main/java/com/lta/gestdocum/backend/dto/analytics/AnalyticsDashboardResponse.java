package com.lta.gestdocum.backend.dto.analytics;

import java.time.OffsetDateTime;
import java.util.List;

public record AnalyticsDashboardResponse(
        OffsetDateTime dateFrom,
        OffsetDateTime dateTo,
        AnalyticsSummary summary,
        List<MonthlyPoint> monthlyTrend,
        List<AreaDistribution> areaDistribution,
        List<WorkflowCycleTime> cycleTimes,
        List<TopUserActivity> topUsers,
        OcrAnalytics ocrPerformance
) {
    public record AnalyticsSummary(
            long totalDocuments,
            double documentApprovalRate,
            long totalWorkflows,
            double averageWorkflowHours,
            long activeUsers,
            long totalOcrProcessed,
            double ocrAcceptanceRate,
            double averageOcrConfidence
    ) {}

    public record MonthlyPoint(
            String month,
            long documentsCreated,
            long documentsApproved,
            long workflowsCompleted
    ) {}

    public record AreaDistribution(
            String area,
            long documentCount,
            long workflowCount
    ) {}

    public record WorkflowCycleTime(
            String templateName,
            long completedCount,
            double averageHours,
            double minHours,
            double maxHours,
            long overdueCount
    ) {}

    public record TopUserActivity(
            String userName,
            String role,
            String area,
            long auditActions,
            long documentsCreated
    ) {}

    public record OcrAnalytics(
            long totalProcessed,
            long validated,
            long rejected,
            double acceptanceRate,
            double averageConfidence,
            double averageProcessingSeconds
    ) {}
}
