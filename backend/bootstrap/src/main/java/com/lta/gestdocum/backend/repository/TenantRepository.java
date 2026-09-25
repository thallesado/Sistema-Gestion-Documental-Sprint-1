package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {}
