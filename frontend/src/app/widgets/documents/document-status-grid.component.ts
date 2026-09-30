import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export type DocStatusItem = { code: string; label: string; tone: string; description: string };

@Component({
  selector: 'app-document-status-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="notice warning">
      <b>Configuración no disponible</b>
      <span>El backend expone el modelo de estados, pero todavía no publica un endpoint para configurarlos.</span>
    </section>
    <section class="status-grid">
      @for (status of statuses(); track status.code) {
        <article class="status-card">
          <span [class]="'status-dot ' + status.tone"></span>
          <div>
            <b>{{ status.label }}</b>
            <small>{{ status.description }}</small>
            <code>{{ status.code }}</code>
          </div>
        </article>
      }
    </section>
  `
})
export class DocumentStatusGridComponent {
  readonly statuses = input<DocStatusItem[]>([]);
}
