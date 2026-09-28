import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ExportDropdown } from './export-dropdown';
import { TenantSelector } from './tenant-selector';

@Component({
  selector: 'app-report-header',
  standalone: true,
  imports: [ExportDropdown, TenantSelector],
  template: `
    <header class="report-header">
      <div class="report-heading">
        <p class="eyebrow">Reportes <span>·</span> {{ title }}</p>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <div class="report-header-actions">
        <app-tenant-selector
          [tenant]="tenant"
          [role]="role"
          (tenantChange)="tenantChange.emit($event)"
        />
        <app-export-dropdown [filterSummary]="filterSummary" (export)="export.emit($event)" />
      </div>
    </header>
  `,
})
export class ReportHeader {
  @Input() title = '';
  @Input() description = '';
  @Input() tenant = 'Organización autenticada';
  @Input() role = '';
  @Input() filterSummary = 'Filtros actuales';
  @Output() tenantChange = new EventEmitter<string>();
  @Output() export = new EventEmitter<string>();
}
