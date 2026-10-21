package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditVerificationResult;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuditVerificationService {

    public static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    private final AuditEventRepository auditEventRepository;
    private final AuditAnchorService auditAnchorService;

    public AuditVerificationService(AuditEventRepository auditEventRepository, AuditAnchorService auditAnchorService) {
        this.auditEventRepository = auditEventRepository;
        this.auditAnchorService = auditAnchorService;
    }

    public String computeCanonicalPayload(AuditEvent event) {
        String occurredAtEpochMs = event.getOccurredAt() == null
                ? "0"
                : String.valueOf(event.getOccurredAt().toInstant().toEpochMilli());

        String ip = postgresHost(event.getIpAddress());
        String details = (event.getDetails() == null || event.getDetails().isBlank()) ? "{}" : event.getDetails();

        return String.join("|",
                event.getChainSeq() == null ? "0" : event.getChainSeq().toString(),
                event.getPreviousHash() == null ? "" : event.getPreviousHash().trim(),
                event.getTenantId() == null ? "" : event.getTenantId().toString(),
                event.getUserId() == null ? "" : event.getUserId().toString(),
                event.getAction() == null ? "" : event.getAction(),
                event.getEntityType() == null ? "" : event.getEntityType(),
                event.getEntityId() == null ? "" : event.getEntityId().toString(),
                occurredAtEpochMs,
                event.getResult() == null ? "SUCCESS" : event.getResult(),
                ip,
                details
        );
    }

    /**
     * Formats the IP exactly like PostgreSQL {@code host(inet)}, which the chain trigger hashes:
     * IPv6 in lowercase with the first longest run (two or more) of zero groups compressed to "::".
     * {@link InetAddress#getHostAddress()} never compresses, so "::1" would not match.
     */
    static String postgresHost(InetAddress address) {
        if (address == null) {
            return "";
        }
        if (!(address instanceof java.net.Inet6Address)) {
            return address.getHostAddress();
        }
        byte[] bytes = address.getAddress();
        int[] groups = new int[8];
        for (int i = 0; i < 8; i++) {
            groups[i] = ((bytes[2 * i] & 0xff) << 8) | (bytes[2 * i + 1] & 0xff);
        }
        int bestStart = -1;
        int bestLength = 0;
        for (int i = 0; i < 8; ) {
            if (groups[i] != 0) {
                i++;
                continue;
            }
            int start = i;
            while (i < 8 && groups[i] == 0) {
                i++;
            }
            if (i - start > bestLength) {
                bestStart = start;
                bestLength = i - start;
            }
        }
        if (bestLength < 2) {
            bestStart = -1;
        }
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            if (i == bestStart) {
                out.append("::");
                i += bestLength - 1;
                continue;
            }
            if (out.length() > 0 && out.charAt(out.length() - 1) != ':') {
                out.append(':');
            }
            out.append(Integer.toHexString(groups[i]));
        }
        return out.toString();
    }

    public String computeRecordHash(AuditEvent event) {
        try {
            String canonical = computeCanonicalPayload(event);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    @Transactional(readOnly = true)
    public AuditVerificationResult verifyTenantChain(UUID tenantId) {
        List<AuditEvent> events = tenantId != null
                ? auditEventRepository.findByTenantIdOrderByChainSeqAsc(tenantId)
                : auditEventRepository.findByTenantIdIsNullOrderByChainSeqAsc();

        Optional<AuditAnchor> latestAnchorOpt = auditAnchorService.getLatestAnchor(tenantId);
        OffsetDateTime now = OffsetDateTime.now();

        if (events.isEmpty()) {
            AuditVerificationResult.ExternalAnchorStatus anchorStatus = latestAnchorOpt.map(a ->
                    new AuditVerificationResult.ExternalAnchorStatus(
                            true, a.getChainSeq(), a.getRecordHash(), false, a.getAnchorType(), a.getAnchorReference(), a.getAnchoredAt()
                    )
            ).orElse(new AuditVerificationResult.ExternalAnchorStatus(
                    false, null, null, false, null, null, null
            ));

            return new AuditVerificationResult(
                    true, tenantId, 0, null, null, null, null, null, anchorStatus, now
            );
        }

        long expectedSeq = 1;
        String expectedPrevHash = GENESIS_HASH;
        AuditEvent matchedAnchorEvent = null;

        for (int i = 0; i < events.size(); i++) {
            AuditEvent event = events.get(i);

            // 1. Verificación de secuencia
            if (event.getChainSeq() == null || event.getChainSeq() != expectedSeq) {
                return new AuditVerificationResult(
                        false, tenantId, i, event.getChainSeq(), event.getId(),
                        "SEQUENCE_GAP: Se esperaba secuencia " + expectedSeq + " pero se encontró " + event.getChainSeq(),
                        String.valueOf(expectedSeq),
                        event.getChainSeq() == null ? "null" : event.getChainSeq().toString(),
                        null, now
                );
            }

            // 2. Verificación de previous_hash
            String actualPrevHash = event.getPreviousHash() == null ? "" : event.getPreviousHash().trim();
            if (!expectedPrevHash.equalsIgnoreCase(actualPrevHash)) {
                return new AuditVerificationResult(
                        false, tenantId, i, event.getChainSeq(), event.getId(),
                        "PREVIOUS_HASH_MISMATCH: previous_hash no coincide con el eslabón anterior",
                        expectedPrevHash,
                        actualPrevHash,
                        null, now
                );
            }

            // 3. Verificación de integridad de contenido (record_hash)
            String computedHash = computeRecordHash(event);
            String actualRecordHash = event.getRecordHash() == null ? "" : event.getRecordHash().trim();
            if (!computedHash.equalsIgnoreCase(actualRecordHash)) {
                return new AuditVerificationResult(
                        false, tenantId, i, event.getChainSeq(), event.getId(),
                        "HASH_MISMATCH: El contenido del registro ha sido alterado, el hash canónico no coincide",
                        computedHash,
                        actualRecordHash,
                        null, now
                );
            }

            if (latestAnchorOpt.isPresent() && Objects.equals(event.getChainSeq(), latestAnchorOpt.get().getChainSeq())) {
                matchedAnchorEvent = event;
            }

            expectedPrevHash = actualRecordHash;
            expectedSeq++;
        }

        // 4. Verificación de anclaje externo si existe
        AuditVerificationResult.ExternalAnchorStatus anchorStatus;
        if (latestAnchorOpt.isPresent()) {
            AuditAnchor anchor = latestAnchorOpt.get();
            boolean signatureValid = auditAnchorService.verifyAnchorIntegrity(anchor);

            if (!signatureValid) {
                anchorStatus = new AuditVerificationResult.ExternalAnchorStatus(
                        true, anchor.getChainSeq(), anchor.getRecordHash(), false, anchor.getAnchorType(), anchor.getAnchorReference(), anchor.getAnchoredAt()
                );
                return new AuditVerificationResult(
                        false, tenantId, events.size(), anchor.getChainSeq(), null,
                        "EXTERNAL_ANCHOR_TAMPERED: La firma criptográfica del ancla externa es inválida",
                        "VALID_SIGNATURE", "INVALID_SIGNATURE", anchorStatus, now
                );
            }

            if (matchedAnchorEvent == null) {
                anchorStatus = new AuditVerificationResult.ExternalAnchorStatus(
                        true, anchor.getChainSeq(), anchor.getRecordHash(), false, anchor.getAnchorType(), anchor.getAnchorReference(), anchor.getAnchoredAt()
                );
                return new AuditVerificationResult(
                        false, tenantId, events.size(), anchor.getChainSeq(), null,
                        "EXTERNAL_ANCHOR_MISMATCH: El eslabón anclado seq=" + anchor.getChainSeq() + " no existe en la base de datos",
                        anchor.getRecordHash(), "NOT_FOUND", anchorStatus, now
                );
            }

            String currentHashAtAnchor = matchedAnchorEvent.getRecordHash() == null ? "" : matchedAnchorEvent.getRecordHash().trim();
            String anchoredHash = anchor.getRecordHash().trim();

            if (!anchoredHash.equalsIgnoreCase(currentHashAtAnchor)) {
                anchorStatus = new AuditVerificationResult.ExternalAnchorStatus(
                        true, anchor.getChainSeq(), anchor.getRecordHash(), false, anchor.getAnchorType(), anchor.getAnchorReference(), anchor.getAnchoredAt()
                );
                return new AuditVerificationResult(
                        false, tenantId, events.size(), anchor.getChainSeq(), matchedAnchorEvent.getId(),
                        "EXTERNAL_ANCHOR_MISMATCH: La cadena de la base de datos fue recalculada fraudulentamente; difiere del ancla externa inalterable",
                        anchoredHash, currentHashAtAnchor, anchorStatus, now
                );
            }

            anchorStatus = new AuditVerificationResult.ExternalAnchorStatus(
                    true, anchor.getChainSeq(), anchor.getRecordHash(), true, anchor.getAnchorType(), anchor.getAnchorReference(), anchor.getAnchoredAt()
            );
        } else {
            anchorStatus = new AuditVerificationResult.ExternalAnchorStatus(
                    false, null, null, false, null, null, null
            );
        }

        return new AuditVerificationResult(
                true, tenantId, events.size(), null, null, null, null, null, anchorStatus, now
        );
    }
}
