package com.lta.gestdocum.usuarios.domain.repository;

import com.lta.gestdocum.usuarios.domain.model.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {}
