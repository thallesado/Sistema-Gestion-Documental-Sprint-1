import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <article class="report-kpi">
      <span class="kpi-icon" [class]="tone">{{ icon }}</span>
      <div><small>{{ label }}</small><strong>{{ value }}</strong><p>{{ detail }}</p></div>
    </article>
  `,
})
export class KpiCard {
  @Input() icon = '▤';
  @Input() label = '';
  @Input() value = '';
  @Input() detail = '';
  @Input() tone = 'teal';
}
