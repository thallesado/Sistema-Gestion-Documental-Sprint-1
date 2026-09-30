import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiExpedient {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  archivedAt: string | null;
}

export interface ExpedientPage {
  content: ApiExpedient[];
  totalElements: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export interface CreateExpedientPayload {
  expedientTypeId: string;
  responsibleId?: string;
  departmentId?: string;
  code: string;
  name: string;
  description?: string;
  metadata: Record<string, never>;
}

export interface ApiExpedientType {
  id: string;
  name: string;
  code: string;
}

export interface ApiDepartment {
  id: string;
  name: string;
}

export interface ApiResponsible {
  id: string;
  firstName: string;
  lastName: string;
}

@Injectable({ providedIn: 'root' })
export class ExpedientApiService {
  private readonly http = inject(HttpClient);

  expedients(filter = '', page = 0, size = 100): Observable<ExpedientPage> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<unknown>(`${API_URL}/expedients`, { params }).pipe(
      map((response) => normalizePage(response)),
    );
  }

  create(payload: CreateExpedientPayload): Observable<ApiExpedient> {
    return this.http.post<ApiExpedient>(`${API_URL}/expedients`, payload);
  }

  expedientTypes(): Observable<ApiExpedientType[]> {
    return this.http.get<unknown>(`${API_URL}/expedient-types`, { params: new HttpParams().set('size', 100) }).pipe(
      map((response) => catalogContent(response, isApiExpedientType)),
    );
  }

  departments(): Observable<ApiDepartment[]> {
    return this.http.get<unknown>(`${API_URL}/departments`, { params: new HttpParams().set('active', true).set('size', 100) }).pipe(
      map((response) => catalogContent(response, isApiDepartment)),
    );
  }

  responsibleUsers(): Observable<ApiResponsible[]> {
    return this.http.get<unknown>(`${API_URL}/users/responsible`, { params: new HttpParams().set('size', 100) }).pipe(
      map((response) => catalogContent(response, isApiResponsible)),
    );
  }
}

function normalizePage(response: unknown): ExpedientPage {
  if (Array.isArray(response)) {
    const items = response.map(normalizeExpedient);
    return {
      content: items,
      totalElements: items.length,
    };
  }

  if (!isRecord(response) || !Array.isArray(response['content'])) {
    throw new Error('La API de expedientes devolvió una respuesta no válida.');
  }

  const content = (response['content'] as unknown[]).map(normalizeExpedient);
  const totalElements = typeof response['totalElements'] === 'number' ? response['totalElements'] : content.length;

  return {
    content,
    totalElements,
    totalPages: optionalNumber(response['totalPages']),
    number: optionalNumber(response['number']),
    size: optionalNumber(response['size']),
  };
}

function normalizeExpedient(value: unknown): ApiExpedient {
  if (!isRecord(value)) {
    throw new Error('Elemento de expediente no válido');
  }
  return {
    id: String(value['id'] ?? ''),
    code: String(value['code'] ?? ''),
    name: String(value['name'] ?? ''),
    description: typeof value['description'] === 'string' ? value['description'] : null,
    status: String(value['status'] ?? 'ACTIVE'),
    departmentId: typeof value['departmentId'] === 'string' ? value['departmentId'] : null,
    createdAt: normalizeDate(value['createdAt']),
    updatedAt: normalizeDate(value['updatedAt']),
    closedAt: typeof value['closedAt'] === 'string' ? value['closedAt'] : null,
    archivedAt: typeof value['archivedAt'] === 'string' ? value['archivedAt'] : null,
  };
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Si viene en segundos (epoch timestamp con decimales o timestamp en ms)
    const ms = value < 10000000000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function catalogContent<T>(response: unknown, isItem: (value: unknown) => value is T): T[] {
  if (!isRecord(response) || !Array.isArray(response['content']) || !response['content'].every(isItem)) {
    throw new Error('La API devolvió un catálogo no válido.');
  }
  return response['content'];
}

function isApiExpedientType(value: unknown): value is ApiExpedientType {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string' && typeof value['code'] === 'string';
}

function isApiDepartment(value: unknown): value is ApiDepartment {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

function isApiResponsible(value: unknown): value is ApiResponsible {
  return isRecord(value)
    && typeof value['id'] === 'string'
    && typeof value['firstName'] === 'string'
    && typeof value['lastName'] === 'string';
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
