package com.lta.gestdocum.backend.modulos.organizaciones.repositorio;

import com.lta.gestdocum.backend.modulos.organizaciones.modelo.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {}
