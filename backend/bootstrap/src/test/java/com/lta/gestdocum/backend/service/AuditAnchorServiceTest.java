package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditAnchorRepository;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditAnchorServiceTest {

    @Mock
    private AuditAnchorRepository anchorRepository;

    @Mock
    private AuditEventRepository auditEventRepository;

    private AuditAnchorService anchorService;

    private UUID tenantId;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        actorId = UUID.randomUUID();
        anchorService = new AuditAnchorService(anchorRepository, auditEventRepository, "test-secret-key-1234567890");
    }

    @Test
    @DisplayName("createAnchor falla si no existen eventos de auditoría para el tenant")
    void createAnchor_whenNoEvents_throwsException() {
        when(auditEventRepository.findTopByTenantIdOrderByChainSeqDesc(tenantId)).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () ->
                anchorService.createAnchor(tenantId, "LOCAL_SIGNED", actorId)
        );
    }

    @Test
    @DisplayName("createAnchor sella el último evento con firma HMAC válida")
    void createAnchor_whenEventsExist_createsSignedAnchor() {
        AuditEvent latestEvent = AuditEvent.builder()
                .id(99L)
                .tenantId(tenantId)
                .chainSeq(42L)
                .recordHash("a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90")
                .occurredAt(OffsetDateTime.now())
                .build();

        when(auditEventRepository.findTopByTenantIdOrderByChainSeqDesc(tenantId)).thenReturn(Optional.of(latestEvent));
        when(anchorRepository.save(any(AuditAnchor.class))).thenAnswer(inv -> inv.getArgument(0));

        AuditAnchor created = anchorService.createAnchor(tenantId, "LOCAL_SIGNED", actorId);

        assertNotNull(created);
        assertEquals(tenantId, created.getTenantId());
        assertEquals(42L, created.getChainSeq());
        assertEquals("a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90", created.getRecordHash());
        assertEquals("LOCAL_SIGNED", created.getAnchorType());
        assertNotNull(created.getSignature());
        assertEquals(actorId, created.getAnchoredBy());

        // Verificar que la firma es íntegra
        assertTrue(anchorService.verifyAnchorIntegrity(created));
    }

    @Test
    @DisplayName("verifyAnchorIntegrity retorna falso si la firma fue alterada")
    void verifyAnchorIntegrity_whenTampered_returnsFalse() {
        AuditAnchor anchor = AuditAnchor.builder()
                .tenantId(tenantId)
                .chainSeq(1L)
                .recordHash("hash123")
                .anchoredAt(OffsetDateTime.now())
                .signature("invalid-fake-signature")
                .build();

        assertFalse(anchorService.verifyAnchorIntegrity(anchor));
    }
}
