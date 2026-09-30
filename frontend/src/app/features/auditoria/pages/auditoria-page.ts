import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiAuditEvent, AuditApiService, AuditEventsFilter } from '../../../core/api/audit-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AuditDrawerDetail, AuditEventDrawer } from '../components/audit-event-drawer';
import { AuditFilterField, AuditFilters } from '../components/audit-filters';
import { auditPageCopy, generalFilters } from '../../../widgets/auditoria/audit-page-config';
import { AuditTimelineViewComponent } from '../../../widgets/auditoria/audit-timeline-view.component';
import { AuditAccessTableComponent } from '../../../widgets/auditoria/audit-access-table.component';

type AuditView = 'general' | 'access' | 'historical';

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, AuditEventDrawer, AuditFilters, AuditTimelineViewComponent, AuditAccessTableComponent],
  template: `
    <section class="page audit-page">
      <header class="audit-page-header">
        <div class="audit-title">
          <div class="audit-module-icon" aria-hidden="true">◌</div>
          <div>
            <p class="eyebrow">Auditoría <span>·</span> {{ pageCopy.title }}</p>
            <h1>{{ pageCopy.title }}</h1>
            <p>{{ pageCopy.description }}</p>
          </div>
        </div>
      </header>

      @if (!canReadAudit()) {
        <section class="audit-feed-card" aria-labelledby="audit-access-title">
          <span class="section-kicker">ACCESO RESTRINGIDO</span>
          <h2 id="audit-access-title">No tienes acceso a la auditoría</h2>
          <p>Esta consulta está disponible para Administrador de tenant y Superadministrador.</p>
        </section>
      } @else if (view === 'historical') {
        <section class="audit-feed-card" aria-labelledby="audit-history-title">
          <span class="section-kicker">HISTORIAL NO DISPONIBLE</span>
          <h2 id="audit-history-title">Esta consulta aún no está expuesta por la API</h2>
          <p>La ruta se mantiene por compatibilidad, pero no muestra registros simulados.</p>
        </section>
      } @else {
        <div class="audit-searchbar">
          <label>
            <span aria-hidden="true">⌕</span>
            <input [value]="searchTerm()" (input)="setSearchTerm($event)" placeholder="Buscar en los registros de esta página" aria-label="Buscar en los registros cargados" />
          </label>
          <span class="audit-search-note">{{ tenantName() }}</span>
        </div>

        <app-audit-filters [fields]="filters" [values]="filterValues()" (valuesChange)="setFilters($event)" />

        @if (view === 'general') {
          <app-audit-timeline-view
            [events]="filteredEvents()"
            [loading]="loading()"
            [errorMessage]="errorMessage()"
            [totalEvents]="totalEvents()"
            [page]="page()"
            [pageSize]="pageSize()"
            [currentPageCount]="events().length"
            (openEvent)="openEvent($event)"
            (retry)="retry()"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="changePageSize($event)"
          />
        } @else {
          <app-audit-access-table
            [events]="filteredEvents()"
            [loading]="loading()"
            [errorMessage]="errorMessage()"
            [totalEvents]="totalEvents()"
            [page]="page()"
            [pageSize]="pageSize()"
            (openEvent)="openEvent($event)"
            (retry)="retry()"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="changePageSize($event)"
          />
        }
      }

      <app-audit-event-drawer [detail]="drawerDetail()" (closed)="closeDrawer()" />
    </section>
  `
})
export class AuditoriaPage {
  private readonly auditApi = inject(AuditApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly events = signal<ApiAuditEvent[]>([]);
  readonly totalEvents = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly filterValues = signal<Record<string, string>>({});
  readonly searchTerm = signal('');
  readonly drawerDetail = signal<AuditDrawerDetail | null>(null);

  readonly view: AuditView = this.resolveView();
  readonly pageCopy = auditPageCopy[this.route.snapshot.routeConfig?.path ? `/${this.route.snapshot.routeConfig.path}` : '/audit'] ?? auditPageCopy['/audit'];
  readonly filters: AuditFilterField[] = generalFilters;

  readonly canReadAudit = computed(() => {
    const user = this.auth.user();
    if (!user) return false;
    if (user.platformAdmin) return true;
    const roles = (user.roleNames ?? []).map(r => r.toUpperCase());
    return roles.includes('ADMINISTRADOR DE TENANT') || roles.includes('SUPERADMINISTRADOR') || roles.includes('SUPER_ADMIN');
  });

  readonly tenantName = computed(() => this.auth.user()?.tenantName ?? 'Tenant activo');

  readonly filteredEvents = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.events();
    if (!term) return list;
    return list.filter(e =>
      (e.action ?? '').toLowerCase().includes(term) ||
      (e.entityType ?? '').toLowerCase().includes(term) ||
      (e.ipAddress ?? '').toLowerCase().includes(term) ||
      (e.actor?.username ?? '').toLowerCase().includes(term)
    );
  });

  constructor() {
    effect(() => {
      if (this.canReadAudit() && this.view !== 'historical') {
        this.fetchEvents();
      }
    });
  }

  fetchEvents(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    const f = this.filterValues();
    const filter: AuditEventsFilter = {
      action: f['action'] || undefined,
      type: f['type'] || undefined,
      result: (f['result'] as any) || undefined,
      from: f['dateFrom'] || undefined,
      to: f['dateTo'] || undefined,
    };
    this.auditApi.events(filter, this.page() - 1, this.pageSize()).subscribe({
      next: res => {
        this.events.set(res.content || []);
        this.totalEvents.set(res.totalElements || 0);
        this.loading.set(false);
      },
      error: err => {
        this.errorMessage.set(err?.error?.message || 'No se pudieron consultar los eventos de auditoría.');
        this.loading.set(false);
      }
    });
  }

  setFilters(values: Record<string, string>): void {
    this.filterValues.set(values);
    this.page.set(1);
    this.fetchEvents();
  }

  setSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.fetchEvents();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.fetchEvents();
  }

  openEvent(event: ApiAuditEvent): void {
    this.drawerDetail.set({
      eyebrow: `EVENTO #${event.id}`,
      title: `${event.action} en ${event.entityType}`,
      subtitle: event.occurredAt,
      status: event.result === 'SUCCESS' ? 'Exitoso' : 'Fallido',
      statusClass: event.result === 'SUCCESS' ? 'success' : 'failure',
      fields: [
        { label: 'Actor', value: event.actor?.username || event.actor?.userId || event.userId || 'Sistema' },
        { label: 'Recurso', value: `${event.entityType} ${event.entityId ? '#' + event.entityId : ''}` },
        { label: 'IP', value: event.ipAddress || 'No registrada' },
        { label: 'User Agent', value: event.userAgent || 'No registrado' }
      ],
      details: event.metadata ? JSON.stringify(event.metadata, null, 2) : undefined,
      before: event.changes?.before,
      after: event.changes?.after
    });
  }

  closeDrawer(): void {
    this.drawerDetail.set(null);
  }

  retry(): void {
    this.fetchEvents();
  }

  private resolveView(): AuditView {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    if (path === 'audit/access') return 'access';
    if (path.startsWith('audit/')) return 'historical';
    return 'general';
  }
}

export const AuditPage = AuditoriaPage;
