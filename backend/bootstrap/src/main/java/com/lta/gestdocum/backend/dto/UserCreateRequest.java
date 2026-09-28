package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.ClinicalStaff.StaffType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.UUID;
import java.util.Set;

@Data
public class UserCreateRequest {
    private UUID tenantId;
    @NotBlank private String username;
    @Email @NotBlank private String email;
    @NotBlank private String password;
    @NotBlank private String firstName;
    @NotBlank private String lastName;
    
    // Asignación de rol clínico (PHYSICIAN = Doctor, NURSE = Enfermero/a, etc.)
    private StaffType staffType;
    private String specialty;
    private String professionalLicense;
    private Set<Long> roleIds;
}