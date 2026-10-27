import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api/v1/platform';

/** Contratos de PlatformPlanDtos (backend): catálogo editable y grupos por defecto. */
export interface PlatformPlanPrice {
  id: string; billingCycle: 'MONTHLY' | 'ANNUAL'; amountUsd: number; stripePriceId: string | null;
  effectiveFrom: string; archivedAt: string | null; tenants: number; pendingMigration: number;
}

export interface PlatformPlan {
  id: string; code: string; name: string; description: string | null; active: boolean; sortOrder: number; tenants: number;
  limits: Record<string, number>; features: { key: string; enabled: boolean; description: string | null }[];
  prices: PlatformPlanPrice[];
}

export interface PlatformMigrationResult { scheduled: number; skipped: { tenantId: string; tenant: string; reason: string }[] }

export interface PlatformRoleTemplate {
  id: string; name: string; description: string | null; permissionCodes: string[]; active: boolean; sortOrder: number;
}

export interface PlatformPermissionOption { code: string; module: string; description: string | null; requiredFeature: string | null }

export interface PlatformRoleTemplateCatalog { templates: PlatformRoleTemplate[]; permissions: PlatformPermissionOption[] }

export interface RoleTemplatePayload {
  name: string; description: string | null; permissionCodes: string[]; active: boolean; sortOrder: number; reason: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformPlansApiService {
  private readonly http = inject(HttpClient);

  plans(): Observable<PlatformPlan[]> {
    return this.http.get<PlatformPlan[]>(`${API_URL}/plans`);
  }

  updatePlan(id: string, body: { name: string; description: string | null; active: boolean; sortOrder: number; reason: string }): Observable<PlatformPlan> {
    return this.http.put<PlatformPlan>(`${API_URL}/plans/${encodeURIComponent(id)}`, body);
  }

  updateLimits(id: string, limits: Record<string, number>, acceptImpact: boolean, reason: string): Observable<PlatformPlan> {
    return this.http.put<PlatformPlan>(`${API_URL}/plans/${encodeURIComponent(id)}/limits`, { limits, acceptImpact, reason });
  }

  updateFeatures(id: string, features: Record<string, boolean>, acceptImpact: boolean, reason: string): Observable<PlatformPlan> {
    return this.http.put<PlatformPlan>(`${API_URL}/plans/${encodeURIComponent(id)}/features`, { features, acceptImpact, reason });
  }

  createPrice(id: string, billingCycle: string, amountUsd: number, reason: string): Observable<PlatformPlan> {
    return this.http.post<PlatformPlan>(`${API_URL}/plans/${encodeURIComponent(id)}/prices`, { billingCycle, amountUsd, reason });
  }

  migrate(priceId: string, reason: string): Observable<PlatformMigrationResult> {
    return this.http.post<PlatformMigrationResult>(`${API_URL}/plans/prices/${encodeURIComponent(priceId)}/migrate`, { reason });
  }

  roleTemplates(): Observable<PlatformRoleTemplateCatalog> {
    return this.http.get<PlatformRoleTemplateCatalog>(`${API_URL}/role-templates`);
  }

  createRoleTemplate(body: RoleTemplatePayload): Observable<PlatformRoleTemplateCatalog> {
    return this.http.post<PlatformRoleTemplateCatalog>(`${API_URL}/role-templates`, body);
  }

  updateRoleTemplate(id: string, body: RoleTemplatePayload): Observable<PlatformRoleTemplateCatalog> {
    return this.http.put<PlatformRoleTemplateCatalog>(`${API_URL}/role-templates/${encodeURIComponent(id)}`, body);
  }

  deleteRoleTemplate(id: string, reason: string): Observable<PlatformRoleTemplateCatalog> {
    return this.http.delete<PlatformRoleTemplateCatalog>(`${API_URL}/role-templates/${encodeURIComponent(id)}`, { params: { reason } });
  }
}
