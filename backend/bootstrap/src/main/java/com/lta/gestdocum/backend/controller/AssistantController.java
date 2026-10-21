package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AssistantChatRequest;
import com.lta.gestdocum.backend.dto.AssistantChatResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.AssistantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/assistant")
@Tag(name = "Asistente", description = "Asistente contextual de uso de la aplicación")
@SecurityRequirement(name = "BearerAuth")
public class AssistantController {

    private final AssistantService service;
    private final AuthenticatedUserContext userContext;

    public AssistantController(AssistantService service, AuthenticatedUserContext userContext) {
        this.service = service;
        this.userContext = userContext;
    }

    @PostMapping("/chat")
    @Operation(summary = "Preguntar al asistente contextual")
    public ResponseEntity<AssistantChatResponse> chat(@Valid @RequestBody AssistantChatRequest request) {
        return ResponseEntity.ok(service.chat(userContext.requireUserId(), request));
    }
}
