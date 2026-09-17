import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReportColumn, ReportRow } from '../../data/report-data';

@Component({
  selector: 'app-report-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="report-table panel">
      <div class="report-table-heading"><div><h2>{{ title }}</h2><p>{{ subtitle }}</p></div><span class="table-count">{{ rows.length }} visibles</span></div>
      <div class="table-scroll">
        <table>
          <thead><tr>@for (column of columns; track column.key) { <th scope="col">{{ column.label }}</th> } @if (actionLabel) { <th scope="col">Acción</th> }</tr></thead>
          <tbody>
            @for (row of rows; track $index) {
              <tr>@for (column of columns; track column.key) { <td [class.status-cell]="column.key === 'status' || column.key === 'result'"><span [class]="badgeClass(column.key, row[column.key])">{{ row[column.key] }}</span></td> } @if (actionLabel) { <td><button type="button" class="table-action" (click)="action.emit(row)">{{ actionLabel }}</button></td> }</tr>
            } @empty { <tr><td class="table-empty" [attr.colspan]="columns.length + (actionLabel ? 1 : 0)">No hay resultados con estos filtros.</td></tr> }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class ReportTable {
  @Input() title = 'Detalle del reporte';
  @Input() subtitle = '';
  @Input() columns: ReportColumn[] = [];
  @Input() rows: ReportRow[] = [];
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<ReportRow>();

  badgeClass(key: string, value: string | number): string {
    if (key !== 'status' && key !== 'result') return '';
    const text = String(value).toLowerCase();
    if (['aprobado', 'activo', 'completado', 'exitoso'].includes(text)) return 'table-status ok';
    if (['vencido', 'bloqueado', 'fallido', 'crítico', 'cancelado'].includes(text)) return 'table-status danger';
    return 'table-status pending';
  }
}
