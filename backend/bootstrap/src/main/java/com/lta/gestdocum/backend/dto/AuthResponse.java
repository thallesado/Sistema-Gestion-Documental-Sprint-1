package com.lta.gestdocum.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType = "Bearer";
    private String refreshToken;
    private long expiresIn;
    /** Códigos de permiso efectivos (los mismos que viajan como authorities en el JWT). */
    private List<String> permissions;
}
