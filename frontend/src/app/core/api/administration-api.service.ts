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

/** Personalización de un usuario (GET/PUT /users/{id}/customization, permiso user:customize). */
export interface UserCustomizationPayload {
  jobTitle: string | null;
  phone: string | null;
  biography: string | null;
  language: 'es' | 'en' | 'fr' | 'zh' | null;
  landingPage: string | null;
  emailNotifications: boolean;
  pushNotifications: boolean;
  mustChangePassword: boolean;
  /** Fecha ISO (yyyy-MM-dd) hasta la que el usuario puede iniciar sesión, inclusive. */
  accessExpiresOn: string | null;
  /** Días ISO: 1 = lunes ... 7 = domingo. Vacío = todos. */
  accessWeekdays: number[];
  /** Hora HH:mm en la zona horaria del tenant; ambas o ninguna. */
  accessStartTime: string | null;
  accessEndTime: string | null;
  maxUploadMb: number | null;
  storageQuotaMb: number | null;
  /** Vacío = todos los tipos documentales. */
  allowedDocumentTypeIds: string[];
}

export interface ApiUserCustomization extends UserCustomizationPayload {
  userId: string;
  username: string;
  fullName: string;
  storageUsedBytes: number;
  timezone: string;
  hasActiveSession: boolean;
  /** true si el usuario personalizado es quien está autenticado. */
  self: boolean;
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
export interface ApiRole { id: number; name: string; description: string | null; system: boolean; permissionCount: number; userCount: number; active?: boolean; }
export interface CreateRolePayload { name: string; description: string; permissionIds: number[]; }
export interface CreateTenantPayload {
  name: string;
  code: string;
  slug: string;
  email: string;
  planId?: string;
  adminEmail?: string;
  adminName?: string;
}

export interface ApiPermission {
  id: number;
  code: string;
  module: string;
  action: string;
  description: string | null;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ApiRolePermissionItem {
  id: number;
  code: string;
  description: string | null;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH';
  granted: boolean;
}

export interface ApiRolePermissionGroup {
  module: string;
  permissions: ApiRolePermissionItem[];
}

export interface ApiRolePermissions {
  roleId: number;
  roleName: string;
  modules: ApiRolePermissionGroup[];
}

@Injectable({ providedIn: 'root' })
export class AdministrationApiService {
  private readonly http = inject(HttpClient);

  users(filter = '', page = 0, size = 10): Observable<PageResponse<ApiUser>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<PageResponse<ApiUser>>(`${API_URL}/users`, { params });
  }

  responsibleUsers(filter = '', page = 0, size = 10): Observable<PageResponse<ApiUser>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<PageResponse<ApiUser>>(`${API_URL}/users/responsible`, { params });
  }

  roles(includeInactive = false): Observable<ApiRole[]> {
    return this.http.get<ApiRole[]>(`${API_URL}/roles`, { params: { includeInactive } });
  }

  createRole(payload: CreateRolePayload): Observable<ApiRole> {
    return this.http.post<ApiRole>(`${API_URL}/roles`, payload);
  }

  updateRole(id: number, payload: CreateRolePayload): Observable<ApiRole> {
    return this.http.put<ApiRole>(`${API_URL}/roles/${id}`, payload);
  }

  setRoleStatus(id: number, isActive: boolean): Observable<ApiRole> {
    return this.http.patch<ApiRole>(`${API_URL}/roles/${id}/status`, { isActive });
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/roles/${id}`);
  }

  rolePermissions(roleId: number): Observable<ApiRolePermissions> {
    return this.http.get<ApiRolePermissions>(`${API_URL}/roles/${roleId}/permissions`);
  }

  updateRolePermissions(roleId: number, permissionIds: number[]): Observable<ApiRolePermissions> {
    return this.http.put<ApiRolePermissions>(`${API_URL}/roles/${roleId}/permissions`, { permissionIds });
  }

  permissions(): Observable<ApiPermission[]> {
    return this.http.get<ApiPermission[]>(`${API_URL}/permissions`);
  }

  permissionDetail(id: number): Observable<ApiPermission> {
    return this.http.get<ApiPermission>(`${API_URL}/permissions/${id}`);
  }

  createUser(payload: CreateUserPayload): Observable<ApiUser> {
    return this.http.post<ApiUser>(`${API_URL}/users`, payload);
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<ApiUser> {
    return this.http.put<ApiUser>(`${API_URL}/users/${id}`, payload);
  }

  userCustomization(id: string): Observable<ApiUserCustomization> {
    return this.http.get<ApiUserCustomization>(`${API_URL}/users/${id}/customization`);
  }

  updateUserCustomization(id: string, payload: UserCustomizationPayload): Observable<ApiUserCustomization> {
    return this.http.put<ApiUserCustomization>(`${API_URL}/users/${id}/customization`, payload);
  }

  revokeUserSessions(id: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/users/${id}/sessions/revoke`, null);
  }

  deactivateUser(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/users/${id}`);
  }

  tenants(): Observable<ApiTenant[]> {
    return this.http.get<ApiTenant[]>(`${API_URL}/tenants`);
  }

  /** Suspender o reactivar exige motivo (auditoría de plataforma, migración 062). */
  changeTenantStatus(id: string, value: string, reason: string): Observable<ApiTenant> {
    return this.http.patch<ApiTenant>(`${API_URL}/tenants/${id}/status`, null, { params: { value, reason } });
  }

  createTenant(payload: CreateTenantPayload, reason: string): Observable<ApiTenant> {
    return this.http.post<ApiTenant>(`${API_URL}/tenants`, payload, { params: { reason } });
  }
}
