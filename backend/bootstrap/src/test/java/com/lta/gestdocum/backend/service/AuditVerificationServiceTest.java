package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditVerificationResult;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.InetAddress;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditVerificationServiceTest {

    @Mock
    private AuditEventRepository auditEventRepository;

    @Mock
    private AuditAnchorService auditAnchorService;

    @InjectMocks
    private AuditVerificationService verificationService;

    private UUID tenantId;
    private UUID userId;
    private OffsetDateTime baseTime;
    private static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        userId = UUID.randomUUID();
        baseTime = OffsetDateTime.parse("2026-10-18T14:00:00Z");
    }

    private AuditEvent createEvent(Long id, Long chainSeq, String prevHash, String action, String entityType, UUID entityId, OffsetDateTime time, String details) throws Exception {
        AuditEvent event = AuditEvent.builder()
                .id(id)
                .tenantId(tenantId)
                .userId(userId)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .occurredAt(time)
                .result("SUCCESS")
                .ipAddress(InetAddress.getByName("127.0.0.1"))
                .userAgent("Mozilla/5.0")
                .details(details)
                .chainSeq(chainSeq)
                .previousHash(prevHash)
                .build();
        String computedHash = verificationService.computeRecordHash(event);
        event.setRecordHash(computedHash);
        return event;
    }

    @Test
    @DisplayName("Cadena vacía retorna estado válido con 0 registros verificados")
    void verifyChain_whenEmpty_returnsValid() {
        when(auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)).thenReturn(List.of());
        when(auditAnchorService.getLatestAnchor(tenantId)).thenReturn(Optional.empty());

        AuditVerificationResult result = verificationService.verifyTenantChain(tenantId);

        assertTrue(result.valid());
        assertEquals(0, result.totalVerified());
        assertNull(result.brokenChainSeq());
        assertNull(result.brokenRecordId());
    }

    @Test
    @DisplayName("Cadena válida con 3 eventos consecutivos pasa la verificación criptográfica")
    void verifyChain_whenValid_returnsValid() throws Exception {
        UUID docId1 = UUID.randomUUID();
        UUID docId2 = UUID.randomUUID();
        UUID docId3 = UUID.randomUUID();

        AuditEvent e1 = createEvent(1L, 1L, GENESIS_HASH, "DOCUMENT_CREATE", "DOCUMENTS", docId1, baseTime, "{\"title\":\"Doc 1\"}");
        AuditEvent e2 = createEvent(2L, 2L, e1.getRecordHash(), "DOCUMENT_UPDATE", "DOCUMENTS", docId2, baseTime.plusMinutes(1), "{\"title\":\"Doc 2\"}");
        AuditEvent e3 = createEvent(3L, 3L, e2.getRecordHash(), "DOCUMENT_ARCHIVE", "DOCUMENTS", docId3, baseTime.plusMinutes(2), "{\"title\":\"Doc 3\"}");

        when(auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)).thenReturn(List.of(e1, e2, e3));
        when(auditAnchorService.getLatestAnchor(tenantId)).thenReturn(Optional.empty());

        AuditVerificationResult result = verificationService.verifyTenantChain(tenantId);

        assertTrue(result.valid());
        assertEquals(3, result.totalVerified());
        assertNull(result.brokenChainSeq());
        assertNull(result.brokenRecordId());
    }

    @Test
    @DisplayName("Criterio de aceptación: Modificar los detalles o acción de una fila vieja detecta y señala el eslabón exacto")
    void verifyChain_whenOldRowTampered_detectsCorruptedLink() throws Exception {
        UUID docId1 = UUID.randomUUID();
        UUID docId2 = UUID.randomUUID();

        AuditEvent e1 = createEvent(10L, 1L, GENESIS_HASH, "DOCUMENT_CREATE", "DOCUMENTS", docId1, baseTime, "{\"title\":\"Contrato original\"}");
        AuditEvent e2 = createEvent(11L, 2L, e1.getRecordHash(), "DOCUMENT_UPDATE", "DOCUMENTS", docId2, baseTime.plusMinutes(1), "{\"title\":\"Anexo\"}");

        // Simular alteración por superusuario directamente en e1 sin recalcular hash
        e1.setDetails("{\"title\":\"Contrato FRAUDULENTO alterado\"}");

        when(auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)).thenReturn(List.of(e1, e2));
        when(auditAnchorService.getLatestAnchor(tenantId)).thenReturn(Optional.empty());

        AuditVerificationResult result = verificationService.verifyTenantChain(tenantId);

        assertFalse(result.valid());
        assertEquals(1L, result.brokenChainSeq());
        assertEquals(10L, result.brokenRecordId());
        assertTrue(result.failureReason().contains("HASH_MISMATCH"));
    }

    @Test
    @DisplayName("Ruptura en previous_hash detecta eslabón desconectado")
    void verifyChain_whenPreviousHashTampered_detectsBrokenLink() throws Exception {
        UUID docId1 = UUID.randomUUID();
        UUID docId2 = UUID.randomUUID();

        AuditEvent e1 = createEvent(10L, 1L, GENESIS_HASH, "DOCUMENT_CREATE", "DOCUMENTS", docId1, baseTime, "{}");
        AuditEvent e2 = createEvent(11L, 2L, e1.getRecordHash(), "DOCUMENT_UPDATE", "DOCUMENTS", docId2, baseTime.plusMinutes(1), "{}");

        // Romper el enlace de e2 alterando previousHash
        e2.setPreviousHash("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

        when(auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)).thenReturn(List.of(e1, e2));
        when(auditAnchorService.getLatestAnchor(tenantId)).thenReturn(Optional.empty());

        AuditVerificationResult result = verificationService.verifyTenantChain(tenantId);

        assertFalse(result.valid());
        assertEquals(2L, result.brokenChainSeq());
        assertEquals(11L, result.brokenRecordId());
        assertTrue(result.failureReason().contains("PREVIOUS_HASH_MISMATCH"));
    }

    @Test
    @DisplayName("Salto en secuencia (registro borrado o eliminado) detecta la brecha")
    void verifyChain_whenSequenceGapped_detectsGaps() throws Exception {
        UUID docId1 = UUID.randomUUID();
        UUID docId3 = UUID.randomUUID();

        AuditEvent e1 = createEvent(10L, 1L, GENESIS_HASH, "DOCUMENT_CREATE", "DOCUMENTS", docId1, baseTime, "{}");
        // Registro seq 2 fue borrado; viene seq 3
        AuditEvent e3 = createEvent(12L, 3L, e1.getRecordHash(), "DOCUMENT_UPDATE", "DOCUMENTS", docId3, baseTime.plusMinutes(2), "{}");

        when(auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)).thenReturn(List.of(e1, e3));
        when(auditAnchorService.getLatestAnchor(tenantId)).thenReturn(Optional.empty());

        AuditVerificationResult result = verificationService.verifyTenantChain(tenantId);

        assertFalse(result.valid());
        assertEquals(3L, result.brokenChainSeq());
        assertTrue(result.failureReason().contains("SEQUENCE_GAP"));
    }

    @Test
    @DisplayName("Ancla externa detecta manipulación si el atacante recalculó toda la cadena en la base de datos")
    void verifyChain_whenDatabaseChainRecalculated_externalAnchorDetectsTampering() throws Exception {
        UUID docId1 = UUID.randomUUID();

        AuditEvent e1 = createEvent(10L, 1L, GENESIS_HASH, "DOCUMENT_CREATE", "DOCUMENTS", docId1, baseTime, "{\"monto\":100}");
        String legitimateOriginalHash = e1.getRecordHash();

        // Ancla externa sellada con el hash original
        AuditAnchor anchor = AuditAnchor.builder()
                .id(1L)
                .tenantId(tenantId)
                .chainSeq(1L)
                .recordHash(legitimateOriginalHash)
                .anchorType("LOCAL_SIGNED")
                .anchorReference("/var/nexodocs/anchors/anchor-seq-1.sig")
                .anchoredAt(baseTime.plusMinutes(5))
                .build();

        // El atacante alteró e1 y recalculó el record_hash en la base de datos
        e1.setDetails("{\"monto\":999999}");
        e1.setRecordHash(verificationService.computeRecordHash(e1)); // nuevo hash recalculado en la base

        when(auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)).thenReturn(List.of(e1));
        when(auditAnchorService.getLatestAnchor(tenantId)).thenReturn(Optional.of(anchor));
        when(auditAnchorService.verifyAnchorIntegrity(anchor)).thenReturn(true);

        AuditVerificationResult result = verificationService.verifyTenantChain(tenantId);

        assertFalse(result.valid());
        assertTrue(result.failureReason().contains("EXTERNAL_ANCHOR_MISMATCH"));
        assertEquals(1L, result.brokenChainSeq());
        assertEquals(legitimateOriginalHash, result.expectedHash());
        assertEquals(e1.getRecordHash(), result.actualHash());
    }
}
