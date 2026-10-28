import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';

const API_URL = '/api/v1/platform';

/** Contrato de PlatformTenantOverviewResponse (backend): solo datos permitidos del anexo A. */
export interface PlatformUsageItem { used: number; limit: number }

export interface PlatformTenantOverview {
  summary: { id: string; name: string; code: string; slug: string; email: string; phone: string | null; createdAt: string | null; lifecycleState: string };
  administrators: { fullName: string; email: string; status: string; lastLoginAt: string | null }[];
  subscription: {
    status: string; planCode: string | null; planName: string | null; billingCycle: string;
    priceMonthly: number | null; priceYearly: number | null; trialEndsAt: string | null; currentPeriodEnd: string | null;
    stripeManaged: boolean; autoRenew: boolean; scheduledPlanCode: string | null; scheduledBillingCycle: string | null;
    scheduledChangeAt: string | null; canceledAt: string | null; cancellationReason: string | null;
    deletionScheduledAt: string | null; purgedAt: string | null; inGracePeriod: boolean;
  };
  usage: { users: PlatformUsageItem; storageBytes: PlatformUsageItem; documents: PlatformUsageItem; ocrPagesMonth: PlatformUsageItem };
  addons: { id: string; code: string; name: string; resourceKey: string; kind: string; units: number; unitQuantity: number;
    source: 'PURCHASE' | 'MANUAL_PAYMENT' | 'COURTESY'; expiresAt: string | null; remaining: number | null; pendingUnits: number | null }[];
  payments: { id: string; createdAt: string; completedAt: string | null; planName: string; method: string; status: string; billingPeriod: string; amountUsd: number; reference: string }[];
  history: { occurredAt: string; source: 'PLATFORM' | 'LIFECYCLE'; action: string; actor: string | null; reason: string | null }[];
}

export interface PlatformAuditRow {
  id: number; occurredAt: string; actor: string; action: string; tenantId: string | null; tenant: string | null;
  reason: string; before: string | null; after: string | null; ipAddress: string | null;
}

export interface PlatformAuditResult { content: PlatformAuditRow[]; totalElements: number; page: number; size: number; totalPages: number }

export type PlatformAuditFilters = Partial<Record<'dateFrom' | 'dateTo' | 'action' | 'tenantId' | 'actor', string>>;

@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private readonly http = inject(HttpClient);

  tenantOverview(id: string): Observable<PlatformTenantOverview> {
    return this.http.get<PlatformTenantOverview>(`${API_URL}/tenants/${encodeURIComponent(id)}/overview`);
  }

  changeStatus(id: string, status: 'SUSPENDED' | 'ACTIVE', reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(`${API_URL}/tenants/${encodeURIComponent(id)}/status`, { status, reason });
  }

  extendTrial(id: string, days: number, reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(`${API_URL}/tenants/${encodeURIComponent(id)}/trial-extension`, { days, reason });
  }

  changePlan(id: string, planCode: string, acceptOverLimit: boolean, reason: string): Observable<PlatformTenantOverview> {
    return this.http.post<PlatformTenantOverview>(`${API_URL}/tenants/${encodeURIComponent(id)}/plan`, { planCode, acceptOverLimit, reason });
  }

  audit(filters: PlatformAuditFilters, page: number, size: number): Observable<PlatformAuditResult> {
    return this.http.get<PlatformAuditResult>(`${API_URL}/audit`, { params: this.params(filters).set('page', page).set('size', size) });
  }

  auditActions(): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/audit/actions`);
  }

  exportAuditCsv(filters: PlatformAuditFilters): Observable<Blob> {
    return this.http.get(`${API_URL}/audit/export/csv`, { params: this.params(filters), responseType: 'blob' }).pipe(
      // El error llega como Blob: se lee el JSON para mostrar el mensaje del servidor (p. ej. 413).
      catchError((err) => err?.error instanceof Blob
        ? from(err.error.text()).pipe(switchMap((text) => {
            let body: unknown = null;
            try { body = JSON.parse(String(text)); } catch { body = null; }
            return throwError(() => ({ ...err, error: body }));
          }))
        : throwError(() => err)),
    );
  }

  private params(filters: PlatformAuditFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value.trim()) params = params.set(key, value.trim());
    }
    return params;
  }
}
