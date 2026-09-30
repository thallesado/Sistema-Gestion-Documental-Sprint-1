import { CommonModule, DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiActivity } from '../../entities/workspace/workspace-api.service';

@Component({
  selector: 'app-workspace-activity-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <article class="dashboard-card activity-card">
      <div class="card-heading">
        <div class="heading-left">
          <span class="card-icon-badge badge-blue">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </span>
          <div>
            <h2>Actividad reciente</h2>
            <p>Registro de acciones en la organización</p>
          </div>
        </div>
        <a routerLink="/audit" class="card-link">Ver auditoría →</a>
      </div>

      @if (activities().length) {
        <div class="activity-timeline">
          @for (act of activities(); track act.id) {
            <div class="activity-item">
              <div class="activity-avatar">{{ initials(act.userId || 'Sistema') }}</div>
              <div class="activity-body">
                <p class="activity-text">
                  <strong>{{ act.userId || 'Usuario' }}</strong>
                  {{ act.action }}
                  @if (act.entityType) {
                    <span class="activity-target">«{{ act.entityType }}{{ act.entityId ? ' #' + act.entityId : '' }}»</span>
                  }
                </p>
                <span class="activity-time">{{ act.occurredAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="empty-hint">No hay actividades recientes registradas.</p>
      }
    </article>
  `
})
export class WorkspaceActivityCardComponent {
  readonly activities = input<ApiActivity[]>([]);

  initials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
}
