package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.ExpedientType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ExpedientTypeRepository extends JpaRepository<ExpedientType, UUID> {
    Page<ExpedientType> findByTenantIdAndActiveTrueOrderByNameAsc(UUID tenantId, Pageable pageable);
}
