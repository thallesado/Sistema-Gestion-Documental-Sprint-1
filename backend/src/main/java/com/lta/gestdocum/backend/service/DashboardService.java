package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.repository.DashboardRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.time.Instant;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

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
                .map(value -> new DashboardTaskResponse((UUID) value[0], (UUID) value[1],
                        (String) value[2], (String) value[3], ((Number) value[4]).intValue(),
                        toOffset(value[5])))
                .toList();
        List<DashboardActivityResponse> activity = repository.findRecentActivity(tenantId, limit).stream()
                .map(value -> new DashboardActivityResponse(((Number) value[0]).longValue(), (UUID) value[1],
                        (String) value[2], (String) value[3], (String) value[4],
                        (UUID) value[5], toOffset(value[6]), (String) value[7]))
                .toList();
        List<DashboardDocumentResponse> documents = repository.findRecentDocuments(tenantId, limit).stream()
                .map(value -> new DashboardDocumentResponse((UUID) value[0], (UUID) value[1],
                        (String) value[2], (String) value[3], (String) value[4], toOffset(value[5])))
                .toList();
        List<ExpedientResponse> expedients = expedientService.find(null,
                org.springframework.data.domain.PageRequest.of(0, limit)).getContent();
        return new DashboardResponse(userService.getCurrentUser(), tasks, activity, documents, expedients);
    }

    private static OffsetDateTime toOffset(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime;
        }
        if (value instanceof Instant instant) {
            return instant.atOffset(ZoneOffset.UTC);
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().atOffset(ZoneOffset.UTC);
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime.atOffset(ZoneOffset.UTC);
        }
        throw new IllegalStateException("Tipo temporal no soportado en dashboard: "
                + value.getClass().getName());
    }
}
