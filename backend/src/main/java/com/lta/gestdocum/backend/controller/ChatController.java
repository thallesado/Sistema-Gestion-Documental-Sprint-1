package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ChatRequestDTO;
import com.lta.gestdocum.backend.dto.ChatResponseDTO;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.RAGService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class ChatController {

    private final RAGService ragService;
    private final AuthenticatedUserContext authenticatedUserContext;

    public ChatController(RAGService ragService, AuthenticatedUserContext authenticatedUserContext) {
        this.ragService = ragService;
        this.authenticatedUserContext = authenticatedUserContext;
    }

    @PostMapping("/ask")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ChatResponseDTO> chat(@RequestBody ChatRequestDTO request) {
        if (request.getMessage() == null || request.getMessage().trim().isEmpty()) {
            return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new ChatResponseDTO("El mensaje no puede estar vacío", false, "Empty message"));
        }

        try {
            authenticatedUserContext.requireTenantId();
            authenticatedUserContext.requireUserId();

            ChatResponseDTO response = ragService.processQuery(
                request.getMessage(),
                request.isIncludeDocuments()
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(new ChatResponseDTO("Error de autenticación", false, e.getMessage()));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Chat API is running");
    }
}