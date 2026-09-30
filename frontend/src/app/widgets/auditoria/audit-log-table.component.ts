import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiAuditLog } from '../../core/api/audit-api.service';

@Component({
  selector: 'app-audit-log-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha / Hora</th>
            <th>Módulo</th>
            <th>Acción</th>
            <th>Usuario</th>
            <th>IP</th>
            <th>Estado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          @for (log of logs(); track log.id) {
            <tr>
              <td><code>{{ log.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</code></td>
              <td><span class="module-tag">{{ log.module }}</span></td>
              <td><strong>{{ log.action }}</strong></td>
              <td>{{ log.username || log.userId || 'Sistema' }}</td>
              <td><code>{{ log.ipAddress || '—' }}</code></td>
              <td>
                <span [class]="'badge ' + (log.status === 'SUCCESS' ? 'badge-green' : 'badge-red')">
                  {{ log.status }}
                </span>
              </td>
              <td>
                <button type="button" class="btn-sm btn-ghost" (click)="viewDetail.emit(log)">
                  Ver detalle
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="empty-state">No se encontraron registros de auditoría para los filtros aplicados.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AuditLogTableComponent {
  readonly logs = input<ApiAuditLog[]>([]);
  readonly viewDetail = output<ApiAuditLog>();
}
