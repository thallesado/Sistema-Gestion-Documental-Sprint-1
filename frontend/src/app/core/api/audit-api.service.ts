import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiAuditEvent {
  id: number;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  result: string;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);

  events(page = 0, size = 100): Observable<{ content: ApiAuditEvent[]; totalElements: number }> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'occurredAt,desc');
    return this.http.get<{ content: ApiAuditEvent[]; totalElements: number }>(`${API_URL}/audit`, { params });
  }
}
