package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.MailIntakeService;
import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.*;
import org.springframework.core.io.Resource;
import java.util.*;

@RestController
@RequestMapping("/api/v1/mail-intake")
public class MailIntakeController {
    private final MailIntakeService s;
    public MailIntakeController(MailIntakeService s){this.s=s;}
    public record Connection(@NotBlank @Size(max=150) String name,@NotBlank @Pattern(regexp="[a-zA-Z0-9_-]{1,80}") String profile,@NotBlank @Size(max=150) String folder,@Size(max=254) String sender,@Size(max=150) String subject,boolean enabled,@Min(1) @Max(365) Integer retentionDays){}
    public record Reason(@NotBlank @Size(min=5,max=1000) String reason){}
    public record Accept(UUID documentId,@Valid DocumentCreateRequest document,@NotBlank @Size(min=5,max=1000) String reason,@Size(max=150) String etag){}
    @GetMapping("/connections") @PreAuthorize("hasAuthority('mailbox:manage')") public Map<String,Object> connections(){return s.connections();}
    @PostMapping("/connections") @PreAuthorize("hasAuthority('mailbox:manage')") public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Connection b){return ResponseEntity.status(201).body(save(null,b));}
    @PutMapping("/connections/{id}") @PreAuthorize("hasAuthority('mailbox:manage')") public Map<String,Object> update(@PathVariable UUID id,@Valid @RequestBody Connection b){return save(id,b);}
    private Map<String,Object> save(UUID id,Connection b){return s.save(id,b.name(),b.profile(),b.folder(),b.sender()==null?"":b.sender(),b.subject()==null?"":b.subject(),b.enabled(),b.retentionDays()==null?30:b.retentionDays());}
    @PostMapping("/connections/{id}/test") @PreAuthorize("hasAuthority('mailbox:manage')") public Map<String,Object> test(@PathVariable UUID id){return s.test(id);}
    @PostMapping("/connections/{id}/disconnect") @PreAuthorize("hasAuthority('mailbox:manage')") public Map<String,Object> disconnect(@PathVariable UUID id){return s.disconnect(id);}
    @PostMapping("/connections/{id}/sync") @PreAuthorize("hasAuthority('mailbox:manage')") public ResponseEntity<Map<String,Object>> sync(@PathVariable UUID id){return ResponseEntity.accepted().body(s.sync(id));}
    @GetMapping("/items") @PreAuthorize("hasAuthority('mail-intake:read')") public Map<String,Object> list(@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="0") int page){return s.list(search,status,page);}
    @GetMapping("/items/{id}") @PreAuthorize("hasAuthority('mail-intake:read')") public Map<String,Object> detail(@PathVariable UUID id){return s.detail(id);}
    @GetMapping("/items/{id}/preview") @PreAuthorize("hasAuthority('mail-intake:read')") public ResponseEntity<Resource> preview(@PathVariable UUID id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Content-Security-Policy","sandbox").header("X-Content-Type-Options","nosniff").contentType(MediaType.APPLICATION_OCTET_STREAM).body(s.preview(id));}
    @PostMapping("/items/{id}/accept") @PreAuthorize("hasAuthority('mail-intake:accept')") public Map<String,Object> accept(@PathVariable UUID id,@Valid @RequestBody Accept b){return s.accept(id,b.documentId(),b.document(),b.reason(),b.etag());}
    @PostMapping("/items/{id}/reject") @PreAuthorize("hasAuthority('mail-intake:reject')") public Map<String,Object> reject(@PathVariable UUID id,@Valid @RequestBody Reason b){return s.reject(id,b.reason());}
    @PostMapping("/items/{id}/rescan") @PreAuthorize("hasAuthority('mailbox:manage')") public Map<String,Object> rescan(@PathVariable UUID id){return s.rescan(id);}
    @PostMapping("/items/{id}/reconcile") @PreAuthorize("hasAuthority('mail-intake:accept')") public Map<String,Object> reconcile(@PathVariable UUID id,@Valid @RequestBody Reason b){return s.reconcile(id,b.reason());}
    public record OcrConsent(boolean consent){}
    @PostMapping("/items/{id}/ocr") @PreAuthorize("hasAuthority('ocr:create') and hasAuthority('mail-intake:read')") public Map<String,Object> ocr(@PathVariable UUID id,@RequestBody OcrConsent b){return s.extract(id,b.consent());}

}
