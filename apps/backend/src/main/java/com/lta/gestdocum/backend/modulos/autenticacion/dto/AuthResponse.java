package com.lta.gestdocum.backend.modulos.autenticacion.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType = "Bearer";
    private String refreshToken;
    private long expiresIn;
}
