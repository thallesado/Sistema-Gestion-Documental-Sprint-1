import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavSection, Role, navSections, roles } from '../../core/data/nexodocs-data';
import { AuthService } from '../../core/auth/auth.service';
import { ChatbotService } from '../../core/chatbot/chatbot.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly chatbot = inject(ChatbotService);

  readonly sections = navSections;
  readonly currentUrl = signal(this.router.url);
  readonly expanded = signal<string[]>([]);
  readonly mobileNavOpen = signal(false);
  readonly assistantOpen = signal(false);
  readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly isCollapsed = signal(this.readCollapsed());

  readonly currentUser = this.auth.user;
  readonly role = computed<Role>(() => {
    const user = this.currentUser();
    if (user?.platformAdmin || user?.roleNames?.includes('SUPER_ADMIN')) return 'Superadministrador';
    if (user?.roleNames?.some((n: string) => n.toUpperCase() === 'ADMINISTRADOR DE TENANT' || n.toUpperCase() === 'TENANT_ADMIN')) return 'Administrador de tenant';
    if (user?.roleNames?.some((n: string) => n.toUpperCase() === 'SUPERVISOR')) return 'Supervisor';
    return 'Usuario basico';
  });

  readonly displayName = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';
  });

  readonly initials = computed(() =>
    this.displayName().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U'
  );

  readonly tenantName = computed(() =>
    this.currentUser()?.tenantName || (this.currentUser()?.platformAdmin ? 'Todos los tenants' : 'Organización autenticada')
  );

  readonly hideGlobalSearch = computed(() =>
    this.currentUrl().split(/[?#]/)[0].split('/')[1] === 'users'
  );

  readonly availableSections = computed(() =>
    this.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.sprintEnabled !== false
          && (!item.roles || item.roles.includes(this.role()))
          && item.children.length > 0
        ),
      }))
      .filter((section) => section.items.length > 0)
  );

  constructor() {
    this.chatbot.load();
    inject(DestroyRef).onDestroy(() => this.chatbot.unload());

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.mobileNavOpen.set(false);
        this.expandForUrl(event.urlAfterRedirects);
      });
  }

  toggleSidebar(): void {
    this.isCollapsed.update((c) => !c);
    try { localStorage.setItem('sidebarCollapsed', String(this.isCollapsed())); } catch {}
  }

  toggleMobileNav(): void {
    this.mobileNavOpen.update((o) => !o);
  }

  toggleNav(label: string): void {
    this.expanded.update((curr) =>
      curr.includes(label) ? curr.filter((i) => i !== label) : [...curr, label]
    );
  }

  openNav(label: string): void {
    if (!this.expanded().includes(label)) {
      this.expanded.update((curr) => [...curr, label]);
    }
  }

  notifyAssistant(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set('Asistente listo: selecciona un documento o escribe tu consulta.');
    this.toastTimer = setTimeout(() => this.toast.set(''), 4000);
  }

  logout(): void {
    this.auth.logout();
  }

  private readCollapsed(): boolean {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  }

  private expandForUrl(url: string): void {
    for (const section of this.availableSections()) {
      for (const item of section.items) {
        if (item.children.some((child) => child.href === url)) {
          this.openNav(item.label);
          return;
        }
      }
    }
  }
}
