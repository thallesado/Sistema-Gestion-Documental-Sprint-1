import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiDocument } from '../../core/api/document-api.service';

@Component({
  selector: 'app-document-catalog-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="doc-catalog-list-card">
      <div class="doc-list-items">
        @for (item of documents(); track item.id) {
          <article class="doc-item-row" tabindex="0" role="button" (click)="openDetails.emit(item)">
            <span class="doc-api-badge">API</span>
            <div class="doc-item-main">
              <h3>{{ item.name }}</h3>
              <p>{{ item.code }} · versión {{ item.currentVersion || 1 }}</p>
            </div>
            <div class="doc-item-right">
              <time>{{ item.effectiveDate || item.createdAt | date:'dd/MM/yyyy' }}</time>
              <span class="status status-pill" [ngClass]="item.status ? item.status.toLowerCase() : 'in_review'">{{ item.status }}</span>
              <button type="button" class="btn-doc-action" (click)="$event.stopPropagation(); loadVersions.emit(item)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Versiones</span>
              </button>
              <label class="btn-doc-action" (click)="$event.stopPropagation()">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                <span>Subir</span>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" style="display: none;" (change)="uploadVersion.emit({ doc: item, event: $event })" />
              </label>
            </div>
          </article>
        } @empty {
          @if (!loading()) {
            <div class="module-empty-state">
              <span class="module-empty-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </span>
              <strong>{{ hasItems() ? 'No hay documentos que coincidan con los filtros.' : 'La API no devolvió documentos para este tenant.' }}</strong>
              <p>Prueba una combinación diferente de filtros o crea un nuevo documento.</p>
            </div>
          }
        }
      </div>
    </section>
  `
})
export class DocumentCatalogListComponent {
  readonly documents = input<ApiDocument[]>([]);
  readonly loading = input<boolean>(false);
  readonly hasItems = input<boolean>(false);

  readonly openDetails = output<ApiDocument>();
  readonly loadVersions = output<ApiDocument>();
  readonly uploadVersion = output<{ doc: ApiDocument; event: Event }>();
}
