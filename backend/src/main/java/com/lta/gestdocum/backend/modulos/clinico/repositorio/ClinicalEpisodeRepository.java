package com.lta.gestdocum.backend.modulos.clinico.repositorio;

import com.lta.gestdocum.backend.modulos.clinico.modelo.ClinicalEpisode;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface ClinicalEpisodeRepository extends JpaRepository<ClinicalEpisode, UUID> {
    List<ClinicalEpisode> findByTenantIdAndClinicalHistoryIdOrderByStartedAtDesc(
            UUID tenantId, UUID clinicalHistoryId);
}
