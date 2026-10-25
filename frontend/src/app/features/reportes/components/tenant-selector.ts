import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tenant-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="tenant-selector">
      <span>Tenant</span>
      <strong>{{ tenant }}</strong>
      @if (role) { <small>Rol: {{ role }}</small> }
    </label>
  `,
})
export class TenantSelector {
  @Input() tenant = 'Organización autenticada';
  @Input() role = '';
}
