package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "medical_notes")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MedicalNote {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "clinical_history_id", nullable = false)
    private UUID clinicalHistoryId;

    @Column(name = "episode_id")
    private UUID episodeId;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "note_type", nullable = false, length = 40)
    private String noteType;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
