import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiRole, ApiUser } from '../../core/api/administration-api.service';

@Component({
  selector: 'app-admin-modals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (editUser) {
      <div class="modal-backdrop" (click)="closeEdit.emit()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>Editar Usuario: {{ editUser.username }}</h3>
            <button class="icon-btn" (click)="closeEdit.emit()">✕</button>
          </header>
          <div class="modal-body">
            @if (editError) { <div class="notice error">{{ editError }}</div> }
            <div class="form-grid">
              <label>Nombres<input [(ngModel)]="editForm.firstName" /></label>
              <label>Apellidos<input [(ngModel)]="editForm.lastName" /></label>
              <label>Correo electrónico<input [(ngModel)]="editForm.email" /></label>
              <label>Estado
                <select [(ngModel)]="editForm.status">
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="LOCKED">Bloqueado</option>
                </select>
              </label>
            </div>
            <div class="roles-selection" style="margin-top: 16px;">
              <h4>Roles asignados</h4>
              <div class="roles-chips">
                @for (role of roles; track role.id) {
                  <button type="button" class="role-chip" [class.selected]="isRoleSelected(role.id)" (click)="toggleRole.emit(role.id)">
                    {{ role.name }}
                  </button>
                }
              </div>
            </div>
          </div>
          <footer class="modal-footer">
            <button class="secondary-action" (click)="closeEdit.emit()">Cancelar</button>
            <button class="primary-action" [disabled]="saving" (click)="saveEdit.emit()">
              {{ saving ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </footer>
        </div>
      </div>
    }

    @if (confirmation) {
      <div class="modal-backdrop" (click)="closeConfirmation.emit()">
        <div class="modal-card confirmation-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>{{ confirmation.title }}</h3>
            <button class="icon-btn" (click)="closeConfirmation.emit()">✕</button>
          </header>
          <div class="modal-body">
            <p>{{ confirmation.message }}</p>
          </div>
          <footer class="modal-footer">
            <button class="secondary-action" (click)="closeConfirmation.emit()">Cancelar</button>
            <button class="primary-action danger-action" (click)="confirmAction.emit()">Confirmar</button>
          </footer>
        </div>
      </div>
    }
  `
})
export class AdminModalsComponent {
  @Input() editUser: ApiUser | null = null;
  @Input() editForm: any = {};
  @Input() editError: string | null = null;
  @Input() roles: ApiRole[] = [];
  @Input() saving = false;
  @Input() confirmation: { title: string; message: string; action: () => void } | null = null;

  @Output() closeEdit = new EventEmitter<void>();
  @Output() saveEdit = new EventEmitter<void>();
  @Output() toggleRole = new EventEmitter<number>();
  @Output() closeConfirmation = new EventEmitter<void>();
  @Output() confirmAction = new EventEmitter<void>();

  isRoleSelected(roleId: number): boolean {
    return this.editForm?.roleIds?.includes(roleId) ?? false;
  }
}
