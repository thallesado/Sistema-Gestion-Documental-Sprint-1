package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AddonDtos.Reason;
import com.lta.gestdocum.backend.dto.DiscountDtos.*;
import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse;
import com.lta.gestdocum.backend.service.PlatformDiscountService;
import com.lta.gestdocum.backend.service.PlatformTenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Cupones, códigos promocionales y descuentos a organizaciones; solo administración global. */
@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformDiscountController {
    private final PlatformDiscountService discounts;
    private final PlatformTenantService tenants;

    public PlatformDiscountController(PlatformDiscountService discounts, PlatformTenantService tenants) {
        this.discounts = discounts;
        this.tenants = tenants;
    }

    @GetMapping("/discounts")
    public DiscountsOverview overview() { return discounts.overview(); }

    @GetMapping("/discounts/redemptions")
    public List<Redemption> redemptions() { return discounts.redemptions(); }

    @GetMapping("/discounts/candidates")
    public List<LoyaltyCandidate> candidates() { return discounts.candidates(); }

    @PreAuthorize("hasAuthority('platform:billing:manage')")
    @PostMapping("/discounts/coupons")
    @ResponseStatus(HttpStatus.CREATED)
    public DiscountsOverview createCoupon(@Valid @RequestBody CouponCreate request) {
        discounts.createCoupon(request);
        return discounts.overview();
    }

    @PreAuthorize("hasAuthority('platform:billing:manage')")
    @PostMapping("/discounts/coupons/{id}/deactivate")
    public DiscountsOverview deactivateCoupon(@PathVariable UUID id, @Valid @RequestBody Reason request) {
        discounts.deactivateCoupon(id, request.reason());
        return discounts.overview();
    }

    @PreAuthorize("hasAuthority('platform:billing:manage')")
    @PostMapping("/discounts/coupons/{id}/promotion-codes")
    @ResponseStatus(HttpStatus.CREATED)
    public DiscountsOverview createPromotionCode(@PathVariable UUID id, @Valid @RequestBody PromotionCodeCreate request) {
        discounts.createPromotionCode(id, request);
        return discounts.overview();
    }

    @PreAuthorize("hasAuthority('platform:billing:manage')")
    @PostMapping("/discounts/promotion-codes/{id}/deactivate")
    public DiscountsOverview deactivatePromotionCode(@PathVariable UUID id, @Valid @RequestBody Reason request) {
        discounts.deactivatePromotionCode(id, request.reason());
        return discounts.overview();
    }

    @PreAuthorize("hasAuthority('platform:discount:apply')")
    @PostMapping("/tenants/{tenantId}/discounts")
    public PlatformTenantOverviewResponse apply(@PathVariable UUID tenantId, @Valid @RequestBody TenantDiscountApply request) {
        discounts.applyToTenant(tenantId, request);
        return tenants.overview(tenantId);
    }

    @PreAuthorize("hasAuthority('platform:discount:apply')")
    @PostMapping("/tenants/{tenantId}/discounts/{discountId}/remove")
    public PlatformTenantOverviewResponse remove(@PathVariable UUID tenantId, @PathVariable UUID discountId,
                                                 @Valid @RequestBody Reason request) {
        discounts.removeFromTenant(tenantId, discountId, request.reason());
        return tenants.overview(tenantId);
    }
}
