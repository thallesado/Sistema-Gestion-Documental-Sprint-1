import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { PermissionRequirement, TENANT_PLAN_ADMIN } from '../../../core/auth/permission-rules';
import { ThemeService } from '../../../core/theme/theme.service';
import { SubscriptionService } from '../../../core/subscription/subscription.service';
import { HelpService } from '../../help/help.service';
import { LocalizedContentDirective } from '../../../core/i18n/localized-content.directive';

export interface SettingsShortcut {
  title: string;
  description: string;
  href: string;
  icon: string;
  group: 'Organización' | 'Personas y accesos' | 'Documentos y datos' | 'Suscripción';
  /** Mismo permiso que exige la ruta destino: la tarjeta solo aparece si se puede abrir. */
  permission: PermissionRequirement;
}

/** Accesos de la pantalla Configuración. Cada `permission` copia el guard de su ruta. */
export const SETTINGS_SHORTCUTS: readonly SettingsShortcut[] = [
  { group: 'Organización', icon: '🎨', title: 'Apariencia y regionalización', href: '/settings/appearance',
    description: 'Color de la marca, logotipo, moneda, zona horaria y formato de fecha.', permission: ['tenant:update', 'tenant:manage'] },
  { group: 'Personas y accesos', icon: '👥', title: 'Usuarios', href: '/users',
    description: 'Crear, editar, desactivar y personalizar las cuentas de la organización.', permission: 'user:read' },
  { group: 'Personas y accesos', icon: '🛡', title: 'Grupos y permisos', href: '/users/roles',
    description: 'Perfiles de trabajo y las funciones que concede cada uno.', permission: 'role:read' },
  { group: 'Personas y accesos', icon: '🧩', title: 'Privilegios por formulario', href: '/users/form-permissions',
    description: 'Qué campos ve o edita cada grupo en los formularios.', permission: 'component_permission:manage' },
  { group: 'Documentos y datos', icon: '🏷', title: 'Estados documentales', href: '/settings/statuses',
    description: 'Estados por los que pasa un documento y cuántos hay en cada uno.', permission: 'document:read' },
  { group: 'Documentos y datos', icon: '💾', title: 'Respaldos', href: '/settings/backups',
    description: 'Copias manuales y automáticas, descarga y restauración.', permission: 'backup:read' },
  { group: 'Documentos y datos', icon: '🔎', title: 'Auditoría', href: '/audit',
    description: 'Quién hizo qué y cuándo; verificación de integridad.', permission: ['audit:read_tenant', 'audit:read_global'] },
  { group: 'Suscripción', icon: '💳', title: 'Suscripción y facturación', href: '/billing/subscription',
    description: 'Plan, renovación, cambio de plan, recibos y cancelación.', permission: [...TENANT_PLAN_ADMIN] },
];

export const MANUAL_PDF_URL = '/assets/manual/manual-de-uso-nexodocs.pdf';

@Component({
  selector: 'app-settings-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LocalizedContentDirective],
  template: `
<main class="settings" i18nContent>
  <header>
    <p class="kicker">Sistema · Configuración</p>
    <h1>Configuración</h1>
    <span>Ajusta tu organización y accede a cada opción de configuración desde un solo lugar.</span>
  </header>

  <section class="org">
    @if (theme.settings().logoUrl) { <img [src]="theme.settings().logoUrl" alt="" /> } @else { <span class="org-badge">{{ initials() }}</span> }
    <div class="org-main"><p class="label">Organización activa</p><h2>{{ user()?.tenantName || 'Tu organización' }}</h2></div>
    <dl>
      @if (plan()) { <div><dt>Plan</dt><dd>{{ plan() }}</dd></div> }
      <div><dt>Moneda</dt><dd>{{ theme.settings().currency || 'USD' }}</dd></div>
      <div><dt>Zona horaria</dt><dd>{{ theme.settings().timezone || 'America/La_Paz' }}</dd></div>
      <div><dt>Formato de fecha</dt><dd>{{ theme.settings().dateFormat || 'YYYY-MM-DD' }}</dd></div>
    </dl>
    @if (canEditOrganization()) { <a class="primary" routerLink="/settings/appearance">Editar datos de la organización</a> }
  </section>

  <section class="manual">
    <div class="manual-icon" aria-hidden="true">📘</div>
    <div class="manual-main">
      <h2>Manual de uso</h2>
      <p>Guía completa para usuarios y administradores: documentos, OCR, expedientes, workflows, usuarios, respaldos, suscripción y auditoría.</p>
    </div>
    <div class="manual-actions">
      <a class="primary" [href]="manualUrl" download="Manual de uso NexoDocs.pdf">Descargar PDF</a>
      <a [href]="manualUrl" target="_blank" rel="noopener">Abrir</a>
      <button type="button" (click)="help.open()">Centro de ayuda</button>
    </div>
  </section>

  @for (group of groups(); track group.name) {
    <section class="group">
      <h2>{{ group.name }}</h2>
      <div class="cards">
        @for (item of group.items; track item.href + item.title) {
          <a class="card" [routerLink]="item.href">
            <span class="icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="text"><b>{{ item.title }}</b><small>{{ item.description }}</small></span>
            <span class="go" aria-hidden="true">›</span>
          </a>
        }
      </div>
    </section>
  } @empty {
    <p class="empty">Tu perfil no tiene opciones de configuración. Puedes descargar el manual o pedir permisos al administrador.</p>
  }
</main>`,
  styles: [`
    .settings{padding:32px;max-width:1240px;margin:auto;color:var(--ink,#173f38)}
    header{margin-bottom:22px}.kicker{color:var(--teal);font-size:11px;font-weight:800;letter-spacing:.12em;margin:0;text-transform:uppercase}
    h1{font-size:31px;margin:5px 0}header span{color:var(--muted,#66857f)}
    a,button{font:700 13px inherit}
    .primary{background:var(--teal);border:1px solid var(--teal);border-radius:10px;color:#fff;padding:10px 14px;text-decoration:none;white-space:nowrap}
    .manual-actions a:not(.primary),.manual-actions button{background:#fff;border:1px solid var(--line);border-radius:10px;color:var(--teal-strong);cursor:pointer;padding:10px 14px;text-decoration:none}
    .org,.manual{align-items:center;background:#fff;border:1px solid var(--line);border-radius:16px;display:flex;flex-wrap:wrap;gap:18px;margin-bottom:16px;padding:20px}
    .org img,.org-badge{border-radius:14px;height:56px;object-fit:contain;width:56px}
    .org-badge{align-items:center;background:var(--mint);color:var(--teal-strong);display:flex;font-size:20px;font-weight:800;justify-content:center}
    .org-main{flex:1;min-width:180px}.label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;margin:0;text-transform:uppercase}.org h2{font-size:22px;margin:4px 0 0}
    dl{display:flex;flex-wrap:wrap;gap:8px 22px;margin:0}dl div{display:grid;gap:2px}dt{color:var(--muted);font-size:11px}dd{font-size:13px;font-weight:700;margin:0}
    .manual{background:linear-gradient(135deg,#fff 55%,var(--tint,#e6f7f4) 100%)}
    .manual-icon{align-items:center;background:var(--mint);border-radius:14px;display:flex;font-size:26px;height:56px;justify-content:center;width:56px}
    .manual-main{flex:1;min-width:220px}.manual h2{font-size:18px;margin:0 0 4px}.manual p{color:var(--muted);font-size:13px;line-height:1.5;margin:0}
    .manual-actions{display:flex;flex-wrap:wrap;gap:8px}
    .group{margin-top:24px}.group h2{color:var(--muted);font-size:12px;letter-spacing:.08em;margin:0 0 10px;text-transform:uppercase}
    .cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
    .card{align-items:center;background:#fff;border:1px solid var(--line);border-radius:14px;color:inherit;display:flex;gap:14px;padding:16px;text-decoration:none;transition:border-color .15s,box-shadow .15s}
    .card:hover,.card:focus-visible{border-color:var(--teal);box-shadow:0 0 0 3px var(--tint,#e6f7f4)}
    .icon{align-items:center;background:var(--canvas,#f4f8f7);border-radius:12px;display:flex;flex:none;font-size:20px;height:44px;justify-content:center;width:44px}
    .text{display:grid;flex:1;gap:3px}.text b{font-size:14px}.text small{color:var(--muted);font-size:12px;font-weight:500;line-height:1.4}
    .go{color:var(--teal);font-size:22px}
    .empty{color:var(--muted);margin-top:20px}
    @media(max-width:700px){.settings{padding:20px 16px}.org,.manual{align-items:flex-start;flex-direction:column}}
  `],
})
export class SettingsHomePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly subscriptions = inject(SubscriptionService);
  readonly theme = inject(ThemeService);
  readonly help = inject(HelpService);
  readonly manualUrl = MANUAL_PDF_URL;
  readonly user = this.auth.user;
  readonly canEditOrganization = computed(() => this.permissions.can(['tenant:update', 'tenant:manage']));
  readonly plan = computed(() => {
    const current = this.subscriptions.currentSubscription();
    return current ? current.plan.name || current.plan.code : null;
  });
  readonly initials = computed(() => (this.user()?.tenantName ?? 'ND').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  readonly groups = computed(() => {
    // Lee el usuario para recalcular cuando /auth/me trae los permisos.
    this.user();
    const visible = SETTINGS_SHORTCUTS.filter((item) => this.permissions.can(item.permission));
    const names = [...new Set(visible.map((item) => item.group))];
    return names.map((name) => ({ name, items: visible.filter((item) => item.group === name) }));
  });

  ngOnInit(): void { this.subscriptions.load(); }
}
