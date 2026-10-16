package com.lta.gestdocum.backend.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record RevenueDashboardResponse(BigDecimal totalRevenueUsd, BigDecimal mrrUsd, BigDecimal arrUsd,
                                       long activeSubscriptions, long trialSubscriptions, BigDecimal conversionRate,
                                       Map<String, BigDecimal> revenueByMethod, Map<String, BigDecimal> revenueByPlan,
                                       List<Map<String, Object>> transactions) { }
