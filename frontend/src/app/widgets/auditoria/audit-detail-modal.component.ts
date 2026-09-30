import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiAuditLog } from '../../core/api/audit-api.service';

@Component({
  selector: 'app-audit-detail-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (log()) {
      <div class="modal-backdrop" (click)="close.emit()">
        <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>Detalle de evento de auditoría</h3>
            <button class="icon-btn" (click)="close.emit()">✕</button>
          </header>
          <div class="modal-body">
            <dl class="meta-grid">
              <div><dt>ID:</dt><dd><code>{{ log()?.id }}</code></dd></div>
              <div><dt>Fecha:</dt><dd>{{ log()?.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</dd></div>
              <div><dt>Módulo:</dt><dd><span class="module-tag">{{ log()?.module }}</span></dd></div>
              <div><dt>Acción:</dt><dd><strong>{{ log()?.action }}</strong></dd></div>
              <div><dt>Usuario:</dt><dd>{{ log()?.username || log()?.userId }}</dd></div>
              <div><dt>Tenant:</dt><dd>{{ log()?.tenantId }}</dd></div>
              <div><dt>IP / Origen:</dt><dd><code>{{ log()?.ipAddress || '—' }}</code></dd></div>
              <div><dt>Estado:</dt><dd><span [class]="'badge ' + (log()?.status === 'SUCCESS' ? 'badge-green' : 'badge-red')">{{ log()?.status }}</span></dd></div>
            </dl>
            @if (log()?.details) {
              <div class="audit-payload">
                <h4>Detalles adicionales</h4>
                <pre><code>{{ log()?.details }}</code></pre>
              </div>
            }
          </div>
          <footer class="modal-footer">
            <button class="btn-primary" (click)="close.emit()">Cerrar</button>
          </footer>
        </div>
      </div>
    }
  `
})
export class AuditDetailModalComponent {
  readonly log = input<ApiAuditLog | null>(null);
  readonly close = output<void>();
}
