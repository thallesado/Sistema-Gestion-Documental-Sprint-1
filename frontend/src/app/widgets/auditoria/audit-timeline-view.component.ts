import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiAuditEvent } from '../../core/api/audit-api.service';
import { AuditPagination } from '../../features/auditoria/components/audit-pagination';

@Component({
  selector: 'app-audit-timeline-view',
  standalone: true,
  imports: [CommonModule, AuditPagination],
  template: `
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
            <button type="button" class="audit-reset" (click)="retry.emit()">Reintentar</button>
          </div>
        } @else if (!events().length) {
          <p class="audit-empty">No hay registros para los filtros actuales.</p>
        } @else {
          <div class="audit-timeline">
            @for (event of events(); track event.id) {
              <button type="button" class="audit-event-row" (click)="openEvent.emit(event)">
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
            (pageChange)="pageChange.emit($event)"
            (pageSizeChange)="pageSizeChange.emit($event)"
          />
        }
      </section>

      <aside class="audit-control-card" aria-label="Resumen de la consulta">
        <span class="section-kicker">LECTURA DE CONTROL</span>
        <h2>Consulta de trazabilidad</h2>
        <p>Los resultados se limitan al alcance autorizado por el servidor.</p>
        @if (loading()) {
          <div class="control-status"><div><strong>Consultando registros</strong><small>Esperando la respuesta de la API.</small></div></div>
        } @else if (errorMessage()) {
          <div class="control-status"><div><strong>Consulta no disponible</strong><small>Reintenta cuando la API esté disponible.</small></div></div>
        } @else {
          <div class="control-status">
            <span class="control-check">✓</span>
            <div><strong>Registro persistente</strong><small>{{ totalEvents() }} eventos encontrados</small></div>
          </div>
        }
        <div class="control-list">
          <div><span>En esta página</span><b>{{ currentPageCount() }}</b></div>
          <div><span>Resultados visibles</span><b>{{ events().length }}</b></div>
          <div><span>Orden</span><b>Más reciente</b></div>
        </div>
      </aside>
    </div>
  `
})
export class AuditTimelineViewComponent {
  readonly events = input<ApiAuditEvent[]>([]);
  readonly loading = input<boolean>(false);
  readonly errorMessage = input<string>('');
  readonly totalEvents = input<number>(0);
  readonly page = input<number>(1);
  readonly pageSize = input<number>(10);
  readonly currentPageCount = input<number>(0);

  readonly openEvent = output<ApiAuditEvent>();
  readonly retry = output<void>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  actorLabel(event: ApiAuditEvent): string {
    return event.actor?.username || event.actor?.id || 'Usuario no identificado';
  }
  actionLabel(action: string): string {
    const map: Record<string, string> = { HTTP_GET: 'Lectura', HTTP_POST: 'Creación', HTTP_PUT: 'Modificación', HTTP_PATCH: 'Modificación parcial', HTTP_DELETE: 'Eliminación' };
    return map[action] ?? action;
  }
  resourceLabel(event: ApiAuditEvent): string {
    if (event.metadata?.['documentName']) return String(event.metadata['documentName']);
    if (event.entityId) return `${event.entityType} #${event.entityId}`;
    return event.entityType;
  }
  eventIcon(event: ApiAuditEvent): string {
    if (event.action === 'HTTP_POST') return '+';
    if (event.action === 'HTTP_DELETE') return '✕';
    if (event.action === 'HTTP_GET') return '👁';
    return '✎';
  }
  eventTone(event: ApiAuditEvent): string {
    if (event.result === 'FAILURE') return 'failure';
    if (event.action === 'HTTP_POST') return 'create';
    if (event.action === 'HTTP_DELETE') return 'delete';
    return 'default';
  }
  resultLabel(result: string): string { return result === 'SUCCESS' ? 'Exitoso' : 'Fallido'; }
  resultClass(result: string): string { return result === 'SUCCESS' ? 'success' : 'failure'; }
  formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return dateStr; }
  }
}
