import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportApiService } from '../../../core/api/report-api.service';

type QueryKind = 'documents' | 'expedients' | 'workflows' | 'users';
type QueryField = { key: string; label: string; placeholder: string };
const FIELDS: Record<QueryKind, QueryField[]> = {
  documents: [
    { key: 'search', label: 'Nombre o código', placeholder: 'Texto de ejemplo' },
    { key: 'type', label: 'Tipo', placeholder: 'Ej. contrato' },
    { key: 'area', label: 'Área', placeholder: 'Ej. administración' },
    { key: 'owner', label: 'Responsable', placeholder: 'Nombre del responsable' },
    { key: 'status', label: 'Estado', placeholder: 'Ej. APPROVED' },
  ],
  expedients: [
    { key: 'type', label: 'Tipo de expediente', placeholder: 'Tipo' },
    { key: 'area', label: 'Área', placeholder: 'Área' },
    { key: 'owner', label: 'Responsable', placeholder: 'Responsable' },
    { key: 'status', label: 'Estado', placeholder: 'Ej. ACTIVE' },
  ],
  workflows: [
    { key: 'type', label: 'Tipo o plantilla', placeholder: 'Plantilla' },
    { key: 'owner', label: 'Responsable', placeholder: 'Responsable' },
    { key: 'status', label: 'Estado', placeholder: 'Ej. IN_PROGRESS' },
  ],
  users: [
    { key: 'area', label: 'Área', placeholder: 'Área' },
    { key: 'owner', label: 'Usuario', placeholder: 'Nombre de usuario' },
    { key: 'status', label: 'Estado', placeholder: 'Ej. ACTIVE' },
  ],
};

@Component({
  selector: 'app-qbe-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page qbe-page">
      <header class="page-header"><div><small>REPORTES · CONSULTAS DINÁMICAS</small><h1>Consulta por ejemplo</h1>
        <p>Elige un conjunto de datos y completa los campos que quieres encontrar. La consulta usa los filtros autorizados del reporte.</p></div></header>
      <section class="panel builder" aria-label="Constructor de consulta">
        <div class="controls">
          <label>Información a consultar
            <select [ngModel]="kind()" (ngModelChange)="selectKind($event)">
              <option value="documents">Documentos</option><option value="expedients">Expedientes</option>
              <option value="workflows">Workflows</option><option value="users">Usuarios</option>
            </select>
          </label>
          <label>Desde <input type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" /></label>
          <label>Hasta <input type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" /></label>
        </div>
        <h2>Completa los ejemplos que correspondan</h2>
        <div class="fields">
          @for (field of fields(); track field.key) {
            <label>{{ field.label }}<input [placeholder]="field.placeholder" [ngModel]="values()[field.key] ?? ''" (ngModelChange)="setValue(field.key, $event)" /></label>
          }
        </div>
        <div class="actions"><button type="button" class="primary" (click)="run()" [disabled]="loading()">{{ loading() ? 'Consultando…' : 'Ejecutar consulta' }}</button>
          <button type="button" (click)="clear()">Limpiar</button>
          @if (rows().length) { <button type="button" (click)="exportCsv()" [disabled]="exporting()">{{ exporting() ? 'Preparando…' : 'Descargar CSV' }}</button> }
        </div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      </section>
      <section class="panel results" aria-live="polite">
        <div class="results-title"><div><h2>Resultados</h2><p>{{ total() }} registros encontrados</p></div></div>
        @if (loading()) { <p>Consultando datos del servidor…</p> }
        @else if (!rows().length) { <p class="empty">Completa los criterios y ejecuta la consulta para ver resultados.</p> }
        @else {
          <div class="table-wrap"><table><thead><tr>@for (column of columns(); track column) { <th>{{ column }}</th> }</tr></thead>
            <tbody>@for (row of rows(); track $index) { <tr>@for (column of columns(); track column) { <td>{{ value(row, column) }}</td> }</tr> }</tbody>
          </table></div>
          <div class="pager"><button type="button" (click)="page.set(page() - 1); run()" [disabled]="page() <= 1 || loading()">Anterior</button>
            <span>Página {{ page() }} de {{ totalPages() }}</span>
            <button type="button" (click)="page.set(page() + 1); run()" [disabled]="page() >= totalPages() || loading()">Siguiente</button></div>
        }
      </section>
    </section>
  `,
  styles: [`
    .qbe-page { display:grid; gap:18px; } .page-header small { color:#07867f; font-weight:700; letter-spacing:.08em; }
    .page-header h1 { margin:6px 0; color:#082b2a; } .page-header p,.results-title p { color:#617775; margin:0; }
    .panel { background:#fff; border:1px solid #dce9e7; border-radius:14px; padding:20px; box-shadow:0 4px 16px #0b33330b; }
    .controls,.fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
    label { display:grid; gap:7px; color:#193c3a; font-size:13px; font-weight:650; }
    input,select { min-height:40px; border:1px solid #cbdedb; border-radius:8px; padding:8px 10px; color:#183432; background:white; }
    h2 { color:#123936; font-size:17px; margin:20px 0 12px; } .actions,.pager { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:18px; }
    button { border:1px solid #b9d4d0; background:white; color:#087f7b; border-radius:8px; padding:9px 14px; font-weight:650; cursor:pointer; }
    button.primary { background:#087f7b; color:white; border-color:#087f7b; } button:disabled { opacity:.5; cursor:default; }
    .error { color:#a32626; } .empty { padding:28px 4px; text-align:center; color:#6a8280; }
    .table-wrap { overflow:auto; } table { width:100%; border-collapse:collapse; font-size:13px; } th,td { padding:10px; border-bottom:1px solid #e4eeec; text-align:left; white-space:nowrap; }
    th { color:#42615e; background:#f4f9f8; } .pager { justify-content:flex-end; } .results-title { display:flex; justify-content:space-between; }
  `],
})
export class QbePage {
  private readonly api = inject(ReportApiService);
  readonly kind = signal<QueryKind>('documents');
  readonly fields = computed(() => FIELDS[this.kind()]);
  readonly values = signal<Record<string, string>>({});
  readonly today = new Date().toISOString().slice(0, 10);
  readonly dateFrom = signal(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  readonly dateTo = signal(this.today);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly columns = signal<string[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');

  selectKind(kind: QueryKind): void { this.kind.set(kind); this.values.set({}); this.rows.set([]); this.total.set(0); this.page.set(1); }
  setValue(key: string, value: string): void { this.values.update((current) => ({ ...current, [key]: value })); }
  clear(): void { this.values.set({}); this.rows.set([]); this.columns.set([]); this.total.set(0); this.error.set(''); this.page.set(1); }
  value(row: Record<string, unknown>, column: string): string { const v = row[column]; return v == null ? '—' : String(v); }

  run(): void {
    if (!this.dateFrom() || !this.dateTo() || this.dateFrom() > this.dateTo()) { this.error.set('Indica un rango de fechas válido.'); return; }
    this.loading.set(true); this.error.set('');
    const filters = { dateFrom: this.dateFrom(), dateTo: this.dateTo(), ...this.values() };
    this.api.getReport(this.kind(), filters, this.page(), 20).subscribe({
      next: (response) => { this.rows.set(response.content ?? []); this.total.set(response.totalElements ?? 0); this.totalPages.set(response.totalPages ?? 0); this.columns.set(response.content?.length ? Object.keys(response.content[0]) : []); this.loading.set(false); },
      error: () => { this.rows.set([]); this.total.set(0); this.totalPages.set(0); this.error.set('No se pudo ejecutar la consulta. Revisa filtros y permisos e inténtalo de nuevo.'); this.loading.set(false); },
    });
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.api.downloadCsv(this.kind(), { dateFrom: this.dateFrom(), dateTo: this.dateTo(), ...this.values() }).subscribe({
      next: (blob) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `consulta-${this.kind()}-${this.today}.csv`; link.click(); URL.revokeObjectURL(url); this.exporting.set(false); },
      error: () => { this.error.set('No se pudo preparar la exportación. Ajusta los filtros e inténtalo de nuevo.'); this.exporting.set(false); },
    });
  }
}
