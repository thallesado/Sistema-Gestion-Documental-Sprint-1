import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlatformTenantOverview } from './platform-api.service';

/** Contratos de AddonDtos (backend, 064): compra por el tenant y catálogo de la plataforma. */
export type AddonResource = 'maxUsers' | 'maxStorageMB' | 'maxOcrPagesPerMonth';

export interface AddonOffer {
  code: string; name: string; description: string | null; resourceKey: AddonResource; unitQuantity: number;
  kind: 'RECURRING' | 'CONSUMABLE'; validityMonths: number | null; billingCycle: string; price: number; stripeReady: boolean;
}

export interface OwnedAddon {
  id: string; code: string; name: string; resourceKey: AddonResource; kind: 'RECURRING' | 'CONSUMABLE'; units: number;
  unitQuantity: number; status: string; source: 'PURCHASE' | 'MANUAL_PAYMENT' | 'COURTESY'; pendingUnits: number | null;
  pendingAt: string | null; expiresAt: string | null; remaining: number | null; stripeManaged: boolean; coveredByPlan: boolean;
}

export interface AddonsOverview {
  planCode: string; billingCycle: string; canPurchase: boolean; purchaseBlockedReason: string | null; stripeSubscription: boolean;
  offers: AddonOffer[]; owned: OwnedAddon[];
  upgradeSuggestion: { planCode: string; planName: string; addonsMonthlyUsd: number; planDifferenceMonthlyUsd: number } | null;
}

export interface ManualOrder {
  transactionId: string; paymentMethod: string; amountUsd: number; currency: string; externalReference: string;
  expiresAt: string; paymentData: Record<string, unknown>;
}

export interface AddonPurchaseResult {
  mode: 'SUBSCRIPTION_ITEM' | 'CHECKOUT' | 'MANUAL_ORDER'; checkoutUrl: string | null; order: ManualOrder | null;
  overview: AddonsOverview | null;
}

export interface AddonCatalogPrice {
  id: string; billingCycle: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME'; amountUsd: number; stripePriceId: string | null;
  effectiveFrom: string; archivedAt: string | null;
}

export interface AddonCatalogItem {
  id: string; code: string; name: string; description: string | null; resourceKey: AddonResource; unitQuantity: number;
  kind: 'RECURRING' | 'CONSUMABLE'; validityMonths: number | null; planCodes: string[]; active: boolean; sortOrder: number;
  activeTenants: number; prices: AddonCatalogPrice[];
}

@Injectable({ providedIn: 'root' })
export class AddonsApiService {
  private readonly http = inject(HttpClient);

  // ----------------------------------------------------------- tenant
  overview(): Observable<AddonsOverview> {
    return this.http.get<AddonsOverview>('/api/v1/billing/addons');
  }

  purchase(addonCode: string, units: number, paymentMethod: string, cryptoNetwork?: string): Observable<AddonPurchaseResult> {
    return this.http.post<AddonPurchaseResult>('/api/v1/billing/addons/purchase', { addonCode, units, paymentMethod, cryptoNetwork });
  }

  changeUnits(id: string, units: number): Observable<AddonsOverview> {
    return this.http.post<AddonsOverview>(`/api/v1/billing/addons/${encodeURIComponent(id)}/units`, { units });
  }

  confirmCheckout(sessionId: string): Observable<AddonsOverview> {
    return this.http.post<AddonsOverview>(`/api/v1/billing/addons/checkout/${encodeURIComponent(sessionId)}/confirm`, {});
  }

  // -------------------------------------------------------- plataforma
  catalog(): Observable<AddonCatalogItem[]> {
    return this.http.get<AddonCatalogItem[]>('/api/v1/platform/addons');
  }

  create(body: Record<string, unknown>): Observable<AddonCatalogItem> {
    return this.http.post<AddonCatalogItem>('/api/v1/platform/addons', body);
  }

  update(id: string, body: { name: string; description: string | null; planCodes: string[]; active: boolean; sortOrder: number; reason: string }): Observable<AddonCatalogItem> {
    return this.http.put<AddonCatalogItem>(`/api/v1/platform/addons/${encodeURIComponent(id)}`, body);
  }

  createPrice(id: string, billingCycle: string, amountUsd: number, reason: string): Observable<AddonCatalogItem> {
    return this.http.post<AddonCatalogItem>(`/api/v1/platform/addons/${encodeURIComponent(id)}/prices`, { billingCycle, amountUsd, reason });
  }

  grantCourtesy(tenantId: string, addonCode: string, units: number, expiresAt: string, reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(`/api/v1/platform/tenants/${encodeURIComponent(tenantId)}/addons`, { addonCode, units, expiresAt, reason });
  }

  revokeCourtesy(tenantId: string, tenantAddonId: string, reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(
      `/api/v1/platform/tenants/${encodeURIComponent(tenantId)}/addons/${encodeURIComponent(tenantAddonId)}/revoke`, { reason });
  }
}
