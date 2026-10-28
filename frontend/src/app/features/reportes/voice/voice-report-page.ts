import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReportiqEmbedComponent } from '../components/reportiq-embed';

@Component({
  selector: 'app-voice-report-page',
  standalone: true,
  imports: [CommonModule, ReportiqEmbedComponent],
  template: `
    <section class="page reportiq-voice-page">
      <app-reportiq-embed
        title="Reportes por Voz & Lenguaje Natural (IA)"
        subtitle="Generación inteligente de consultas y reportes analíticos a partir de voz y texto con IA generativa"
        tab="visual"
      />
    </section>
  `,
  styles: [`
    .reportiq-voice-page {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
  `]
})
export class VoiceReportPage {}
