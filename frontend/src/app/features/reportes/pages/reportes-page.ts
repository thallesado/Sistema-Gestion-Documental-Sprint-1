import { ExportColumn } from '../../../core/utils/export-utils';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Pagination } from '../../../shared';
import {
  KpiCard, ReportChart, ReportFilters, ReportHeader, ReportTable,
} from '../components';
import { ChartPoint, ReportDefinition, ReportRow, reportDefinition } from '../../../core/data/report-data';
import { DemoSessionState } from '../../../core/state/demo-session';
import { buildFilterSummary, generateChartPoints, handleReportExport } from '../../../widgets/reportes/reportes-helper';

type Kpi = { icon: string; label: string; value: string; detail: string; tone: string };

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, KpiCard, ReportChart, ReportFilters, ReportHeader, ReportTable],
  template: `
    <section class="page report-page">
      <app-report-header
        [title]="report.title"
        [description]="report.description"
        [tenant]="session.tenant()"
        [role]="session.role()"
        [filterSummary]="filterSummary()"
        (tenantChange)="changeTenant($event)"
        (export)="exportReport($event)"
      />

      @if (isSuperAdmin && session.tenant() === 'Todos los tenants') {
        <div class="tenant-comparison-note"><span>◈</span><div><strong>Comparativo global disponible para Superadministrador</strong><small>La comparación es visual y usa datos simulados; no cambia el tenant autenticado ni representa persistencia.</small></div></div>
      }

      <app-report-filters
        [filters]="report.filters"
        [values]="filterValues()"
        (filtersChange)="changeFilter($event.key, $event.value)"
        (reset)="resetFilters()"
      />

      <section class="report-kpis" aria-label="Indicadores clave">
        @for (kpi of kpis(); track kpi.label) {
          <app-kpi-card [icon]="kpi.icon" [label]="kpi.label" [value]="kpi.value" [detail]="kpi.detail" [tone]="kpi.tone" />
        }
      </section>

      <section class="report-charts" aria-label="Visualizaciones del reporte">
        <app-report-chart [title]="report.chartOne.title" [subtitle]="report.chartOne.subtitle" [kind]="report.chartOne.kind" [points]="chartPoints(report.chartOne.groupBy)" />
        <app-report-chart [title]="report.chartTwo.title" [subtitle]="report.chartTwo.subtitle" [kind]="report.chartTwo.kind" [points]="chartPoints(report.chartTwo.groupBy)" />
        @if (report.chartThree; as chartThree) {
          <app-report-chart [title]="chartThree.title" [subtitle]="chartThree.subtitle" [kind]="chartThree.kind" [points]="chartPoints(chartThree.groupBy)" />
        }
        @if (report.key === 'storage' && isSuperAdmin) {
          <app-report-chart title="Comparativo por tenant" subtitle="Solo visible para Superadministrador" kind="bars" [points]="tenantComparison" />
        }
      </section>

      <app-report-table
        [columns]="report.columns"
        [rows]="pagedRows()"
        [totalRows]="filteredRows().length"
        [page]="page()"
        [pageSize]="pageSize"
        (pageChange)="page.set($event)"
      />
    </section>
  `
})
export class ReportesPage {
  readonly session = inject(DemoSessionState);
  private readonly route = inject(ActivatedRoute);

  readonly report: ReportDefinition = this.loadReportDefinition();
  readonly filterValues = signal<Record<string, string>>({});
  readonly page = signal(1);
  readonly pageSize = 8;

  readonly isSuperAdmin = this.session.role() === 'Superadministrador';
  readonly tenantComparison: ChartPoint[] = [
    { label: 'Hospital Central', value: 450 },
    { label: 'Clínica Los Andes', value: 310 },
    { label: 'Seguros del Sur', value: 240 },
    { label: 'Gobierno Regional', value: 180 },
  ];

  readonly filterSummary = computed(() => buildFilterSummary(this.report, this.filterValues()));

  readonly filteredRows = computed(() => {
    const f = this.filterValues();
    return this.report.rows.filter(row => {
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
    const cols: ExportColumn[] = this.report.columns.map(c => ({ label: c.label || c.header || c.key, key: c.key }));
    handleReportExport(format, this.report.title, this.filteredRows(), cols);
  }

  private loadReportDefinition(): ReportDefinition {
    const slug = this.route.snapshot.routeConfig?.path ?? 'reports/documents';
    return reportDefinition(slug);
  }
}

export const ReportsPage = ReportesPage;
