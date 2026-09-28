import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiAuditEvent, AuditApiService, AuditEventsFilter } from '../../core/api/audit-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { RouteInfo } from '../../core/data/nexodocs-data';
import { AuditDrawerDetail, AuditEventDrawer } from './components/audit-event-drawer';
import { AuditFilterField, AuditFilters } from './components/audit-filters';
import { AuditPagination } from './components/audit-pagination';

type AuditView = 'general' | 'access' | 'historical';

type AuditPageCopy = {
  title: string;
  description: string;
};

const auditPageCopy: Record<string, AuditPageCopy> = {
  '/audit': {
    title: 'Registro general',
    description: 'Consulta cronológica de los eventos persistidos para el tenant autenticado.',
  },
  '/audit/access': {
    title: 'Accesos',
    description: 'Consulta los accesos HTTP persistidos y su contexto técnico registrado.',
  },
  '/audit/document-creation': {
    title: 'Creación de documentos',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/modifications': {
    title: 'Modificaciones',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/downloads': {
    title: 'Descargas',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/approvals': {
    title: 'Aprobaciones',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/deletions': {
    title: 'Eliminaciones',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/permissions': {
    title: 'Cambios de permisos',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
};

const generalFilters: AuditFilterField[] = [
  {
    key: 'action',
    label: 'Operación',
    type: 'select',
    options: [
      { value: 'HTTP_GET', label: 'Lectura (GET)' },
      { value: 'HTTP_POST', label: 'Creación (POST)' },
      { value: 'HTTP_PUT', label: 'Modificación (PUT)' },
      { value: 'HTTP_PATCH', label: 'Modificación parcial (PATCH)' },
    ],
  },
  { key: 'type', label: 'Tipo de recurso', placeholder: 'DOCUMENT' },
  {
    key: 'result',
    label: 'Resultado',
    type: 'select',
    options: [
      { value: 'SUCCESS', label: 'Exitoso' },
      { value: 'FAILURE', label: 'Fallido' },
    ],
  },
  { key: 'dateFrom', label: 'Desde', type: 'date' },
  { key: 'dateTo', label: 'Hasta', type: 'date' },
];

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, AuditEventDrawer, AuditFilters, AuditPagination],
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
            <input
              [value]="searchTerm()"
              (input)="setSearchTerm($event)"
              placeholder="Buscar en los registros de esta página"
              aria-label="Buscar en los registros cargados"
            />
          </label>
          <span class="audit-search-note">{{ tenantName() }}</span>
        </div>

        <app-audit-filters
          [fields]="filters"
          [values]="filterValues()"
          (valuesChange)="setFilters($event)"
        />

        @if (view === 'general') {
          <div class="audit-general-layout">
            <section class="audit-feed-card" aria-labelledby="audit-records-title">
              <div class="audit-section-heading">
                <div>
                  <span class="section-kicker">REGISTRO PERSISTENTE</span>
                  <h2 id="audit-records-title">Actividad registrada</h2>
                  <p>Eventos recuperados desde la bitácora inmutable de la API.</p>
                </div>
                <span class="live-indicator">Consulta actual</span>
              </div>

              @if (loading()) {
                <p class="audit-empty" role="status">Cargando registros de auditoría…</p>
              } @else if (errorMessage()) {
                <div class="audit-empty" role="alert">
                  <p>{{ errorMessage() }}</p>
                  <button type="button" class="audit-reset" (click)="retry()">Reintentar</button>
                </div>
              } @else if (!filteredEvents().length) {
                <p class="audit-empty">No hay registros para los filtros actuales.</p>
              } @else {
                <div class="audit-timeline">
                  @for (event of filteredEvents(); track event.id) {
                    <button type="button" class="audit-event-row" (click)="openEvent(event)">
                      <span [class]="'audit-event-icon ' + eventTone(event)" aria-hidden="true">{{ eventIcon(event) }}</span>
                      <span class="audit-event-line"></span>
                      <span class="audit-event-main">
                        <span class="audit-event-top">
                          <b>{{ actorLabel(event) }}</b>
                          <span class="audit-action-badge" [class]="eventTone(event)">{{ actionLabel(event.action) }}</span>
                        </span>
                        <strong>{{ resourceLabel(event) }}</strong>
                        <small>{{ event.entityType }} · {{ formatDate(event.occurredAt) }} · {{ event.ipAddress || 'IP no registrada' }}</small>
                      </span>
                      <span class="audit-result" [class]="resultClass(event.result)">{{ resultLabel(event.result) }}</span>
                      <span class="audit-chevron" aria-hidden="true">›</span>
                    </button>
                  }
                </div>
              }

              @if (!loading() && !errorMessage()) {
                <app-audit-pagination
                  [total]="totalEvents()"
                  [page]="page()"
                  [pageSize]="pageSize()"
                  (pageChange)="goToPage($event)"
                  (pageSizeChange)="changePageSize($event)"
                />
              }
            </section>

            <aside class="audit-control-card" aria-label="Resumen de la consulta">
              <span class="section-kicker">LECTURA DE CONTROL</span>
              <h2>Consulta de trazabilidad</h2>
              <p>Los resultados se limitan al alcance autorizado por el servidor.</p>
              @if (loading()) {
                <div class="control-status">
                  <div><strong>Consultando registros</strong><small>Esperando la respuesta de la API.</small></div>
                </div>
              } @else if (errorMessage()) {
                <div class="control-status">
                  <div><strong>Consulta no disponible</strong><small>Reintenta cuando la API esté disponible.</small></div>
                </div>
              } @else {
                <div class="control-status">
                  <span class="control-check">✓</span>
                  <div>
                    <strong>Registro persistente</strong>
                    <small>{{ totalEvents() }} eventos encontrados</small>
                  </div>
                </div>
              }
              <div class="control-list">
                <div><span>En esta página</span><b>{{ events().length }}</b></div>
                <div><span>Resultados visibles</span><b>{{ filteredEvents().length }}</b></div>
                <div><span>Orden</span><b>Más reciente</b></div>
              </div>
            </aside>
          </div>
        } @else {
          <section class="audit-panel access-ledger" aria-labelledby="access-records-title">
            <div class="audit-section-heading">
              <div>
                <span class="section-kicker">ACCESOS PERSISTIDOS</span>
                <h2 id="access-records-title">Accesos y operaciones HTTP</h2>
                <p>Cada fila corresponde a un evento devuelto por la API de auditoría.</p>
              </div>
              <span class="security-chip">{{ totalEvents() }} registros</span>
            </div>

            @if (loading()) {
              <p class="audit-empty" role="status">Cargando accesos registrados…</p>
            } @else if (errorMessage()) {
              <div class="audit-empty" role="alert">
                <p>{{ errorMessage() }}</p>
                <button type="button" class="audit-reset" (click)="retry()">Reintentar</button>
              </div>
            } @else if (!filteredEvents().length) {
              <p class="audit-empty">No hay accesos para los filtros actuales.</p>
            } @else {
              <div class="audit-table-wrap">
                <table class="audit-table">
                  <thead>
                    <tr><th>Actor</th><th>Operación</th><th>Recurso</th><th>Resultado</th><th>Fecha</th><th>IP</th><th><span class="sr-only">Detalle</span></th></tr>
                  </thead>
                  <tbody>
                    @for (event of filteredEvents(); track event.id) {
                      <tr (click)="openEvent(event)">
                        <td><b>{{ actorLabel(event) }}</b><small>{{ event.actor?.scope || 'Sin alcance informado' }}</small></td>
                        <td>{{ actionLabel(event.action) }}</td>
                        <td><b>{{ event.entityType }}</b><small>{{ event.entityId || 'Sin identificador asociado' }}</small></td>
                        <td><span class="audit-result" [class]="resultClass(event.result)">{{ resultLabel(event.result) }}</span></td>
                        <td>{{ formatDate(event.occurredAt) }}</td>
                        <td>{{ event.ipAddress || 'No registrada' }}</td>
                        <td><button type="button" class="table-link" (click)="openEvent(event); $event.stopPropagation()">Detalle</button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @if (!loading() && !errorMessage()) {
              <app-audit-pagination
                [total]="totalEvents()"
                [page]="page()"
                [pageSize]="pageSize()"
                (pageChange)="goToPage($event)"
                (pageSizeChange)="changePageSize($event)"
              />
            }
          </section>
        }
      }
      <app-audit-event-drawer [detail]="drawerDetail()" (closed)="closeDrawer()" />
    </section>
  `,
})
export class AuditPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly auditApi = inject(AuditApiService);
  private readonly routeInfo = this.route.snapshot.data['routeInfo'] as RouteInfo | undefined;
  private readonly routePath = this.routeInfo?.href ?? '/audit';

  readonly pageCopy = auditPageCopy[this.routePath] ?? auditPageCopy['/audit'];
  readonly view: AuditView = this.routePath === '/audit'
    ? 'general'
    : this.routePath === '/audit/access'
      ? 'access'
      : 'historical';
  readonly filters = generalFilters;
  readonly currentUser = this.auth.user;
  readonly canReadAudit = computed(() => {
    const user = this.currentUser();
    return user?.platformAdmin === true
      || (user?.roleNames ?? []).some((role) => {
        const normalized = role.toUpperCase();
        return normalized === 'SUPER_ADMIN'
          || normalized === 'SUPERADMINISTRADOR'
          || normalized === 'ADMINISTRADOR DE TENANT'
          || normalized === 'TENANT_ADMIN';
      });
  });
  readonly tenantName = computed(() => {
    const user = this.currentUser();
    if (user?.tenantName) return user.tenantName;
    return user?.platformAdmin ? 'Cuenta de plataforma' : 'Tenant no disponible';
  });
  readonly events = signal<ApiAuditEvent[]>([]);
  readonly totalEvents = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly searchTerm = signal('');
  readonly filterValues = signal<Record<string, string>>({});
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly reloadVersion = signal(0);
  readonly drawerDetail = signal<AuditDrawerDetail | null>(null);

  constructor() {
    effect((onCleanup) => {
      if (this.view === 'historical' || !this.canReadAudit()) {
        this.events.set([]);
        this.totalEvents.set(0);
        return;
      }

      this.reloadVersion();
      this.loading.set(true);
      this.errorMessage.set('');
      const subscription = this.auditApi.events(
        this.apiFilters(this.filterValues()),
        this.page() - 1,
        this.pageSize(),
      ).subscribe({
        next: (response) => {
          this.events.set(response.content);
          this.totalEvents.set(response.totalElements);
          this.loading.set(false);
        },
        error: (error: { status?: number }) => {
          this.events.set([]);
          this.totalEvents.set(0);
          this.errorMessage.set(this.auditError(error));
          this.loading.set(false);
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  setSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setFilters(values: Record<string, string>): void {
    this.page.set(1);
    this.filterValues.set(values);
  }

  goToPage(page: number): void {
    this.page.set(page);
  }

  changePageSize(pageSize: number): void {
    this.page.set(1);
    this.pageSize.set(pageSize);
  }

  retry(): void {
    this.reloadVersion.update((version) => version + 1);
  }

  openEvent(event: ApiAuditEvent): void {
    this.drawerDetail.set({
      eyebrow: 'EVENTO PERSISTIDO',
      title: this.actionLabel(event.action),
      subtitle: this.resourceLabel(event),
      status: this.resultLabel(event.result),
      statusClass: this.resultClass(event.result),
      fields: [
        { label: 'Identificador', value: String(event.id) },
        { label: 'Actor', value: this.actorLabel(event) },
        { label: 'Alcance', value: event.actor?.scope || 'No informado' },
        { label: 'Tipo de recurso', value: event.entityType },
        { label: 'Recurso', value: event.entityId || 'Sin identificador asociado' },
        { label: 'Fecha', value: this.formatDate(event.occurredAt) },
        { label: 'Dirección IP', value: event.ipAddress || 'No registrada' },
        { label: 'Agente de usuario', value: event.userAgent || 'No registrado' },
      ],
    });
  }

  closeDrawer(): void {
    this.drawerDetail.set(null);
  }

  readonly filteredEvents = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    if (!query) return this.events();
    return this.events().filter((event) => this.searchableEvent(event).includes(query));
  });

  actorLabel(event: ApiAuditEvent): string {
    const user = this.currentUser();
    if (user && event.userId === user.id) {
      const name = `${user.firstName} ${user.lastName}`.trim();
      return name || user.username;
    }
    return event.actor?.userId || event.userId || event.platformActorId || 'Actor no informado';
  }

  resourceLabel(event: ApiAuditEvent): string {
    return event.entityId ? `${event.entityType} · ${event.entityId}` : event.entityType;
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      HTTP_GET: 'Lectura (GET)',
      HTTP_POST: 'Creación (POST)',
      HTTP_PUT: 'Modificación (PUT)',
      HTTP_PATCH: 'Modificación parcial (PATCH)',
      HTTP_DELETE: 'Eliminación (DELETE)',
    };
    return labels[action] ?? action;
  }

  resultLabel(result: string): string {
    return result === 'SUCCESS' ? 'Exitoso' : result === 'FAILURE' ? 'Fallido' : result;
  }

  resultClass(result: string): string {
    return result === 'SUCCESS' ? 'success' : 'danger';
  }

  eventTone(event: ApiAuditEvent): string {
    if (event.action === 'HTTP_GET') return 'blue';
    if (event.action === 'HTTP_POST') return 'teal';
    if (event.action === 'HTTP_PUT' || event.action === 'HTTP_PATCH') return 'amber';
    return event.result === 'SUCCESS' ? 'purple' : 'rose';
  }

  eventIcon(event: ApiAuditEvent): string {
    if (event.action === 'HTTP_GET') return '⌕';
    if (event.action === 'HTTP_POST') return '+';
    if (event.action === 'HTTP_PUT' || event.action === 'HTTP_PATCH') return '✎';
    return event.result === 'SUCCESS' ? '✓' : '!';
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(date);
  }

  private apiFilters(values: Record<string, string>): AuditEventsFilter {
    return {
      action: values['action'] || undefined,
      type: values['type'] || undefined,
      result: values['result'] as AuditEventsFilter['result'] || undefined,
      from: values['dateFrom'] ? `${values['dateFrom']}T00:00:00.000Z` : undefined,
      to: values['dateTo'] ? `${values['dateTo']}T23:59:59.999Z` : undefined,
    };
  }

  private searchableEvent(event: ApiAuditEvent): string {
    return [
      event.id,
      event.userId,
      event.platformActorId,
      event.actor?.userId,
      event.actor?.scope,
      event.action,
      event.entityType,
      event.entityId,
      event.occurredAt,
      event.result,
      event.ipAddress,
      event.userAgent,
    ].filter((value): value is string | number => value !== null && value !== undefined)
      .join(' ')
      .toLocaleLowerCase();
  }

  private auditError(error: { status?: number }): string {
    if (error.status === 401 || error.status === 403) {
      return 'No tienes permisos para consultar los registros de auditoría.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con la API de auditoría. Comprueba que el servidor esté disponible.';
    }
    return 'No fue posible cargar los registros de auditoría.';
  }
}
