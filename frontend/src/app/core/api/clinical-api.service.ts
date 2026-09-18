import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiPatient {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  phone: string;
  email: string;
  status: string;
}

export interface ApiPage<T> {
  content: T[];
  totalElements: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export interface ClinicalHistory {
  id: string;
  code: string;
  patientId: string;
  patientLabel: string;
  bloodType: string | null;
  pathologicalAntecedents: string | null;
  nonPathologicalAntecedents: string | null;
  familyAntecedents: string | null;
  allergies: { allergen: string; severity?: string; reaction?: string }[];
  chronicConditions: string | null;
  currentMedications: { name: string; dose?: string; frequency?: string }[];
  baseDiagnoses: { code?: string; description: string; diagnosedAt?: string }[];
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TimelineEvent {
  occurredAt: string;
  eventType: string;
  code: string | null;
  status: string | null;
  referenceId: string | null;
  description: string | null;
}

export interface ClinicalHistoryPayload {
  patientId: string;
  bloodType?: string;
  pathologicalAntecedents?: string;
  nonPathologicalAntecedents?: string;
  familyAntecedents?: string;
  allergies: { allergen: string; severity: string; reaction: string }[];
  chronicConditions?: string;
  currentMedications: { name: string; dose: string; frequency: string }[];
  baseDiagnoses: { code: string; description: string; diagnosedAt: string }[];
  observations?: string;
}

export interface CreatePatientPayload {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  phone?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicalApiService {
  private readonly http = inject(HttpClient);

  patients(filter = '', page = 0, size = 20): Observable<ApiPage<ApiPatient>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<unknown>(`${API_URL}/patients`, { params }).pipe(
      map((response) => normalizePage<ApiPatient>(response, isApiPatient)),
    );
  }

  patient(id: string): Observable<ApiPatient> {
    return this.http.get<ApiPatient>(`${API_URL}/patients/${id}`);
  }

  /** HU-03: alta de paciente dentro del tenant autenticado. */
  createPatient(payload: CreatePatientPayload): Observable<ApiPatient> {
    return this.http.post<ApiPatient>(`${API_URL}/patients`, payload);
  }

  histories(patientId: string): Observable<{ content: ClinicalHistory[]; totalElements: number }> {
    const params = new HttpParams().set('patientId', patientId).set('page', 0).set('size', 20);
    return this.http.get<{ content: ClinicalHistory[]; totalElements: number }>(`${API_URL}/clinical-histories`, { params });
  }

  createHistory(payload: ClinicalHistoryPayload): Observable<ClinicalHistory> {
    return this.http.post<ClinicalHistory>(`${API_URL}/clinical-histories`, payload);
  }

  updateHistory(id: string, payload: ClinicalHistoryPayload): Observable<ClinicalHistory> {
    return this.http.put<ClinicalHistory>(`${API_URL}/clinical-histories/${id}`, payload);
  }

  timeline(historyId: string): Observable<TimelineEvent[]> {
    return this.http.get<TimelineEvent[]>(`${API_URL}/clinical-histories/${historyId}/timeline`);
  }
}

function normalizePage<T>(response: unknown, isItem: (value: unknown) => value is T): ApiPage<T> {
  if (Array.isArray(response) && response.every(isItem)) {
    return { content: response, totalElements: response.length };
  }

  if (!isRecord(response) || !Array.isArray(response['content']) || !response['content'].every(isItem)) {
    throw new Error('La API clínica devolvió una respuesta de pacientes no válida.');
  }

  const totalElements = response['totalElements'];
  if (typeof totalElements !== 'number' || !Number.isFinite(totalElements) || totalElements < 0) {
    throw new Error('La API clínica devolvió una paginación no válida.');
  }

  return {
    content: response['content'],
    totalElements,
    totalPages: typeof response['totalPages'] === 'number' ? response['totalPages'] : undefined,
    number: typeof response['number'] === 'number' ? response['number'] : undefined,
    size: typeof response['size'] === 'number' ? response['size'] : undefined,
  };
}

function isApiPatient(value: unknown): value is ApiPatient {
  if (!isRecord(value)) return false;
  return typeof value['id'] === 'string'
    && typeof value['documentType'] === 'string'
    && typeof value['documentNumber'] === 'string'
    && typeof value['firstName'] === 'string'
    && typeof value['lastName'] === 'string'
    && (typeof value['birthDate'] === 'string' || value['birthDate'] === null)
    && typeof value['gender'] === 'string'
    && (typeof value['phone'] === 'string' || value['phone'] === null)
    && (typeof value['email'] === 'string' || value['email'] === null)
    && typeof value['status'] === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
