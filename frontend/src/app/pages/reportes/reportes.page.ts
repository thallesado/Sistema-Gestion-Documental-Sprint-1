import { ExportColumn } from '../../core/utils/export-utils';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Pagination } from '../../shared';
import {
  KpiCard, ReportChart, ReportFilters, ReportHeader, ReportTable,
} from '../../features/reportes/components';
import { ChartPoint, ReportDefinition, ReportRow, reportDefinition } from '../../core/data/report-data';
import { DemoSessionState } from '../../core/state/demo-session';
import { buildFilterSummary, generateChartPoints, handleReportExport } from '../../widgets/reportes/reportes-helper';

type Kpi = { icon: string; label: string; value: string; detail: string; tone: string };

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, KpiCard, ReportChart, ReportFilters, ReportHeader, ReportTable],
  templateUrl: './reportes.page.html',
  styleUrl: './reportes.page.css'
})
export class ReportesPage {
  readonly session = inject(DemoSessionState);
  private readonly route = inject(ActivatedRoute);

  readonly report: ReportDefinition = this.loadReportDefinition();
  readonly filterValues = signal<Record<string, string>>({});
  readonly page = signal(1);
  readonly pageSize = 8;

  readonly isSuperAdmin = computed(() => this.session.role() === 'Superadministrador');
  readonly tenantComparison: ChartPoint[] = [
    { label: 'Hospital Central', value: 450 },
    { label: 'Clínica Los Andes', value: 310 },
    { label: 'Seguros del Sur', value: 240 },
    { label: 'Gobierno Regional', value: 180 },
  ];

  readonly filterSummary = computed(() => buildFilterSummary(this.report, this.filterValues()));

  readonly filteredRows = computed(() => {
    const f = this.filterValues();
    return this.report.rows.filter((row: ReportRow) => {
      for (const [key, val] of Object.entries(f)) {
        if (val && val !== 'all' && String((row as any)[key]) !== val) return false;
      }
      return true;
    });
  });

  readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredRows().slice(start, start + this.pageSize);
  });

  readonly kpis = computed<Kpi[]>(() => {
    const count = this.filteredRows().length;
    return [
      { icon: '📊', label: 'Total registros', value: String(count), detail: 'Elementos coincidentes', tone: 'mint' },
      { icon: '⚡', label: 'En proceso', value: String(Math.floor(count * 0.35)), detail: 'En curso actualmente', tone: 'amber' },
      { icon: '✓', label: 'Completados', value: String(Math.floor(count * 0.6)), detail: 'Finalizados con éxito', tone: 'green' },
    ];
  });

  changeFilter(key: string, value: string): void {
    this.filterValues.update(v => ({ ...v, [key]: value }));
    this.page.set(1);
  }

  resetFilters(): void {
    this.filterValues.set({});
    this.page.set(1);
  }

  changeTenant(t: string): void {
    this.session.setTenant(t as any);
  }

  chartPoints(groupBy: string): ChartPoint[] {
    return generateChartPoints(this.filteredRows(), groupBy);
  }

  exportReport(format: 'Excel' | 'PDF' | 'JSON' | any): void {
    const cols: ExportColumn[] = this.report.columns.map((c: any) => ({ label: c.label || c.header || c.key, key: c.key }));
    handleReportExport(format, this.report.title, this.filteredRows(), cols);
  }

  private loadReportDefinition(): ReportDefinition {
    const slug = this.route.snapshot.routeConfig?.path ?? 'reports/documents';
    return reportDefinition(slug);
  }
}

export const ReportsPage = ReportesPage;
