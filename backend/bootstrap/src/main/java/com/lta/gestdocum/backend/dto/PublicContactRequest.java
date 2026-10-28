package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Formulario público «Contáctanos» de la web comercial. */
public record PublicContactRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 150) String email,
        @Size(max = 160) String organization,
        @Size(max = 40) String phone,
        @NotBlank @Pattern(regexp = "VENTAS|SOPORTE|DEMO|ALIANZAS|OTRO") String topic,
        @NotBlank @Size(min = 10, max = 4000) String message) { }
