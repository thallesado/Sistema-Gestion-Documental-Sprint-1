import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { DemoItem, RouteInfo } from '../../core/data/nexodocs-data';
import { Pagination } from '../../shared';

@Component({
  selector: 'app-workspace-subview-panel',
  standalone: true,
  imports: [CommonModule, Pagination],
  template: `
    <section class="subview-header">
      <div class="subview-left">
        <p class="eyebrow">{{ activeRoute()?.module || 'Módulo' }} · {{ activeRoute()?.subcategory || 'Vista' }}</p>
        <h1>{{ activeRoute()?.subcategory || 'Espacio de trabajo' }}</h1>
        <p>{{ description() }}</p>
      </div>
      <div class="subview-actions">
        <button type="button" class="btn-primary" (click)="primaryAction.emit()">{{ actionText() }}</button>
      </div>
    </section>

    <!-- Toolbar & Search -->
    <div class="subview-toolbar">
      <div class="search-box">
        <span>⌕</span>
        <input placeholder="Buscar en esta vista…" [value]="searchTerm()" (input)="searchChange.emit($any($event.target).value)" />
      </div>
      <button type="button" class="btn-ghost" (click)="exportCsv.emit()">Exportar CSV</button>
    </div>

    <!-- Table -->
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Elemento</th>
            <th>Metadatos</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.title + item.date) {
            <tr>
              <td><strong>{{ item.title }}</strong></td>
              <td>{{ item.meta }}</td>
              <td><code>{{ item.date }}</code></td>
              <td><span class="badge">{{ item.status }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="empty-state">No se encontraron elementos disponibles para esta consulta.</td></tr>
          }
        </tbody>
      </table>

      @if (totalItems() > pageSize()) {
        <app-pagination [page]="page()" [pageSize]="pageSize()" [total]="totalItems()" (pageChange)="pageChange.emit($event)" />
      }
    </div>
  `
})
export class WorkspaceSubviewPanelComponent {
  readonly activeRoute = input<RouteInfo | null>(null);
  readonly description = input<string>('');
  readonly actionText = input<string>('Nueva acción');
  readonly items = input<DemoItem[]>([]);
  readonly totalItems = input<number>(0);
  readonly page = input<number>(1);
  readonly pageSize = input<number>(8);
  readonly searchTerm = input<string>('');

  readonly primaryAction = output<void>();
  readonly exportCsv = output<void>();
  readonly searchChange = output<string>();
  readonly pageChange = output<number>();
}
