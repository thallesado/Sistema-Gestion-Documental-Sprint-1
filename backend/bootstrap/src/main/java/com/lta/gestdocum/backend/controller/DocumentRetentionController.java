package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.DocumentRetentionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class DocumentRetentionController {
    private final DocumentRetentionService service;
    public DocumentRetentionController(DocumentRetentionService service){this.service=service;}
    public record Policy(@NotBlank @Size(max=120) String name,@Min(0) @Max(1200) Integer retentionMonths,@NotBlank String action,boolean active,boolean indefinite){}
    public record Assignment(UUID policyId){}
    public record Transfer(@NotNull UUID documentId,@NotBlank String toLevel,@NotBlank @Size(min=10,max=1000) String reason){}
    @GetMapping("/retention-policies") @PreAuthorize("hasAuthority('configuration:read')")
    public List<Map<String,Object>> policies(){return service.policies();}
    @GetMapping("/retention-policies/types") @PreAuthorize("hasAuthority('configuration:read')")
    public List<Map<String,Object>> types(){return service.types();}
    @PostMapping("/retention-policies") @ResponseStatus(org.springframework.http.HttpStatus.CREATED) @PreAuthorize("hasAuthority('configuration:create')")
    public Map<String,Object> create(@Valid @RequestBody Policy p){return service.save(null,p.name(),p.retentionMonths(),p.action(),p.active(),p.indefinite());}
    @PutMapping("/retention-policies/{id}") @PreAuthorize("hasAuthority('configuration:update')")
    public Map<String,Object> update(@PathVariable UUID id,@Valid @RequestBody Policy p){return service.save(id,p.name(),p.retentionMonths(),p.action(),p.active(),p.indefinite());}
    @DeleteMapping("/retention-policies/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @PreAuthorize("hasAuthority('configuration:delete')")
    public void delete(@PathVariable UUID id){service.remove(id);}
    @PutMapping("/retention-policies/types/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @PreAuthorize("hasAuthority('configuration:update')")
    public void assign(@PathVariable UUID id,@RequestBody Assignment a){service.assign(id,a.policyId());}
    @GetMapping("/retention-policies/due") @PreAuthorize("hasAuthority('configuration:read') and hasAuthority('document:read')")
    public List<Map<String,Object>> due(@RequestParam(defaultValue="30") int days){return service.due(days);}
    @GetMapping("/document-transfers/candidates") @PreAuthorize("hasAuthority('configuration:read') and hasAuthority('document:read')")
    public List<Map<String,Object>> candidates(){return service.candidates();}
    @GetMapping("/document-transfers") @PreAuthorize("hasAuthority('document:read')")
    public List<Map<String,Object>> transfers(){return service.transfers();}
    @PostMapping("/document-transfers") @ResponseStatus(org.springframework.http.HttpStatus.CREATED) @PreAuthorize("hasAuthority('document:archive') and hasAuthority('document:read') and hasAuthority('configuration:read')")
    public Map<String,Object> request(@Valid @RequestBody Transfer t){return service.request(t.documentId(),t.toLevel(),t.reason());}
    @PostMapping("/document-transfers/{id}/approve") @PreAuthorize("hasAuthority('document:archive') and hasAuthority('document:read') and hasAuthority('configuration:read')")
    public Map<String,Object> approve(@PathVariable UUID id){return service.advance(id,false);}
    @PostMapping("/document-transfers/{id}/execute") @PreAuthorize("hasAuthority('document:archive') and hasAuthority('document:read') and hasAuthority('configuration:read')")
    public Map<String,Object> execute(@PathVariable UUID id){return service.advance(id,true);}
}
