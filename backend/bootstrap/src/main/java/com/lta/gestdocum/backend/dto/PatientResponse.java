package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.util.UUID;

@Value
@Builder
public class PatientResponse {
    UUID id;
    String documentType;
    String documentNumber;
    String firstName;
    String lastName;
    LocalDate birthDate;
    String gender;
    String phone;
    String email;
    String status;
}