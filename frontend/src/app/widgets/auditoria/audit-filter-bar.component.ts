import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-audit-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="filter-card">
      <div class="filter-grid">
        <div class="field">
          <label for="audit-search">Buscar</label>
          <input
            id="audit-search"
            type="text"
            placeholder="Usuario, acción, IP…"
            [value]="search()"
            (input)="searchChange.emit($any($event.target).value)"
          >
        </div>
        <div class="field">
          <label for="audit-module">Módulo</label>
          <select
            id="audit-module"
            [value]="module()"
            (change)="moduleChange.emit($any($event.target).value)"
          >
            <option value="">Todos los módulos</option>
            <option value="AUTH">Autenticación</option>
            <option value="DOCUMENT">Documentos</option>
            <option value="EXPEDIENT">Expedientes</option>
            <option value="CLINICAL">Clínico</option>
            <option value="USER">Usuarios</option>
            <option value="SYSTEM">Sistema</option>
          </select>
        </div>
        <div class="field">
          <label for="audit-date-from">Desde</label>
          <input
            id="audit-date-from"
            type="date"
            [value]="dateFrom()"
            (input)="dateFromChange.emit($any($event.target).value)"
          >
        </div>
        <div class="field">
          <label for="audit-date-to">Hasta</label>
          <input
            id="audit-date-to"
            type="date"
            [value]="dateTo()"
            (input)="dateToChange.emit($any($event.target).value)"
          >
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" class="btn-ghost" (click)="clear.emit()">Limpiar filtros</button>
        <button type="button" class="btn-secondary" (click)="exportCsv.emit()">Exportar CSV</button>
      </div>
    </section>
  `
})
export class AuditFilterBarComponent {
  readonly search = input<string>('');
  readonly module = input<string>('');
  readonly dateFrom = input<string>('');
  readonly dateTo = input<string>('');

  readonly searchChange = output<string>();
  readonly moduleChange = output<string>();
  readonly dateFromChange = output<string>();
  readonly dateToChange = output<string>();
  readonly clear = output<void>();
  readonly exportCsv = output<void>();
}
