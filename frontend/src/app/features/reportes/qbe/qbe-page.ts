import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReportiqEmbedComponent } from '../components/reportiq-embed';

@Component({
  selector: 'app-qbe-page',
  standalone: true,
  imports: [CommonModule, ReportiqEmbedComponent],
  template: `
    <section class="page reportiq-qbe-page">
      <app-reportiq-embed
        title="Consultas Dinámicas (QBE)"
        subtitle="Constructor visual de consultas por ejemplo (Query By Example), filtros avanzados y visualización de datos"
        tab="qbe"
      />
    </section>
  `,
  styles: [`
    .reportiq-qbe-page {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
  `]
})
export class QbePage {}
