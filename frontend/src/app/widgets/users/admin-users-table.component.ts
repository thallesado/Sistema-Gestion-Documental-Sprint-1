import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiUser } from '../../core/api/administration-api.service';

@Component({
  selector: 'app-admin-users-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Tenant</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (user of users(); track user.id) {
            <tr>
              <td>
                <div class="user-cell">
                  <span class="user-avatar">{{ (user.fullName || user.username).charAt(0).toUpperCase() }}</span>
                  <div>
                    <strong>{{ user.fullName || user.username }}</strong>
                    <small>@{{ user.username }}</small>
                  </div>
                </div>
              </td>
              <td>{{ user.email }}</td>
              <td><span class="badge badge-role">{{ user.roleName || user.role }}</span></td>
              <td>{{ user.tenantName || user.tenantId }}</td>
              <td>
                <span [class]="'badge ' + (user.active ? 'badge-green' : 'badge-gray')">
                  {{ user.active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td>
                <button type="button" class="btn-sm btn-ghost" (click)="editUser.emit(user)">Editar</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty-state">No se encontraron usuarios registrados.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AdminUsersTableComponent {
  readonly users = input<ApiUser[]>([]);
  readonly editUser = output<ApiUser>();
}
