import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlatformApiService, PlatformTenantUsageRow, PlatformUsageItem } from '../../../core/api/platform-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { formatBytes, usageBar } from './platform-tenant.logic';
import { TENANT_STATUS_LABELS, storageRatio } from './platform-tenant-usage.logic';

/**
 * Uso de almacenamiento (/tenants/storage): cuánto usa cada organización frente a los límites de su plan y
 * complementos. Solo números (anexo A); los mismos que muestra la ficha.
 */
@Component({
  selector: 'app-platform-tenant-usage-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page platform-usage">
      <header class="pu-header">
        <div>
          <span class="pu-kicker">ADMINISTRACIÓN GLOBAL · TENANTS</span>
          <h1>Uso de almacenamiento</h1>
          <p>Consumo de cada organización frente a los límites de su plan y sus complementos. Ordenado por el porcentaje de almacenamiento usado.</p>
        </div>
      </header>

      @if (error()) { <div class="pu-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }

      @if (rows().length) {
        <div class="pu-kpis">
          <article><span>Organizaciones</span><b>{{ rows().length }}</b></article>
          <article><span>Almacenamiento total</span><b>{{ bytes(totalStorage()) }}</b></article>
          <article><span>Sobre el 80 %</span><b>{{ nearLimit() }}</b></article>
          <article><span>Sobre el límite</span><b>{{ overLimit() }}</b></article>
        </div>
      }

      <section class="pu-panel">
        <div class="pu-toolbar">
          <label><span class="sr-only">Buscar</span><input name="search" [(ngModel)]="search" placeholder="Buscar organización…" /></label>
        </div>
        @if (loading() && !rows().length) { <p class="pu-muted">Cargando uso de las organizaciones…</p> }
        <div class="pu-table">
          <table>
            <thead><tr><th>Organización</th><th>Almacenamiento</th><th>Usuarios</th><th>Documentos</th><th>Páginas OCR del mes</th><th></th></tr></thead>
            <tbody>
              @for (r of visible(); track r.id) {
                <tr>
                  <td><b>{{ r.name }}</b><small>{{ r.planName ?? 'Sin plan' }} · {{ status(r.status) }}</small></td>
                  <td class="pu-meter-cell">
                    <span>{{ bytes(r.usage.storageBytes.used) }} / {{ r.usage.storageBytes.limit === -1 ? 'ilimitado' : bytes(r.usage.storageBytes.limit) }}</span>
                    <div class="pu-bar"><i [class]="bar(r.usage.storageBytes).tone" [style.width.%]="bar(r.usage.storageBytes).percent"></i></div>
                  </td>
                  <td class="pu-meter-cell"><span>{{ count(r.usage.users) }}</span>
                    <div class="pu-bar"><i [class]="bar(r.usage.users).tone" [style.width.%]="bar(r.usage.users).percent"></i></div></td>
                  <td class="pu-meter-cell"><span>{{ count(r.usage.documents) }}</span>
                    <div class="pu-bar"><i [class]="bar(r.usage.documents).tone" [style.width.%]="bar(r.usage.documents).percent"></i></div></td>
                  <td class="pu-meter-cell"><span>{{ count(r.usage.ocrPagesMonth) }}</span>
                    <div class="pu-bar"><i [class]="bar(r.usage.ocrPagesMonth).tone" [style.width.%]="bar(r.usage.ocrPagesMonth).percent"></i></div></td>
                  <td><a [routerLink]="['/platform/tenants', r.id]">Ver ficha</a></td>
                </tr>
              } @empty {
                @if (!loading()) { <tr><td colspan="6" class="pu-muted">No hay organizaciones que coincidan.</td></tr> }
              }
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .platform-usage { display: grid; gap: 14px; }
    .pu-header { padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pu-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pu-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pu-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 700px; }
    .pu-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pu-error button { margin-left: auto; background: #fff; border: 1px solid #fecaca; border-radius: 9px; cursor: pointer; font: inherit; font-weight: 700; padding: 6px 12px; }
    .pu-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .pu-kpis article { background: #fff; border: 1px solid #dcebe8; border-radius: 12px; padding: 12px 14px; display: grid; gap: 4px; }
    .pu-kpis span { font-size: 12px; color: #51717d; font-weight: 700; }
    .pu-kpis b { font-size: 20px; color: #153a39; }
    .pu-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 16px 18px; display: grid; gap: 10px; min-width: 0; }
    .pu-toolbar input { width: min(360px, 100%); border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; padding: 8px 10px; }
    .pu-muted { margin: 0; font-size: 13px; color: #51717d; }
    .pu-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #51717d; background: #f2f7f8; padding: 8px 10px; white-space: nowrap; }
    td { padding: 10px; border-bottom: 1px solid #eef3f2; vertical-align: middle; }
    td small { display: block; color: #6b8583; font-size: 12px; }
    td a { color: #087f7b; font-weight: 700; white-space: nowrap; }
    .pu-meter-cell { min-width: 150px; }
    .pu-meter-cell span { display: block; font-size: 12px; color: #244b49; margin-bottom: 4px; white-space: nowrap; }
    .pu-bar { height: 6px; border-radius: 999px; background: #edf3f1; overflow: hidden; }
    .pu-bar i { display: block; height: 100%; border-radius: 999px; background: #0f9d9a; }
    .pu-bar i.warn { background: #d99a1e; }
    .pu-bar i.over { background: #d14b4b; }
    .pu-bar i.unlimited { background: transparent; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `],
})
export class PlatformTenantUsagePage implements OnInit {
  private readonly api = inject(PlatformApiService);
  readonly rows = signal<PlatformTenantUsageRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';

  readonly totalStorage = computed(() => this.rows().reduce((sum, r) => sum + (Number(r.usage.storageBytes.used) || 0), 0));
  readonly nearLimit = computed(() => this.rows().filter((r) => usageBar(r.usage.storageBytes.used, r.usage.storageBytes.limit).tone === 'warn').length);
  readonly overLimit = computed(() => this.rows().filter((r) => usageBar(r.usage.storageBytes.used, r.usage.storageBytes.limit).tone === 'over').length);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tenantUsage().subscribe({
      next: (rows) => { this.rows.set([...rows].sort((a, b) => storageRatio(b) - storageRatio(a))); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo cargar el uso de las organizaciones.'); },
    });
  }

  visible(): PlatformTenantUsageRow[] {
    const term = this.search.trim().toLowerCase();
    return term ? this.rows().filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(term)) : this.rows();
  }

  bar(item: PlatformUsageItem) { return usageBar(item.used, item.limit); }
  bytes(value: number): string { return formatBytes(value); }
  count(item: PlatformUsageItem): string { return `${item.used} / ${item.limit === -1 ? 'ilimitado' : item.limit}`; }
  status(value: string): string { return TENANT_STATUS_LABELS[value] ?? value; }
}
