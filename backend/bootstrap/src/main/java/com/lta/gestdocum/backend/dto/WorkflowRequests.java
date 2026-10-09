package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import java.util.*;
import java.time.OffsetDateTime;

public final class WorkflowRequests {
    private WorkflowRequests() {}
    public record Node(@NotBlank String key, @NotBlank @Size(max=150) String name,
                       @NotBlank String type, String assignmentType, String assignmentReference,
                       @Min(0) @Max(3650) Integer dueDays, Map<String,Object> rules) {}
    public record Edge(@NotBlank String from, @NotBlank String to, String outcome, String label) {}
    public record Template(@NotBlank @Size(max=150) String name, @Size(max=4000) String description,
                           @NotBlank @Size(max=100) String category, @NotBlank String originType,
                           boolean active, @NotEmpty @Size(max=50) List<@Valid Node> nodes,
                           @NotEmpty @Size(max=100) List<@Valid Edge> edges,
                           Map<String,String> documentStatusRules, String publicationStatus) {
        public Template(String name,String description,String category,String originType,boolean active,
                        List<Node> nodes,List<Edge> edges) {
            this(name,description,category,originType,active,nodes,edges,Map.of(),null);
        }
        public Template(String name,String description,String category,String originType,boolean active,
                        List<Node> nodes,List<Edge> edges,Map<String,String> documentStatusRules) {
            this(name,description,category,originType,active,nodes,edges,documentStatusRules,null);
        }
    }
    public record Start(@NotNull UUID templateId, @NotBlank @Size(max=255) String title,
                        @Size(max=4000) String description, UUID documentId, UUID expedientId,
                        UUID departmentId, @Min(1) @Max(4) int priority, OffsetDateTime dueAt,
                        Map<String,UUID> assignments) {}
    public record TemplateStart(@NotBlank @Size(max=255) String title,
                        @Size(max=4000) String description, UUID documentId, UUID expedientId,
                        UUID departmentId, @Min(1) @Max(4) int priority, OffsetDateTime dueAt,
                        Map<String,UUID> assignments) {}
    public record Action(@NotBlank String action, @Size(max=4000) String comment,
                         UUID targetUserId, UUID returnStageId, Map<String,Boolean> checklist) {}
    public record Lifecycle(@NotBlank String action, @Size(max=4000) String comment) {}
    public record Comment(@NotBlank @Size(max=4000) String comment) {}
    public record Hierarchy(@Min(0) @Max(99) int rank) {}
    public record Edit(@NotBlank @Size(max=255) String title,@Size(max=4000) String description,
                       @Min(1) @Max(4) int priority,OffsetDateTime dueAt) {}
}
