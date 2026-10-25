package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuditVerificationResult;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.AuditAnchorService;
import com.lta.gestdocum.backend.service.AuditQueryUseCase;
import com.lta.gestdocum.backend.service.AuditVerificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditControllerTest {

    @Mock
    private AuditQueryUseCase queryService;

    @Mock
    private AuditVerificationService verificationService;

    @Mock
    private AuditAnchorService anchorService;

    @Mock
    private AuthenticatedUserContext userContext;

    @Mock
    private com.lta.gestdocum.backend.service.AuditAnchorScheduler anchorScheduler;

    @InjectMocks
    private AuditController controller;

    private UUID tenantId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        userId = UUID.randomUUID();
    }

    @Test
    @DisplayName("verify con permiso audit:read_global permite verificar cualquier tenant especificado")
    void verify_whenGlobalAdmin_verifiesSpecifiedTenant() {
        UUID customTenant = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(userId, tenantId, "superadmin", Set.of("audit:read_global"));
        when(userContext.require()).thenReturn(user);

        AuditVerificationResult mockResult = new AuditVerificationResult(
                true, customTenant, 5, null, null, null, null, null, null, OffsetDateTime.now()
        );
        when(verificationService.verifyTenantChain(customTenant)).thenReturn(mockResult);

        AuditVerificationResult result = controller.verify(customTenant);

        assertNotNull(result);
        assertTrue(result.valid());
        assertEquals(customTenant, result.tenantId());
        verify(verificationService).verifyTenantChain(customTenant);
    }

    @Test
    @DisplayName("verify con permiso audit:read_tenant verifica únicamente el tenant del usuario autenticado")
    void verify_whenTenantAdmin_verifiesOwnTenant() {
        UUID requestedDifferentTenant = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(userId, tenantId, "tenantadmin", Set.of("audit:read_tenant"));
        when(userContext.require()).thenReturn(user);

        AuditVerificationResult mockResult = new AuditVerificationResult(
                true, tenantId, 12, null, null, null, null, null, null, OffsetDateTime.now()
        );
        when(verificationService.verifyTenantChain(tenantId)).thenReturn(mockResult);

        AuditVerificationResult result = controller.verify(requestedDifferentTenant);

        assertNotNull(result);
        assertTrue(result.valid());
        assertEquals(tenantId, result.tenantId());
        verify(verificationService).verifyTenantChain(tenantId);
    }

    @Test
    @DisplayName("createAnchor genera un sello de anclaje para el tenant y usuario")
    void createAnchor_generatesSeal() {
        AuthenticatedUser user = new AuthenticatedUser(userId, tenantId, "superadmin", Set.of("audit:read_global"));
        when(userContext.require()).thenReturn(user);

        AuditAnchor mockAnchor = AuditAnchor.builder()
                .id(1L)
                .tenantId(tenantId)
                .chainSeq(10L)
                .recordHash("hash123")
                .anchorType("LOCAL_SIGNED")
                .anchoredBy(userId)
                .anchoredAt(OffsetDateTime.now())
                .build();

        when(anchorService.createAnchor(tenantId, "LOCAL_SIGNED", userId)).thenReturn(mockAnchor);

        AuditAnchor anchor = controller.createAnchor(tenantId, "LOCAL_SIGNED");

        assertNotNull(anchor);
        assertEquals(10L, anchor.getChainSeq());
        assertEquals(userId, anchor.getAnchoredBy());
        verify(anchorService).createAnchor(tenantId, "LOCAL_SIGNED", userId);
    }

    @Test
    @DisplayName("anchorStatus expone el estado del job de anclaje externo en solo lectura")
    void anchorStatus_returnsSchedulerStatus() {
        var status = new com.lta.gestdocum.backend.dto.AuditAnchorJobStatus(
                false, "DISABLED", "disabled", null, java.util.List.of(), null, "NEVER_RUN", 0, 0);
        when(anchorScheduler.status()).thenReturn(status);
        assertEquals("DISABLED", controller.anchorStatus().state());
    }
}
