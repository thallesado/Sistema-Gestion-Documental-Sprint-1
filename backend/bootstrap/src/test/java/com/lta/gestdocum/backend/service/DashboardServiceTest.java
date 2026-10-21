package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.repository.DashboardRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private DashboardRepository repository;

    @Mock
    private AuthenticatedUserContext context;

    @Mock
    private UserService userService;

    @Mock
    private ExpedientService expedientService;

    @InjectMocks
    private DashboardService dashboardService;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(context.requireTenantId()).thenReturn(tenantId);
        when(context.requireUserId()).thenReturn(userId);
    }

    @Test
    @DisplayName("load() should query repository and aggregate tasks, activity, documents and expedients")
    void shouldLoadDashboardSuccessfully() {
        UUID taskId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        UUID doc2Id = UUID.randomUUID();
        Instant now = Instant.now();

        Object[] rawTask = new Object[]{
                taskId,
                documentId,
                "Revisión de informe",
                "PENDING",
                1,
                Timestamp.from(now)
        };
        when(repository.findMyTasks(eq(tenantId), eq(userId), eq(10)))
                .thenReturn(Collections.singletonList(rawTask));

        Object[] rawActivity = new Object[]{
                100L,
                userId,
                "Dr. Roberto Gómez",
                "CREATE",
                "DOCUMENT",
                documentId,
                Timestamp.from(now),
                "SUCCESS"
        };
        when(repository.findRecentActivity(eq(tenantId), eq(10)))
                .thenReturn(Collections.singletonList(rawActivity));

        Object[] rawDoc = new Object[]{
                doc2Id,
                UUID.randomUUID(),
                "DOC-001",
                "Consentimiento informado",
                "APPROVED",
                Timestamp.from(now)
        };
        when(repository.findRecentDocuments(eq(tenantId), eq(10)))
                .thenReturn(Collections.singletonList(rawDoc));

        when(expedientService.find(isNull(), eq(PageRequest.of(0, 10))))
                .thenReturn(new PageImpl<>(List.of()));

        UserResponse mockUser = UserResponse.builder()
                .id(userId)
                .tenantId(tenantId)
                .username("roberto.gomez")
                .email("roberto@clinica.com")
                .firstName("Roberto")
                .lastName("Gómez")
                .status("ACTIVE")
                .build();
        when(userService.getCurrentUser()).thenReturn(mockUser);

        DashboardResponse response = dashboardService.load(10);

        assertNotNull(response);
        assertEquals(mockUser, response.currentUser());
        assertEquals(1, response.tasks().size());
        assertEquals("Revisión de informe", response.tasks().get(0).title());
        assertEquals(1, response.recentActivity().size());
        assertEquals("Dr. Roberto Gómez", response.recentActivity().get(0).actorName());
        assertEquals(1, response.recentDocuments().size());
        assertEquals("DOC-001", response.recentDocuments().get(0).code());

        verify(context).establishDatabaseContext();
    }

    @Test
    @DisplayName("load() should clamp limit between 1 and 50 and use 10 by default")
    void shouldClampLimitProperly() {
        when(repository.findMyTasks(any(), any(), anyInt())).thenReturn(List.of());
        when(repository.findRecentActivity(any(), anyInt())).thenReturn(List.of());
        when(repository.findRecentDocuments(any(), anyInt())).thenReturn(List.of());
        when(expedientService.find(isNull(), any())).thenReturn(new PageImpl<>(List.of()));

        // Case null -> 10
        dashboardService.load(null);
        verify(repository).findMyTasks(tenantId, userId, 10);

        // Case 0 -> 1
        dashboardService.load(0);
        verify(repository).findMyTasks(tenantId, userId, 1);

        // Case 100 -> 50
        dashboardService.load(100);
        verify(repository).findMyTasks(tenantId, userId, 50);
    }
}
