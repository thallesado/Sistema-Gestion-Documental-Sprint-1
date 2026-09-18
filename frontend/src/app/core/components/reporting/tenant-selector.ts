import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-tenant-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="tenant-selector">
      <span>Tenant</span>
      @if (isSuperAdmin) {
        <select [value]="tenant" (change)="tenantChange.emit(($any($event.target)).value)">
          @for (option of options; track option) { <option [value]="option">{{ option }}</option> }
        </select>
      } @else {
        <strong>{{ tenant }}</strong><small>Rol: {{ role }}</small>
      }
    </label>
  `,
})
export class TenantSelector {
  @Input() tenant = 'Organización autenticada';
  @Input() role = '';
  @Output() tenantChange = new EventEmitter<string>();
  readonly options = ['Todos los tenants'];

  get isSuperAdmin(): boolean { return this.role === 'Superadministrador'; }
}
