import { Component } from '@angular/core';

@Component({
  selector: 'app-workspace-desktop-banner',
  standalone: true,
  template: `
    <div class="desktop-banner" role="region" aria-label="Integración con NexoDocs Desktop">
      <div class="desktop-banner-badge">
        <span class="desktop-pulse-dot" aria-hidden="true"></span>
        <span>STUB · INTEGRACIÓN DE ESCRITORIO PENDIENTE</span>
      </div>
      <div class="desktop-banner-content">
        <div>
          <h3>NexoDocs Desktop para Windows</h3>
          <p>Sincronización bidireccional de carpetas locales y edición directa de archivos con bloqueo de concurrencia.</p>
        </div>
        <a href="#desktop-download" class="btn-desktop-stub" (click)="$event.preventDefault()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Descargar agente v0.9 (Demo)</span>
        </a>
      </div>
    </div>
  `
})
export class WorkspaceDesktopBannerComponent {}
