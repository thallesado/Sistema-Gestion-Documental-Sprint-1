import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Pagination } from '../../core/components/pagination/pagination';
import { KpiCard } from '../../core/components/reporting/kpi-card';
import { ReportChart } from '../../core/components/reporting/report-chart';
import { ReportFilters } from '../../core/components/reporting/report-filters';
import { ReportHeader } from '../../core/components/reporting/report-header';
import { ReportTable } from '../../core/components/reporting/report-table';
import { ChartPoint, ReportDefinition, ReportRow, reportDefinition } from '../../core/data/report-data';
import { DemoSessionState } from '../../core/state/demo-session';

type Kpi = { icon: string; label: string; value: string; detail: string; tone: string };

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, Pagination, KpiCard, ReportChart, ReportFilters, ReportHeader, ReportTable],
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

      @if (report.key === 'areas' && selectedArea()) {
        <div class="area-detail panel"><div><span class="side-kicker">DETALLE DEL ÁREA</span><h2>{{ selectedArea() }}</h2><p>Documentos, procesos y pendientes asociados al área seleccionada.</p></div><div class="area-detail-values"><strong>{{ areaValue('documents') }} <small>documentos</small></strong><strong>{{ areaValue('workflows') }} <small>workflows</small></strong><strong>{{ areaValue('tasks') }} <small>tareas</small></strong><strong>{{ areaValue('pending') }} <small>pendientes</small></strong></div><button type="button" class="text-button" (click)="selectedArea.set('')">Cerrar</button></div>
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
        [total]="filteredRows().length"
        [page]="page()"
        [pageSize]="pageSize()"
        [label]="'Paginación de ' + report.title"
        (pageChange)="page.set($event)"
        (pageSizeChange)="changePageSize($event)"
      />

      @if (message()) { <div class="inline-toast" role="status">{{ message() }}</div> }
      <footer class="demo-note"><span>ⓘ</span> Reporte de demostración con datos simulados de <b>{{ session.tenant() }}</b>. Los filtros y exportaciones son locales; no hay persistencia ni conexión directa con PostgreSQL.</footer>
    </section>
  `,
})
export class ReportsPage {
  readonly session = inject(DemoSessionState);
  private readonly route = inject(ActivatedRoute);
  private readonly routeKey = this.route.snapshot.data['routeInfo']?.href ?? '/reports';
  readonly report: ReportDefinition = reportDefinition(this.keyFromRoute(this.routeKey));
  readonly filterValues = signal<Record<string, string>>({});
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly message = signal('');
  readonly selectedArea = signal('');
  readonly tenantComparison: ChartPoint[] = [
    { label: 'Acme', value: 68, color: '#087f7b' },
    { label: 'Clínica', value: 57, color: '#4d9bd8' },
    { label: 'Universidad', value: 81, color: '#79c4bb' },
  ];

  readonly filteredRows = computed(() => {
    const values = this.filterValues();
    return this.report.rows.filter((row) =>
      Object.entries(values).every(([key, value]) => {
        if (!value) return true;
        if (key === 'dateFrom') return String(row['date'] ?? row['start'] ?? '') >= value;
        if (key === 'dateTo') return String(row['date'] ?? row['start'] ?? '') <= value;
        return String(row[key] ?? '').toLowerCase() === value.toLowerCase();
      }),
    );
  });

  readonly visibleRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  readonly kpis = computed<Kpi[]>(() => this.buildKpis(this.filteredRows()));

  get actionLabel(): string {
    if (this.report.key === 'users') return 'Ver actividad';
    if (this.report.key === 'areas') return 'Ver detalle';
    return '';
  }

  get tableTitle(): string {
    return this.report.key === 'audit' ? 'Eventos auditables' : this.report.key === 'areas' ? 'Detalle operativo por área' : `Detalle de ${this.report.title.replace('Reporte de ', '').toLowerCase()}`;
  }

  get tableSubtitle(): string {
    if (this.report.key === 'users') return 'Acciones operativas y último acceso por usuario';
    if (this.report.key === 'productivity') return 'Seguimiento de tareas asignadas, completadas y vencidas';
    if (this.report.key === 'areas') return 'Selecciona un área para consultar su desglose';
    return 'Resultados que respetan los filtros globales actuales';
  }

  get isSuperAdmin(): boolean { return this.session.role() === 'Superadministrador'; }

  filterSummary(): string {
    const count = Object.values(this.filterValues()).filter(Boolean).length;
    return count ? `${count} filtro${count === 1 ? '' : 's'} aplicado${count === 1 ? '' : 's'}` : 'filtros actuales';
  }

  changeFilter(key: string, value: string): void {
    this.filterValues.update((current) => ({ ...current, [key]: value }));
    this.page.set(1);
  }

  resetFilters(): void {
    this.filterValues.set({});
    this.page.set(1);
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  changeTenant(tenant: string): void {
    if (!this.isSuperAdmin) return;
    this.session.tenant.set(tenant);
    this.message.set(`Tenant visual cambiado a ${tenant}; datos demo sin persistencia`);
  }

  exportReport(format: string): void {
    this.message.set(`Stub de exportación ${format}: se respetan ${this.filterSummary()} y ${this.filteredRows().length} resultados; la generación futura corresponde a la API.`);
  }

  tableAction(row: ReportRow): void {
    if (this.report.key === 'areas') {
      this.selectedArea.set(String(row['area']));
      return;
    }
    this.message.set(`Ver actividad de ${row['user']}: vista local preparada para futura API`);
  }

  chartPoints(groupBy: string): ChartPoint[] {
    const rows = this.filteredRows();
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
    return this.filteredRows().find((row) => row['area'] === this.selectedArea());
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
    const count = rows.length;
    const countValue = (key: string, value: string): number => rows.filter((row) => row[key] === value).length;
    const sum = (key: string): number => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    switch (this.report.key) {
      case 'documents': return [
        { icon: '▤', label: 'Documentos', value: String(count), detail: 'Con filtros actuales', tone: 'teal' },
        { icon: '✓', label: 'Aprobados', value: String(countValue('status', 'Aprobado')), detail: 'Estado aprobado', tone: 'green' },
        { icon: '◷', label: 'Pendientes', value: String(countValue('status', 'Pendiente')), detail: 'Requieren atención', tone: 'amber' },
        { icon: '↗', label: 'Áreas activas', value: String(new Set(rows.map((row) => row['area'])).size), detail: 'Distribución actual', tone: 'blue' },
      ];
      case 'users': return [
        { icon: '♙', label: 'Registrados', value: String(count), detail: 'En el tenant actual', tone: 'teal' },
        { icon: '✓', label: 'Activos', value: String(countValue('status', 'Activo')), detail: 'Cuentas habilitadas', tone: 'green' },
        { icon: '◌', label: 'Inactivos', value: String(countValue('status', 'Inactivo')), detail: 'Sin actividad reciente', tone: 'muted' },
        { icon: '!', label: 'Bloqueados', value: String(countValue('status', 'Bloqueado')), detail: 'Acceso restringido', tone: 'rose' },
        { icon: '◷', label: 'Activos hoy', value: String(countValue('period', 'Hoy')), detail: 'Acceso reciente', tone: 'blue' },
        { icon: '+', label: 'Nuevos', value: String(countValue('newUser', 'Sí')), detail: 'Altas del periodo', tone: 'amber' },
      ];
      case 'workflows': return [
        { icon: '↗', label: 'Activos', value: String(countValue('status', 'Activo')), detail: 'En ejecución', tone: 'blue' },
        { icon: '✓', label: 'Completados', value: String(countValue('status', 'Completado')), detail: 'Dentro del reporte', tone: 'green' },
        { icon: '◷', label: 'Pendientes', value: String(countValue('status', 'Pendiente')), detail: 'Esperan una acción', tone: 'amber' },
        { icon: '!', label: 'Vencidos', value: String(countValue('status', 'Vencido')), detail: 'Cuello de botella', tone: 'rose' },
        { icon: '×', label: 'Cancelados', value: String(countValue('status', 'Cancelado')), detail: 'Cierre excepcional', tone: 'muted' },
        { icon: '◴', label: 'Tiempo medio', value: '2.4 d', detail: 'Mock por workflow', tone: 'teal' },
      ];
      case 'storage': return [
        { icon: '▤', label: 'Usado', value: `${sum('used').toFixed(1)} GB`, detail: 'De 10 GB disponibles', tone: 'teal' },
        { icon: '▰', label: 'Disponible', value: '10 GB', detail: 'Capacidad del tenant', tone: 'blue' },
        { icon: '▱', label: 'Libre', value: `${Math.max(0, 10 - sum('used')).toFixed(1)} GB`, detail: 'Estimación local', tone: 'green' },
        { icon: '↗', label: 'Archivos', value: String(sum('files')), detail: 'Por categoría', tone: 'amber' },
        { icon: '◫', label: 'Tamaño promedio', value: '2.0 MB', detail: 'Estimación por archivo', tone: 'blue' },
        { icon: '↗', label: 'Crecimiento', value: `+${sum('growthValue').toFixed(1)}%`, detail: 'Variación del periodo', tone: 'teal' },
      ];
      case 'audit': return [
        { icon: '◌', label: 'Eventos', value: String(count), detail: 'En el periodo filtrado', tone: 'teal' },
        { icon: '↗', label: 'Logins', value: String(countValue('action', 'Inicio de sesión')), detail: 'Accesos registrados', tone: 'blue' },
        { icon: '▤', label: 'Modificaciones', value: String(countValue('action', 'Modificación')), detail: 'Cambios de contenido', tone: 'amber' },
        { icon: '↓', label: 'Descargas', value: String(countValue('action', 'Descarga')), detail: 'Salidas registradas', tone: 'blue' },
        { icon: '!', label: 'Críticos', value: String(countValue('result', 'Crítico')), detail: 'Requieren revisión', tone: 'rose' },
        { icon: '×', label: 'Fallidos', value: String(countValue('result', 'Fallido')), detail: 'Accesos o acciones', tone: 'rose' },
      ];
      case 'productivity': return [
        { icon: '◷', label: 'Tareas asignadas', value: String(sum('assigned')), detail: 'Actividad operativa', tone: 'teal' },
        { icon: '✓', label: 'Completadas', value: String(sum('completed')), detail: 'Seguimiento local', tone: 'green' },
        { icon: '◌', label: 'Pendientes', value: String(sum('pending')), detail: 'En curso', tone: 'amber' },
        { icon: '!', label: 'Vencidas', value: String(sum('overdue')), detail: 'Requieren atención', tone: 'rose' },
        { icon: '◴', label: 'Tiempo medio', value: '2.2 d', detail: 'Mock por tarea', tone: 'blue' },
        { icon: '↗', label: 'Workflows', value: String(new Set(rows.map((row) => row['workflow'])).size), detail: 'Tipos con actividad', tone: 'teal' },
      ];
      default: return [
        { icon: '↗', label: 'Área más activa', value: rows[0]?.['area'] ? String(rows[0]['area']) : '—', detail: 'Según documentos', tone: 'teal' },
        { icon: '▤', label: 'Documentos', value: String(sum('documents')), detail: 'Por área seleccionada', tone: 'blue' },
        { icon: '◷', label: 'Workflows', value: String(sum('workflows')), detail: 'En seguimiento', tone: 'amber' },
        { icon: '▣', label: 'Tareas', value: String(sum('tasks')), detail: 'Carga operativa', tone: 'amber' },
        { icon: '♙', label: 'Usuarios', value: String(sum('users')), detail: 'Con actividad', tone: 'green' },
      ];
    }
  }

  private keyFromRoute(href: string): string {
    return ({ '/reports': 'documents', '/reports/users': 'users', '/reports/workflows': 'workflows', '/reports/storage': 'storage', '/reports/audit': 'audit', '/reports/productivity': 'productivity', '/reports/by-area': 'areas' } as Record<string, string>)[href] ?? 'documents';
  }
}
