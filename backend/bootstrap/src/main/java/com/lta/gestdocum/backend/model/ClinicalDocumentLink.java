package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "clinical_document_links")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClinicalDocumentLink {

    @EmbeddedId
    private ClinicalDocumentLinkId id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "clinical_history_id")
    private UUID clinicalHistoryId;

    @Column(name = "episode_id")
    private UUID episodeId;

    @Column(name = "linked_at", nullable = false)
    private OffsetDateTime linkedAt;
}
