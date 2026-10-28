package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.TenantBackupService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/backups")
public class BackupController {
    private final TenantBackupService service;
    public BackupController(TenantBackupService service){this.service=service;}
    public record Configuration(boolean enabled,@NotBlank @Pattern(regexp="[0-2][0-9]:[0-5][0-9]") String hour,@NotBlank String timezone,@Min(1) @Max(365) int retentionDays){}
    public record Confirmation(@NotBlank String organizationName){}
    @GetMapping public Map<String,Object> list(){return service.overview();}
    @PostMapping public ResponseEntity<Map<String,Object>> create(){return ResponseEntity.accepted().body(service.create());}
    @PutMapping("/settings") public Map<String,Object> settings(@Valid @RequestBody Configuration body){return service.configure(body.enabled(),body.hour(),body.timezone(),body.retentionDays());}
    @GetMapping("/maintenance") public Map<String,Object> maintenance(){return service.maintenance();}
    @PostMapping("/{id}/verify") public Map<String,Object> verify(@PathVariable UUID id){return service.verify(id);}
    @PostMapping("/{id}/restore") public ResponseEntity<Map<String,Object>> restore(@PathVariable UUID id,@Valid @RequestBody Confirmation body){return ResponseEntity.accepted().body(service.restore(id,body.organizationName()));}
    @GetMapping("/{id}/download") public ResponseEntity<Resource> download(@PathVariable UUID id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename("nexodocs-"+id+".zip").build().toString()).contentType(MediaType.parseMediaType("application/zip")).body(new FileSystemResource(service.download(id)));}
    @GetMapping("/{id}/evidence") public Map<String,Object> evidence(@PathVariable UUID id,@RequestParam String table,@RequestParam String rowId){return service.evidence(id,table,rowId);}
}
