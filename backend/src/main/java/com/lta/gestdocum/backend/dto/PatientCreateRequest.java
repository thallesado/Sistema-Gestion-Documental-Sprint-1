package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDate;

@Data
public class PatientCreateRequest {
    @NotBlank @Size(max = 30)
    private String documentType;
    @NotBlank @Size(max = 40)
    private String documentNumber;
    @NotBlank @Size(max = 100)
    private String firstName;
    @NotBlank @Size(max = 100)
    private String lastName;
    private LocalDate birthDate;
    @Size(max = 30) private String gender;
    @Size(max = 30) private String phone;
    @Size(max = 150) private String email;
    @Size(max = 255) private String address;
}
