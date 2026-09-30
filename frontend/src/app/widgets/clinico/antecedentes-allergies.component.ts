import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-antecedentes-allergies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div [formGroup]="parentForm" class="allergies-section" style="border-top: 1px solid #dcebe8; padding-top: 16px; margin-top: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <h3 style="font-size: 14px; margin: 0; color: #153a39;">Alergias y Reacciones Adversas</h3>
          <span style="font-size: 11px; color: #6b8583;">Especifica el tipo de alérgeno y el nivel de severidad</span>
        </div>
        <button type="button" (click)="addAllergy.emit()" style="background: #e8f5f3; color: #087f7b; border: 1px solid #b2ded7; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;">
          + Agregar Alergia
        </button>
      </div>

      <div formArrayName="allergies">
        @for (allergy of allergiesArray.controls; track $index) {
          <div [formGroupName]="$index" style="display: grid; grid-template-columns: 2fr 1fr 2fr auto; gap: 8px; align-items: center; background: #fafdfc; border: 1px solid #e2ece9; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px;">
            <input formControlName="allergen" placeholder="Alérgeno (ej: Penicilina)" style="border: 1px solid #dcebe8; border-radius: 6px; padding: 6px 8px; font-size: 12px;" />
            <select formControlName="severity" style="border: 1px solid #dcebe8; border-radius: 6px; padding: 6px 8px; font-size: 12px; background: #fff;">
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta (Crítica)</option>
            </select>
            <input formControlName="reaction" placeholder="Reacción (ej: Anafilaxia)" style="border: 1px solid #dcebe8; border-radius: 6px; padding: 6px 8px; font-size: 12px;" />
            <button type="button" (click)="removeAllergy.emit($index)" style="background: none; border: none; color: #a65050; font-size: 16px; cursor: pointer; padding: 0 4px;">✕</button>
          </div>
        }
        @if (allergiesArray.length === 0) {
          <p style="font-size: 11px; color: #6b8583; margin: 4px 0;">No se han registrado alergias para este paciente.</p>
        }
      </div>
    </div>
  `
})
export class AntecedentesAllergiesComponent {
  @Input({ required: true }) parentForm!: FormGroup;
  @Input({ required: true }) allergiesArray!: FormArray;
  @Output() addAllergy = new EventEmitter<void>();
  @Output() removeAllergy = new EventEmitter<number>();
}
