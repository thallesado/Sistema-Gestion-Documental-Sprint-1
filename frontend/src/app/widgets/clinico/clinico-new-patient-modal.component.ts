import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-clinico-new-patient-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section id="patient-registration" class="panel form-panel" aria-labelledby="patient-registration-title">
      <div class="panel-title">
        <div>
          <h2 id="patient-registration-title">Alta de paciente</h2>
          <p>HU-03 · registro real mediante <code>POST /api/v1/patients</code>.</p>
        </div>
      </div>

      @if (patientFormError) { <div class="state error" role="alert">{{ patientFormError }}</div> }
      @if (patientFormMessage) { <p class="success" role="status">{{ patientFormMessage }}</p> }

      <form (submit)="createPatient.emit($event)">
        <div class="form-grid">
          <label>Tipo de documento
            <select [ngModel]="newDocumentType" (ngModelChange)="documentTypeChange.emit($event)" name="docType">
              <option value="CI">CI</option>
              <option value="SEGURO">Seguro</option>
            </select>
          </label>
          <label>Número de documento
            <input required maxlength="40" [ngModel]="newDocument" (ngModelChange)="documentChange.emit($event)" name="docNum">
          </label>
          <label>Nombres
            <input required maxlength="100" [ngModel]="newFirstName" (ngModelChange)="firstNameChange.emit($event)" name="fn">
          </label>
          <label>Apellidos
            <input required maxlength="100" [ngModel]="newLastName" (ngModelChange)="lastNameChange.emit($event)" name="ln">
          </label>
          <label>Fecha de nacimiento
            <input type="date" [ngModel]="newBirthDate" (ngModelChange)="birthDateChange.emit($event)" name="bd">
          </label>
          <label>Género
            <input maxlength="30" [ngModel]="newGender" (ngModelChange)="genderChange.emit($event)" name="gn">
          </label>
          <label>Teléfono
            <input maxlength="30" inputmode="tel" [ngModel]="newPhone" (ngModelChange)="phoneChange.emit($event)" name="ph">
          </label>
          <label>Correo electrónico
            <input type="email" maxlength="150" [ngModel]="newEmail" (ngModelChange)="emailChange.emit($event)" name="em">
          </label>
        </div>
        <button class="primary" type="submit" [disabled]="savingPatient || !canCreatePatient">
          {{ savingPatient ? 'Guardando…' : 'Guardar alta' }}
        </button>
      </form>
    </section>
  `
})
export class ClinicoNewPatientModalComponent {
  @Input() newDocumentType = 'CI';
  @Input() newDocument = '';
  @Input() newFirstName = '';
  @Input() newLastName = '';
  @Input() newBirthDate = '';
  @Input() newGender = '';
  @Input() newPhone = '';
  @Input() newEmail = '';
  @Input() savingPatient = false;
  @Input() canCreatePatient = false;
  @Input() patientFormError: string | null = null;
  @Input() patientFormMessage: string | null = null;

  @Output() documentTypeChange = new EventEmitter<string>();
  @Output() documentChange = new EventEmitter<string>();
  @Output() firstNameChange = new EventEmitter<string>();
  @Output() lastNameChange = new EventEmitter<string>();
  @Output() birthDateChange = new EventEmitter<string>();
  @Output() genderChange = new EventEmitter<string>();
  @Output() phoneChange = new EventEmitter<string>();
  @Output() emailChange = new EventEmitter<string>();
  @Output() createPatient = new EventEmitter<Event>();
}
