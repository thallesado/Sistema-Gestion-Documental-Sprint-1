import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiAuditEvent {
  id: number;
  tenantId: string;
  userId: string | null;
  platformActorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  clientTimestamp?: string | null;
  clientTimezone?: string | null;
  result: string;
  ipAddress: string | null;
  userAgent: string | null;
  actor: ApiAuditActor | null;
  details?: Record<string, unknown> | null;
  chainSeq?: number | null;
  previousHash?: string | null;
  recordHash?: string | null;
}

export interface ApiAuditActor {
  userId: string;
  scope: 'TENANT' | 'PLATFORM';
}

export interface AuditEventsFilter {
  action?: string;
  type?: string;
  result?: 'SUCCESS' | 'FAILURE';
  from?: string;
  to?: string;
}

export interface AuditEventsPage {
  content: ApiAuditEvent[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ApiAuditVerificationResult {
  valid: boolean;
  tenantId: string | null;
  totalVerified: number;
  brokenChainSeq: number | null;
  brokenRecordId: number | null;
  failureReason: string | null;
  expectedHash: string | null;
  actualHash: string | null;
  externalAnchorStatus: {
    anchored: boolean;
    anchoredChainSeq: number | null;
    anchoredRecordHash: string | null;
    anchorMatchesChain: boolean;
    anchorType: string | null;
    anchorReference: string | null;
    anchoredAt: string | null;
    /** ANCHORED_MATCH | ANCHOR_MISMATCH | ANCHOR_SIGNATURE_INVALID | NO_EXTERNAL_ANCHOR | UNREACHABLE | UNVERIFIABLE | NOT_CONFIGURED */
    status?: string;
    detail?: string | null;
    externalConfigured?: boolean;
  } | null;
  verifiedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);

  events(filters: AuditEventsFilter = {}, page = 0, size = 10): Observable<AuditEventsPage> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', 'occurredAt,desc');

    for (const [key, value] of Object.entries(filters)) {
      if (value?.trim()) params = params.set(key, value.trim());
    }

    return this.http.get<AuditEventsPage>(`${API_URL}/audit`, { params });
  }

  verifyChain(tenantId?: string): Observable<ApiAuditVerificationResult> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<ApiAuditVerificationResult>(`${API_URL}/audit/verify`, { params });
  }
}
