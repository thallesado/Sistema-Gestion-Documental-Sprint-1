package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditAnchorRepository;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuditAnchorService {

    private final AuditAnchorRepository anchorRepository;
    private final AuditEventRepository auditEventRepository;
    private final String anchorSecret;

    public AuditAnchorService(
            AuditAnchorRepository anchorRepository,
            AuditEventRepository auditEventRepository,
            @Value("${nexodocs.audit.anchor-secret:nexodocs-tamper-proof-anchor-master-key-2026}") String anchorSecret) {
        this.anchorRepository = anchorRepository;
        this.auditEventRepository = auditEventRepository;
        this.anchorSecret = anchorSecret;
    }

    public Optional<AuditAnchor> getLatestAnchor(UUID tenantId) {
        if (tenantId != null) {
            return anchorRepository.findTopByTenantIdOrderByChainSeqDesc(tenantId);
        } else {
            return anchorRepository.findTopByTenantIdIsNullOrderByChainSeqDesc();
        }
    }

    @Transactional
    public AuditAnchor createAnchor(UUID tenantId, String anchorType, UUID actorId) {
        Optional<AuditEvent> latestEventOpt = tenantId != null
                ? auditEventRepository.findTopByTenantIdOrderByChainSeqDesc(tenantId)
                : auditEventRepository.findTopByTenantIdIsNullOrderByChainSeqDesc();

        if (latestEventOpt.isEmpty()) {
            throw new IllegalStateException("No audit events found to anchor for tenant: " + tenantId);
        }

        AuditEvent latestEvent = latestEventOpt.get();
        OffsetDateTime now = OffsetDateTime.now();
        String type = (anchorType == null || anchorType.isBlank()) ? "LOCAL_SIGNED" : anchorType;
        String reference = "urn:nexodocs:anchor:" + (tenantId != null ? tenantId : "global") + ":" + latestEvent.getChainSeq();

        String signature = computeSignature(
                tenantId,
                latestEvent.getChainSeq(),
                latestEvent.getRecordHash(),
                now
        );

        AuditAnchor anchor = AuditAnchor.builder()
                .tenantId(tenantId)
                .chainSeq(latestEvent.getChainSeq())
                .recordHash(latestEvent.getRecordHash())
                .anchorType(type)
                .anchorReference(reference)
                .signature(signature)
                .metadata(String.format("{\"sealedBy\":\"%s\",\"algorithm\":\"HMAC-SHA256\"}", actorId != null ? actorId : "SYSTEM"))
                .anchoredAt(now)
                .anchoredBy(actorId)
                .build();

        return anchorRepository.save(anchor);
    }

    public boolean verifyAnchorIntegrity(AuditAnchor anchor) {
        if (anchor == null || anchor.getSignature() == null) {
            return false;
        }
        String expectedSignature = computeSignature(
                anchor.getTenantId(),
                anchor.getChainSeq(),
                anchor.getRecordHash(),
                anchor.getAnchoredAt()
        );
        return expectedSignature.equalsIgnoreCase(anchor.getSignature());
    }

    private String computeSignature(UUID tenantId, Long chainSeq, String recordHash, OffsetDateTime timestamp) {
        try {
            String payload = String.join(":",
                    tenantId != null ? tenantId.toString() : "global",
                    String.valueOf(chainSeq),
                    recordHash,
                    String.valueOf(timestamp.toInstant().toEpochMilli())
            );

            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(anchorSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] signedBytes = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(signedBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Error computing HMAC signature for audit anchor", e);
        }
    }
}
