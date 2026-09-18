package com.lta.gestdocum.backend.controller;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.service.AuditQueryService;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/audit")
public class AuditController {
  private final AuditQueryService service;
  public AuditController(AuditQueryService service){this.service=service;}
  @GetMapping @PreAuthorize("hasAnyAuthority('audit:read_global','audit:read_tenant')")
  public Page<AuditEvent> list(Pageable pageable) {
    return service.list(pageable);
  }
}
