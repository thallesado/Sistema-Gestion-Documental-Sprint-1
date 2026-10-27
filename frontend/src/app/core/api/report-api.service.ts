import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';

const API_URL = '/api/v1/reports';

export interface ReportPageResponse<T> {
  content: T[];
  totalElements: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface AnalyticsSummary {
  totalDocuments: number;
  documentApprovalRate: number;
  totalWorkflows: number;
  averageWorkflowHours: number;
  activeUsers: number;
  totalOcrProcessed: number;
  ocrAcceptanceRate: number;
  averageOcrConfidence: number;
}

export interface MonthlyTrendPoint {
  month: string;
  documentsCreated: number;
  documentsApproved: number;
  workflowsCompleted: number;
}

export interface AreaDistributionPoint {
  area: string;
  documentCount: number;
  workflowCount: number;
}

export interface WorkflowCycleTimePoint {
  templateName: string;
  completedCount: number;
  averageHours: number;
  minHours: number;
  maxHours: number;
  overdueCount: number;
}

export interface TopUserPoint {
  userName: string;
  role: string;
  area: string;
  auditActions: number;
  documentsCreated: number;
}

export interface OcrAnalyticsPoint {
  totalProcessed: number;
  validated: number;
  rejected: number;
  acceptanceRate: number;
  averageConfidence: number;
  averageProcessingSeconds: number;
}

export interface AnalyticsDashboard {
  dateFrom: string;
  dateTo: string;
  summary: AnalyticsSummary;
  monthlyTrend: MonthlyTrendPoint[];
  areaDistribution: AreaDistributionPoint[];
  cycleTimes: WorkflowCycleTimePoint[];
  topUsers: TopUserPoint[];
  ocrPerformance: OcrAnalyticsPoint;
}

export interface PlatformSeriesPoint { label: string; value: number; }
export interface PlatformMonth { month: string; revenue: number; fees: number; newTenants: number; }
export interface PlatformTenantRow {
  id: string; tenant: string; code: string; plan: string; planCode: string | null; status: string; cycle: string;
  createdAt: string; periodEnd: string | null; trialEndsAt: string | null; stripeManaged: boolean;
  users: number; documents: number; totalPaid: number; lastPaymentAt: string | null; mrr: number;
}
export interface PlatformPaymentRow {
  id: string; createdAt: string; tenant: string; plan: string; method: string; status: string; cycle: string;
  amount: number; fee: number; net: number; reference: string;
}
export interface PlatformDashboard {
  kpis: {
    totalTenants: number; activeTenants: number; trialTenants: number; pastDueTenants: number; churnedTenants: number;
    suspendedTenants: number; newTenants30d: number; stripeSubscriptions: number; mrrUsd: number; arrUsd: number;
    revenueTotalUsd: number; revenue30dUsd: number; revenuePrev30dUsd: number; feesTotalUsd: number; fees30dUsd: number;
    netTotalUsd: number; net30dUsd: number; paymentsTotal: number; payingTenants: number; arpaUsd: number;
    failedPayments30d: number; pendingPayments30d: number; pendingSignups: number; failedSignups: number;
  };
  monthly: PlatformMonth[];
  tenantsByStatus: PlatformSeriesPoint[];
  tenantsByPlan: PlatformSeriesPoint[];
  revenueByPlan: PlatformSeriesPoint[];
  revenueByMethod: PlatformSeriesPoint[];
  tenants: PlatformTenantRow[];
  recentPayments: PlatformPaymentRow[];
  feeRates: { stripeCardPercent: number; stripeCardFixed: number; bankQrPercent: number; cryptoUsdtPercent: number };
}

@Injectable({ providedIn: 'root' })
export class ReportApiService {
  private readonly http = inject(HttpClient);

  getReport(
    reportKey: string,
    filters: Record<string, string>,
    page = 1,
    size = 10
  ): Observable<ReportPageResponse<any>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value.toString().trim() !== '') {
        params = params.set(key, value.toString().trim());
      }
    }

    const endpoint = this.resolveEndpoint(reportKey);
    return this.http.get<ReportPageResponse<any>>(this.reportUrl(reportKey, endpoint), { params });
  }

  downloadCsv(reportKey: string, filters: Record<string, string>): Observable<Blob> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value.toString().trim() !== '') {
        params = params.set(key, value.toString().trim());
      }
    }

    const endpoint = this.resolveEndpoint(reportKey);
    return this.http.get(`${this.reportUrl(reportKey, endpoint)}/export/csv`, {
      params,
      responseType: 'blob',
    }).pipe(catchError((err) => this.readBlobError(err)));
  }

  /** Un error con cuerpo Blob (p. ej. HTTP 413) se convierte en un error con el JSON del servidor. */
  private readBlobError(err: any): Observable<never> {
    if (!(err?.error instanceof Blob)) return throwError(() => err);
    return from(err.error.text() as Promise<string>).pipe(
      switchMap((text) => {
        let body: unknown = { message: text };
        try {
          body = JSON.parse(text);
        } catch {
          // cuerpo no JSON: se conserva el texto
        }
        return throwError(() => ({ ...err, error: body }));
      }),
    );
  }

  getAnalyticsDashboard(dateFrom: string, dateTo: string): Observable<AnalyticsDashboard> {
    const params = new HttpParams()
      // yyyy-MM-dd sin hora: el servidor lo interpreta en la zona horaria del tenant
      .set('dateFrom', dateFrom)
      .set('dateTo', dateTo);

    return this.http.get<AnalyticsDashboard>(`${API_URL}/analytics/dashboard`, { params });
  }

  /** Panel del administrador de plataforma: KPIs, series mensuales, tenants y pagos recientes. */
  getPlatformDashboard(): Observable<PlatformDashboard> {
    return this.http.get<PlatformDashboard>('/api/v1/platform/dashboard');
  }

  /** Platform reports (platform-tenants, platform-payments) live outside the tenant-scoped API. */
  private reportUrl(reportKey: string, endpoint: string): string {
    return reportKey.startsWith('platform-')
      ? `/api/v1/platform/reports/${reportKey.slice('platform-'.length)}`
      : `${API_URL}/${endpoint}`;
  }

  private resolveEndpoint(key: string): string {
    switch (key) {
      case 'users':
        return 'users';
      case 'workflows':
        return 'workflows';
      case 'audit':
        return 'audit';
      case 'expedients':
        return 'expedients';
      case 'ocr':
        return 'ocr';
      default:
        return 'documents';
    }
  }
}
