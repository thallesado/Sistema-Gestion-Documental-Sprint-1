import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdministrationApiService, ApiRole, ApiTenant, ApiUser } from '../../core/api/administration-api.service';
import { DemoSessionState } from '../../core/state/demo-session';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-administration-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="admin-page">
      @if (isTenantArea) {
        @if (isSuperadmin) {
          @if (isCreate) {
            <header class="admin-header"><div><p class="eyebrow">Administración global · Tenants</p><h1>Crear organización</h1><p>Registra un nuevo tenant en NexoDocs.</p></div></header>
            <form class="admin-form" (ngSubmit)="createTenant()"><h2>Nuevo tenant</h2><div class="form-grid">
              <label>Nombre<input name="tenantName" [(ngModel)]="tenantForm.name" required /></label>
              <label>Código<input name="tenantCode" [(ngModel)]="tenantForm.code" required /></label>
              <label>Slug<input name="tenantSlug" [(ngModel)]="tenantForm.slug" required /></label>
              <label>Correo de contacto<input type="email" name="tenantEmail" [(ngModel)]="tenantForm.email" required /></label>
            </div><div class="form-actions"><a routerLink="/tenants" class="admin-secondary">Cancelar</a><button class="admin-primary" type="submit" [disabled]="saving()">Crear tenant</button></div></form>
          } @else {
          <header class="admin-header"><div><p class="eyebrow">Administración global · Tenants</p><h1>Organizaciones</h1><p>Gestiona el ciclo de vida de los tenants de NexoDocs.</p></div><a class="admin-primary" routerLink="/tenants/new">＋ Crear tenant</a></header>
          @if (loading()) { <p class="admin-empty">Cargando tenants…</p> } @else if (error()) { <div class="admin-state error" role="alert"><b>Error al cargar tenants</b><span>{{ message() }}</span></div> } @else {
            <section class="admin-table-wrap"><table><thead><tr><th>Organización</th><th>Código</th><th>Slug</th><th>Estado</th><th>Acción</th></tr></thead><tbody>@for (tenant of tenants(); track tenant.id) { <tr><td><b>{{ tenant.name }}</b></td><td>{{ tenant.code }}</td><td>{{ tenant.slug }}</td><td><span class="admin-status" [class.inactive]="tenant.status !== 'ACTIVE'">{{ tenant.status }}</span></td><td><button class="link-button" type="button" (click)="changeTenantStatus(tenant)">{{ tenant.status === 'ACTIVE' ? 'Suspender' : 'Activar' }}</button></td></tr> }</tbody></table></section>
          @if (confirmation()) { <div class="modal-backdrop" role="presentation"><section class="admin-modal confirmation" role="alertdialog" aria-modal="true" aria-labelledby="tenant-confirm-title"><h2 id="tenant-confirm-title">{{ confirmation()?.title }}</h2><p>{{ confirmation()?.message }}</p><div class="form-actions"><button class="admin-secondary" type="button" (click)="closeConfirmation()">Cancelar</button><button class="admin-primary" type="button" (click)="confirmAction()">Confirmar</button></div></section></div> }
          }
          <p class="api-note">La edición de datos generales de tenants aún no está expuesta por el contrato; el estado sí puede activarse o suspenderse.</p>
          }
        } @else {
          <div class="admin-state forbidden" role="alert"><b>Acceso restringido</b><span>La vista global de tenants solo está disponible para Superadministrador.</span></div>
        }
      } @else if (!canManageUsers) {
        <div class="admin-state forbidden" role="alert"><b>Acceso restringido</b><span>Solo un Administrador de tenant o Superadministrador puede gestionar usuarios.</span></div>
      } @else {
        <header class="admin-header">
          <div><p class="eyebrow">Gestión · Usuarios y equipos</p><h1>{{ isCreate ? 'Crear usuario' : 'Usuarios del tenant' }}</h1><p>Administra las cuentas de {{ tenantName() }} sin salir del tenant autenticado.</p></div>
          @if (!isCreate) { <a class="admin-primary" routerLink="/users/new">＋ Crear usuario</a> }
        </header>
        @if (isCreate) {
          <form class="admin-form" (ngSubmit)="createUser()">
            <h2>Nuevo usuario</h2><p class="form-note">La cuenta se crea en el tenant del token. El cliente no envía tenantId.</p>
            <div class="form-grid">
              <label>Nombre<input name="firstName" [(ngModel)]="form.firstName" required /></label>
              <label>Apellido<input name="lastName" [(ngModel)]="form.lastName" required /></label>
              <label>Usuario<input name="username" [(ngModel)]="form.username" required /></label>
              <label>Correo<input type="email" name="email" [(ngModel)]="form.email" required /></label>
              <label>Contraseña<input type="password" name="password" [(ngModel)]="form.password" required minlength="8" /></label>
              <label>Roles permitidos<select name="roleIds" [(ngModel)]="form.roleIds" multiple required>@for (role of roles(); track role.id) { <option [ngValue]="role.id">{{ role.name }}</option> }</select><small class="field-help">Selecciona uno o más roles activos del tenant.</small></label>
            </div>
            <div class="form-actions"><a routerLink="/users" class="admin-secondary">Cancelar</a><button class="admin-primary" type="submit" [disabled]="saving()">Crear usuario</button></div>
          </form>
        } @else {
          <div class="admin-toolbar"><label class="admin-search">⌕<input [(ngModel)]="search" (keyup.enter)="loadUsers()" placeholder="Buscar por nombre, usuario o correo" aria-label="Buscar usuarios" /></label><button class="admin-secondary" type="button" (click)="loadUsers()">Buscar</button></div>
          @if (message()) { <div class="admin-state" [class.error]="error()" role="status">{{ message() }}</div> }
          <section class="admin-table-wrap">
            @if (loading()) { <p class="admin-empty">Cargando usuarios…</p> }
            @else if (!users().length && !error()) { <p class="admin-empty">No hay usuarios para mostrar.</p> }
            @else {
              <table><thead><tr><th>Usuario</th><th>Correo</th><th>Perfil clínico</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
              <tbody>@for (user of users(); track user.id) { <tr><td><b>{{ user.firstName }} {{ user.lastName }}</b><small>{{ user.username }}</small></td><td>{{ user.email }}</td><td>{{ user.staffType || 'No asignado' }}</td><td><span class="admin-status" [class.inactive]="user.status !== 'ACTIVE'">{{ user.status === 'ACTIVE' ? 'Activo' : user.status }}</span></td><td><button class="link-button" type="button" (click)="edit(user)">Editar</button>@if (user.status === 'ACTIVE') {<button class="link-button danger" type="button" (click)="deactivate(user)">Desactivar</button>} @else {<button class="link-button" type="button" (click)="reactivate(user)">Reactivar</button>}</td></tr> }</tbody></table>
            }
            @if (editUser()) {
              <div class="modal-backdrop" role="presentation"><section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
                <h2 id="edit-user-title">Editar usuario</h2><p class="form-note">Actualiza los datos y roles permitidos para este usuario.</p>@if (editError()) { <div class="admin-state error" role="alert">{{ editError() }}</div> } @if (rolesLoading()) { <p class="admin-empty">Cargando roles…</p> } @else if (rolesError()) { <div class="admin-state error" role="alert">{{ rolesError() }}</div> }
                <div class="form-grid"><label>Nombre<input [(ngModel)]="editForm.firstName" /></label><label>Apellido<input [(ngModel)]="editForm.lastName" /></label><label>Correo<input type="email" [(ngModel)]="editForm.email" /></label><label>Estado<select [(ngModel)]="editForm.status"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label><label>Roles permitidos<select [(ngModel)]="editForm.roleIds" multiple>@for (role of roles(); track role.id) { <option [ngValue]="role.id">{{ role.name }}</option> }</select></label></div>
                <div class="form-actions"><button class="admin-secondary" type="button" (click)="closeEdit()">Cancelar</button><button class="admin-primary" type="button" (click)="saveEdit()" [disabled]="saving()">Guardar cambios</button></div>
              </section></div>
            }
            @if (confirmation()) {
              <div class="modal-backdrop" role="presentation"><section class="admin-modal confirmation" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{{ confirmation()?.title }}</h2><p>{{ confirmation()?.message }}</p><div class="form-actions"><button class="admin-secondary" type="button" (click)="closeConfirmation()">Cancelar</button><button class="admin-primary" type="button" (click)="confirmAction()">Confirmar</button></div></section></div>
            }
          </section>
          <p class="api-note">Los roles se asignan en creación y edición mediante roleIds. Activar/desactivar utiliza la actualización del usuario.</p>
        }
      }
    </section>
  `,
})
export class AdministrationPage {
  readonly api = inject(AdministrationApiService);
  readonly session = inject(DemoSessionState);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly users = signal<ApiUser[]>([]);
  readonly tenants = signal<ApiTenant[]>([]);
  readonly roles = signal<ApiRole[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly rolesLoading = signal(false);
  readonly rolesError = signal('');
  readonly editError = signal('');
  readonly message = signal('');
  readonly error = signal(false);
  search = '';
  form = { username: '', email: '', password: '', firstName: '', lastName: '', roleIds: [] as number[] };
  tenantForm = { name: '', code: '', slug: '', email: '' };
  readonly editUser = signal<ApiUser | null>(null);
  readonly confirmation = signal<{ title: string; message: string; action: () => void } | null>(null);
  editForm = { firstName: '', lastName: '', email: '', status: 'ACTIVE', roleIds: [] as number[] };
  readonly isTenantArea = this.route.snapshot.url[0]?.path === 'tenants';
  readonly isCreate = this.route.snapshot.url[1]?.path === 'new';
  readonly isSuperadmin = this.session.role() === 'Superadministrador';
  readonly canManageUsers = this.session.role() === 'Administrador de tenant' || this.isSuperadmin;
  readonly tenantName = () => this.auth.user()?.tenantName || 'la organización autenticada';

  constructor() { if (this.isTenantArea && this.isSuperadmin && !this.isCreate) this.loadTenants(); else if (this.canManageUsers && !this.isCreate) { this.loadUsers(); this.loadRoles(); } else if (this.canManageUsers && this.isCreate) this.loadRoles(); }

  loadRoles(): void {
    this.rolesLoading.set(true); this.rolesError.set('');
    this.api.roles().subscribe({ next: roles => { this.roles.set(roles); this.rolesLoading.set(false); }, error: err => { this.rolesLoading.set(false); this.rolesError.set(this.apiError(err, 'No se pudieron cargar los roles.')); } });
  }

  loadUsers(): void {
    this.loading.set(true); this.message.set(''); this.error.set(false);
    this.api.users(this.search).subscribe({ next: page => { this.users.set(page.content); this.loading.set(false); }, error: err => this.showError(this.apiError(err, 'No se pudieron cargar los usuarios.')) });
  }

  loadTenants(): void {
    this.loading.set(true); this.error.set(false); this.message.set('');
    this.api.tenants().subscribe({ next: tenants => { this.tenants.set(tenants); this.loading.set(false); }, error: err => { this.loading.set(false); this.error.set(true); this.message.set(this.apiError(err, 'No se pudieron cargar los tenants.')); } });
  }

  changeTenantStatus(tenant: ApiTenant): void {
    const value = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.confirmation.set({ title: value === 'SUSPENDED' ? 'Suspender organización' : 'Activar organización', message: `${value === 'SUSPENDED' ? '¿Quieres suspender' : '¿Quieres activar'} ${tenant.name}?`, action: () => this.api.changeTenantStatus(tenant.id, value).subscribe({ next: () => this.loadTenants(), error: err => { this.error.set(true); this.message.set(this.apiError(err, 'No se pudo cambiar el estado del tenant.')); } }) });
  }

  createUser(): void {
    this.saving.set(true); this.message.set('');
    const payload = { ...this.form };
    this.api.createUser(payload).subscribe({ next: () => { this.saving.set(false); this.message.set('Usuario creado correctamente.'); this.form = { username: '', email: '', password: '', firstName: '', lastName: '', roleIds: [] }; }, error: err => { this.saving.set(false); this.showError(this.apiError(err, 'No se pudo crear el usuario.')); } });
  }

  createTenant(): void {
    this.saving.set(true); this.message.set('');
    this.api.createTenant(this.tenantForm).subscribe({ next: () => { this.saving.set(false); this.message.set('Tenant creado correctamente.'); this.tenantForm = { name: '', code: '', slug: '', email: '' }; }, error: err => { this.saving.set(false); this.showError(this.apiError(err, 'No se pudo crear el tenant.')); } });
  }

  edit(user: ApiUser): void {
    this.editForm = { firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, roleIds: [...(user.roleIds ?? [])] };
    this.editError.set('');
    this.editUser.set(user);
  }
  closeEdit(): void { this.editUser.set(null); this.editError.set(''); }
  saveEdit(): void { const user = this.editUser(); if (!user) return; this.saving.set(true); this.editError.set(''); this.api.updateUser(user.id, this.editForm).subscribe({ next: () => { this.saving.set(false); this.closeEdit(); this.message.set('Usuario actualizado.'); this.loadUsers(); }, error: err => { this.saving.set(false); this.editError.set(this.apiError(err, 'No se pudo actualizar el usuario.')); } }); }

  deactivate(user: ApiUser): void {
    this.confirmation.set({ title: 'Desactivar usuario', message: `¿Quieres desactivar a ${user.firstName} ${user.lastName}?`, action: () => this.api.deactivateUser(user.id).subscribe({ next: () => { this.message.set('Usuario desactivado.'); this.loadUsers(); }, error: err => this.showError(this.apiError(err, 'No se pudo desactivar el usuario.')) }) });
  }

  reactivate(user: ApiUser): void {
    this.api.updateUser(user.id, { firstName: user.firstName, lastName: user.lastName, email: user.email, status: 'ACTIVE', roleIds: user.roleIds ?? [] }).subscribe({ next: () => { this.message.set('Usuario reactivado.'); this.loadUsers(); }, error: err => this.showError(this.apiError(err, 'No se pudo reactivar el usuario.')) });
  }

  private showError(text: string): void { this.loading.set(false); this.error.set(true); this.message.set(text); }
  confirmAction(): void { const action = this.confirmation()?.action; this.closeConfirmation(); action?.(); }
  closeConfirmation(): void { this.confirmation.set(null); }
  private apiError(error: { status?: number }, fallback: string): string {
    if (error.status === 401 || error.status === 403) return 'No tienes permisos para realizar esta operación.';
    if (error.status === 0) return 'No se pudo conectar con la API. Comprueba que el backend esté ejecutándose.';
    return fallback;
  }
}
