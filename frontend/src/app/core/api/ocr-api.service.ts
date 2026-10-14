import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, finalize, throwError } from 'rxjs';
import { describeOcrError } from '../utils/ocr-error-message';
import { OcrJobStatus, OcrMetadataFields, OcrStatsData, OcrStatsLoadState } from '../utils/ocr-flow';

const API_URL = '/api/v1/ocr';

export interface OcrField {
  key: string;
  value: string;
  status: string;
}

/** A persisted digitization (ocr_jobs row) with its effective extracted metadata. */
export interface OcrProcessResult {
  id: string;
  status: OcrJobStatus;
  originalFilename: string | null;
  fileType: string | null;
  fileSizeBytes: number | null;
  documentType: string | null;
  patientName: string | null;
  patientDocumentNumber: string | null;
  doctorName: string | null;
  issueDate: string | null;
  extractedSummary: string | null;
  fullText: string | null;
  confidence: number | null;
  structuredFields: OcrField[];
  finalMetadata: Record<string, unknown>;
  modelUsed: string | null;
  processingMs: number | null;
  errorMessage: string | null;
  documentId: string | null;
  createdAt: string;
  validatedAt: string | null;
}

export interface OcrIndexPayload {
  documentTypeId: string;
  code?: string;
  name?: string;
  departmentId?: string;
  description?: string;
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
  readonly ocrStatus = signal<OcrJobStatus | 'IDLE' | 'ERROR'>('IDLE');
  /** True while validate / reject / index / metadata is in flight: blocks double submits. */
  readonly ocrBusy = signal<boolean>(false);

  readonly stats = signal<OcrStatsData | null>(null);
  readonly statsState = signal<OcrStatsLoadState>('loading');
  readonly recentJobs = signal<OcrProcessResult[]>([]);

  setFile(file: File, source: string): void {
    this.rawFile.set(file);
    this.selectedSource.set(source);
    this.ocrError.set(null);
    if (this.ocrStatus() === 'ERROR') this.ocrStatus.set('IDLE');
  }

  processFile(file: File): Observable<OcrProcessResult> {
    this.rawFile.set(file);
    this.ocrData.set(null);
    this.ocrLoading.set(true);
    this.ocrStatus.set('PROCESSING');
    this.ocrError.set(null);
    this.startElapsedTimer();

    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<OcrProcessResult>(`${API_URL}/process`, formData).pipe(
      tap((job) => {
        this.ocrLoading.set(false);
        if (job.status === 'FAILED') {
          // A failed extraction is persisted as FAILED; it must never look like a result.
          this.ocrStatus.set('ERROR');
          this.ocrError.set(job.errorMessage || 'No se pudo extraer el documento');
          return;
        }
        this.ocrData.set(job);
        this.ocrStatus.set(job.status);
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

  loadStats(): void {
    this.statsState.set('loading');
    this.http.get<OcrStatsData>(`${API_URL}/stats`).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.statsState.set('ready');
      },
      error: () => this.statsState.set('error'),
    });
  }

  loadRecent(): void {
    this.http.get<OcrProcessResult[]>(`${API_URL}/jobs`).subscribe({
      next: (jobs) => this.recentJobs.set(jobs),
      error: () => this.recentJobs.set([]),
    });
  }

  /** Resume a stored digitization (e.g. after a page reload or from the recent list). */
  openJob(job: OcrProcessResult): void {
    this.rawFile.set(null);
    this.ocrError.set(null);
    this.ocrData.set(job);
    this.ocrStatus.set(job.status);
  }

  validate(corrections?: Partial<OcrMetadataFields>): Observable<OcrProcessResult> {
    return this.action('validate', 'post', corrections ?? {});
  }

  reject(reason?: string): Observable<OcrProcessResult> {
    return this.action('reject', 'post', reason ? { reason } : {});
  }

  index(payload: OcrIndexPayload): Observable<OcrProcessResult> {
    return this.action('index', 'post', payload);
  }

  updateMetadata(corrections: Partial<OcrMetadataFields>): Observable<OcrProcessResult> {
    return this.action('metadata', 'patch', corrections);
  }

  private action(path: string, method: 'post' | 'patch', body: unknown): Observable<OcrProcessResult> {
    const job = this.ocrData();
    if (!job) return throwError(() => new Error('No hay una digitalización abierta'));
    this.ocrBusy.set(true);
    this.ocrError.set(null);
    const url = `${API_URL}/jobs/${job.id}/${path}`;
    const request = method === 'post' ? this.http.post<OcrProcessResult>(url, body) : this.http.patch<OcrProcessResult>(url, body);
    return request.pipe(
      tap((updated) => {
        this.ocrData.set(updated);
        this.ocrStatus.set(updated.status);
      }),
      catchError((err) => {
        this.ocrError.set(describeOcrError(err));
        return throwError(() => err);
      }),
      finalize(() => this.ocrBusy.set(false))
    );
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

  private startElapsedTimer(): void {
    this.stopElapsedTimer();
    this.ocrElapsed.set(0);
    this.elapsedTimer = setInterval(() => this.ocrElapsed.update((seconds) => seconds + 1), 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    this.elapsedTimer = null;
  }
}
