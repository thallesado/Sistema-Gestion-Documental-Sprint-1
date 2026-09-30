import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdministrationApiService, ApiRole, ApiTenant, ApiUser } from '../../../core/api/administration-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantsViewComponent } from '../../../widgets/users/tenants-view.component';
import { AdminModalsComponent } from '../../../widgets/users/admin-modals.component';
import { CreateUserModal } from '../../../features/users/components/create-user-modal';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';

@Component({
  selector: 'app-administration-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TenantsViewComponent, AdminModalsComponent, CreateUserModal],
  templateUrl: './administracion.page.html',
  styleUrl: './administracion.page.css'
})
export class AdministracionPage implements OnInit {
  private readonly api = inject(AdministrationApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly isTenantArea = this.route.snapshot.url.some(s => s.path === 'tenants');
  readonly isSuperadmin = computed(() => this.auth.user()?.platformAdmin ?? false);
  readonly canManageUsers = computed(() => this.isSuperadmin() || (this.auth.user()?.roleNames?.some(r => r.toUpperCase().includes('ADMIN')) ?? false));

  readonly users = signal<ApiUser[]>([]);
  readonly roles = signal<ApiRole[]>([]);
  readonly tenants = signal<ApiTenant[]>([]);
  readonly editUser = signal<ApiUser | null>(null);
  readonly editError = signal<string | null>(null);
  readonly confirmation = signal<{ title: string; message: string; action: () => void } | null>(null);
  readonly showCreateModal = signal(false);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly message = signal<string | null>(null);

  editForm: any = { firstName: '', lastName: '', email: '', status: 'ACTIVE', roleIds: [] };
  tenantForm = { name: '', code: '', slug: '', email: '' };

  ngOnInit(): void {
    if (this.isTenantArea) this.loadTenants();
    else { this.loadUsers(); this.loadRoles(); }
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.users('', 0, 50).subscribe({
      next: res => { this.users.set(res.content); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  loadRoles(): void { this.api.roles().subscribe({ next: r => this.roles.set(r) }); }
  loadTenants(): void { this.api.tenants().subscribe({ next: t => this.tenants.set(t) }); }

  onUserCreated(): void {
    this.showCreateModal.set(false);
    this.loadUsers();
    this.message.set('Usuario creado correctamente.');
  }

  createTenant(): void {
    if (!this.tenantForm.name || !this.tenantForm.code) return;
    this.saving.set(true);
    this.api.createTenant(this.tenantForm).subscribe({
      next: () => { this.saving.set(false); this.loadTenants(); this.tenantForm = { name: '', code: '', slug: '', email: '' }; },
      error: () => this.saving.set(false)
    });
  }

  changeTenantStatus(event: { id: string; status: string }): void {
    this.api.changeTenantStatus(event.id, event.status).subscribe({ next: () => this.loadTenants() });
  }

  exportUsers(format: 'Excel' | 'PDF' | 'JSON'): void {
    const rows = this.users().map(u => ({
      nombre: `${u.firstName} ${u.lastName}`, usuario: u.username, correo: u.email,
      perfil: u.staffType || 'No asignado', estado: u.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
    }));
    const cols: ExportColumn[] = [
      { key: 'nombre', label: 'Nombre' }, { key: 'usuario', label: 'Usuario' }, { key: 'correo', label: 'Correo' },
      { key: 'perfil', label: 'Perfil clínico' }, { key: 'estado', label: 'Estado' },
    ];
    const filename = `usuarios-${new Date().toISOString().split('T')[0]}`;
    if (format === 'JSON') exportToJson(rows, filename);
    else if (format === 'PDF') exportToPrintView('Usuarios', 'Módulo Usuarios y equipos · NexoDocs', rows, cols);
    else exportToCsv(rows, filename, cols);
  }

  edit(user: ApiUser): void {
    this.editUser.set(user);
    this.editForm = { firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, roleIds: [...(user.roleIds ?? [])] };
  }

  deactivate(user: ApiUser): void {
    this.confirmation.set({
      title: 'Desactivar usuario',
      message: `¿Quieres desactivar a ${user.firstName} ${user.lastName}?`,
      action: () => this.changeUserStatus(user, 'INACTIVE', 'Usuario desactivado.')
    });
  }

  reactivate(user: ApiUser): void {
    this.changeUserStatus(user, 'ACTIVE', 'Usuario reactivado.');
  }

  private changeUserStatus(user: ApiUser, status: 'ACTIVE' | 'INACTIVE', okMessage: string): void {
    this.api.updateUser(user.id, { firstName: user.firstName, lastName: user.lastName, email: user.email, status, roleIds: user.roleIds ?? [] }).subscribe({
      next: updated => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, status: updated?.status ?? status } : u));
        this.message.set(okMessage);
      },
      error: () => { this.error.set(true); this.message.set('No se pudo actualizar el estado del usuario.'); }
    });
  }

  closeEdit(): void { this.editUser.set(null); }
  toggleEditRole(id: number): void {
    const list = this.editForm.roleIds;
    this.editForm.roleIds = list.includes(id) ? list.filter((r: number) => r !== id) : [...list, id];
  }

  saveEdit(): void {
    const u = this.editUser();
    if (!u) return;
    this.saving.set(true);
    this.api.updateUser(u.id, this.editForm).subscribe({
      next: () => { this.saving.set(false); this.closeEdit(); this.loadUsers(); },
      error: err => { this.saving.set(false); this.editError.set(err?.message || 'Error al guardar.'); }
    });
  }

  closeConfirmation(): void { this.confirmation.set(null); }
  confirmAction(): void { this.confirmation()?.action(); this.closeConfirmation(); }
}

export const AdministrationPage = AdministracionPage;
