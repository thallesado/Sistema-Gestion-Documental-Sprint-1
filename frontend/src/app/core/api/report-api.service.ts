import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
    return this.http.get<ReportPageResponse<any>>(`${API_URL}/${endpoint}`, { params });
  }

  downloadCsv(reportKey: string, filters: Record<string, string>): Observable<Blob> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value.toString().trim() !== '') {
        params = params.set(key, value.toString().trim());
      }
    }

    const endpoint = this.resolveEndpoint(reportKey);
    return this.http.get(`${API_URL}/${endpoint}/export/csv`, {
      params,
      responseType: 'blob',
    });
  }

  getAnalyticsDashboard(dateFrom: string, dateTo: string): Observable<AnalyticsDashboard> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00Z`)
      .set('dateTo', dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59Z`);

    return this.http.get<AnalyticsDashboard>(`${API_URL}/analytics/dashboard`, { params });
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
      default:
        return 'documents';
    }
  }
}
