import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { ClinicalEvent } from '../../core/data/data.types';

@Component({
  selector: 'app-clinico-events-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="events-timeline">
      @for (event of events(); track event.title + event.date) {
        <div class="timeline-item">
          <div class="timeline-badge">
            <span class="timeline-dot"></span>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="event-type-badge">{{ event.type }}</span>
              <span class="event-date">{{ event.date }}</span>
            </div>
            <h4 class="event-title">{{ event.title }}</h4>
            <p class="event-desc">{{ event.description }}</p>
            <div class="event-meta">
              <span><strong>Médico:</strong> {{ event.doctor }}</span>
              <span class="status-chip">{{ event.status }}</span>
            </div>
          </div>
        </div>
      } @empty {
        <p class="empty-timeline">No hay eventos clínicos registrados para este paciente.</p>
      }
    </div>
  `
})
export class ClinicoEventsTimelineComponent {
  readonly events = input<ClinicalEvent[]>([]);
}
