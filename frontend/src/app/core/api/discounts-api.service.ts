import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlatformTenantOverview } from './platform-api.service';

/** Contratos de DiscountDtos (backend, 065): cupones, códigos promocionales y descuentos por organización. */
export interface PromotionCodeView {
  id: string; code: string; maxRedemptions: number | null; redemptions: number; expiresAt: string;
  firstTimeOnly: boolean; active: boolean; stripePublished: boolean;
}

export interface CouponView {
  id: string; code: string; name: string; percentOff: number | null; amountOffUsd: number | null; duration: 'ONCE' | 'REPEATING';
  durationInMonths: number | null; planCodes: string[]; redeemBy: string; active: boolean; stripePublished: boolean;
  redemptions: number; activeDiscounts: number; discountedUsd: number; revenueUsd: number; promotionCodes: PromotionCodeView[];
}

export interface DiscountsOverview { maxPercentOff: number; loyaltyMonths: number; coupons: CouponView[] }

export interface DiscountRedemption {
  id: string; tenantId: string; tenantName: string; couponCode: string; promotionCode: string | null;
  source: 'PROMOTION_CODE' | 'LOYALTY' | 'MANUAL'; status: 'ACTIVE' | 'ENDED' | 'REMOVED'; startsAt: string; endsAt: string;
  reason: string | null; approvedBy: string | null; discountedUsd: number;
}

export interface LoyaltyCandidate {
  tenantId: string; tenantName: string; planCode: string; planName: string; billingCycle: string; firstPaymentAt: string;
  monthsActive: number; payments: number; totalPaidUsd: number;
}

export interface CouponCreateBody {
  code: string; name: string; percentOff: number | null; amountOffUsd: number | null; duration: 'ONCE' | 'REPEATING';
  durationInMonths: number | null; planCodes: string[]; redeemBy: string; reason: string;
}

export interface PromotionCodeCreateBody { code: string; maxRedemptions: number | null; expiresAt: string; firstTimeOnly: boolean; reason: string }

@Injectable({ providedIn: 'root' })
export class DiscountsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/platform';

  overview(): Observable<DiscountsOverview> { return this.http.get<DiscountsOverview>(`${this.base}/discounts`); }

  redemptions(): Observable<DiscountRedemption[]> { return this.http.get<DiscountRedemption[]>(`${this.base}/discounts/redemptions`); }

  candidates(): Observable<LoyaltyCandidate[]> { return this.http.get<LoyaltyCandidate[]>(`${this.base}/discounts/candidates`); }

  createCoupon(body: CouponCreateBody): Observable<DiscountsOverview> {
    return this.http.post<DiscountsOverview>(`${this.base}/discounts/coupons`, body);
  }

  deactivateCoupon(id: string, reason: string): Observable<DiscountsOverview> {
    return this.http.post<DiscountsOverview>(`${this.base}/discounts/coupons/${encodeURIComponent(id)}/deactivate`, { reason });
  }

  createPromotionCode(couponId: string, body: PromotionCodeCreateBody): Observable<DiscountsOverview> {
    return this.http.post<DiscountsOverview>(`${this.base}/discounts/coupons/${encodeURIComponent(couponId)}/promotion-codes`, body);
  }

  deactivatePromotionCode(id: string, reason: string): Observable<DiscountsOverview> {
    return this.http.post<DiscountsOverview>(`${this.base}/discounts/promotion-codes/${encodeURIComponent(id)}/deactivate`, { reason });
  }

  applyToTenant(tenantId: string, couponId: string, reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(`${this.base}/tenants/${encodeURIComponent(tenantId)}/discounts`, { couponId, reason });
  }

  removeFromTenant(tenantId: string, discountId: string, reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(
      `${this.base}/tenants/${encodeURIComponent(tenantId)}/discounts/${encodeURIComponent(discountId)}/remove`, { reason });
  }
}
