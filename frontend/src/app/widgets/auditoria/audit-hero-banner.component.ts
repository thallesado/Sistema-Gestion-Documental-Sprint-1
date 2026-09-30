import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-audit-hero-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="module-hero-banner">
      <div class="module-hero-left">
        <span class="module-hero-badge">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </span>
        <div class="module-hero-text">
          <p class="eyebrow">AUDITORÍA Y SEGURIDAD</p>
          <h1>Registro de Actividad</h1>
          <p>Trazabilidad inmutable de eventos, accesos y operaciones en el sistema.</p>
        </div>
      </div>
      <div class="module-hero-right">
        <div class="stat-pill">
          <span class="stat-pill-label">Total eventos</span>
          <strong class="stat-pill-value">{{ totalElements() }}</strong>
        </div>
      </div>
    </section>
  `
})
export class AuditHeroBannerComponent {
  readonly totalElements = input<number>(0);
}
