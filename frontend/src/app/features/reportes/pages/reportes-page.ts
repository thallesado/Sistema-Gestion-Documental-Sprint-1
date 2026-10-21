import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Pagination } from '../../../shared';
import {
  KpiCard,
  ReportChart,
  ReportFilters,
  ReportHeader,
  ReportTable,
} from '../components';
import { ChartPoint, ReportDefinition, ReportRow, reportDefinition } from '../../../core/data/report-data';
import { DemoSessionState } from '../../../core/state/demo-session';
import { AnalyticsDashboard, ReportApiService } from '../../../core/api/report-api.service';
import { exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';

type Kpi = { icon: string; label: string; value: string; detail: string; tone: string };

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, Pagination, KpiCard, ReportChart, ReportFilters, ReportHeader, ReportTable],
  template: `
    <section class="page report-page">
      <app-report-header
        [title]="viewMode() === 'analytics' ? 'Tablero Analítico y Business Intelligence' : report.title"
        [description]="viewMode() === 'analytics' ? 'Métricas agregadas en tiempo real: evolución mensual, tiempos de ciclo, cuellos de botella y rendimiento de OCR.' : report.description"
        [tenant]="session.tenant()"
        [role]="session.role()"
        [filterSummary]="filterSummary()"
        (tenantChange)="changeTenant($event)"
        (export)="exportReport($event)"
      />

      <div class="report-view-mode-tabs" style="display: flex; gap: 8px; margin-bottom: 16px;">
        <button
          type="button"
          class="btn"
          [style.background]="viewMode() === 'tabular' ? '#087f7b' : '#edf5f3'"
          [style.color]="viewMode() === 'tabular' ? '#ffffff' : '#087f7b'"
          (click)="setViewMode('tabular')"
          style="font-weight: 600; font-size: 13px; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
        >
          📋 Reportes Tabulares Detallados
        </button>
        <button
          type="button"
          class="btn"
          [style.background]="viewMode() === 'analytics' ? '#087f7b' : '#edf5f3'"
          [style.color]="viewMode() === 'analytics' ? '#ffffff' : '#087f7b'"
          (click)="setViewMode('analytics')"
          style="font-weight: 600; font-size: 13px; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
        >
          📊 Tablero Analítico y BI
        </button>
      </div>

      @if (isSuperAdmin && session.tenant() === 'Todos los tenants') {
        <div class="tenant-comparison-note">
          <span>◈</span>
          <div>
            <strong>Comparativo global disponible para Superadministrador</strong>
            <small>Filtros aplicados sobre el alcance administrativo actual.</small>
          </div>
        </div>
      }

      <app-report-filters
        [filters]="report.filters"
        [values]="filterValues()"
        (filtersChange)="changeFilter($event.key, $event.value)"
        (reset)="resetFilters()"
      />

      @if (errorMessage()) {
        <div class="inline-toast" style="background: #fef2f2; border: 1px solid #f87171; color: #991b1b; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;" role="alert">
          ⚠ {{ errorMessage() }}
        </div>
      }

      @if (loading()) {
        <div style="padding: 16px; text-align: center; color: #087f7b; font-weight: 500;">
          ⏳ Consultando datos reales del servidor...
        </div>
      }

      @if (viewMode() === 'analytics') {
        <!-- SECCIÓN TABLERO ANALÍTICO BI -->
        <section class="report-kpis" aria-label="Indicadores clave de BI">
          @for (kpi of analyticsKpis(); track kpi.label) {
            <app-kpi-card [icon]="kpi.icon" [label]="kpi.label" [value]="kpi.value" [detail]="kpi.detail" [tone]="kpi.tone" />
          }
        </section>

        <section class="report-charts" aria-label="Visualizaciones analíticas de BI">
          <app-report-chart
            title="Evolución Mensual de Documentos"
            subtitle="Volumen creado mes a mes"
            kind="line"
            [points]="monthlyPoints()"
          />
          <app-report-chart
            title="Tiempos de Ciclo por Flujo"
            subtitle="Horas promedio de resolución"
            kind="bars"
            [points]="cycleTimePoints()"
          />
          <app-report-chart
            title="Distribución Documental por Área"
            subtitle="Concentración por departamento"
            kind="donut"
            [points]="areaPoints()"
          />
          @if (ocrPoints().length > 0) {
            <app-report-chart
              title="Aceptación de Digitalización OCR"
              subtitle="Validación vs Rechazo de IA"
              kind="donut"
              [points]="ocrPoints()"
            />
          }
        </section>

        @if (analyticsData()?.cycleTimes?.length) {
          <article class="report-table panel" style="margin-bottom: 20px;">
            <div class="report-table-heading">
              <div>
                <h2>Cuellos de Botella y Tiempos de Resolución en Workflows</h2>
                <p>Métricas de duración por tipo de plantilla en el período seleccionado.</p>
              </div>
              <span class="table-count">{{ analyticsData()!.cycleTimes.length }} plantillas</span>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Plantilla</th>
                    <th>Flujos Completados</th>
                    <th>Tiempo Promedio</th>
                    <th>Tiempo Mínimo</th>
                    <th>Tiempo Máximo</th>
                    <th>Atrasados / Fuera de Plazo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ct of analyticsData()!.cycleTimes; track ct.templateName) {
                    <tr>
                      <td><strong>{{ ct.templateName }}</strong></td>
                      <td>{{ ct.completedCount }}</td>
                      <td><span class="table-status ok">{{ ct.averageHours }} hrs</span></td>
                      <td>{{ ct.minHours }} hrs</td>
                      <td>{{ ct.maxHours }} hrs</td>
                      <td>
                        @if (ct.overdueCount > 0) {
                          <span class="table-status danger">{{ ct.overdueCount }} fuera de plazo</span>
                        } @else {
                          <span class="table-status ok">0 atrasos</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </article>
        }

        @if (analyticsData()?.topUsers?.length) {
          <article class="report-table panel">
            <div class="report-table-heading">
              <div>
                <h2>Usuarios con Mayor Actividad Operativa</h2>
                <p>Ranking por eventos de auditoría registrados en el período.</p>
              </div>
              <span class="table-count">{{ analyticsData()!.topUsers.length }} usuarios</span>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Área</th>
                    <th>Acciones Auditadas</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of analyticsData()!.topUsers; track u.userName) {
                    <tr>
                      <td><strong>{{ u.userName }}</strong></td>
                      <td>{{ u.role }}</td>
                      <td>{{ u.area }}</td>
                      <td><span class="table-status ok">{{ u.auditActions }} eventos</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </article>
        }
      } @else {
        <!-- SECCIÓN REPORTES TABULARES DETALLADOS -->
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

        @if (report.key === 'areas' && selectedArea()) {
          <div class="area-detail panel">
            <div>
              <span class="side-kicker">DETALLE DEL ÁREA</span>
              <h2>{{ selectedArea() }}</h2>
              <p>Documentos, procesos y pendientes asociados al área seleccionada.</p>
            </div>
            <div class="area-detail-values">
              <strong>{{ areaValue('documents') }} <small>documentos</small></strong>
              <strong>{{ areaValue('workflows') }} <small>workflows</small></strong>
              <strong>{{ areaValue('tasks') }} <small>tareas</small></strong>
              <strong>{{ areaValue('pending') }} <small>pendientes</small></strong>
            </div>
            <button type="button" class="text-button" (click)="selectedArea.set('')">Cerrar</button>
          </div>
        }

        <app-report-table
          [title]="tableTitle"
          [subtitle]="tableSubtitle"
          [columns]="report.columns"
          [rows]="visibleRows()"
          [actionLabel]="actionLabel"
          (action)="tableAction($event)"
        />

        <app-pagination
          [page]="page()"
          [pageSize]="pageSize()"
          [total]="totalElements()"
          (pageChange)="changePage($event)"
          (pageSizeChange)="changePageSize($event)"
        />
      }
    </section>
  `,
})
export class ReportsPage implements OnInit {
  readonly session = inject(DemoSessionState);
  private readonly route = inject(ActivatedRoute);
  private readonly reportApi = inject(ReportApiService);

  private readonly routeKey = this.route.snapshot.data['routeInfo']?.href ?? '/reports';
  readonly report: ReportDefinition = reportDefinition(this.keyFromRoute(this.routeKey));

  readonly viewMode = signal<'tabular' | 'analytics'>(
    this.routeKey === '/reports/productivity' || this.routeKey === '/reports/by-area' ? 'analytics' : 'tabular'
  );

  readonly filterValues = signal<Record<string, string>>(this.defaultDates());
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly loading = signal(false);
  readonly selectedArea = signal('');

  readonly rows = signal<ReportRow[]>([]);
  readonly totalElements = signal(0);
  readonly analyticsData = signal<AnalyticsDashboard | null>(null);

  readonly tenantComparison: ChartPoint[] = [
    { label: 'Acme', value: 68, color: '#087f7b' },
    { label: 'Clínica', value: 57, color: '#4d9bd8' },
    { label: 'Universidad', value: 81, color: '#79c4bb' },
  ];

  readonly visibleRows = computed(() => this.rows());
  readonly filteredRows = computed(() => this.rows());
  readonly kpis = computed<Kpi[]>(() => this.buildKpis(this.rows()));

  readonly analyticsKpis = computed<Kpi[]>(() => {
    const data = this.analyticsData();
    if (!data) return [];
    const s = data.summary;
    return [
      {
        icon: '▤',
        label: 'Documentos en Período',
        value: String(s.totalDocuments),
        detail: `${s.documentApprovalRate}% aprobados`,
        tone: 'teal',
      },
      {
        icon: '◷',
        label: 'Tiempo Medio de Ciclo',
        value: `${s.averageWorkflowHours} hrs`,
        detail: `${s.totalWorkflows} flujos completados`,
        tone: 'blue',
      },
      {
        icon: '✓',
        label: 'Aceptación OCR (IA)',
        value: `${s.ocrAcceptanceRate}%`,
        detail: `${s.totalOcrProcessed} digitalizados (conf. ${Math.round(s.averageOcrConfidence * 100)}%)`,
        tone: 'green',
      },
      {
        icon: '♙',
        label: 'Usuarios Activos',
        value: String(s.activeUsers),
        detail: 'Con actividad auditada',
        tone: 'amber',
      },
    ];
  });

  readonly monthlyPoints = computed<ChartPoint[]>(() => {
    const data = this.analyticsData();
    if (!data || !data.monthlyTrend.length) return [];
    return data.monthlyTrend.map((m) => ({ label: m.month, value: m.documentsCreated, color: '#087f7b' }));
  });

  readonly cycleTimePoints = computed<ChartPoint[]>(() => {
    const data = this.analyticsData();
    if (!data || !data.cycleTimes.length) return [];
    const colors = ['#087f7b', '#4d9bd8', '#79c4bb', '#e3a633', '#7e5ab0'];
    return data.cycleTimes.map((c, i) => ({ label: c.templateName, value: c.averageHours, color: colors[i % colors.length] }));
  });

  readonly areaPoints = computed<ChartPoint[]>(() => {
    const data = this.analyticsData();
    if (!data || !data.areaDistribution.length) return [];
    const colors = ['#087f7b', '#4d9bd8', '#79c4bb', '#e3a633', '#7e5ab0'];
    return data.areaDistribution.map((a, i) => ({ label: a.area, value: a.documentCount, color: colors[i % colors.length] }));
  });

  readonly ocrPoints = computed<ChartPoint[]>(() => {
    const data = this.analyticsData();
    if (!data || data.ocrPerformance.totalProcessed === 0) return [];
    return [
      { label: 'Validados', value: data.ocrPerformance.validated, color: '#059669' },
      { label: 'Rechazados', value: data.ocrPerformance.rejected, color: '#dc2626' },
    ];
  });

  ngOnInit(): void {
    this.loadData();
  }

  setViewMode(mode: 'tabular' | 'analytics'): void {
    this.viewMode.set(mode);
    this.loadData();
  }

  loadData(): void {
    if (this.viewMode() === 'analytics') {
      this.loadAnalytics();
    } else {
      this.loadReport();
    }
  }

  loadAnalytics(): void {
    const filters = this.filterValues();
    const dateFrom = filters['dateFrom'];
    const dateTo = filters['dateTo'];

    if (!dateFrom || !dateTo) {
      this.errorMessage.set('Debe seleccionar obligatoriamente un rango de fechas (Desde y Hasta) para la analítica.');
      this.analyticsData.set(null);
      return;
    }

    if (dateFrom > dateTo) {
      this.errorMessage.set('La fecha Desde no puede ser posterior a la fecha Hasta.');
      this.analyticsData.set(null);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.reportApi.getAnalyticsDashboard(dateFrom, dateTo).subscribe({
      next: (dashboard) => {
        this.analyticsData.set(dashboard);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.message ?? err?.message ?? 'Error al consultar analítica de negocio';
        this.errorMessage.set(detail);
      },
    });
  }

  loadReport(): void {
    const filters = this.filterValues();
    const dateFrom = filters['dateFrom'];
    const dateTo = filters['dateTo'];

    if (!dateFrom || !dateTo) {
      this.errorMessage.set('Debe seleccionar obligatoriamente un rango de fechas (Desde y Hasta) para ejecutar el reporte.');
      this.rows.set([]);
      this.totalElements.set(0);
      return;
    }

    if (dateFrom > dateTo) {
      this.errorMessage.set('La fecha Desde no puede ser posterior a la fecha Hasta.');
      this.rows.set([]);
      this.totalElements.set(0);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.reportApi.getReport(this.report.key, filters, this.page(), this.pageSize()).subscribe({
      next: (res) => {
        this.rows.set(res.content ?? []);
        this.totalElements.set(res.totalElements ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.message ?? err?.message ?? 'Error al consultar datos del reporte';
        this.errorMessage.set(detail);
      },
    });
  }

  get actionLabel(): string {
    if (this.report.key === 'users') return 'Ver actividad';
    return '';
  }

  get tableTitle(): string {
    return this.report.key === 'audit' ? 'Eventos auditables' : `Detalle de ${this.report.title.replace('Reporte de ', '').toLowerCase()}`;
  }

  get tableSubtitle(): string {
    if (this.report.key === 'users') return 'Acciones operativas y último acceso por usuario';
    return 'Resultados que respetan los filtros obligatorios actuales';
  }

  get isSuperAdmin(): boolean { return this.session.role() === 'Superadministrador'; }

  filterSummary(): string {
    const count = Object.values(this.filterValues()).filter(Boolean).length;
    return count ? `${count} filtro${count === 1 ? '' : 's'} aplicado${count === 1 ? '' : 's'}` : 'filtros actuales';
  }

  changeFilter(key: string, value: string): void {
    this.filterValues.update((current) => ({ ...current, [key]: value }));
    this.page.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterValues.set(this.defaultDates());
    this.page.set(1);
    this.loadData();
  }

  changePage(newPage: number): void {
    this.page.set(newPage);
    this.loadReport();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.loadReport();
  }

  changeTenant(tenant: string): void {
    if (!this.isSuperAdmin) return;
    this.session.tenant.set(tenant);
    this.message.set(`Tenant visual cambiado a ${tenant}`);
    this.loadData();
  }

  exportReport(format: string): void {
    const filters = this.filterValues();
    if (!filters['dateFrom'] || !filters['dateTo']) {
      this.message.set('Seleccione un rango de fechas antes de exportar.');
      return;
    }

    if (format === 'Excel' || format === 'CSV') {
      this.message.set(`Generando exportación CSV en el servidor...`);
      this.reportApi.downloadCsv(this.report.key, filters).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `reporte-${this.report.key}-${new Date().toISOString().split('T')[0]}.csv`;
          anchor.click();
          window.URL.revokeObjectURL(url);
          this.message.set(`Reporte descargado exitosamente.`);
        },
        error: (err) => {
          this.message.set(`Error al exportar reporte: ${err?.error?.message ?? err?.message ?? 'Fallo de red'}`);
        },
      });
    } else if (format === 'JSON') {
      const filename = `reporte-${this.report.key}-${new Date().toISOString().split('T')[0]}`;
      exportToJson(this.rows(), filename);
      this.message.set(`Reporte exportado exitosamente en formato JSON.`);
    } else if (format === 'PDF') {
      const cols: ExportColumn[] = this.report.columns.map((c) => ({ key: c.key, label: c.label }));
      exportToPrintView(this.report.title, `Reporte del tenant ${this.session.tenant()} · NexoDocs`, this.rows(), cols);
      this.message.set(`Vista de impresión preparada.`);
    }
  }

  tableAction(row: ReportRow): void {
    if (this.report.key === 'areas') {
      this.selectedArea.set(String(row['area']));
      return;
    }
    this.message.set(`Actividad de ${row['user'] ?? row['owner'] ?? 'registro'}`);
  }

  chartPoints(groupBy: string): ChartPoint[] {
    const rows = this.rows();
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const label = String(row[groupBy] ?? 'Sin dato');
      const value = this.numericValue(row, groupBy);
      grouped.set(label, (grouped.get(label) ?? 0) + value);
    }
    const colors = ['#087f7b', '#4d9bd8', '#79c4bb', '#e3a633', '#7e5ab0', '#d76a6a', '#8aa19f'];
    return Array.from(grouped.entries()).map(([label, value], index) => ({ label, value, color: colors[index % colors.length] }));
  }

  selectedAreaRow(): ReportRow | undefined {
    return this.rows().find((row) => row['area'] === this.selectedArea());
  }

  areaValue(key: string): string | number {
    return this.selectedAreaRow()?.[key] ?? '—';
  }

  private numericValue(row: ReportRow, groupBy: string): number {
    if (groupBy === 'status' || groupBy === 'result' || groupBy === 'action' || groupBy === 'module' || groupBy === 'period') return 1;
    const numericKey = ['stateValue', 'activityValue', 'completedValue', 'growthValue', 'stageValue', 'areaValue'].find((key) => typeof row[key] === 'number');
    if (groupBy === 'category') return Number(row['used'] ?? row['percentage'] ?? 1);
    if (groupBy === 'area' && this.report.key === 'areas') return Number(row['documents'] ?? 1);
    return Number(row[numericKey ?? groupBy] ?? 1);
  }

  private buildKpis(rows: ReportRow[]): Kpi[] {
    const count = this.totalElements();
    const countValue = (key: string, value: string): number => rows.filter((row) => String(row[key]).toLowerCase() === value.toLowerCase()).length;
    switch (this.report.key) {
      case 'documents': return [
        { icon: '▤', label: 'Documentos', value: String(count), detail: 'Total periodo filtrado', tone: 'teal' },
        { icon: '✓', label: 'Aprobados', value: String(countValue('status', 'APPROVED')), detail: 'Estado aprobado', tone: 'green' },
        { icon: '◷', label: 'En revisión', value: String(countValue('status', 'IN_REVIEW')), detail: 'Pendientes de firma', tone: 'amber' },
        { icon: '↗', label: 'Áreas activas', value: String(new Set(rows.map((row) => row['area'])).size), detail: 'Distribución real', tone: 'blue' },
      ];
      case 'users': return [
        { icon: '♙', label: 'Usuarios', value: String(count), detail: 'Total periodo filtrado', tone: 'teal' },
        { icon: '✓', label: 'Activos', value: String(countValue('status', 'ACTIVE')), detail: 'Cuentas habilitadas', tone: 'green' },
        { icon: '◌', label: 'Inactivos', value: String(countValue('status', 'INACTIVE')), detail: 'Sin actividad', tone: 'muted' },
        { icon: '!', label: 'Suspendidos', value: String(countValue('status', 'SUSPENDED')), detail: 'Acceso restringido', tone: 'rose' },
        { icon: '↗', label: 'Con acciones', value: String(rows.filter((r) => Number(r['actions'] ?? 0) > 0).length), detail: 'Operativos en rango', tone: 'blue' },
      ];
      case 'workflows': return [
        { icon: '◷', label: 'Workflows', value: String(count), detail: 'Total periodo filtrado', tone: 'teal' },
        { icon: '✓', label: 'Completados', value: String(countValue('status', 'COMPLETED')), detail: 'Finalizados', tone: 'green' },
        { icon: '◌', label: 'En ejecución', value: String(countValue('status', 'RUNNING')), detail: 'Activos ahora', tone: 'blue' },
        { icon: '!', label: 'Fallidos', value: String(countValue('status', 'FAILED')), detail: 'Con incidencias', tone: 'rose' },
      ];
      case 'expedients': return [
        { icon: '🗂', label: 'Expedientes', value: String(count), detail: 'Total periodo filtrado', tone: 'teal' },
        { icon: '✓', label: 'Abiertos', value: String(countValue('status', 'OPEN')), detail: 'En trámite', tone: 'green' },
        { icon: '◷', label: 'En proceso', value: String(countValue('status', 'IN_PROCESS')), detail: 'Con gestiones', tone: 'amber' },
        { icon: '◌', label: 'Cerrados', value: String(countValue('status', 'CLOSED')), detail: 'Concluidos', tone: 'blue' },
      ];
      case 'audit': return [
        { icon: '📋', label: 'Eventos auditados', value: String(count), detail: 'Total periodo filtrado', tone: 'teal' },
        { icon: '✓', label: 'Operaciones exitosas', value: String(countValue('result', 'SUCCESS')), detail: 'Sin errores', tone: 'green' },
        { icon: '!', label: 'Fallos de acceso', value: String(countValue('result', 'FAILURE')), detail: 'Intentos fallidos', tone: 'rose' },
        { icon: '↗', label: 'Módulos impactados', value: String(new Set(rows.map((row) => row['module'])).size), detail: 'Superficie activa', tone: 'blue' },
      ];
      default: return [
        { icon: '▤', label: 'Registros', value: String(count), detail: 'Total periodo filtrado', tone: 'teal' },
        { icon: '↗', label: 'Áreas', value: String(new Set(rows.map((row) => row['area'])).size), detail: 'Con actividad', tone: 'blue' },
        { icon: '✓', label: 'Completados', value: String(countValue('status', 'ACTIVE') + countValue('status', 'APPROVED')), detail: 'Estado regular', tone: 'green' },
      ];
    }
  }

  private defaultDates(): Record<string, string> {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 30);
    return {
      dateFrom: past.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    };
  }

  private keyFromRoute(href: string): string {
    return ({
      '/reports': 'documents',
      '/reports/users': 'users',
      '/reports/workflows': 'workflows',
      '/reports/expedients': 'expedients',
      '/reports/audit': 'audit',
      '/reports/productivity': 'productivity',
      '/reports/by-area': 'areas',
    } as Record<string, string>)[href] ?? 'documents';
  }
}

export { ReportsPage as ReportesPage };
