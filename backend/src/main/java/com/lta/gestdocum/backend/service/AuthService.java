package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse login(AuthRequest request) {
        if (request.getTenantId() == null) {
            throw new IllegalArgumentException("El tenant es obligatorio");
        }

        User user = userRepository.findByTenantAndIdentifier(request.getTenantId(), request.getUsernameOrEmail())
                .orElseThrow(() -> new RuntimeException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Credenciales inválidas");
        }

        if (user.getDeletedAt() != null || user.getStatus() != User.UserStatus.ACTIVE) {
            throw new RuntimeException("Usuario inactivo o dado de baja");
        }

        String token = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), "USER");
        return new AuthResponse(token, "Bearer");
    }
}
