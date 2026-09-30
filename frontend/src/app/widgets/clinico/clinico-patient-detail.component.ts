import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiPatient, ClinicalHistory, PatientQuickSummary } from '../../core/api/clinical-api.service';

@Component({
  selector: 'app-clinico-patient-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="detail-grid">
      <article class="panel patient-detail">
        <div class="panel-title">
          <div>
            <h2>{{ patient.firstName }} {{ patient.lastName }}</h2>
            <p>{{ patient.documentType }} {{ patient.documentNumber }} · {{ patient.status }}</p>
          </div>
          <span class="badge">Expediente único</span>
        </div>
        <dl class="data">
          <div><dt>Fecha de nacimiento</dt><dd>{{ patient.birthDate ? (patient.birthDate | date:'dd/MM/yyyy') : '—' }}</dd></div>
          <div><dt>Teléfono</dt><dd>{{ patient.phone || '—' }}</dd></div>
          <div><dt>Correo</dt><dd>{{ patient.email || '—' }}</dd></div>
        </dl>
      </article>

      <article class="panel quick-summary-panel" aria-labelledby="quick-summary-title" [attr.aria-busy]="quickSummaryLoading">
        <div class="panel-title">
          <div>
            <h2 id="quick-summary-title">Resumen rápido</h2>
            <p>HU-10 · alergias, diagnósticos y las cinco notas más recientes.</p>
          </div>
          <button class="secondary" type="button" (click)="reload.emit()">Actualizar</button>
        </div>

        @if (quickSummaryLoading) {
          <div class="state" role="status">Consultando resumen rápido…</div>
        } @else if (quickSummaryError) {
          <div class="state error" role="alert">
            <span>{{ quickSummaryError }}</span>
            <button type="button" (click)="reload.emit()">Reintentar</button>
          </div>
        } @else if (quickSummary) {
          <div class="summary-blocks">
            <div>
              <h3>Alergias</h3>
              <ul>
                @for (allergy of quickSummary.allergies; track allergy.allergen) {
                  <li><b>{{ allergy.allergen }}</b><small>{{ allergy.severity }} · {{ allergy.reaction || 'Sin reacción descrita' }}</small></li>
                } @empty {
                  <li class="empty-inline">Sin alergias registradas.</li>
                }
              </ul>
            </div>
            <div>
              <h3>Diagnósticos activos</h3>
              <ul>
                @for (diag of quickSummary.baseDiagnoses; track diag.description) {
                  <li>{{ diag.description }} <small *ngIf="diag.code">({{ diag.code }})</small></li>
                } @empty {
                  <li class="empty-inline">Sin diagnósticos activos.</li>
                }
              </ul>
            </div>
          </div>
        }
      </article>
    </section>
  `
})
export class ClinicoPatientDetailComponent {
  @Input({ required: true }) patient!: ApiPatient;
  @Input() quickSummary: PatientQuickSummary | null = null;
  @Input() quickSummaryLoading = false;
  @Input() quickSummaryError: string | null = null;
  @Output() reload = new EventEmitter<void>();
}
