import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavChild, NavItem, navigationRoutes, navSections, Role, roles } from '../core/data/nexodocs-data';
import { AuthService } from '../core/auth/auth.service';
import { ChatbotService } from '../core/chatbot/chatbot.service';
import { WorkflowApi } from '../features/workflows/workflow-api.service';

/** Pantallas públicas: siempre a pantalla completa, sin sidebar ni topbar, aunque haya sesión. */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

type ProfileTab = 'profile' | 'security' | 'notifications' | 'access' | 'workflows';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly chatbot = inject(ChatbotService);
  private readonly workflowApi = inject(WorkflowApi);
  readonly profileWorkflowTasks = signal<any[]>([]);
  readonly profileActiveWorkflows = signal<any[]>([]);
  readonly profileApprovalHistory = signal<any[]>([]);
  readonly roles = roles;
  readonly sections = navSections;
  readonly currentUrl = signal(this.router.url);
  readonly expanded = signal<string[]>([]);
  readonly role = computed<Role>(() => {
    const user = this.currentUser();
    if (user?.platformAdmin || user?.roleNames?.some(name => ['SUPER_ADMIN','SUPERADMINISTRADOR'].includes(name.toUpperCase()))) return 'Superadministrador';
    if (user?.roleNames?.some((name) => name.toUpperCase() === 'ADMINISTRADOR DE TENANT' || name.toUpperCase() === 'TENANT_ADMIN')) return 'Administrador de tenant';
    if (user?.roleNames?.some((name) => name.toUpperCase() === 'SUPERVISOR')) return 'Supervisor';
    return 'Usuario basico';
  });
  readonly currentUser = this.auth.user;
  readonly avatarUrl = this.auth.avatarUrl;
  readonly displayName = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';
  });
  readonly initials = computed(() => this.displayName().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U');
  readonly tenantName = computed(() => this.currentUser()?.tenantName || (this.currentUser()?.platformAdmin ? 'Todos los tenants' : 'Organización autenticada'));
  /** El módulo «Usuarios y equipos» (/users, /users/...) ya trae su propio buscador: se oculta el global. */
  readonly hideGlobalSearch = computed(() => this.currentUrl().split(/[?#]/)[0].split('/')[1] === 'users');
  readonly toast = signal('');
  readonly mobileNavOpen = signal(false);
  /** Sidebar reducido a iconos (solo escritorio). Se recuerda entre sesiones. */
  readonly isCollapsed = signal(this.readCollapsed());

  toggleSidebar(): void {
    this.isCollapsed.update((collapsed) => !collapsed);
    try { localStorage.setItem('sidebarCollapsed', String(this.isCollapsed())); } catch { /* almacenamiento no disponible */ }
  }

  private readCollapsed(): boolean {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  }
  readonly sidebarUserMenuOpen = signal(false);
  readonly headerUserMenuOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly profileSaving = signal(false);
  readonly profileError = signal('');
  readonly avatarUploading = signal(false);
  readonly profileTab = signal<ProfileTab>('profile');
  readonly passwordSaving = signal(false);
  readonly notificationSaving = signal(false);
  profileFirstName = '';
  profileLastName = '';
  profileEmail = '';
  profilePhone = '';
  profileBiography = '';
  profileEmailNotifications = true;
  profilePushNotifications = true;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  private toastTimer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private readonly idleTimeoutMs = 5 * 60 * 1000;
  private lastIdleResetAt = 0;

  readonly availableSections = computed(() =>
    this.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.sprintEnabled !== false
          && (!item.roles || item.roles.includes(this.role()))
          && this.visibleChildren(item).length > 0,
        ),
      }))
      .filter((section) => section.items.length > 0),
  );

  constructor() {
    // El chatbot solo existe dentro del layout autenticado: se carga al entrar y se retira al salir
    // (logout, sesión expirada o pantallas públicas como /login).
    effect(() => (this.isWorkspace() ? this.chatbot.load() : this.chatbot.unload()));
    const activityEvents = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    const resetIdleTimer = () => this.resetIdleTimer();
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    effect(() => this.isWorkspace() ? this.resetIdleTimer() : this.clearIdleTimer());
    inject(DestroyRef).onDestroy(() => {
      this.chatbot.unload();
      this.clearIdleTimer();
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    });
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        // También cubre la recarga en una subruta: el grupo que contiene la URL nace abierto.
        this.expandForUrl(event.urlAfterRedirects);
      });
  }

  isWorkspace(): boolean {
    const path = this.currentUrl().split(/[?#]/)[0];
    const isPublic = PUBLIC_PATHS.some((base) => path === base || path.startsWith(base + '/'));
    return !isPublic && this.auth.isAuthenticated();
  }

  isExpanded(label: string): boolean {
    return this.expanded().includes(label);
  }

  toggleNav(label: string): void {
    this.expanded.update((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }

  openNav(label: string): void {
    this.expanded.update((current) => (current.includes(label) ? current : [...current, label]));
    this.mobileNavOpen.set(false);
  }

  /** Un ítem está activo si alguna de sus rutas hijas coincide con la URL actual (o cuelga de ella). */
  isActiveItem(label: string): boolean {
    const item = this.findItem(label);
    return !!item && this.itemContainsUrl(item, this.currentUrl());
  }

  navId(label: string): string {
    return 'nav-sub-' + label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  }

  private findItem(label: string): NavItem | undefined {
    return this.sections.flatMap((section) => section.items).find((item) => item.label === label);
  }

  private itemContainsUrl(item: NavItem, url: string): boolean {
    const path = url.split(/[?#]/)[0];
    return item.children.some((child) => path === child.href || (child.href !== '/' && path.startsWith(child.href + '/')));
  }

  private expandForUrl(url: string): void {
    const groups = this.sections
      .flatMap((section) => section.items)
      .filter((item) => item.children.length > 1 && this.itemContainsUrl(item, url))
      .map((item) => item.label);
    if (groups.length) this.expanded.update((current) => [...new Set([...current, ...groups])]);
  }

  unreadCount(label: string): string {
    return '';
  }

  notify(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2600);
  }

  toggleSidebarUserMenu(): void {
    this.sidebarUserMenuOpen.update((open) => !open);
    this.headerUserMenuOpen.set(false);
  }

  toggleHeaderUserMenu(): void {
    this.headerUserMenuOpen.update((open) => !open);
    this.sidebarUserMenuOpen.set(false);
  }

  accountAction(action: string): void {
    this.sidebarUserMenuOpen.set(false);
    this.headerUserMenuOpen.set(false);
    this.notify(`${action}: operación preparada para la API`);
  }

  openProfile(): void {
    const user = this.currentUser();
    if (!user) return;
    this.sidebarUserMenuOpen.set(false);
    this.headerUserMenuOpen.set(false);
    this.profileFirstName = user.firstName;
    this.profileLastName = user.lastName;
    this.profileEmail = user.email;
    this.profilePhone = user.phone ?? '';
    this.profileBiography = user.biography ?? '';
    this.profileEmailNotifications = user.emailNotifications;
    this.profilePushNotifications = user.pushNotifications;
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.profileTab.set('profile');
    this.loadProfileWorkflows();
    this.profileError.set('');
    this.profileOpen.set(true);
  }

  closeProfile(): void {
    if (!this.profileSaving() && !this.avatarUploading()) this.profileOpen.set(false);
  }

  saveProfile(): void {
    this.profileError.set('');
    this.profileSaving.set(true);
    this.auth.updateProfile({
      firstName: this.profileFirstName.trim(),
      lastName: this.profileLastName.trim(),
      email: this.profileEmail.trim(),
      phone: this.profilePhone.trim(),
      biography: this.profileBiography.trim(),
    }).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profileOpen.set(false);
        this.notify('Perfil actualizado correctamente');
      },
      error: (error) => {
        this.profileSaving.set(false);
        this.profileError.set(error?.error?.message || 'No se pudieron guardar los cambios.');
      },
    });
  }

  uploadAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      this.profileError.set('Selecciona una imagen JPG, PNG o WEBP de hasta 2 MB.');
      return;
    }
    this.profileError.set('');
    this.avatarUploading.set(true);
    this.auth.uploadAvatar(file).subscribe({
      next: () => {
        this.avatarUploading.set(false);
        this.notify('Foto de perfil actualizada');
      },
      error: (error) => {
        this.avatarUploading.set(false);
        this.profileError.set(error?.error?.message || 'No se pudo subir la foto.');
      },
    });
  }

  setProfileTab(tab: ProfileTab): void {
    this.profileError.set('');
    this.profileTab.set(tab);
  }

  private resetIdleTimer(): void {
    const now = Date.now();
    if (this.idleTimer && now - this.lastIdleResetAt < 1000) return;
    this.lastIdleResetAt = now;
    this.clearIdleTimer();
    if (!this.isWorkspace()) return;
    this.idleTimer = setTimeout(() => {
      if (!this.isWorkspace()) return;
      this.notify('Desconectado por inactividad. Inicia sesión nuevamente.');
      this.auth.logoutForInactivity();
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private loadProfileWorkflows():void {
    this.workflowApi.page('/tasks/my',{status:'PENDING',size:5}).subscribe({next:p=>this.profileWorkflowTasks.set(p.content),error:()=>this.profileWorkflowTasks.set([])});
     this.workflowApi.page<any>('',{bucket:'active',size:5}).subscribe({next:p=>this.profileActiveWorkflows.set(p.content.filter(flow=>flow.creator_id===this.currentUser()?.id||flow.responsible_id===this.currentUser()?.id)),error:()=>this.profileActiveWorkflows.set([])});
    this.workflowApi.page('/approvals/my',{size:5}).subscribe({next:p=>this.profileApprovalHistory.set(p.content),error:()=>this.profileApprovalHistory.set([])});
  }

  saveNotifications(): void {
    this.profileError.set('');
    this.notificationSaving.set(true);
    this.auth.updateNotificationPreferences({
      emailNotifications: this.profileEmailNotifications,
      pushNotifications: this.profilePushNotifications,
    }).subscribe({
      next: () => {
        this.notificationSaving.set(false);
        this.notify('Preferencias de notificación actualizadas');
      },
      error: (error) => {
        this.notificationSaving.set(false);
        this.profileError.set(error?.error?.message || 'No se pudieron guardar las preferencias.');
      },
    });
  }

  savePassword(): void {
    this.profileError.set('');
    if (this.newPassword.length < 8) {
      this.profileError.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.profileError.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    this.passwordSaving.set(true);
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.notify('Contraseña actualizada correctamente');
      },
      error: (error) => {
        this.passwordSaving.set(false);
        this.profileError.set(error?.error?.message || 'No se pudo actualizar la contraseña.');
      },
    });
  }

  logout(): void {
    this.sidebarUserMenuOpen.set(false);
    this.headerUserMenuOpen.set(false);
    this.auth.logout();
  }

  routeLabel(href: string): string {
    return navigationRoutes.find((route) => route.href === href)?.subcategory ?? 'Resumen';
  }

  visibleChildren(item: NavItem): NavChild[] {
    return item.children.filter((child) => child.visible !== false && child.sprintEnabled !== false);
  }
}
