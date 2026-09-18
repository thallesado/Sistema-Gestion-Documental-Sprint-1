import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavChild, NavItem, navigationRoutes, navSections, Role, roles } from '../core/data/nexodocs-data';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly roles = roles;
  readonly sections = navSections;
  readonly currentUrl = signal(this.router.url);
  readonly expanded = signal<string[]>(['Inicio']);
  readonly role = computed<Role>(() => {
    const user = this.currentUser();
    if (user?.platformAdmin || user?.roleNames?.includes('SUPER_ADMIN')) return 'Superadministrador';
    if (user?.roleNames?.some((name) => name.toUpperCase() === 'ADMINISTRADOR DE TENANT' || name.toUpperCase() === 'TENANT_ADMIN')) return 'Administrador de tenant';
    if (user?.roleNames?.some((name) => name.toUpperCase() === 'SUPERVISOR')) return 'Supervisor';
    return 'Usuario basico';
  });
  readonly currentUser = this.auth.user;
  readonly displayName = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';
  });
  readonly initials = computed(() => this.displayName().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U');
  readonly tenantName = computed(() => this.currentUser()?.tenantName || (this.currentUser()?.platformAdmin ? 'Todos los tenants' : 'Organización autenticada'));
  readonly toast = signal('');
  readonly chatOpen = signal(false);
  readonly mobileNavOpen = signal(false);
  readonly sidebarUserMenuOpen = signal(false);
  readonly headerUserMenuOpen = signal(false);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly availableSections = computed(() =>
    this.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.roles || item.roles.includes(this.role())),
      }))
      .filter((section) => section.items.length > 0),
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }

  isWorkspace(): boolean {
    return this.currentUrl() !== '/login' && this.auth.isAuthenticated();
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

  isActiveItem(label: string): boolean {
    const route = navigationRoutes.find((item) => item.href === this.currentUrl());
    return (route?.module ?? 'Inicio') === label;
  }

  isActiveChild(href: string): boolean {
    return this.currentUrl() === href;
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

  logout(): void {
    this.sidebarUserMenuOpen.set(false);
    this.headerUserMenuOpen.set(false);
    this.auth.logout();
  }

  routeLabel(href: string): string {
    return navigationRoutes.find((route) => route.href === href)?.subcategory ?? 'Resumen';
  }

  visibleChildren(item: NavItem): NavChild[] {
    return item.children.filter((child) => child.visible !== false);
  }
}
