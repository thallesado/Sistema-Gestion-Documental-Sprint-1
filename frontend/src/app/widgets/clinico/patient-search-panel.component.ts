import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiPatient } from '../../core/api/clinical-api.service';

@Component({
  selector: 'app-patient-search-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="panel">
      <div class="panel-title">
        <div>
          <h2>Buscar paciente</h2>
          <p>Nombre o documento; la consulta se filtra en el tenant autenticado.</p>
        </div>
        <button
          class="primary"
          type="button"
          [attr.aria-expanded]="showNewPatient()"
          aria-controls="patient-registration"
          (click)="togglePatientForm.emit()"
        >{{ showNewPatient() ? 'Cerrar alta' : '＋ Alta de paciente' }}</button>
      </div>

      <div class="search-bar">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Buscar paciente por nombre o documento"
          autocomplete="off"
          placeholder="Nombre o CI…"
          [value]="searchTerm()"
          (input)="search.emit($any($event.target).value)"
        >
      </div>

      @if (loading()) {
        <div class="inline-state" role="status">Buscando pacientes…</div>
      }

      <div class="patient-list" [attr.aria-busy]="loading()">
        @for (patient of patients(); track patient.id) {
          <button
            class="patient-row"
            type="button"
            [class.selected]="selected()?.id === patient.id"
            [attr.aria-pressed]="selected()?.id === patient.id"
            (click)="select.emit(patient)"
          >
            <span class="avatar" aria-hidden="true">{{ initials(patient.firstName + ' ' + patient.lastName) }}</span>
            <span class="patient-info">
              <b>{{ patient.firstName }} {{ patient.lastName }}</b>
              <small>{{ patient.documentType || 'DOC' }}: {{ patient.documentNumber }} · {{ patient.gender || 'Sin género' }}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        } @empty {
          <div class="empty" role="status">
            {{ apiError() ? 'No hay pacientes disponibles mientras la API no responde.' : 'No se encontraron pacientes.' }}
          </div>
        }
      </div>
    </section>
  `
})
export class PatientSearchPanelComponent {
  readonly patients = input<ApiPatient[]>([]);
  readonly selected = input<ApiPatient | null>(null);
  readonly searchTerm = input<string>('');
  readonly loading = input<boolean>(false);
  readonly apiError = input<string | null>(null);
  readonly showNewPatient = input<boolean>(false);

  readonly search = output<string>();
  readonly select = output<ApiPatient>();
  readonly togglePatientForm = output<void>();

  initials(name: string): string {
    return (name || '').split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();
  }
}
