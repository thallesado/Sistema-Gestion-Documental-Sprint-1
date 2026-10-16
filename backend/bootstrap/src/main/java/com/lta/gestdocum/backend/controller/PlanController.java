package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.MySubscriptionResponse;
import com.lta.gestdocum.backend.dto.PlanCatalogResponse;
import com.lta.gestdocum.backend.dto.PlanChangeRequest;
import com.lta.gestdocum.backend.dto.EnterpriseInquiryRequest;
import com.lta.gestdocum.backend.dto.EnterpriseInquiryResponse;
import com.lta.gestdocum.backend.service.PlanEnforcementService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/plans")
@PreAuthorize("isAuthenticated()")
public class PlanController {

    private final PlanEnforcementService planEnforcementService;

    public PlanController(PlanEnforcementService planEnforcementService) {
        this.planEnforcementService = planEnforcementService;
    }

    @GetMapping
    @PreAuthorize("permitAll()")
    public List<PlanCatalogResponse> listPlans() {
        return planEnforcementService.listAvailablePlans();
    }

    @GetMapping("/my-subscription")
    public MySubscriptionResponse mySubscription() {
        return planEnforcementService.getCurrentSubscription();
    }

    @PostMapping("/change")
    public MySubscriptionResponse changePlan(@Valid @RequestBody PlanChangeRequest request) {
        return planEnforcementService.changeCurrentPlan(request);
    }

    @PostMapping("/enterprise-inquiry")
    public EnterpriseInquiryResponse enterpriseInquiry(@Valid @RequestBody EnterpriseInquiryRequest request) {
        return planEnforcementService.submitEnterpriseInquiry(request);
    }
}
