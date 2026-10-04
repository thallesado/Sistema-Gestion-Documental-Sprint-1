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
  birthDate: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
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
  birthDate?: string;
  gender?: string;
  phone?: string;
  email?: string;
}

export type MedicalNoteStatus = 'DRAFT' | 'APPROVED' | 'VOIDED';

export interface MedicalNoteItem {
  id: string;
  clinicalHistoryId: string;
  episodeId: string | null;
  authorId: string;
  noteType: string;
  content: string;
  status: MedicalNoteStatus;
  createdAt: string;
}

export interface CreateMedicalNotePayload {
  clinicalHistoryId: string;
  episodeId?: string;
  noteType: string;
  content: string;
  status?: MedicalNoteStatus;
}

/** Resumen de lectura rápida de HU-10, limitado por el tenant del JWT. */
export interface PatientQuickSummary {
  patientId: string;
  patientName: string;
  document: string;
  clinicalHistoryId: string | null;
  historyCode: string | null;
  allergies: { allergen: string; severity?: string | null; reaction?: string | null }[];
  baseDiagnoses: { code?: string | null; description: string; diagnosedAt?: string | null }[];
  recentNotes: { id: string; type: string; content: string; createdAt: string }[];
}

@Injectable({ providedIn: 'root' })
export class ClinicalApiService {
  private readonly http = inject(HttpClient);

  patients(filter = '', page = 0, size = 20): Observable<ApiPage<ApiPatient>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<unknown>(`${API_URL}/patients`, { params }).pipe(
      map((response) => normalizePatientPage(response)),
    );
  }

  patient(id: string): Observable<ApiPatient> {
    return this.http.get<unknown>(`${API_URL}/patients/${id}`).pipe(
      map((response) => normalizePatient(response)),
    );
  }

  quickSummary(id: string): Observable<PatientQuickSummary> {
    return this.http.get<PatientQuickSummary>(`${API_URL}/patients/${id}/quick-summary`);
  }

  /** HU-03: alta de paciente dentro del tenant autenticado. */
  createPatient(payload: CreatePatientPayload): Observable<ApiPatient> {
    return this.http.post<unknown>(`${API_URL}/patients`, payload).pipe(
      map((response) => normalizePatient(response)),
    );
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

  notes(clinicalHistoryId: string, status?: MedicalNoteStatus, page = 0, size = 50): Observable<ApiPage<MedicalNoteItem>> {
    let params = new HttpParams().set('clinicalHistoryId', clinicalHistoryId).set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<ApiPage<MedicalNoteItem>>(`${API_URL}/medical-notes`, { params });
  }

  createNote(payload: CreateMedicalNotePayload): Observable<MedicalNoteItem> {
    return this.http.post<MedicalNoteItem>(`${API_URL}/medical-notes`, payload);
  }

  updateNoteStatus(id: string, status: MedicalNoteStatus): Observable<MedicalNoteItem> {
    return this.http.patch<MedicalNoteItem>(`${API_URL}/medical-notes/${id}/status`, { status });
  }
}

function normalizePatientPage(response: unknown): ApiPage<ApiPatient> {
  if (Array.isArray(response)) {
    const items = response.map(normalizePatient);
    return { content: items, totalElements: items.length };
  }

  if (!isRecord(response) || !Array.isArray(response['content'])) {
    throw new Error('La API clínica devolvió una respuesta de pacientes no válida.');
  }

  const items = (response['content'] as unknown[]).map(normalizePatient);
  const totalElements = typeof response['totalElements'] === 'number' ? response['totalElements'] : items.length;

  return {
    content: items,
    totalElements,
    totalPages: typeof response['totalPages'] === 'number' ? response['totalPages'] : undefined,
    number: typeof response['number'] === 'number' ? response['number'] : undefined,
    size: typeof response['size'] === 'number' ? response['size'] : undefined,
  };
}

function normalizePatient(value: unknown): ApiPatient {
  if (!isRecord(value)) {
    throw new Error('Elemento de paciente no válido');
  }

  return {
    id: String(value['id'] ?? ''),
    documentType: String(value['documentType'] ?? 'CI'),
    documentNumber: String(value['documentNumber'] ?? ''),
    firstName: String(value['firstName'] ?? ''),
    lastName: String(value['lastName'] ?? ''),
    birthDate: normalizeBirthDate(value['birthDate']),
    gender: typeof value['gender'] === 'string' ? value['gender'] : null,
    phone: typeof value['phone'] === 'string' ? value['phone'] : null,
    email: typeof value['email'] === 'string' ? value['email'] : null,
    status: String(value['status'] ?? 'ACTIVE'),
  };
}

function normalizeBirthDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length >= 3) {
    const y = String(value[0]).padStart(4, '0');
    const m = String(value[1]).padStart(2, '0');
    const d = String(value[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
