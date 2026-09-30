package com.lta.gestdocum.usuarios.application.dto;

import com.lta.gestdocum.usuarios.domain.model.StaffType;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Set;
import lombok.Data;

@Data
public class UserUpdateRequest {
    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    @Email
    @NotBlank
    private String email;

    // Campos opcionales para la actualización del perfil clínico
    private StaffType staffType;
    private String specialty;
    private String professionalLicense;
    private String status;
    private Set<Long> roleIds;
}