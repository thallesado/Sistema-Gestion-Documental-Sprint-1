import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiTask {
  id: string;
  documentId?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | number | null;
  dueAt?: string | null;
  area?: string | null;
}

export interface ApiActivity {
  id: string | number;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  occurredAt: string;
  result: string;
  userId?: string | null;
}

export interface ApiDashboardDocument {
  id: string;
  expedientId?: string | null;
  code: string;
  name: string;
  status: string;
  updatedAt: string;
}

export interface DashboardResponse {
  currentUser?: any;
  tasks: ApiTask[];
  recentActivity: ApiActivity[];
  recentDocuments: ApiDashboardDocument[];
  expedients?: any[];
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  private readonly http = inject(HttpClient);

  dashboard(limit = 10): Observable<DashboardResponse> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<DashboardResponse>(`${API_URL}/dashboard`, { params });
  }

  tasks(page = 0, size = 10): Observable<{ content: ApiTask[]; totalElements: number }> {
    return this.dashboard(size).pipe(
      map((res) => ({
        content: res.tasks || [],
        totalElements: (res.tasks || []).length,
      }))
    );
  }

  activity(page = 0, size = 10): Observable<{ content: ApiActivity[]; totalElements: number }> {
    return this.dashboard(size).pipe(
      map((res) => ({
        content: res.recentActivity || [],
        totalElements: (res.recentActivity || []).length,
      }))
    );
  }
}
