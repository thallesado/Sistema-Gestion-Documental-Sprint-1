package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PushTokenRequest;
import com.lta.gestdocum.backend.service.PushTokenService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Tokens de avisos push del dispositivo del usuario autenticado. */
@RestController
@RequestMapping("/api/v1/push-tokens")
@PreAuthorize("isAuthenticated()")
public class PushTokenController {

    private final PushTokenService service;

    public PushTokenController(PushTokenService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void register(@Valid @RequestBody PushTokenRequest request) {
        service.register(request.platform(), request.token());
    }

    @DeleteMapping("/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String token) {
        service.delete(token);
    }
}
