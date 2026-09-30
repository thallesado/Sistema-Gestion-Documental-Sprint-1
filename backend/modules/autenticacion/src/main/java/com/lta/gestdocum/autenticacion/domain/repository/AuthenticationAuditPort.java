package com.lta.gestdocum.autenticacion.domain.repository;

import com.lta.gestdocum.autenticacion.application.dto.AuthResponse;
import jakarta.servlet.http.HttpServletRequest;

public interface AuthenticationAuditPort {
    void recordSuccessfulAuthentication(AuthResponse response, HttpServletRequest request);
}
