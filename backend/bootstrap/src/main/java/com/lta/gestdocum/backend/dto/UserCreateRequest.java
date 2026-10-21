package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.ClinicalStaff.StaffType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.UUID;
import java.util.Set;

@Data
public class UserCreateRequest {
    private UUID tenantId;
    @NotBlank @Pattern(regexp = "\\S+", message = "El usuario no puede contener espacios") private String username;
    @Email @NotBlank private String email;
    @NotBlank @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres") private String password;
    @NotBlank private String firstName;
    @NotBlank private String lastName;
    
    // Asignación de rol clínico (PHYSICIAN = Doctor, NURSE = Enfermero/a, etc.)
    private StaffType staffType;
    private String specialty;
    private String professionalLicense;
    private Set<Long> roleIds;
}