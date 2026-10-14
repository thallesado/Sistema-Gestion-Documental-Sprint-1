import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, finalize, throwError } from 'rxjs';
import { describeOcrError } from '../utils/ocr-error-message';

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
  /** Seconds since the current request started; drives the loading indicator. */
  readonly ocrElapsed = signal<number>(0);
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  readonly ocrError = signal<string | null>(null);
  readonly ocrStatus = signal<'IDLE' | 'PROCESSING' | 'REQUIRES_VALIDATION' | 'VALIDATED' | 'INDEXED' | 'ERROR'>('IDLE');

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
    this.startElapsedTimer();

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
        this.ocrStatus.set('ERROR');
        this.ocrError.set(describeOcrError(err));
        return throwError(() => err);
      }),
      finalize(() => this.stopElapsedTimer())
    );
  }

  private startElapsedTimer(): void {
    this.stopElapsedTimer();
    this.ocrElapsed.set(0);
    this.elapsedTimer = setInterval(() => this.ocrElapsed.update((seconds) => seconds + 1), 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    this.elapsedTimer = null;
  }

  reset(): void {
    this.rawFile.set(null);
    this.selectedSource.set('Carga local');
    this.ocrData.set(null);
    this.ocrLoading.set(false);
    this.stopElapsedTimer();
    this.ocrError.set(null);
    this.ocrStatus.set('IDLE');
  }
}
