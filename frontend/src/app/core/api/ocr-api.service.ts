import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';

const API_URL = '/api/v1/ocr';

export interface OcrField {
  key: string;
  value: string;
  status: string;
}

export interface OcrProcessResult {
  documentType: string;
  patientName: string | null;
  patientDocumentNumber: string | null;
  doctorName: string | null;
  issueDate: string | null;
  extractedSummary: string;
  fullText: string;
  confidence: number;
  structuredFields: OcrField[];
  rawMetadata: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class OcrApiService {
  private readonly http = inject(HttpClient);

  readonly rawFile = signal<File | null>(null);
  readonly selectedSource = signal<string>('Carga local');
  readonly ocrData = signal<OcrProcessResult | null>(null);
  readonly ocrLoading = signal<boolean>(false);
  readonly ocrError = signal<string | null>(null);
  readonly ocrStatus = signal<'IDLE' | 'PROCESSING' | 'REQUIRES_VALIDATION' | 'VALIDATED' | 'INDEXED'>('IDLE');

  setFile(file: File, source: string): void {
    this.rawFile.set(file);
    this.selectedSource.set(source);
    this.ocrError.set(null);
  }

  processFile(file: File): Observable<OcrProcessResult> {
    this.rawFile.set(file);
    this.ocrLoading.set(true);
    this.ocrStatus.set('PROCESSING');
    this.ocrError.set(null);

    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<OcrProcessResult>(`${API_URL}/process`, formData).pipe(
      tap((result) => {
        this.ocrLoading.set(false);
        this.ocrData.set(result);
        this.ocrStatus.set('REQUIRES_VALIDATION');
      }),
      catchError((err) => {
        this.ocrLoading.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Error al procesar el documento con IA multimodal';
        this.ocrError.set(errorMsg);
        return throwError(() => err);
      })
    );
  }

  reset(): void {
    this.rawFile.set(null);
    this.selectedSource.set('Carga local');
    this.ocrData.set(null);
    this.ocrLoading.set(false);
    this.ocrError.set(null);
    this.ocrStatus.set('IDLE');
  }
}
