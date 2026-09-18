import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api/v1';

/** Contratos REST documentales expuestos por el backend. */
export interface ApiDocumentType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
}

export interface DocumentTypePage {
  content: ApiDocumentType[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
export interface ApiDocument {
  id: string; documentTypeId: string; expedientId?: string | null; code: string; name: string;
  description?: string | null; status: string; currentVersion: number; createdAt: string; updatedAt: string;
  category?: string | null; responsibleUserId?: string | null; responsibleUserName?: string | null;
  creatorId?: string | null; creatorName?: string | null; area?: string | null;
  effectiveDate?: string | null; version?: number | null; expedientCode?: string | null;
}
export interface MedicalNote {
  id: string; clinicalHistoryId: string; episodeId?: string | null; authorId: string;
  noteType: string; content: string; createdAt: string;
}
export interface MedicalNotePage { content: MedicalNote[]; totalElements: number; totalPages: number; number: number; size: number; }
export interface ApiDocumentVersion { id: string; documentId: string; versionNumber: number; fileName: string; mimeType: string; fileSizeBytes: number; checksumSha256: string; changeReason: string; createdAt: string; }
export interface DocumentCreatePayload {
  documentTypeId: string;
  expedientId?: string;
  responsibleUserId?: string;
  departmentId?: string;
  code: string;
  name: string;
  description?: string;
  issueDate?: string;
  expiryDate?: string;
  externalSource?: boolean;
  source?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly http = inject(HttpClient);

  documentTypes(filter = '', page = 0, size = 20): Observable<DocumentTypePage> {
    let params = new HttpParams().set('page', page).set('size', size).set('active', true);
    if (filter.trim()) params = params.set('filter', filter.trim());
    return this.http.get<DocumentTypePage>(`${API_URL}/document-types`, { params });
  }

  documents(filter = '', status?: string, page = 0, size = 20, scope?: 'mine' | 'shared'): Observable<{ content: ApiDocument[]; totalElements: number }> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.trim()) params = params.set('filter', filter.trim());
    if (status) params = params.set('status', status);
    const path = scope === 'mine' ? '/documents/mine' : scope === 'shared' ? '/documents/shared' : '/documents';
    return this.http.get<{ content: ApiDocument[]; totalElements: number }>(`${API_URL}${path}`, { params });
  }

  createDocument(payload: DocumentCreatePayload): Observable<ApiDocument> {
    return this.http.post<ApiDocument>(`${API_URL}/documents`, payload);
  }

  uploadVersion(documentId: string, file: File, changeReason: string): Observable<ApiDocumentVersion> {
    const body = new FormData(); body.append('file', file); body.append('changeReason', changeReason);
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
