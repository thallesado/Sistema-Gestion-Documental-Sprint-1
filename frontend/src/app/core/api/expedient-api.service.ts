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
  name: string;
  description?: string;
  type?: string;
  area?: string;
  responsible?: string;
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
}

function normalizePage(response: unknown): ExpedientPage {
  if (!isRecord(response) || !Array.isArray(response['content']) || !response['content'].every(isApiExpedient)) {
    throw new Error('La API de expedientes devolvió una respuesta no válida.');
  }

  const totalElements = response['totalElements'];
  if (typeof totalElements !== 'number' || !Number.isFinite(totalElements) || totalElements < 0) {
    throw new Error('La API de expedientes devolvió una paginación no válida.');
  }

  return {
    content: response['content'],
    totalElements,
    totalPages: optionalNumber(response['totalPages']),
    number: optionalNumber(response['number']),
    size: optionalNumber(response['size']),
  };
}

function isApiExpedient(value: unknown): value is ApiExpedient {
  if (!isRecord(value)) return false;
  return typeof value['id'] === 'string'
    && typeof value['code'] === 'string'
    && typeof value['name'] === 'string'
    && (typeof value['description'] === 'string' || value['description'] === null)
    && typeof value['status'] === 'string'
    && (typeof value['departmentId'] === 'string' || value['departmentId'] === null)
    && typeof value['createdAt'] === 'string'
    && typeof value['updatedAt'] === 'string'
    && (typeof value['closedAt'] === 'string' || value['closedAt'] === null)
    && (typeof value['archivedAt'] === 'string' || value['archivedAt'] === null);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
