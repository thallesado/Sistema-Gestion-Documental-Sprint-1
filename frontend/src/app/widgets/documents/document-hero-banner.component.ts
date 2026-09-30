import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-document-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="module-hero-banner">
      <div class="module-hero-left">
        <span class="module-hero-badge">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
        </span>
        <div class="module-hero-text">
          <p class="eyebrow">DOCUMENTOS · {{ isStatuses ? 'ESTADOS' : scope === 'mine' ? 'MIS DOCUMENTOS' : 'CATÁLOGO' }}</p>
          <h1>{{ isStatuses ? 'Estados documentales' : pageTitle }}</h1>
          <p>{{ isStatuses ? 'Consulta el ciclo de vida definido por el dominio documental.' : 'Consulta los documentos disponibles en el tenant autenticado.' }}</p>
        </div>
      </div>
      <div class="module-hero-right">
        @if (!isStatuses) {
          <a class="btn-primary-action" routerLink="/documents/new">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Nuevo documento</span>
          </a>
        }
      </div>
    </section>
  `
})
export class DocumentHeroBannerComponent {
  @Input() isStatuses = false;
  @Input() scope: string | null = null;
  @Input() pageTitle = '';
}
