import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AuditFilterOption = {
  value: string;
  label: string;
};

export type AuditFilterField = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'select';
  placeholder?: string;
  options?: AuditFilterOption[];
};

@Component({
  selector: 'app-audit-filters',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="audit-filters" aria-label="Filtros de auditoría">
      <div class="audit-filter-heading"><span>≡</span><div><strong>Filtrar registros</strong><small>Refina esta vista de auditoría</small></div></div>
      @for (field of fields; track field.key) {
        <label class="audit-filter-field">
          <span>{{ field.label }}</span>
          @if (field.type === 'select') {
            <select [value]="values[field.key] || ''" (change)="change(field.key, $event)">
              <option value="">Todos</option>
              @for (option of field.options ?? []; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
            </select>
          } @else {
            <input [type]="field.type || 'text'" [value]="values[field.key] || ''" [placeholder]="field.placeholder || ''" (input)="change(field.key, $event)" />
          }
        </label>
      }
      <button type="button" class="audit-reset" (click)="reset()">Limpiar</button>
    </section>
  `,
})
export class AuditFilters {
  @Input() fields: AuditFilterField[] = [];
  @Input() values: Record<string, string> = {};
  @Output() valuesChange = new EventEmitter<Record<string, string>>();

  change(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.valuesChange.emit({ ...this.values, [key]: value });
  }

  reset(): void {
    this.valuesChange.emit({});
  }
}
