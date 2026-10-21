package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.PasswordRecoveryRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PasswordRecoveryRequestRepository extends JpaRepository<PasswordRecoveryRequest, UUID> {
    Optional<PasswordRecoveryRequest> findByTokenHashAndUsedAtIsNull(String tokenHash);
}
