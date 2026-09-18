package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.repository.DashboardRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DashboardService {
    private static final int DEFAULT_LIMIT = 10;

    private final DashboardRepository repository;
    private final AuthenticatedUserContext context;
    private final UserService userService;
    private final ExpedientService expedientService;

    public DashboardService(DashboardRepository repository,
                            AuthenticatedUserContext context,
                            UserService userService,
                            ExpedientService expedientService) {
        this.repository = repository;
        this.context = context;
        this.userService = userService;
        this.expedientService = expedientService;
    }

    @Transactional(readOnly = true)
    public DashboardResponse load(Integer requestedLimit) {
        int limit = requestedLimit == null ? DEFAULT_LIMIT : Math.min(Math.max(requestedLimit, 1), 50);
        UUID tenantId = context.requireTenantId();
        UUID userId = context.requireUserId();
        context.establishDatabaseContext();

        List<DashboardTaskResponse> tasks = repository.findMyTasks(tenantId, userId, limit).stream()
                .map(value -> new DashboardTaskResponse(value.getId(), value.getDocumentId(),
                        value.getTitle(), value.getStatus(), value.getPriority(), value.getDueAt()))
                .toList();
        List<DashboardActivityResponse> activity = repository.findRecentActivity(tenantId, limit).stream()
                .map(value -> new DashboardActivityResponse(value.getId(), value.getUserId(),
                        value.getActorName(), value.getAction(), value.getEntityType(),
                        value.getEntityId(), value.getOccurredAt(), value.getResult()))
                .toList();
        List<DashboardDocumentResponse> documents = repository.findRecentDocuments(tenantId, limit).stream()
                .map(value -> new DashboardDocumentResponse(value.getId(), value.getExpedientId(),
                        value.getCode(), value.getName(), value.getStatus(), value.getUpdatedAt()))
                .toList();
        List<ExpedientResponse> expedients = expedientService.find(null,
                org.springframework.data.domain.PageRequest.of(0, limit)).getContent();
        return new DashboardResponse(userService.getCurrentUser(), tasks, activity, documents, expedients);
    }
}
