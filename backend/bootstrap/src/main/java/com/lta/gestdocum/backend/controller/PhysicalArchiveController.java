package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.PhysicalArchiveService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import java.util.*;
import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/v1/physical-archive")
@PreAuthorize("hasAuthority('physical:read')")
public class PhysicalArchiveController {
    private final PhysicalArchiveService s;
    public PhysicalArchiveController(PhysicalArchiveService s){this.s=s;}
    public record Location(UUID parentId,@NotBlank @Size(max=150) String name,boolean active){}
    public record Item(@NotBlank @Size(max=60) String code,@NotBlank @Size(max=255) String name,@NotNull UUID locationId,@NotNull UUID custodianId,UUID documentId,UUID expedientId,@NotBlank @Size(max=1000) String condition,Integer revision){}
    public record Reassign(@NotNull UUID custodianId,@NotNull @Min(1) Integer revision,@NotBlank @Size(min=5,max=1000) String reason){}
    public record Request(@NotBlank @Size(min=5,max=1000) String reason,@NotNull @Future OffsetDateTime dueAt){}
    public record Action(@Size(max=1000) String reason,UUID locationId,@Size(max=1000) String condition,boolean incident){}
    @GetMapping("/options") public Map<String,Object> options(){return s.options();}
    @PostMapping("/locations") public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Location b){return ResponseEntity.status(201).body(s.location(null,b.parentId(),b.name(),b.active()));}
    @PutMapping("/locations/{id}") public Map<String,Object> update(@PathVariable UUID id,@Valid @RequestBody Location b){return s.location(id,b.parentId(),b.name(),b.active());}
    @DeleteMapping("/locations/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id){s.deleteLocation(id);return ResponseEntity.noContent().build();}
    @GetMapping("/items") public Map<String,Object> list(@RequestParam(defaultValue="") String search,@RequestParam(required=false) String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return s.list(search,status,page,size);}
    @GetMapping("/items/{id}") public Map<String,Object> detail(@PathVariable UUID id){return s.detail(id);}
    @PostMapping("/items") public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Item b){return ResponseEntity.status(201).body(save(null,b));}
    @PutMapping("/items/{id}") public Map<String,Object> update(@PathVariable UUID id,@Valid @RequestBody Item b){return save(id,b);}
    private Map<String,Object> save(UUID id,Item b){return s.saveItem(id,b.code(),b.name(),b.locationId(),b.custodianId(),b.documentId(),b.expedientId(),b.condition(),b.revision());}
    @PostMapping("/items/{id}/requests") public ResponseEntity<Map<String,Object>> request(@PathVariable UUID id,@Valid @RequestBody Request b){return ResponseEntity.status(201).body(s.request(id,b.reason(),b.dueAt()));}
    @PostMapping("/loans/{id}/{action:reserve|reject|cancel|handover|return}") public Map<String,Object> action(@PathVariable UUID id,@PathVariable String action,@Valid @RequestBody Action b){return s.action(id,action,b.reason(),b.locationId(),b.condition(),b.incident());}
    @PostMapping("/items/{id}/custodian") public Map<String,Object> reassign(@PathVariable UUID id,@Valid @RequestBody Reassign b){return s.reassign(id,b.custodianId(),b.revision(),b.reason());}
    @PostMapping("/items/{id}/resolve") public Map<String,Object> resolve(@PathVariable UUID id,@Valid @RequestBody Action b){return s.resolve(id,b.reason(),b.condition());}
    @PostMapping("/items/{id}/withdraw") public Map<String,Object> withdraw(@PathVariable UUID id,@Valid @RequestBody Action b){return s.withdraw(id,b.reason());}
}
