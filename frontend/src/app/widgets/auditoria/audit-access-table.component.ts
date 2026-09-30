import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiAuditEvent } from '../../core/api/audit-api.service';
import { AuditPagination } from '../../features/auditoria/components/audit-pagination';

@Component({
  selector: 'app-audit-access-table',
  standalone: true,
  imports: [CommonModule, AuditPagination],
  template: `
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
          <button type="button" class="audit-reset" (click)="retry.emit()">Reintentar</button>
        </div>
      } @else if (!events().length) {
        <p class="audit-empty">No hay accesos para los filtros actuales.</p>
      } @else {
        <div class="audit-table-wrap">
          <table class="audit-table">
            <thead>
              <tr><th>Actor</th><th>Operación</th><th>Recurso</th><th>Resultado</th><th>Fecha</th><th>IP</th><th><span class="sr-only">Detalle</span></th></tr>
            </thead>
            <tbody>
              @for (event of events(); track event.id) {
                <tr (click)="openEvent.emit(event)">
                  <td><b>{{ actorLabel(event) }}</b><small>{{ event.actor?.scope || 'Sin alcance informado' }}</small></td>
                  <td>{{ actionLabel(event.action) }}</td>
                  <td><b>{{ event.entityType }}</b><small>{{ event.entityId || 'Sin identificador asociado' }}</small></td>
                  <td><span class="audit-result" [class]="resultClass(event.result)">{{ resultLabel(event.result) }}</span></td>
                  <td>{{ formatDate(event.occurredAt) }}</td>
                  <td>{{ event.ipAddress || 'No registrada' }}</td>
                  <td><button type="button" class="table-link" (click)="openEvent.emit(event); $event.stopPropagation()">Detalle</button></td>
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
          (pageChange)="pageChange.emit($event)"
          (pageSizeChange)="pageSizeChange.emit($event)"
        />
      }
    </section>
  `
})
export class AuditAccessTableComponent {
  readonly events = input<ApiAuditEvent[]>([]);
  readonly loading = input<boolean>(false);
  readonly errorMessage = input<string>('');
  readonly totalEvents = input<number>(0);
  readonly page = input<number>(1);
  readonly pageSize = input<number>(10);

  readonly openEvent = output<ApiAuditEvent>();
  readonly retry = output<void>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  actorLabel(event: ApiAuditEvent): string { return event.actor?.username || event.actor?.id || 'Usuario no identificado'; }
  actionLabel(action: string): string {
    const map: Record<string, string> = { HTTP_GET: 'Lectura', HTTP_POST: 'Creación', HTTP_PUT: 'Modificación', HTTP_PATCH: 'Modificación parcial', HTTP_DELETE: 'Eliminación' };
    return map[action] ?? action;
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
