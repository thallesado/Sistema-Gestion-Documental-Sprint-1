import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { AdministrationApiService, ApiRolePermissions } from '../../../core/api/administration-api.service';
import { PermissionDetailModal } from './permission-detail-modal';

@Component({
  selector: 'app-role-permissions-modal',
  imports: [CommonModule, PermissionDetailModal],
  template: `
    @if (roleId != null) {
      <div class="modal-backdrop" role="presentation">
        <section class="admin-modal permissions-modal" role="dialog" aria-modal="true" aria-labelledby="role-permissions-title">
          <h2 id="role-permissions-title">Permisos de {{ data()?.roleName || 'rol' }}</h2>
          <p class="form-note">Marca los permisos que este rol debe conceder, agrupados por módulo.</p>
          @if (loading()) { <p class="admin-empty">Cargando permisos…</p> }
          @else if (error()) { <div class="admin-state error" role="alert">{{ error() }}</div> }
          @else {
            <div class="permission-modules">
              @for (group of data()?.modules; track group.module) {
                <section class="permission-group">
                  <h3>{{ group.module }}</h3>
                  <ul>
                    @for (item of group.permissions; track item.id) {
                      <li class="permission-row">
                        <label class="switch-label">
                          <input type="checkbox" [checked]="selected().has(item.id)" (change)="toggle(item.id)" />
                          <span>{{ item.code }}</span>
                        </label>
                        <span class="criticality-pill" [class]="item.criticality.toLowerCase()">{{ item.criticality }}</span>
                        <button class="link-button" type="button" (click)="detailId.set(item.id)">Ver detalle</button>
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          }
          @if (saveError()) { <div class="admin-state error" role="alert">{{ saveError() }}</div> }
          <div class="form-actions">
            <button class="admin-secondary" type="button" (click)="closed.emit()">Cancelar</button>
            <button class="admin-primary" type="button" (click)="save()" [disabled]="saving() || loading()">Guardar cambios</button>
          </div>
        </section>
      </div>
      <app-permission-detail-modal [permissionId]="detailId()" (close)="detailId.set(null)" />
    }
  `,
})
export class RolePermissionsModal implements OnChanges {
  private readonly api = inject(AdministrationApiService);
  @Input() roleId: number | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<void>();
  readonly data = signal<ApiRolePermissions | null>(null);
  readonly selected = signal<Set<number>>(new Set());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveError = signal('');
  readonly detailId = signal<number | null>(null);

  ngOnChanges(): void {
    if (this.roleId == null) { this.data.set(null); return; }
    this.loading.set(true);
    this.error.set('');
    this.saveError.set('');
    this.api.rolePermissions(this.roleId).subscribe({
      next: (response) => {
        this.data.set(response);
        const granted = new Set<number>();
        response.modules.forEach((group) => group.permissions.forEach((item) => {
          if (item.granted) granted.add(item.id);
        }));
        this.selected.set(granted);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('No se pudieron cargar los permisos del rol.'); },
    });
  }

  toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selected.set(next);
  }

  save(): void {
    if (this.roleId == null) return;
    this.saving.set(true);
    this.saveError.set('');
    this.api.updateRolePermissions(this.roleId, [...this.selected()]).subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); this.closed.emit(); },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.status === 400
          ? 'La lista de permisos no puede quedar vacía.'
          : 'No se pudieron guardar los permisos.');
      },
    });
  }
}
