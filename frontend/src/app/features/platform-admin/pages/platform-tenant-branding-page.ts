import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdministrationApiService, ApiTenant } from '../../../core/api/administration-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { TENANT_STATUS_LABELS, brandColor, initials, safeLogoUrl } from './platform-tenant-usage.logic';

/**
 * Branding de organizaciones (/tenants/branding): consulta del color y el logo de cada organización. Solo
 * lectura: cada organización edita su marca en Configuración → Apariencia.
 */
@Component({
  selector: 'app-platform-tenant-branding-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page platform-branding">
      <header class="pb-header">
        <div>
          <span class="pb-kicker">ADMINISTRACIÓN GLOBAL · TENANTS</span>
          <h1>Branding de organizaciones</h1>
          <p>Color de marca y logotipo de cada organización. Solo consulta: cada organización los configura en Configuración → Apariencia.</p>
        </div>
      </header>

      @if (error()) { <div class="pb-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }
      @if (loading() && !tenants().length) { <p class="pb-muted">Cargando organizaciones…</p> }

      <div class="pb-grid">
        @for (t of tenants(); track t.id) {
          <article class="pb-card">
            <div class="pb-band" [style.background]="color(t) ?? '#0e6b66'"></div>
            <div class="pb-body">
              @if (logo(t); as url) {
                <img class="pb-logo" [src]="url" [alt]="t.name" referrerpolicy="no-referrer" loading="lazy" />
              } @else {
                <span class="pb-logo pb-initials" [style.background]="color(t) ?? '#0e6b66'">{{ initialsOf(t.name) }}</span>
              }
              <div class="pb-info">
                <h2>{{ t.name }}</h2>
                <p>{{ t.code }} · {{ status(t.status) }}</p>
                <p class="pb-color">
                  <span class="pb-swatch" [style.background]="color(t) ?? 'transparent'"></span>
                  {{ color(t) ?? 'Color por defecto de NexoDocs' }}
                </p>
                <p class="pb-muted">{{ logo(t) ? 'Logotipo configurado' : 'Sin logotipo' }}</p>
              </div>
            </div>
            <a class="pb-link" [routerLink]="['/platform/tenants', t.id]">Ver ficha</a>
          </article>
        } @empty {
          @if (!loading()) { <p class="pb-muted">No hay organizaciones.</p> }
        }
      </div>
    </section>
  `,
  styles: [`
    .platform-branding { display: grid; gap: 14px; }
    .pb-header { padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pb-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pb-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pb-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 700px; }
    .pb-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pb-error button { margin-left: auto; background: #fff; border: 1px solid #fecaca; border-radius: 9px; cursor: pointer; font: inherit; font-weight: 700; padding: 6px 12px; }
    .pb-muted { margin: 0; font-size: 12px; color: #6b8583; }
    .pb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .pb-card { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; overflow: hidden; display: grid; }
    .pb-band { height: 10px; }
    .pb-body { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px 6px; }
    .pb-logo { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 12px; object-fit: contain; background: #f2f7f8; border: 1px solid #eef3f2; }
    .pb-initials { display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 16px; border: 0; }
    .pb-info { display: grid; gap: 3px; min-width: 0; }
    .pb-info h2 { margin: 0; font-size: 15px; color: #153a39; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pb-info p { margin: 0; font-size: 12px; color: #51717d; }
    .pb-color { display: flex; align-items: center; gap: 6px; font-family: ui-monospace, monospace; }
    .pb-swatch { width: 14px; height: 14px; border-radius: 4px; border: 1px solid #dcebe8; }
    .pb-link { color: #087f7b; font-size: 13px; font-weight: 700; padding: 6px 16px 14px; text-decoration: none; }
  `],
})
export class PlatformTenantBrandingPage implements OnInit {
  private readonly api = inject(AdministrationApiService);
  readonly tenants = signal<ApiTenant[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tenants().subscribe({
      next: (list) => { this.tenants.set([...list].sort((a, b) => a.name.localeCompare(b.name))); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudieron cargar las organizaciones.'); },
    });
  }

  color(t: ApiTenant): string | null { return brandColor(t.primaryColor); }
  logo(t: ApiTenant): string | null { return safeLogoUrl(t.logoUrl); }
  initialsOf(name: string): string { return initials(name); }
  status(value: string): string { return TENANT_STATUS_LABELS[value] ?? value; }
}
