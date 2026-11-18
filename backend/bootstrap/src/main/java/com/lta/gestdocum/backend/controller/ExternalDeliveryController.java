package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.ExternalDeliveryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.*;
import org.springframework.core.io.Resource;
import java.util.*;

@RestController
public class ExternalDeliveryController {
    private final ExternalDeliveryService s;
    public ExternalDeliveryController(ExternalDeliveryService s){this.s=s;}
    public record Create(@NotNull UUID documentId,@NotNull UUID versionId,@NotBlank @Size(max=150) String recipientName,@NotBlank @Email @Size(max=254) String recipientEmail,@NotBlank @Size(min=5,max=1000) String reason,@Min(1) @Max(168) int hours,boolean allowDownload){}
    public record Reason(@NotBlank @Size(min=5,max=1000) String reason){}
    public record Access(@NotBlank @Size(max=500) String token,@Size(max=100) String session,@Pattern(regexp="[0-9]{6}") String code,boolean download){}
    @GetMapping("/api/v1/deliveries/options") @PreAuthorize("hasAuthority('document:deliver')")
    public Map<String,Object> options(@RequestParam(required=false) UUID documentId){return s.options(documentId);}
    @GetMapping("/api/v1/deliveries") @PreAuthorize("hasAuthority('delivery:read')")
    public Map<String,Object> list(@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page){return s.list(search,page);}
    @PostMapping("/api/v1/deliveries") @PreAuthorize("hasAuthority('document:deliver')")
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Create b){return ResponseEntity.accepted().body(s.create(b.documentId(),b.versionId(),b.recipientName(),b.recipientEmail(),b.reason(),b.hours(),b.allowDownload()));}
    @GetMapping("/api/v1/deliveries/{id}/events") @PreAuthorize("hasAuthority('delivery:read')")
    public Map<String,Object> events(@PathVariable UUID id){return s.events(id);}
    @PostMapping("/api/v1/deliveries/{id}/revoke") @PreAuthorize("hasAuthority('delivery:revoke')")
    public Map<String,Object> revoke(@PathVariable UUID id,@Valid @RequestBody Reason b){return s.revoke(id,b.reason());}
    @PostMapping("/api/v1/deliveries/{id}/resend") @PreAuthorize("hasAuthority('document:deliver')")
    public ResponseEntity<Map<String,Object>> resend(@PathVariable UUID id){return ResponseEntity.accepted().body(s.resend(id));}
    private ResponseEntity<Map<String,Object>> noCache(Map<String,Object> r){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Referrer-Policy","no-referrer").body(r);}
    @PostMapping("/api/v1/external-deliveries/code") public ResponseEntity<Map<String,Object>> code(@Valid @RequestBody Access b){return noCache(s.requestCode(b.token()));}
    @PostMapping("/api/v1/external-deliveries/verify") public ResponseEntity<Map<String,Object>> verify(@Valid @RequestBody Access b){if(b.code()==null)throw new IllegalArgumentException("Código requerido");return noCache(s.verify(b.token(),b.code()));}
    @PostMapping("/api/v1/external-deliveries/info") public ResponseEntity<Map<String,Object>> info(@Valid @RequestBody Access b){if(b.session()==null)throw new IllegalArgumentException("Sesión requerida");return noCache(s.info(b.token(),b.session()));}
    @PostMapping("/api/v1/external-deliveries/content") public ResponseEntity<Resource> content(@Valid @RequestBody Access b){
        if(b.session()==null)throw new IllegalArgumentException("Sesión requerida");var c=s.content(b.token(),b.session(),b.download());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Referrer-Policy","no-referrer").header("X-Content-Type-Options","nosniff").header("Content-Security-Policy","sandbox")
            .header(HttpHeaders.CONTENT_DISPOSITION,(b.download()?ContentDisposition.attachment():ContentDisposition.inline()).filename(c.filename(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).contentType(MediaType.parseMediaType(c.mime())).body(c.resource());
    }
}
