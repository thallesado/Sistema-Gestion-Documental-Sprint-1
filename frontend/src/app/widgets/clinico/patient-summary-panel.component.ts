import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { ApiPatient, PatientQuickSummary } from '../../core/api/clinical-api.service';

@Component({
  selector: 'app-patient-summary-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (patient()) {
      <section class="patient-summary-card">
        <header class="summary-header">
          <div class="patient-avatar">{{ (patient()?.firstName || '').charAt(0) }}</div>
          <div>
            <h3>{{ patient()?.firstName }} {{ patient()?.lastName }}</h3>
            <p>{{ patient()?.documentType || 'DOC' }}: {{ patient()?.documentNumber }} · {{ patient()?.birthDate || 'Fecha nac. no registrada' }}</p>
          </div>
        </header>

        <div class="summary-badges">
          <span class="badge">Tipo Sangre: <strong>{{ summary()?.bloodType || '—' }}</strong></span>
          <span [class]="'badge ' + (summary()?.hasHighRiskAllergy ? 'badge-red' : 'badge-green')">
            {{ summary()?.hasHighRiskAllergy ? '⚠️ Alergia crítica' : '✓ Sin alertas críticas' }}
          </span>
          <span class="badge">Notas: <strong>{{ summary()?.notesCount || 0 }}</strong></span>
          <span class="badge">Documentos: <strong>{{ summary()?.documentsCount || 0 }}</strong></span>
        </div>
      </section>
    }
  `
})
export class PatientSummaryPanelComponent {
  readonly patient = input<ApiPatient | null>(null);
  readonly summary = input<PatientQuickSummary | null>(null);
}
