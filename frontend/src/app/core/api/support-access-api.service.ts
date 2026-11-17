import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Contratos de SupportAccessDtos y PlatformTeamDtos (backend, 066). */
export type SupportStatus = 'PENDING_TENANT' | 'PENDING_INTERNAL' | 'APPROVED' | 'EXPIRED' | 'REJECTED' | 'REVOKED' | 'CANCELED';

export interface SupportAccessRequest {
  id: string; tenantId: string; tenantName: string; requestedBy: string; reason: string; modules: string[];
  durationMinutes: number; breakGlass: boolean; status: SupportStatus; decidedBy: string | null; decidedAt: string | null;
  decisionNote: string | null; startsAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string;
  approvals: { approver: string; roleCode: string; approvedAt: string }[]; mine: boolean; canStartSession: boolean;
}

export interface SupportModule { code: string; label: string; permissions: string[] }

export interface SupportSession { token: string; expiresAt: string; tenantId: string; tenantName: string; permissions: string[] }

export interface PlatformMember {
  id: string; fullName: string; username: string; email: string; roleCode: string | null; status: string;
  lastLoginAt: string | null; mfaEnabled: boolean; createdAt: string | null;
}

export interface PlatformRole { code: string; name: string; description: string; authorities: string[] }

export interface PlatformTeam { members: PlatformMember[]; roles: PlatformRole[] }

@Injectable({ providedIn: 'root' })
export class SupportAccessApiService {
  private readonly http = inject(HttpClient);
  private readonly platform = '/api/v1/platform/support-access';

  // ------------------------------------------------------------ plataforma
  list(tenantId?: string | null): Observable<SupportAccessRequest[]> {
    const params = tenantId ? new HttpParams().set('tenantId', tenantId) : undefined;
    return this.http.get<SupportAccessRequest[]>(this.platform, { params });
  }

  modules(): Observable<SupportModule[]> { return this.http.get<SupportModule[]>(`${this.platform}/modules`); }

  request(body: { tenantId: string; modules: string[]; durationMinutes: number; breakGlass: boolean; reason: string }): Observable<SupportAccessRequest> {
    return this.http.post<SupportAccessRequest>(this.platform, body);
  }

  approveInternal(id: string, reason: string): Observable<SupportAccessRequest> {
    return this.http.post<SupportAccessRequest>(`${this.platform}/${encodeURIComponent(id)}/approve-internal`, { reason });
  }

  cancel(id: string, reason: string): Observable<SupportAccessRequest> {
    return this.http.post<SupportAccessRequest>(`${this.platform}/${encodeURIComponent(id)}/cancel`, { reason });
  }

  session(id: string): Observable<SupportSession> {
    return this.http.post<SupportSession>(`${this.platform}/${encodeURIComponent(id)}/session`, {});
  }

  // ---------------------------------------------------------------- tenant
  tenantList(): Observable<SupportAccessRequest[]> { return this.http.get<SupportAccessRequest[]>('/api/v1/support-access'); }

  decide(id: string, decision: 'approve' | 'reject' | 'revoke', note: string | null): Observable<SupportAccessRequest[]> {
    return this.http.post<SupportAccessRequest[]>(`/api/v1/support-access/${encodeURIComponent(id)}/${decision}`, { note });
  }

  // ------------------------------------------------------------ equipo
  team(): Observable<PlatformTeam> { return this.http.get<PlatformTeam>('/api/v1/platform/team'); }

  createMember(body: { username: string; email: string; firstName: string; lastName: string; roleCode: string; temporaryPassword: string; reason: string }): Observable<PlatformTeam> {
    return this.http.post<PlatformTeam>('/api/v1/platform/team', body);
  }

  changeRole(id: string, roleCode: string, reason: string): Observable<PlatformTeam> {
    return this.http.put<PlatformTeam>(`/api/v1/platform/team/${encodeURIComponent(id)}/role`, { roleCode, reason });
  }

  changeStatus(id: string, status: 'ACTIVE' | 'INACTIVE', reason: string): Observable<PlatformTeam> {
    return this.http.post<PlatformTeam>(`/api/v1/platform/team/${encodeURIComponent(id)}/status`, { status, reason });
  }

  resetMfa(id: string, reason: string): Observable<PlatformTeam> {
    return this.http.post<PlatformTeam>(`/api/v1/platform/team/${encodeURIComponent(id)}/mfa-reset`, { reason });
  }
}
