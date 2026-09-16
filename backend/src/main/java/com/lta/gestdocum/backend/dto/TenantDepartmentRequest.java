package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantDepartmentRequest {

    @Size(max = 120)
    private String name;

    @Size(max = 40)
    private String code;

    @Size(max = 255)
    private String description;

    private Boolean active;
}
