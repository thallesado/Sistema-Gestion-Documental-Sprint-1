package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "expedient_types")
@Getter
@NoArgsConstructor
public class ExpedientType {
    @Id
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String code;

    @Column(name = "is_active", nullable = false)
    private boolean active;
}
