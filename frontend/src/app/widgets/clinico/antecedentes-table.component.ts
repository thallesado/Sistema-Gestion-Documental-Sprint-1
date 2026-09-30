import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

export type AntecedenteItem = { id: string; category: string; description: string; diagnosedDate?: string; status: string; notes?: string };

@Component({
  selector: 'app-antecedentes-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Descripción</th>
            <th>Fecha Diagnóstico</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.id) {
            <tr>
              <td><span class="category-badge">{{ item.category }}</span></td>
              <td><strong>{{ item.description }}</strong></td>
              <td>{{ item.diagnosedDate || '—' }}</td>
              <td><span class="badge">{{ item.status }}</span></td>
              <td>
                <button type="button" class="btn-sm btn-ghost" (click)="edit.emit(item)">Editar</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty-state">No se registraron antecedentes médicos.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AntecedentesTableComponent {
  readonly items = input<AntecedenteItem[]>([]);
  readonly edit = output<AntecedenteItem>();
}
