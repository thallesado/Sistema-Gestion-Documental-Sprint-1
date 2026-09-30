import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  dueAt?: string | null;
  area?: string | null;
}

export interface ApiActivity {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  occurredAt: string;
  result: string;
  userId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  private readonly http = inject(HttpClient);

  tasks(page = 0, size = 3): Observable<{ content: ApiTask[]; totalElements: number }> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<{ content: ApiTask[]; totalElements: number }>(`${API_URL}/tasks`, { params });
  }

  recentActivity(page = 0, size = 3): Observable<{ content: ApiActivity[]; totalElements: number }> {
    return this.activity(page, size);
  }

  updateTaskStatus(taskId: string, status: string): Observable<ApiTask> {
    return this.http.patch<ApiTask>(`${API_URL}/tasks/${taskId}/status`, { status });
  }

  activity(page = 0, size = 3): Observable<{ content: ApiActivity[]; totalElements: number }> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'occurredAt,desc');
    return this.http.get<{ content: ApiActivity[]; totalElements: number }>(`${API_URL}/activity`, { params });
  }
}
