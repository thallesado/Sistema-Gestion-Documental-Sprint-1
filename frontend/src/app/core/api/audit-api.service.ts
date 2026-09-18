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
  result: string;
  ipAddress: string | null;
  userAgent: string | null;
  actor: ApiAuditActor | null;
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
}
