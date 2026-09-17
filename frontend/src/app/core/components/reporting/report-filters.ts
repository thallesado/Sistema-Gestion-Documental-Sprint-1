import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReportFilter } from '../../data/report-data';

@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="report-filters" aria-label="Filtros del reporte">
      <div class="filter-title"><span>⌕</span><div><strong>Filtros globales</strong><small>Combina criterios para actualizar KPIs, gráficos y tabla.</small></div></div>
      @for (filter of filters; track filter.key) {
        <label class="report-filter">
          <span>{{ filter.label }}</span>
          @if (filter.type === 'select') {
            <select [value]="values[filter.key] || ''" (change)="change(filter.key, $event)">
              <option value="">Todos</option>
              @for (option of filter.options ?? []; track option) { <option [value]="option">{{ option }}</option> }
            </select>
          } @else {
            <input [type]="filter.type" [placeholder]="filter.placeholder ?? ''" [value]="values[filter.key] || ''" (input)="change(filter.key, $event)" />
          }
        </label>
      }
      <button type="button" class="report-reset" (click)="reset.emit()">Limpiar</button>
    </section>
  `,
})
export class ReportFilters {
  @Input() filters: ReportFilter[] = [];
  @Input() values: Record<string, string> = {};
  @Output() filtersChange = new EventEmitter<{ key: string; value: string }>();
  @Output() reset = new EventEmitter<void>();

  change(key: string, event: Event): void {
    this.filtersChange.emit({ key, value: (event.target as HTMLInputElement | HTMLSelectElement).value });
  }
}
