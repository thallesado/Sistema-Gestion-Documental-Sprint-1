import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export type ReportStatCard = { title: string; value: string | number; subtitle: string; icon: string; trend?: string };

@Component({
  selector: 'app-reportes-stats-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stats-grid">
      @for (card of stats(); track card.title) {
        <article class="stat-card">
          <div class="stat-icon-wrap">
            <span class="stat-icon">{{ card.icon }}</span>
          </div>
          <div class="stat-info">
            <span class="stat-title">{{ card.title }}</span>
            <strong class="stat-value">{{ card.value }}</strong>
            <p class="stat-subtitle">{{ card.subtitle }}</p>
          </div>
        </article>
      }
    </div>
  `
})
export class ReportesStatsViewComponent {
  readonly stats = input<ReportStatCard[]>([]);
}
