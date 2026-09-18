package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "clinical_episodes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClinicalEpisode {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name="tenant_id", nullable=false) private UUID tenantId;
    @Column(name="clinical_history_id", nullable=false) private UUID clinicalHistoryId;
    @Column(nullable=false, length=60) private String code;
    @Column(name="episode_type", nullable=false, length=50) private String episodeType;
    @Column(name="started_at", nullable=false) private OffsetDateTime startedAt;
    @Column(name="ended_at") private OffsetDateTime endedAt;
    @Column(nullable=false, length=20) private String status;
}
