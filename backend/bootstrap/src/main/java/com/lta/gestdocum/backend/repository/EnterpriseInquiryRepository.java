package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.EnterpriseInquiry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface EnterpriseInquiryRepository extends JpaRepository<EnterpriseInquiry, UUID> { }
