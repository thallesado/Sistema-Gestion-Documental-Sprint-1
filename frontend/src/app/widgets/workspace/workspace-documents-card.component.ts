import { CommonModule, DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiDocument } from '../../entities/document/document-api.service';

@Component({
  selector: 'app-workspace-documents-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <article class="dashboard-card doc-card">
      <div class="card-heading">
        <div class="heading-left">
          <span class="card-icon-badge badge-teal">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </span>
          <div>
            <h2>Documentos recientes</h2>
            <p>Acceso rápido a los últimos editados</p>
          </div>
        </div>
        <a routerLink="/documents" class="card-link">Ver repositorio →</a>
      </div>

      <div class="task-counter-strip">
        <div class="counter-item"><strong>{{ documents().length }}</strong><span>en curso</span></div>
        <div class="counter-item"><b class="text-teal">{{ inReviewCount() }}</b><span>en revisión</span></div>
      </div>

      @if (documents().length) {
        @for (doc of documents(); track doc.id) {
          <div class="doc-line">
            <div class="doc-type-icon">PDF</div>
            <div class="doc-info">
              <strong class="doc-title">{{ doc.name }}</strong>
              <span class="doc-meta">{{ doc.code }} · {{ doc.responsibleUserName || 'Sin responsable' }} · {{ doc.updatedAt | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <span class="status status-pill" [ngClass]="docStatusClass(doc.status)">{{ formatDocStatus(doc.status) }}</span>
          </div>
        }
      } @else {
        <p class="empty-hint">No hay documentos recientes disponibles.</p>
      }
    </article>
  `
})
export class WorkspaceDocumentsCardComponent {
  readonly documents = input<ApiDocument[]>([]);
  readonly inReviewCount = input<number>(0);

  docStatusClass(status?: string): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'IN_REVIEW': return 'status-in-review';
      case 'APPROVED': case 'PUBLISHED': return 'status-approved';
      case 'REJECTED': return 'status-rejected';
      case 'ARCHIVED': return 'status-archived';
      default: return 'status-active';
    }
  }

  formatDocStatus(status?: string): string {
    switch (status) {
      case 'DRAFT': return 'Borrador';
      case 'IN_REVIEW': return 'En revisión';
      case 'APPROVED': return 'Aprobado';
      case 'PUBLISHED': return 'Publicado';
      case 'REJECTED': return 'Rechazado';
      case 'ARCHIVED': return 'Archivado';
      default: return status || 'Activo';
    }
  }
}
