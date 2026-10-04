package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ClinicalDocumentLinkId implements Serializable {

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;
}
