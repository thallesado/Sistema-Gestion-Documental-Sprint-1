import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AuditDrawerField = { label: string; value: string };
export type AuditDrawerAction = { label: string; kind: 'primary' | 'secondary' };
export type AuditDrawerDetail = {
  eyebrow: string;
  title: string;
  subtitle: string;
  status?: string;
  statusClass?: string;
  fields: AuditDrawerField[];
  details?: string;
  before?: Record<string, string>;
  after?: Record<string, string>;
  actions?: AuditDrawerAction[];
};

@Component({
  selector: 'app-audit-event-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (detail) {
      <div class="audit-drawer-backdrop" (click)="close()"></div>
      <aside class="audit-drawer" role="dialog" aria-modal="true" [attr.aria-label]="'Detalle de ' + detail.title">
        <header class="audit-drawer-header">
          <div><span class="audit-drawer-eyebrow">{{ detail.eyebrow }}</span><h2>{{ detail.title }}</h2><p>{{ detail.subtitle }}</p></div>
          <button type="button" class="drawer-close" aria-label="Cerrar detalle" (click)="close()">×</button>
        </header>
        @if (detail.status) { <span class="audit-result" [class]="detail.statusClass ?? 'success'">{{ detail.status }}</span> }
        <div class="audit-drawer-body">
          <dl class="audit-detail-grid">
            @for (field of detail.fields; track field.label) { <div><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div> }
          </dl>
          @if (detail.details) { <section class="drawer-section"><span class="drawer-label">DETALLES</span><p>{{ detail.details }}</p></section> }
          @if (detail.before || detail.after) {
            <section class="drawer-section"><span class="drawer-label">CAMBIO REGISTRADO</span>
              <div class="drawer-diff"><div><b>Antes</b>@for (item of detail.before | keyvalue; track item.key) { <span><small>{{ item.key }}</small>{{ item.value }}</span> }</div><div><b>Después</b>@for (item of detail.after | keyvalue; track item.key) { <span><small>{{ item.key }}</small>{{ item.value }}</span> }</div></div>
            </section>
          }
        </div>
        @if (detail.actions?.length) {
          <footer class="audit-drawer-actions">
            @for (action of detail.actions; track action.label) { <button type="button" [class]="action.kind === 'primary' ? 'drawer-primary' : 'drawer-secondary'" (click)="actionSelected.emit(action.label)">{{ action.label }}</button> }
          </footer>
        }
      </aside>
    }
  `,
})
export class AuditEventDrawer {
  @Input() detail: AuditDrawerDetail | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() actionSelected = new EventEmitter<string>();

  close(): void { this.closed.emit(); }
}
