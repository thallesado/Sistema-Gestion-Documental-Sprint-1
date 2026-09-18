package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity @Table(name="tenants")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Tenant {
    @Id private UUID id;
    private String name;
    private String code;
    private String slug;
    private String email;
    @Enumerated(EnumType.STRING) @Column(name="subscription_status")
    private Status status;
    public enum Status { TRIAL, ACTIVE, SUSPENDED, CANCELED }
}
