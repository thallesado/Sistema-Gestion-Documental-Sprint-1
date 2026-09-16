package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;

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
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        if (user.getDeletedAt() != null || user.getStatus() != User.UserStatus.ACTIVE) {
            throw new InvalidCredentialsException();
        }

        List<String> authorities = userRepository.findAuthorityCodes(user.getId(), user.getTenantId());
        if (authorities.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "El usuario no tiene permisos activos asignados");
        }
        String token = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), authorities);
        return new AuthResponse(token, "Bearer");
    }
}
