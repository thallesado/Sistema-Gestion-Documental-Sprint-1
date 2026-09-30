import { CommonModule, DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiTask } from '../../entities/workspace/workspace-api.service';

@Component({
  selector: 'app-workspace-tasks-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <article class="dashboard-card task-card">
      <div class="card-heading">
        <div class="heading-left">
          <span class="card-icon-badge badge-amber">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <div>
            <h2>Mis tareas</h2>
            <p>Requieren tu atención</p>
          </div>
        </div>
        <a routerLink="/dashboard/tasks" class="card-link">Ver todas →</a>
      </div>

      <div class="task-counter-strip">
        <div class="counter-item"><strong>{{ tasks().length }}</strong><span>pendientes</span></div>
        <div class="counter-item"><b>{{ highPriorityCount() }}</b><span>alta prioridad</span></div>
      </div>

      @if (tasks().length) {
        @for (task of tasks(); track task.id) {
          <div class="task-line">
            <span class="dot" [ngClass]="task.status === 'COMPLETED' ? 'green-dot' : task.status === 'IN_REVIEW' ? 'blue-dot' : 'amber-dot'"></span>
            <div class="task-line-info">
              <strong class="task-title">{{ task.title }}</strong>
              <span class="task-meta">
                <span>{{ task.dueAt ? ('Vence: ' + (task.dueAt | date:'dd/MM/yyyy')) : 'Sin fecha límite' }}</span>
                @if (task.area) {
                  <span class="meta-separator">·</span>
                  <span class="task-area-pill">{{ task.area }}</span>
                }
              </span>
            </div>
            <span class="status status-pill" [ngClass]="taskStatusClass(task.status)">{{ formatTaskStatus(task.status) }}</span>
          </div>
        }
      } @else {
        <p class="empty-hint">No tienes tareas pendientes asignadas.</p>
      }
    </article>
  `
})
export class WorkspaceTasksCardComponent {
  readonly tasks = input<ApiTask[]>([]);
  readonly highPriorityCount = input<number>(0);
  readonly toggleTask = output<ApiTask>();

  taskStatusClass(status?: string): string {
    switch (status) {
      case 'PENDING': return 'status-draft';
      case 'IN_REVIEW': return 'status-in-review';
      case 'COMPLETED': return 'status-approved';
      default: return 'status-active';
    }
  }

  formatTaskStatus(status?: string): string {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'IN_REVIEW': return 'En revisión';
      case 'COMPLETED': return 'Completada';
      default: return status || 'Pendiente';
    }
  }
}
