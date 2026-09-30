import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdministrationApiService, ApiRole, ApiTenant, ApiUser, CreateUserPayload } from '../../../core/api/administration-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { RolePermissionsModal } from '../components/role-permissions-modal';
import { TenantsViewComponent } from '../../../widgets/users/tenants-view.component';
import { AdminModalsComponent } from '../../../widgets/users/admin-modals.component';

@Component({
  selector: 'app-administration-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TenantsViewComponent, AdminModalsComponent],
  template: `
    <section class="admin-page">
      @if (isTenantArea) {
        @if (isSuperadmin()) {
          <app-tenants-view
            [isCreate]="isCreate"
            [loading]="loading()"
            [error]="error()"
            [saving]="saving()"
            [message]="message()"
            [tenants]="tenants()"
            [tenantForm]="tenantForm"
            (createTenant)="createTenant()"
            (changeStatus)="changeTenantStatus($event)"
          />
        } @else {
          <div class="admin-state forbidden" role="alert"><b>Acceso restringido</b><span>La vista global de tenants solo está disponible para Superadministrador.</span></div>
        }
      } @else if (!canManageUsers()) {
        <div class="admin-state forbidden" role="alert"><b>Acceso restringido</b><span>Solo un Administrador de tenant o Superadministrador puede gestionar usuarios.</span></div>
      } @else {
        <header class="admin-header">
          <div><p class="eyebrow">Gestión · Usuarios y equipos</p><h1>{{ isCreate ? 'Crear usuario' : 'Usuarios del tenant' }}</h1><p>Administra las cuentas sin salir del tenant autenticado.</p></div>
          @if (!isCreate) { <a class="admin-primary" routerLink="/users/new">＋ Crear usuario</a> }
        </header>

        @if (isCreate) {
          <form class="admin-form create-user-form" [formGroup]="userForm" (ngSubmit)="onSubmit()" novalidate>
            @if (message()) { <div class="admin-state" [class.error]="error()" [class.success]="!error()">{{ message() }}</div> }
            <div class="form-grid">
              <label>Nombre<input formControlName="firstName" /></label>
              <label>Apellido<input formControlName="lastName" /></label>
              <label>Usuario<input formControlName="username" /></label>
              <label>Correo<input type="email" formControlName="email" /></label>
              <label>Contraseña<input type="password" formControlName="password" /></label>
              <label>Confirmar contraseña<input type="password" formControlName="confirmPassword" /></label>
            </div>
            <div class="form-actions"><a routerLink="/users" class="admin-secondary">Cancelar</a><button class="admin-primary" type="submit" [disabled]="saving() || userForm.invalid">{{ saving() ? 'Creando…' : 'Crear usuario' }}</button></div>
          </form>
        } @else {
          <div class="admin-table-wrap">
            @if (loading()) { <p class="admin-empty">Cargando usuarios…</p> }
            @else {
              <table class="admin-table">
                <thead><tr><th>Usuario</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  @for (user of users(); track user.id) {
                    <tr>
                      <td><b>{{ user.firstName }} {{ user.lastName }}</b><small>@{{ user.username }}</small></td>
                      <td>{{ user.email }}</td>
                      <td><span class="status-badge" [class.active]="user.status === 'ACTIVE'">{{ user.status }}</span></td>
                      <td><button type="button" class="btn-link" (click)="edit(user)">Editar</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }
      }

      <app-admin-modals
        [editUser]="editUser()"
        [editForm]="editForm"
        [editError]="editError()"
        [roles]="roles()"
        [saving]="saving()"
        [confirmation]="confirmation()"
        (closeEdit)="closeEdit()"
        (saveEdit)="saveEdit()"
        (toggleRole)="toggleEditRole($event)"
        (closeConfirmation)="closeConfirmation()"
        (confirmAction)="confirmAction()"
      />
    </section>
  `
})
export class AdministracionPage implements OnInit {
  private readonly api = inject(AdministrationApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly isTenantArea = this.route.snapshot.url.some(s => s.path === 'tenants');
  readonly isCreate = this.route.snapshot.url.some(s => s.path === 'new');
  readonly isSuperadmin = computed(() => this.auth.user()?.platformAdmin ?? false);
  readonly canManageUsers = computed(() => this.isSuperadmin() || (this.auth.user()?.roleNames?.includes('ADMIN') ?? false));

  readonly users = signal<ApiUser[]>([]);
  readonly roles = signal<ApiRole[]>([]);
  readonly tenants = signal<ApiTenant[]>([]);
  readonly editUser = signal<ApiUser | null>(null);
  readonly editError = signal<string | null>(null);
  readonly confirmation = signal<{ title: string; message: string; action: () => void } | null>(null);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly message = signal<string | null>(null);

  editForm: any = { firstName: '', lastName: '', email: '', status: 'ACTIVE', roleIds: [] };
  userForm: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    confirmPassword: ['', Validators.required],
    roleIds: [[1]]
  });
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

  onSubmit(): void {
    if (this.userForm.invalid) return;
    this.saving.set(true);
    this.api.createUser(this.userForm.value).subscribe({
      next: () => { this.saving.set(false); this.message.set('Usuario creado con éxito.'); this.userForm.reset(); },
      error: err => { this.saving.set(false); this.error.set(true); this.message.set(err?.message || 'Error.'); }
    });
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

  edit(user: ApiUser): void {
    this.editUser.set(user);
    this.editForm = { firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, roleIds: [...(user.roleIds ?? [])] };
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
