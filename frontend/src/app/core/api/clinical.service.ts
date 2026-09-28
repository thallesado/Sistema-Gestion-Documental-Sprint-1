import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ClinicalHistoryRequest, ClinicalHistoryResponse, Page, PatientResponse } from './clinical.types';

const API_URL = 'http://localhost:8080/api/v1';

@Injectable({ providedIn: 'root' })
export class ClinicalService {
  private readonly http = inject(HttpClient);

  getPatients(filter?: string, page: number = 0, size: number = 20): Observable<Page<PatientResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter) {
      params = params.set('filter', filter);
    }
    return this.http.get<Page<PatientResponse>>(`${API_URL}/patients`, { params });
  }

  getClinicalHistories(patientId?: string, filter?: string, page: number = 0, size: number = 20): Observable<Page<ClinicalHistoryResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (patientId) {
      params = params.set('patientId', patientId);
    }
    if (filter) {
      params = params.set('filter', filter);
    }
    return this.http.get<Page<ClinicalHistoryResponse>>(`${API_URL}/clinical-histories`, { params });
  }

  createClinicalHistory(request: ClinicalHistoryRequest): Observable<ClinicalHistoryResponse> {
    return this.http.post<ClinicalHistoryResponse>(`${API_URL}/clinical-histories`, request);
  }

  updateClinicalHistory(id: string, request: ClinicalHistoryRequest): Observable<ClinicalHistoryResponse> {
    return this.http.put<ClinicalHistoryResponse>(`${API_URL}/clinical-histories/${id}`, request);
  }
}
