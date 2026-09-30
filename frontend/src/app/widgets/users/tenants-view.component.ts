import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiTenant } from '../../core/api/administration-api.service';

@Component({
  selector: 'app-tenants-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (isCreate()) {
      <header class="admin-header"><div><p class="eyebrow">Administración global · Tenants</p><h1>Crear organización</h1><p>Registra un nuevo tenant en NexoDocs.</p></div></header>
      <form class="admin-form" (ngSubmit)="createTenant.emit()">
        <h2>Nuevo tenant</h2>
        <div class="form-grid">
          <label>Nombre<input name="tenantName" [(ngModel)]="tenantForm().name" required /></label>
          <label>Código<input name="tenantCode" [(ngModel)]="tenantForm().code" required /></label>
          <label>Slug<input name="tenantSlug" [(ngModel)]="tenantForm().slug" required /></label>
          <label>Correo de contacto<input type="email" name="tenantEmail" [(ngModel)]="tenantForm().email" required /></label>
        </div>
        <div class="form-actions">
          <a routerLink="/tenants" class="admin-secondary">Cancelar</a>
          <button class="admin-primary" type="submit" [disabled]="saving()">Crear tenant</button>
        </div>
      </form>
    } @else {
      <header class="admin-header">
        <div><p class="eyebrow">Administración global · Tenants</p><h1>Organizaciones</h1><p>Gestiona el ciclo de vida de los tenants de NexoDocs.</p></div>
        <a class="admin-primary" routerLink="/tenants/new">＋ Crear tenant</a>
      </header>
      @if (loading()) { <p class="admin-empty">Cargando tenants…</p> }
      @else if (error()) { <div class="admin-state error" role="alert"><b>Error al cargar tenants</b><span>{{ message() }}</span></div> }
      @else {
        <section class="admin-table-wrap">
          <table>
            <thead><tr><th>Organización</th><th>Código</th><th>Slug</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              @for (tenant of tenants(); track tenant.id) {
                <tr>
                  <td><b>{{ tenant.name }}</b></td>
                  <td>{{ tenant.code }}</td>
                  <td>{{ tenant.slug }}</td>
                  <td><span class="admin-status" [class.inactive]="tenant.status !== 'ACTIVE'">{{ tenant.status }}</span></td>
                  <td><button class="link-button" type="button" (click)="changeStatus.emit(tenant)">{{ tenant.status === 'ACTIVE' ? 'Suspender' : 'Activar' }}</button></td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    }
  `
})
export class TenantsViewComponent {
  readonly isCreate = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly error = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly message = input<string | null>(null);
  readonly tenants = input<ApiTenant[]>([]);
  readonly tenantForm = input.required<{ name: string; code: string; slug: string; email: string }>();

  readonly createTenant = output<void>();
  readonly changeStatus = output<ApiTenant>();
}
