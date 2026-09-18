import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiUser {
  id: string;
  tenantId: string | null;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  staffType?: string | null;
  specialty?: string | null;
  roleIds?: number[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleIds: number[];
}

export interface UpdateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  status?: string;
  roleIds?: number[];
}
export interface ApiTenant { id: string; name: string; code: string; slug: string; status: string; }
export interface ApiRole { id: number; name: string; description: string | null; system: boolean; }
export interface CreateTenantPayload { name: string; code: string; slug: string; email: string; }

@Injectable({ providedIn: 'root' })
export class AdministrationApiService {
  private readonly http = inject(HttpClient);

  users(filter = '', page = 0, size = 10): Observable<PageResponse<ApiUser>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<PageResponse<ApiUser>>(`${API_URL}/users`, { params });
  }

  roles(): Observable<ApiRole[]> {
    return this.http.get<ApiRole[]>(`${API_URL}/roles`);
  }

  createUser(payload: CreateUserPayload): Observable<ApiUser> {
    return this.http.post<ApiUser>(`${API_URL}/users`, payload);
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<ApiUser> {
    return this.http.put<ApiUser>(`${API_URL}/users/${id}`, payload);
  }

  deactivateUser(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/users/${id}`);
  }

  tenants(): Observable<ApiTenant[]> {
    return this.http.get<ApiTenant[]>(`${API_URL}/tenants`);
  }

  changeTenantStatus(id: string, value: string): Observable<ApiTenant> {
    return this.http.patch<ApiTenant>(`${API_URL}/tenants/${id}/status`, null, { params: { value } });
  }

  createTenant(payload: CreateTenantPayload): Observable<ApiTenant> {
    return this.http.post<ApiTenant>(`${API_URL}/tenants`, payload);
  }
}
