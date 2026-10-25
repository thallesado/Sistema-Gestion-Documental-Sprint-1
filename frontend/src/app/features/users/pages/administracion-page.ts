import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdministrationApiService, ApiRole, ApiTenant, ApiUser } from '../../../core/api/administration-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CreateUserModal } from '../components/create-user-modal';
import { RolePermissionsModal } from '../components/role-permissions-modal';
import { RoleFormModal } from '../components/role-form-modal';
import { PermissionService } from '../../../core/auth/permission.service';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { FieldPermissionDirective } from '../../../core/auth/field-permission.directive';
import { ComponentPermissionService } from '../../../core/auth/component-permission.service';
import { ExportColumn, exportToCsv, exportToJson, exportToPrintView } from '../../../core/utils/export-utils';
import { Pagination } from '../../../shared/components/pagination/pagination.component';
import { LocalizedContentDirective } from '../../../core/i18n/localized-content.directive';
import { friendlyApiMessage } from '../../../core/http/tenant-session';

@Component({
  selector: 'app-administration-page',
  imports: [CommonModule, FormsModule, RouterLink, CreateUserModal, RolePermissionsModal, RoleFormModal, HasPermissionDirective, FieldPermissionDirective, Pagination, LocalizedContentDirective],
  template: `
    <section class="admin-page" i18nContent>
      @if (isTenantArea) {
        @if (isSuperadmin()) {
          @if (isCreate) {
            <header class="admin-header"><div><p class="eyebrow">Administración global · Tenants</p><h1>Crear organización</h1><p>Registra un nuevo tenant en NexoDocs.</p></div></header>
            <form class="admin-form" (ngSubmit)="createTenant()"><h2>Nuevo tenant</h2><div class="form-grid">
              <label>Nombre<input name="tenantName" [(ngModel)]="tenantForm.name" required /></label>
              <label>Código<input name="tenantCode" [(ngModel)]="tenantForm.code" required /></label>
              <label>Slug<input name="tenantSlug" [(ngModel)]="tenantForm.slug" required /></label>
              <label>Correo de contacto<input type="email" name="tenantEmail" [(ngModel)]="tenantForm.email" required /></label>
              <label>Plan de suscripción
                <select name="tenantPlan" [(ngModel)]="tenantForm.planId">
                  <option value="">Selecciona un plan (opcional)</option>
                  @for (plan of plans(); track plan.id) {
                    <option [value]="plan.id">{{ plan.name }} ({{ plan.code }})</option>
                  }
                </select>
              </label>
              <label>Nombre del administrador inicial<input name="adminName" [(ngModel)]="tenantForm.adminName" placeholder="Ej. Administrador Sistema" /></label>
              <label>Correo del administrador inicial<input type="email" name="adminEmail" [(ngModel)]="tenantForm.adminEmail" placeholder="admin@empresa.com" /></label>
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
      } @else if (!canManageUsers()) {
        <div class="admin-state forbidden" role="alert"><b>Acceso restringido</b><span>Tu perfil no tiene el permiso para consultar usuarios (user:read).</span></div>
      } @else {
        <header class="admin-header">
          <div><p class="eyebrow">Gestión · Usuarios y equipos</p><h1>Usuarios del tenant</h1><p>Administra las cuentas de {{ tenantName() }} sin salir del tenant autenticado.</p></div>
          @if (activeTab() === 'roles') {
            <button *appHasPermission="'role:create'" class="admin-primary" type="button" (click)="roleFormOpen.set(true)">＋ Crear grupo</button>
          } @else {
            <button *appHasPermission="'user:create'" class="admin-primary" type="button" (click)="openCreateUserModal()">＋ Crear usuario</button>
          }
        </header>
          <div class="admin-tabs" role="tablist">
            <button type="button" role="tab" class="admin-tab" [class.active]="activeTab() === 'users'" (click)="activeTab.set('users')">Usuarios</button>
            <button type="button" role="tab" class="admin-tab" [class.active]="activeTab() === 'roles'" (click)="activeTab.set('roles')">Grupos de usuarios (perfiles)</button>
          </div>
          @if (activeTab() === 'roles') {
            <section class="admin-table-wrap">
              @if (rolesLoading()) { <p class="admin-empty">Cargando grupos…</p> }
              @else if (rolesError()) { <div class="admin-state error" role="alert">{{ rolesError() }}</div> }
              @else {
                <table><thead><tr><th>Grupo</th><th>Descripción</th><th>Tipo</th><th><span class="sr-only">Acciones</span></th></tr></thead>
                <tbody>@for (role of roles(); track role.id) { <tr><td><b>{{ role.name }}</b></td><td>{{ role.description || '—' }}</td><td><span class="admin-status" [class.inactive]="role.system">{{ role.system ? 'Sistema' : 'Personalizado' }}</span></td><td><button *appHasPermission="'role:read'" class="link-button" type="button" (click)="permissionsRoleId.set(role.id)">Permisos</button></td></tr> }</tbody></table>
              }
            </section>
          } @else {
          <div class="admin-toolbar users-toolbar">
            <label class="admin-search">⌕<input [value]="search" (input)="onSearchInput($event)" placeholder="Buscar por nombre, usuario o correo" aria-label="Buscar usuarios" /></label>
            <div class="users-toolbar-filters">
              <select class="filter-btn-pill" aria-label="Filtrar por estado" [value]="filtroEstado()" (change)="setFiltroEstado($event)">
                <option value="">Todos los estados</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option>
              </select>
              <select class="filter-btn-pill" aria-label="Filtrar por perfil" [value]="filtroPerfil()" (change)="setFiltroPerfil($event)">
                <option value="">Todos los perfiles</option><option value="WITH">Con perfil</option><option value="WITHOUT">Sin asignar</option>
              </select>
              <div class="export-dropdown-wrapper">
                <button type="button" class="filter-btn-pill" (click)="exportMenuOpen.set(!exportMenuOpen())" [attr.aria-expanded]="exportMenuOpen()">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Exportar</span>
                </button>
                @if (exportMenuOpen()) {
                  <div class="export-dropdown-backdrop" (click)="exportMenuOpen.set(false)"></div>
                  <div class="export-dropdown-popover">
                    <button type="button" (click)="exportUsers('Excel')"><div><strong>Exportar a Excel</strong><small>Descargar tabla en formato .csv</small></div></button>
                    <button type="button" (click)="exportUsers('PDF')"><div><strong>Exportar a PDF</strong><small>Vista de impresión y guardado PDF</small></div></button>
                    <button type="button" (click)="exportUsers('JSON')"><div><strong>Exportar a JSON</strong><small>Descargar archivo de datos .json</small></div></button>
                  </div>
                }
              </div>
            </div>
          </div>
          @if (message()) { <div class="admin-state" [class.error]="error()" role="status">{{ message() }}</div> }
          <section class="admin-table-wrap">
            @if (loading()) { <p class="admin-empty">Cargando usuarios…</p> }
            @else if (!visibleUsers().length && !error()) { <p class="admin-empty">No hay usuarios para mostrar.</p> }
            @else {
              <table><thead><tr><th>Usuario</th><th>Correo</th><th>Perfil clínico</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
              <tbody>@for (user of visibleUsers(); track user.id) { <tr><td><b>{{ user.firstName }} {{ user.lastName }}</b><small>{{ user.username }}</small></td><td>{{ user.email }}</td><td>{{ user.staffType || 'No asignado' }}</td><td><span class="admin-status" [class.status-inactive]="user.status === 'INACTIVE'" [class.inactive]="user.status !== 'ACTIVE' && user.status !== 'INACTIVE'">{{ statusLabel(user.status) }}</span></td><td><button class="link-button" type="button" (click)="edit(user)">Editar</button>@if (user.status === 'ACTIVE') {<button class="link-button danger" type="button" (click)="deactivate(user)">Desactivar</button>} @else {<button class="link-button" type="button" (click)="reactivate(user)">Reactivar</button>}</td></tr> }</tbody></table>
            }
            @if (editUser()) {
              <div class="modal-backdrop" role="presentation"><section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
                <h2 id="edit-user-title">Editar usuario</h2><p class="form-note">Actualiza los datos y los grupos del usuario. Debe pertenecer al menos a uno.</p>@if (editError()) { <div class="admin-state error" role="alert">{{ editError() }}</div> } @if (rolesLoading()) { <p class="admin-empty">Cargando grupos…</p> } @else if (rolesError()) { <div class="admin-state error" role="alert">{{ rolesError() }}</div> }
                <div class="form-grid"><label [appField]="'usuario.nombre'">Nombre<input [(ngModel)]="editForm.firstName" /></label><label [appField]="'usuario.apellido'">Apellido<input [(ngModel)]="editForm.lastName" /></label><label [appField]="'usuario.correo'">Correo<input type="email" [(ngModel)]="editForm.email" /></label><label [appField]="'usuario.estado'">Estado<select [(ngModel)]="editForm.status"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label><label class="chip-field" [appField]="'usuario.grupos'">Grupos del usuario
                <div class="role-chip-list" role="group" aria-label="Grupos del usuario">
                  @for (role of roles(); track role.id) {
                    <button type="button" class="role-chip" [class.selected]="editForm.roleIds.includes(role.id)" (click)="toggleEditRole(role.id)">{{ role.name }}</button>
                  }
                </div>
              </label></div>
                <div class="form-actions"><button class="admin-secondary" type="button" (click)="closeEdit()">Cancelar</button><button class="admin-primary" type="button" (click)="saveEdit()" [disabled]="saving()">Guardar cambios</button></div>
              </section></div>
            }
            @if (confirmation()) {
              <div class="modal-backdrop" role="presentation"><section class="admin-modal confirmation" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{{ confirmation()?.title }}</h2><p>{{ confirmation()?.message }}</p><div class="form-actions"><button class="admin-secondary" type="button" (click)="closeConfirmation()">Cancelar</button><button class="admin-primary" type="button" (click)="confirmAction()">Confirmar</button></div></section></div>
            }
            @if (!loading() && visibleTotal() > 0) {
              <app-pagination [total]="visibleTotal()" [page]="userPage() + 1" [pageSize]="userPageSize()" label="Paginación de usuarios" (pageChange)="changeUserPage($event)" (pageSizeChange)="changeUserPageSize($event)" />
            }
          </section>
          <p class="api-note">Cada usuario pertenece al menos a un grupo (perfil); los grupos definen sus permisos. Activar/desactivar utiliza la actualización del usuario.</p>
          }
      }
      @if (showCreateModal()) {
        <app-create-user-modal [roles]="roles()" (closed)="showCreateModal.set(false)" (saved)="onUserCreated()" />
      }
      <app-role-permissions-modal [roleId]="permissionsRoleId()" (closed)="permissionsRoleId.set(null)" (saved)="loadRoles()" />
      @if (roleFormOpen()) {
        <app-role-form-modal (closed)="roleFormOpen.set(false)" (saved)="loadRoles()" />
      }
    </section>
  `,
})
export class AdministrationPage {
  readonly api = inject(AdministrationApiService);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly fields = inject(ComponentPermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
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
  readonly totalUsers = signal(0);
  readonly filtroEstado = signal<'' | 'ACTIVE' | 'INACTIVE'>('');
  readonly filtroPerfil = signal<'' | 'WITH' | 'WITHOUT'>('');
  readonly exportMenuOpen = signal(false);
  // Con filtros de estado/perfil (que el backend no soporta) se trae el conjunto completo
  // que coincide con la búsqueda y se filtra y pagina en el cliente.
  private readonly filtersActive = computed(() => !!this.filtroEstado() || !!this.filtroPerfil());
  private readonly filteredUsers = computed(() => this.applyFilters(this.users()));
  readonly visibleUsers = computed(() => {
    if (!this.filtersActive()) return this.users();
    const start = this.userPage() * this.userPageSize();
    return this.filteredUsers().slice(start, start + this.userPageSize());
  });
  readonly visibleTotal = computed(() => this.filtersActive() ? this.filteredUsers().length : this.totalUsers());
  readonly userPage = signal(0); // base 0, como el backend
  readonly userPageSize = signal(10);
  readonly showCreateModal = signal(false);
  readonly plans = signal<any[]>([]);
  tenantForm = { name: '', code: '', slug: '', email: '', planId: '', adminEmail: '', adminName: '' };
  readonly activeTab = signal<'users' | 'roles'>('users');
  readonly permissionsRoleId = signal<number | null>(null);
  readonly roleFormOpen = signal(false);
  readonly editUser = signal<ApiUser | null>(null);
  readonly confirmation = signal<{ title: string; message: string; action: () => void } | null>(null);
  editForm = { firstName: '', lastName: '', email: '', status: 'ACTIVE', roleIds: [] as number[] };
  readonly isTenantArea = this.route.snapshot.url[0]?.path === 'tenants';
  readonly isCreate = this.route.snapshot.url[1]?.path === 'new';
  readonly currentUser = this.auth.user;
  readonly isSuperadmin = computed(() => {
    const user = this.currentUser();
    return user?.platformAdmin === true
      || (user?.roleNames ?? []).some((role) => {
        const normalized = role.toUpperCase();
        return normalized === 'SUPER_ADMIN' || normalized === 'SUPERADMINISTRADOR';
      });
  });
  /** Basta el permiso de función, no un nombre de rol fijo: un rol personalizado con user:read también entra. */
  readonly canManageUsers = computed(() => this.permissions.can('user:read'));
  readonly tenantName = computed(() => this.currentUser()?.tenantName || 'la organización del usuario autenticado');

  private readonly searchInput$ = new Subject<string>();

  constructor() {
    this.searchInput$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe(value => {
      this.search = value;
      this.searchUsers();
    });
    effect(() => {
      if (this.isTenantArea) {
        if (this.isSuperadmin()) {
          if (!this.isCreate) this.loadTenants();
          else this.loadPlans();
        }
        return;
      }
      if (!this.canManageUsers()) return;
      this.loadRoles();
      this.loadUsers();
    });
  }

  loadRoles(): void {
    this.rolesLoading.set(true); this.rolesError.set('');
    this.api.roles().subscribe({ next: roles => { this.roles.set(roles); this.rolesLoading.set(false); }, error: err => { this.rolesLoading.set(false); this.rolesError.set(this.apiError(err, 'No se pudieron cargar los grupos.')); } });
  }

  private applyFilters(list: ApiUser[]): ApiUser[] {
    const estado = this.filtroEstado(); const perfil = this.filtroPerfil();
    return list.filter(u =>
      (!estado || (estado === 'ACTIVE') === (u.status === 'ACTIVE')) &&
      (!perfil || (perfil === 'WITH') === !!u.staffType));
  }
  setFiltroEstado(event: Event): void { this.filtroEstado.set((event.target as HTMLSelectElement).value as '' | 'ACTIVE' | 'INACTIVE'); this.searchUsers(); }
  setFiltroPerfil(event: Event): void { this.filtroPerfil.set((event.target as HTMLSelectElement).value as '' | 'WITH' | 'WITHOUT'); this.searchUsers(); }

  exportUsers(format: 'Excel' | 'PDF' | 'JSON'): void {
    this.exportMenuOpen.set(false);
    this.api.users(this.search, 0, 2000).subscribe({
      next: page => {
        const rows = this.applyFilters(page.content).map(u => ({
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
      },
      error: err => this.showError(this.apiError(err, 'No se pudo exportar la lista de usuarios.')),
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo', INVITED: 'Invitado', BLOCKED: 'Bloqueado', SUSPENDED: 'Suspendido' };
    return labels[status] ?? status;
  }

  onSearchInput(event: Event): void { this.searchInput$.next((event.target as HTMLInputElement).value); }

  searchUsers(): void { this.userPage.set(0); this.loadUsers(); }
  changeUserPage(page: number): void { this.userPage.set(page - 1); this.loadUsers(); }
  changeUserPageSize(size: number): void { this.userPageSize.set(size); this.userPage.set(0); this.loadUsers(); }

  loadUsers(): void {
    this.loading.set(true); this.message.set(''); this.error.set(false);
    const all = this.filtersActive();
    this.api.users(this.search, all ? 0 : this.userPage(), all ? 2000 : this.userPageSize()).subscribe({ next: page => { this.users.set(page.content); this.totalUsers.set(page.totalElements); this.loading.set(false); }, error: err => this.showError(this.apiError(err, 'No se pudieron cargar los usuarios.')) });
  }

  loadTenants(): void {
    this.loading.set(true); this.error.set(false); this.message.set('');
    this.api.tenants().subscribe({ next: tenants => { this.tenants.set(tenants); this.loading.set(false); }, error: err => { this.loading.set(false); this.error.set(true); this.message.set(this.apiError(err, 'No se pudieron cargar los tenants.')); } });
  }

  changeTenantStatus(tenant: ApiTenant): void {
    const value = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.confirmation.set({ title: value === 'SUSPENDED' ? 'Suspender organización' : 'Activar organización', message: `${value === 'SUSPENDED' ? '¿Quieres suspender' : '¿Quieres activar'} ${tenant.name}?`, action: () => this.api.changeTenantStatus(tenant.id, value).subscribe({ next: () => this.loadTenants(), error: err => { this.error.set(true); this.message.set(this.apiError(err, 'No se pudo cambiar el estado del tenant.')); } }) });
  }

  openCreateUserModal(): void { this.showCreateModal.set(true); }

  /** El usuario se creó: cierra el modal y recarga la lista desde la primera página. */
  onUserCreated(): void {
    this.showCreateModal.set(false);
    this.searchUsers();
    this.message.set('Usuario creado correctamente.');
  }

  createTenant(): void {
    this.saving.set(true); this.message.set('');
    const payload = {
      name: this.tenantForm.name,
      code: this.tenantForm.code,
      slug: this.tenantForm.slug,
      email: this.tenantForm.email,
      planId: this.tenantForm.planId || undefined,
      adminEmail: this.tenantForm.adminEmail || undefined,
      adminName: this.tenantForm.adminName || undefined,
    };
    this.api.createTenant(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Tenant creado correctamente.');
        this.tenantForm = { name: '', code: '', slug: '', email: '', planId: '', adminEmail: '', adminName: '' };
      },
      error: err => {
        this.saving.set(false);
        this.showError(this.apiError(err, 'No se pudo crear el tenant.'));
      }
    });
  }

  loadPlans(): void {
    this.http.get<any[]>('/api/v1/plans').subscribe({
      next: plans => this.plans.set(plans || []),
      error: () => {},
    });
  }

  toggleEditRole(id: number): void {
    const idx = this.editForm.roleIds.indexOf(id);
    if (idx >= 0) this.editForm.roleIds.splice(idx, 1); else this.editForm.roleIds.push(id);
  }

  edit(user: ApiUser): void {
    this.editForm = { firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, roleIds: [...(user.roleIds ?? [])] };
    this.editError.set('');
    this.editUser.set(user);
  }
  closeEdit(): void { this.editUser.set(null); this.editError.set(''); }
  saveEdit(): void { const user = this.editUser(); if (!user) return; const canEditGroups = this.fields.editable('usuario.grupos'); if (canEditGroups && !this.editForm.roleIds.length) { this.editError.set('Debe seleccionar al menos un grupo para el usuario.'); return; } this.saving.set(true); this.editError.set(''); this.api.updateUser(user.id, { ...this.editForm, roleIds: canEditGroups ? this.editForm.roleIds : undefined }).subscribe({ next: () => { this.saving.set(false); this.closeEdit(); this.message.set('Usuario actualizado.'); this.loadUsers(); }, error: err => { this.saving.set(false); this.editError.set(this.apiError(err, 'No se pudo actualizar el usuario.')); } }); }

  deactivate(user: ApiUser): void {
    this.confirmation.set({ title: 'Desactivar usuario', message: `¿Quieres desactivar a ${user.firstName} ${user.lastName}?`, action: () => this.changeUserStatus(user, 'INACTIVE', 'Usuario desactivado.', 'No se pudo desactivar el usuario.') });
  }

  reactivate(user: ApiUser): void {
    this.changeUserStatus(user, 'ACTIVE', 'Usuario reactivado.', 'No se pudo reactivar el usuario.');
  }

  private changeUserStatus(user: ApiUser, status: 'ACTIVE' | 'INACTIVE', okMessage: string, errorMessage: string): void {
    this.api.updateUser(user.id, { firstName: user.firstName, lastName: user.lastName, email: user.email, status, roleIds: user.roleIds?.length ? user.roleIds : undefined }).subscribe({
      next: updated => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, status: updated?.status ?? status } : u));
        this.message.set(okMessage);
      },
      error: err => this.showError(this.apiError(err, errorMessage)),
    });
  }

  private showError(text: string): void { this.loading.set(false); this.error.set(true); this.message.set(text); }
  confirmAction(): void { const action = this.confirmation()?.action; this.closeConfirmation(); action?.(); }
  closeConfirmation(): void { this.confirmation.set(null); }
  private apiError(error: { status?: number; error?: { message?: string } }, fallback: string): string {
    if (error.status === 0) return 'No se pudo conectar con la API. Comprueba que el backend esté ejecutándose.';
    const serverMessage = error.error?.message;
    if (serverMessage) return friendlyApiMessage(serverMessage, fallback);
    if (error.status === 401 || error.status === 403) return 'No tienes permisos para realizar esta operación.';
    return fallback;
  }
}

export { AdministrationPage as AdministracionPage };
