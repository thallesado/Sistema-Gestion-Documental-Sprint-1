import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

const API_URL = '/api/v1';

export interface ApiDocumentType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  categoryId?: string | null;
}

export interface DocumentTypePage {
  content: ApiDocumentType[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ApiDocumentCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
}

export interface ApiDepartment {
  id: string;
  code: string;
  name: string;
}

export interface ApiDocument {
  id: string;
  documentTypeId: string;
  expedientId?: string | null;
  authorId?: string | null;
  responsibleId?: string | null;
  departmentId?: string | null;
  patientId?: string | null;
  specialty?: string | null;
  institutionalProcess?: string | null;
  metadata?: Record<string, any>;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  currentVersion: number;
  issueDate?: string | null;
  expiryDate?: string | null;
  externalSource?: boolean;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
  documentTypeName?: string | null;
  documentTypeCode?: string | null;
  categoryName?: string | null;
  departmentName?: string | null;
  authorName?: string | null;
  responsibleName?: string | null;
  patientName?: string | null;
  expedientCode?: string | null;

  // Campos de compatibilidad con filtros previos
  category?: string | null;
  responsibleUserId?: string | null;
  responsibleUserName?: string | null;
  creatorId?: string | null;
  creatorName?: string | null;
  area?: string | null;
  effectiveDate?: string | null;
  version?: number | null;
}

export interface MedicalNote {
  id: string;
  clinicalHistoryId: string;
  episodeId?: string | null;
  authorId: string;
  noteType: string;
  content: string;
  createdAt: string;
}

export interface MedicalNotePage {
  content: MedicalNote[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ApiDocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  changeReason: string;
  createdAt: string;
}

export interface DocumentCreatePayload {
  documentTypeId: string;
  expedientId?: string;
  responsibleUserId?: string;
  departmentId?: string;
  patientId?: string;
  specialty?: string;
  institutionalProcess?: string;
  metadata?: Record<string, any>;
  code: string;
  name: string;
  description?: string;
  issueDate?: string;
  expiryDate?: string;
  externalSource?: boolean;
  source?: string;
}

function normalizeDateStr(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const y = String(value[0]).padStart(4, '0');
    const m = String(value[1] || 1).padStart(2, '0');
    const d = String(value[2] || 1).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') {
    const ms = value < 10000000000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return String(value);
}

function normalizeDoc(item: any): ApiDocument {
  const createdAt = normalizeDateStr(item.createdAt);
  const updatedAt = normalizeDateStr(item.updatedAt);
  const issueDate = normalizeDateStr(item.issueDate);
  const expiryDate = normalizeDateStr(item.expiryDate);

  const categoryName = item.categoryName || item.category || null;
  const responsibleName = item.responsibleName || item.responsibleUserName || null;
  const authorName = item.authorName || item.creatorName || null;
  const departmentName = item.departmentName || item.area || null;

  return {
    ...item,
    createdAt,
    updatedAt,
    issueDate,
    expiryDate,
    currentVersion: item.currentVersion ?? 1,
    categoryName,
    responsibleName,
    authorName,
    departmentName,
    // Compatibilidad para plantillas existentes
    category: categoryName,
    responsibleUserName: responsibleName,
    creatorName: authorName,
    area: departmentName,
    effectiveDate: issueDate || createdAt,
    version: item.currentVersion ?? 1,
    responsibleUserId: item.responsibleId || item.responsibleUserId || null,
    creatorId: item.authorId || item.creatorId || null,
  };
}

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly http = inject(HttpClient);

  documentTypes(filter = '', page = 0, size = 100): Observable<DocumentTypePage> {
    let params = new HttpParams().set('page', page).set('size', size).set('active', true);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<DocumentTypePage>(`${API_URL}/document-types`, { params });
  }

  categories(): Observable<ApiDocumentCategory[]> {
    return this.http.get<ApiDocumentCategory[]>(`${API_URL}/documents/categories`);
  }

  specialties(): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/documents/specialties`);
  }

  processes(): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/documents/processes`);
  }

  departments(): Observable<ApiDepartment[]> {
    const params = new HttpParams().set('page', 0).set('size', 100).set('active', true);
    return this.http.get<{ content: ApiDepartment[] }>(`${API_URL}/departments`, { params }).pipe(
      map(res => res.content || [])
    );
  }

  documents(filter = '', status?: string, page = 0, size = 20, scope?: 'mine' | 'shared'): Observable<{ content: ApiDocument[]; totalElements: number }> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    if (status) params = params.set('status', status);
    const path = scope === 'mine' ? '/documents/mine' : scope === 'shared' ? '/documents/shared' : '/documents';
    return this.http.get<{ content: any[]; totalElements: number }>(`${API_URL}${path}`, { params }).pipe(
      map(res => ({
        content: (res.content || []).map(normalizeDoc),
        totalElements: res.totalElements || 0,
      }))
    );
  }

  getById(documentId: string): Observable<ApiDocument> {
    return this.http.get<any>(`${API_URL}/documents/${documentId}`).pipe(map(normalizeDoc));
  }

  createDocument(payload: DocumentCreatePayload): Observable<ApiDocument> {
    return this.http.post<any>(`${API_URL}/documents`, payload).pipe(
      map(normalizeDoc)
    );
  }

  changeStatus(documentId: string, status: string): Observable<ApiDocument> {
    return this.http.patch<any>(`${API_URL}/documents/${documentId}/status`, { status }).pipe(
      map(normalizeDoc)
    );
  }

  uploadVersion(documentId: string, file: File, changeReason: string): Observable<ApiDocumentVersion> {
    const body = new FormData();
    body.append('file', file);
    body.append('changeReason', changeReason);
    return this.http.post<ApiDocumentVersion>(`${API_URL}/documents/${documentId}/versions`, body);
  }

  versions(documentId: string): Observable<ApiDocumentVersion[]> {
    return this.http.get<ApiDocumentVersion[]>(`${API_URL}/documents/${documentId}/versions`);
  }

  downloadVersion(documentId: string, versionId: string): Observable<Blob> {
    return this.http.get(`${API_URL}/documents/${documentId}/versions/${versionId}/content`, { responseType: 'blob' });
  }

  medicalNotes(clinicalHistoryId: string, page = 0, size = 20): Observable<MedicalNotePage> {
    const params = new HttpParams().set('clinicalHistoryId', clinicalHistoryId).set('page', page).set('size', size);
    return this.http.get<MedicalNotePage>(`${API_URL}/medical-notes`, { params });
  }

  createMedicalNote(payload: { clinicalHistoryId: string; episodeId?: string; noteType: string; content: string }): Observable<MedicalNote> {
    return this.http.post<MedicalNote>(`${API_URL}/medical-notes`, payload);
  }
}
