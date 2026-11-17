package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PublicRadicacionResponse;
import com.lta.gestdocum.backend.service.PublicRadicacionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/public/radicaciones")
@Tag(name = "Consulta Pública de Radicaciones", description = "Consulta ciudadana externa de expedientes y trámites radicados sin autenticación previa")
public class PublicRadicacionController {

    private final PublicRadicacionService service;

    public PublicRadicacionController(PublicRadicacionService service) {
        this.service = service;
    }

    @GetMapping("/{code}")
    @Operation(summary = "Consultar estado público de radicación",
            description = "Permite a un usuario final o ciudadano consultar el avance, estado y sello de tiempo de su solicitud mediante el código formal y el tenant")
    public ResponseEntity<PublicRadicacionResponse> consultar(
            @PathVariable String code,
            @RequestParam UUID tenantId) {
        return ResponseEntity.ok(service.consultarRadicacion(tenantId, code));
    }
}
