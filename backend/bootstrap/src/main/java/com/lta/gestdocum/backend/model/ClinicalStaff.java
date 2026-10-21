package com.lta.gestdocum.backend.model;

// ClinicalStaff.java

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "clinical_staff")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClinicalStaff {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "staff_type", nullable = false)
    private StaffType staffType;

    private String specialty;

    @Column(name = "professional_license")
    private String professionalLicense;

    public enum StaffType { PHYSICIAN,NURSE,DIAGNOSTIC_TECH,MEDICAL_AUDITOR,BILLING }
}