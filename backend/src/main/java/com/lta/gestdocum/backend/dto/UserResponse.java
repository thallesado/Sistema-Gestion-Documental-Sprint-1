package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class UserResponse {
    private UUID id;
    private UUID tenantId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String status;
    private String tenantName;
    private boolean platformAdmin;
    private String staffType;
    private String specialty;
    private java.util.Set<Long> roleIds;
    private java.util.Set<String> roleNames;
}
