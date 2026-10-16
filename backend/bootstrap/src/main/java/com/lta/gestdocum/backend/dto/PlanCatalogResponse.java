package com.lta.gestdocum.backend.dto;

import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;

public record PlanCatalogResponse(
        UUID id,
        String code,
        String name,
        String description,
        BigDecimal priceMonthly,
        BigDecimal priceYearly,
        List<PlanLimitResponse> limits,
        List<PlanFeatureResponse> features) { }
