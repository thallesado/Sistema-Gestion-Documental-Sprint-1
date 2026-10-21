package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.PlanLimitExceededException;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlanLimitServiceTest {

    @Mock private PlanRepository planRepository;
    @Mock private TenantRepository tenantRepository;
    @Mock private UserRepository userRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private DocumentVersionRepository documentVersionRepository;
    @Mock private PlanEnforcementService planEnforcementService;
    @Mock private EntityManager entityManager;

    private PlanLimitService planLimitService;
    private final UUID tenantId = UUID.randomUUID();
    private final UUID planId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        planLimitService = new PlanLimitService(
                planRepository,
                tenantRepository,
                userRepository,
                documentRepository,
                documentVersionRepository,
                planEnforcementService,
                entityManager
        );
    }

    @Test
    void validateUserLimit_WhenBelowLimit_AllowsCreation() {
        when(planRepository.findPlanIdByTenantIdForUpdate(tenantId)).thenReturn(Optional.of(planId));
        when(planRepository.findLimitValue(planId, PlanLimitService.MAX_USERS)).thenReturn(Optional.of(3L));
        when(userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(tenantId, UserStatus.ACTIVE)).thenReturn(2L);

        assertDoesNotThrow(() -> planLimitService.validateUserLimit(tenantId));
        verify(planEnforcementService).validateWriteAccess(tenantId);
    }

    @Test
    void validateUserLimit_WhenLimitReached_ThrowsPlanLimitExceededException() {
        when(planRepository.findPlanIdByTenantIdForUpdate(tenantId)).thenReturn(Optional.of(planId));
        when(planRepository.findLimitValue(planId, PlanLimitService.MAX_USERS)).thenReturn(Optional.of(3L));
        when(userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(tenantId, UserStatus.ACTIVE)).thenReturn(3L);

        PlanLimitExceededException ex = assertThrows(PlanLimitExceededException.class,
                () -> planLimitService.validateUserLimit(tenantId));

        assertTrue(ex.getMessage().contains("3"));
        assertTrue(ex.getMessage().contains("usuarios"));
    }

    @Test
    void validateDocumentLimit_WhenLimitReached_ThrowsPlanLimitExceededException() {
        when(planRepository.findPlanIdByTenantIdForUpdate(tenantId)).thenReturn(Optional.of(planId));
        when(planRepository.findLimitValue(planId, PlanLimitService.MAX_DOCUMENTS)).thenReturn(Optional.of(100L));
        when(documentRepository.countByTenantId(tenantId)).thenReturn(100L);

        PlanLimitExceededException ex = assertThrows(PlanLimitExceededException.class,
                () -> planLimitService.validateDocumentLimit(tenantId));

        assertTrue(ex.getMessage().contains("100"));
        assertTrue(ex.getMessage().contains("documentos"));
    }

    @Test
    void validateDocumentLimit_WhenBelowLimit_AllowsCreation() {
        when(planRepository.findPlanIdByTenantIdForUpdate(tenantId)).thenReturn(Optional.of(planId));
        when(planRepository.findLimitValue(planId, PlanLimitService.MAX_DOCUMENTS)).thenReturn(Optional.of(100L));
        when(documentRepository.countByTenantId(tenantId)).thenReturn(50L);

        assertDoesNotThrow(() -> planLimitService.validateDocumentLimit(tenantId));
    }
}
