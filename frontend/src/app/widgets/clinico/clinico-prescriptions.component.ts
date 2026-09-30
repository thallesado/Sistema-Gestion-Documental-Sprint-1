import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type PrescriptionItem = { id?: string; medication: string; dosage: string; frequency: string; duration: string; notes?: string };

@Component({
  selector: 'app-clinico-prescriptions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="prescriptions-panel">
      <div class="panel-header">
        <h3>Recetas e Indicaciones</h3>
        <button type="button" class="btn-sm btn-primary" (click)="addPrescription.emit()">+ Agregar medicamento</button>
      </div>
      <div class="prescriptions-list">
        @for (item of items(); track item.medication + item.dosage; let idx = $index) {
          <div class="prescription-row">
            <div class="prescription-info">
              <strong>{{ item.medication }}</strong>
              <span>{{ item.dosage }} · {{ item.frequency }} · Durante {{ item.duration }}</span>
              @if (item.notes) { <small>{{ item.notes }}</small> }
            </div>
            <button type="button" class="btn-icon-danger" (click)="removePrescription.emit(idx)" title="Eliminar">🗑</button>
          </div>
        } @empty {
          <p class="empty-state">No hay recetas indicadas en esta consulta.</p>
        }
      </div>
    </section>
  `
})
export class ClinicoPrescriptionsComponent {
  readonly items = input<PrescriptionItem[]>([]);
  readonly addPrescription = output<void>();
  readonly removePrescription = output<number>();
}
