package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ChatResponseDTO;
import com.lta.gestdocum.backend.dto.DocumentDTO;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class RAGService {

    private final ChatClient chatClient;
    private final DocumentSearchService documentSearchService;
    private final ToolCallback documentSearchTool;
    private final AuthenticatedUserContext authenticatedUserContext;

    public RAGService(
        ChatClient.Builder builder,
        DocumentSearchService documentSearchService,
        ToolCallback documentSearchTool,
        AuthenticatedUserContext authenticatedUserContext
    ) {
        this.chatClient = builder.build();
        this.documentSearchService = documentSearchService;
        this.documentSearchTool = documentSearchTool;
        this.authenticatedUserContext = authenticatedUserContext;
    }

    public ChatResponseDTO processQuery(String userQuery, boolean includeDocuments) {
        try {
            authenticatedUserContext.requireTenantId();

            List<DocumentDTO> relevantDocuments = new ArrayList<>();

            String systemPrompt = buildSystemPrompt();

            var promptBuilder = chatClient.prompt()
                .system(systemPrompt)
                .user(userQuery);

            if (includeDocuments) {
                promptBuilder = promptBuilder.tools(documentSearchTool);
                relevantDocuments = documentSearchService.searchDocumentsByTenant(userQuery, 5);
            }

            String aiResponse = promptBuilder
                .call()
                .content();

            List<String> suggestedActions = extractSuggestedActions(aiResponse);

            return new ChatResponseDTO(
                aiResponse,
                suggestedActions,
                relevantDocuments,
                true
            );

        } catch (Exception e) {
            return new ChatResponseDTO(
                "Error al procesar tu consulta",
                false,
                e.getMessage()
            );
        }
    }

    private String buildSystemPrompt() {
        return """
            Eres un asistente experto en gestión documental clínica y hospitalaria.
            Tu rol principal es asesorar al personal médico y administrativo sobre:
            - Ciclo de vida de expedientes
            - Digitalización de historias clínicas
            - Cumplimiento de normativas de salud
            - Procesos de aprobación y flujos de trabajo
            - Búsqueda y acceso a documentos

            Responde de manera profesional, técnica y estructurada.
            Si el usuario pregunta sobre temas no relacionados con gestión documental o salud, indícale cortésmente que tu función está restringido a esa área.

            Cuando hables de acciones que el usuario puede realizar, sugiere acciones concretas que pueda tomar en el sistema.
            Si el usuario pregunta sobre documentos específicos, usa la herramienta de búsqueda disponible.
            """;
    }

    private List<String> extractSuggestedActions(String response) {
        List<String> actions = new ArrayList<>();

        if (response.toLowerCase().contains("expediente") || response.toLowerCase().contains("documento")) {
            actions.add("Ver documentos relacionados");
        }

        if (response.toLowerCase().contains("aprobación") || response.toLowerCase().contains("revisar")) {
            actions.add("Iniciar proceso de aprobación");
        }

        if (response.toLowerCase().contains("plantilla") || response.toLowerCase().contains("formato")) {
            actions.add("Usar plantilla sugerida");
        }

        if (response.toLowerCase().contains("workflow") || response.toLowerCase().contains("proceso")) {
            actions.add("Ver flujo del proceso");
        }

        return actions;
    }
}
