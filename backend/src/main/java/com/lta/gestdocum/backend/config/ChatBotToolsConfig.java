package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.dto.DocumentDTO;
import com.lta.gestdocum.backend.service.DocumentSearchService;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.function.FunctionToolCallback;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.function.Function;

@Configuration
public class ChatBotToolsConfig {

    private final DocumentSearchService documentSearchService;

    public ChatBotToolsConfig(DocumentSearchService documentSearchService) {
        this.documentSearchService = documentSearchService;
    }

    @Bean
    public Function<String, String> documentSearch() {
        return query -> {
            List<DocumentDTO> documents = documentSearchService.searchDocumentsByTenant(query, 5);
            return documentSearchService.buildRAGContext(documents);
        };
    }

    @Bean
    public ToolCallback documentSearchTool(Function<String, String> documentSearch) {
        return FunctionToolCallback.builder("documentSearch", documentSearch)
            .description("Busca documentos en la base de datos del tenant autenticado. Retorna un contexto formateado para usar en respuestas del chatbot.")
            .inputType(String.class)
            .build();
    }
}

