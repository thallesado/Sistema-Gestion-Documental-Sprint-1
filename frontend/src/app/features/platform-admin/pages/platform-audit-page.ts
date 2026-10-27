import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlatformApiService, PlatformAuditFilters, PlatformAuditResult } from '../../../core/api/platform-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { actionLabel, describeState } from './platform-tenant.logic';

const PAGE_SIZE = 20;

/** Auditoría de plataforma (/platform/audit): acciones del administrador global con su motivo. */
@Component({
  selector: 'app-platform-audit-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page platform-audit">
      <header class="pa-header">
        <div>
          <span class="pa-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Auditoría de plataforma</h1>
          <p>Acciones de los administradores globales sobre las organizaciones, con su motivo. Los registros no se pueden editar ni borrar.</p>
        </div>
      </header>

      <form class="pa-filters" (ngSubmit)="search()">
        <label>Desde<input type="date" name="dateFrom" [(ngModel)]="filters.dateFrom" /></label>
        <label>Hasta<input type="date" name="dateTo" [(ngModel)]="filters.dateTo" /></label>
        <label>Acción
          <select name="action" [(ngModel)]="filters.action">
            <option value="">Todas las acciones</option>
            @for (action of actions(); track action) { <option [value]="action">{{ label(action) }}</option> }
          </select>
        </label>
        <label>Administrador<input type="search" name="actor" [(ngModel)]="filters.actor" placeholder="Usuario" /></label>
        @if (filters.tenantId) {
          <span class="pa-chip">Organización filtrada <button type="button" (click)="clearTenant()" aria-label="Quitar filtro de organización">✕</button></span>
        }
        <div class="pa-buttons">
          <button type="submit" class="primary" [disabled]="loading()">Buscar</button>
          <button type="button" (click)="exportCsv()" [disabled]="exporting()">{{ exporting() ? 'Exportando…' : 'Exportar CSV' }}</button>
        </div>
      </form>

      @if (error()) {
        <div class="pa-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div>
      }

      <section class="pa-panel">
        @if (loading() && !page()) {
          <div class="pa-loading"><span class="spinner"></span> Cargando la auditoría…</div>
        } @else if (page(); as p) {
          <p class="pa-count">{{ p.totalElements }} registro(s)</p>
          <div class="pa-table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Administrador</th><th>Acción</th><th>Organización</th><th>Motivo</th><th>Antes</th><th>Después</th><th>IP</th></tr></thead>
              <tbody>
                @for (row of p.content; track row.id) {
                  <tr>
                    <td class="nowrap">{{ dateTime(row.occurredAt) }}</td>
                    <td>{{ row.actor }}</td>
                    <td><b>{{ label(row.action) }}</b></td>
                    <td>@if (row.tenantId) { <a [routerLink]="['/platform/tenants', row.tenantId]">{{ row.tenant }}</a> } @else { — }</td>
                    <td class="reason">{{ row.reason }}</td>
                    <td class="state">{{ state(row.before) }}</td>
                    <td class="state">{{ state(row.after) }}</td>
                    <td class="nowrap">{{ row.ipAddress || '—' }}</td>
                  </tr>
                } @empty { <tr><td colspan="8" class="pa-empty">No hay acciones registradas con estos filtros.</td></tr> }
              </tbody>
            </table>
          </div>
          @if (p.totalPages > 1) {
            <nav class="pa-pager" aria-label="Paginación">
              <button type="button" [disabled]="p.page <= 1 || loading()" (click)="goTo(p.page - 1)">Anterior</button>
              <span>Página {{ p.page }} de {{ p.totalPages }}</span>
              <button type="button" [disabled]="p.page >= p.totalPages || loading()" (click)="goTo(p.page + 1)">Siguiente</button>
            </nav>
          }
        }
      </section>
    </section>
  `,
  styles: [`
    .platform-audit { display: grid; gap: 14px; }
    .pa-header { padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pa-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pa-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pa-header p { margin: 0; color: #b6d7ce; font-size: 14px; }
    .pa-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 14px 16px; }
    .pa-filters label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #51717d; }
    .pa-filters input, .pa-filters select { border: 1px solid #cfdfe4; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; color: #153a39; background: #fff; min-width: 0; }
    .pa-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: #e6f4f1; color: #0f4a43; font-size: 12px; font-weight: 700; }
    .pa-chip button { border: 0; background: none; padding: 0 2px; cursor: pointer; color: inherit; }
    .pa-buttons { display: flex; gap: 8px; margin-left: auto; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 9px 14px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .pa-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pa-error button { margin-left: auto; }
    .pa-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 16px 18px; min-width: 0; }
    .pa-loading { display: flex; align-items: center; gap: 10px; padding: 30px; justify-content: center; color: #087f7b; }
    .spinner { width: 20px; height: 20px; border: 3px solid #dcebe8; border-top-color: #087f7b; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pa-count { margin: 0 0 10px; font-size: 12px; color: #6b8583; }
    .pa-table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #51717d; background: #f2f7f8; padding: 10px 12px; white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid #eef3f2; color: #153a39; vertical-align: top; }
    td a { color: #087f7b; font-weight: 700; text-decoration: none; }
    td.reason { min-width: 200px; overflow-wrap: anywhere; }
    td.state { font-size: 12px; color: #51717d; min-width: 140px; overflow-wrap: anywhere; }
    .nowrap { white-space: nowrap; }
    .pa-empty { text-align: center; color: #6b8583; padding: 24px; }
    .pa-pager { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 12px; font-size: 13px; color: #415e5a; }
    @media (max-width: 720px) { .pa-buttons { margin-left: 0; width: 100%; } .pa-filters label { flex: 1 1 140px; } }
  `],
})
export class PlatformAuditPage implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly route = inject(ActivatedRoute);

  readonly page = signal<PlatformAuditResult | null>(null);
  readonly actions = signal<string[]>([]);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  filters: Required<PlatformAuditFilters> = { dateFrom: '', dateTo: '', action: '', tenantId: '', actor: '' };
  private current = 1;

  ngOnInit(): void {
    this.filters.tenantId = this.route.snapshot.queryParamMap.get('tenantId') ?? '';
    this.api.auditActions().subscribe({ next: (actions) => this.actions.set(actions), error: () => undefined });
    this.load();
  }

  search(): void { this.current = 1; this.load(); }

  goTo(page: number): void { this.current = page; this.load(); }

  clearTenant(): void { this.filters.tenantId = ''; this.search(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.audit(this.filters, this.current, PAGE_SIZE).subscribe({
      next: (page) => { this.page.set(page); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo cargar la auditoría de plataforma.');
      },
    });
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.error.set('');
    this.api.exportAuditCsv(this.filters).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `plataforma-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(friendlyApiMessage(err?.error?.message) || 'No se pudo exportar la auditoría.');
      },
    });
  }

  label(action: string): string { return actionLabel(action); }
  state(json: string | null): string { return describeState(json); }

  dateTime(value: string): string {
    return new Date(value).toLocaleString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
