package com.lta.gestdocum.backend.modulos.organizaciones.servicio;

import com.lta.gestdocum.backend.modulos.organizaciones.dto.TenantResponse;
import com.lta.gestdocum.backend.modulos.organizaciones.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.modulos.organizaciones.modelo.Tenant;
import com.lta.gestdocum.backend.modulos.organizaciones.repositorio.TenantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class TenantService {
    private final TenantRepository repository;
    public TenantService(TenantRepository repository) { this.repository = repository; }
    @Transactional(readOnly=true) public List<TenantResponse> list() {
        return repository.findAll().stream().map(this::map).toList();
    }
    @Transactional public TenantResponse create(TenantCreateRequest r) {
        Tenant t = new Tenant(UUID.randomUUID(), r.name(), r.code(), r.slug(), r.email(), Tenant.Status.TRIAL);
        return map(repository.save(t));
    }
    @Transactional public TenantResponse changeStatus(UUID id, String value) {
        Tenant t = repository.findById(id).orElseThrow();
        t.setStatus(Tenant.Status.valueOf(value.toUpperCase()));
        return map(repository.save(t));
    }
    private TenantResponse map(Tenant t) { return new TenantResponse(t.getId(),t.getName(),t.getCode(),t.getSlug(),t.getStatus().name()); }
}
