import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClinicalService } from '../../core/api/clinical.service';
import { PatientResponse } from '../../core/api/clinical.types';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-clinical-history-page',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="page">
      <!-- Encabezado corporativo estilo NexoDocs -->
      <header class="dashboard-welcome">
        <div>
          <p class="eyebrow">MÓDULO CLÍNICO · HISTORIA CLÍNICA</p>
          <h1>Captura de Antecedentes</h1>
          <p class="welcome-copy">
            Registro estructurado de diagnósticos base, antecedentes y alergias vinculados al expediente único del paciente.
          </p>
        </div>
      </header>

      <!-- Grid principal: Formulario a la izquierda y Panel de Trazabilidad a la derecha -->
      <div class="content-grid" style="margin-top: 20px;">
        
        <!-- Formulario Principal -->
        <section class="dashboard-card form-panel">
          <div class="form-title">
            <h2>Expediente Clínico del Paciente</h2>
            <span class="required-note">Trazabilidad y firma digital activa</span>
          </div>

          @if (isLoadingPatients()) {
            <p style="color: var(--muted); font-size: 13px;">Cargando lista de pacientes de la clínica...</p>
          } @else {
            <form [formGroup]="historyForm" (ngSubmit)="saveHistory()">
              
              <!-- Alerta visual de alta severidad según especificación técnica -->
              @if (hasHighSeverityAllergy()) {
                <div class="critical-banner">
                  <span>!</span>
                  <div>
                    <b>¡ALERTA CLÍNICA DE RIESGO ALTO!</b>
                    <small>El paciente tiene registrada al menos una alergia con severidad ALTA. Requiere precaución médica.</small>
                  </div>
                </div>
              }

              <!-- Selección de Paciente y Grupo Sanguíneo en Grid -->
              <div class="form-fields" style="margin-bottom: 16px;">
                <label>
                  <span>Seleccionar Paciente *</span>
                  <select formControlName="patientId">
                    <option value="">-- Seleccione un paciente --</option>
                    @for (p of patients(); track p.id) {
                      <option [value]="p.id">{{ p.firstName }} {{ p.lastName }} (Doc: {{ p.documentNumber }})</option>
                    }
                  </select>
                </label>

                <label>
                  <span>Grupo Sanguíneo</span>
                  <select formControlName="bloodType">
                    <option value="">-- Seleccionar --</option>
                    <option value="O+">O Positivo (O+)</option>
                    <option value="O-">O Negativo (O-)</option>
                    <option value="A+">A Positivo (A+)</option>
                    <option value="A-">A Negativo (A-)</option>
                    <option value="B+">B Positivo (B+)</option>
                    <option value="B-">B Negativo (B-)</option>
                    <option value="AB+">AB Positivo (AB+)</option>
                    <option value="AB-">AB Negativo (AB-)</option>
                  </select>
                </label>
              </div>

              <!-- Bloque de Antecedentes en dos columnas -->
              <div class="form-fields" style="margin-bottom: 16px;">
                <label>
                  <span>Antecedentes Patológicos</span>
                  <textarea formControlName="pathologicalAntecedents" rows="3" placeholder="Enfermedades previas, cirugías, traumas..."></textarea>
                </label>

                <label>
                  <span>Antecedentes No Patológicos</span>
                  <textarea formControlName="nonPathologicalAntecedents" rows="3" placeholder="Hábitos, inmunizaciones, estilo de vida..."></textarea>
                </label>

                <label>
                  <span>Antecedentes Familiares</span>
                  <textarea formControlName="familyAntecedents" rows="3" placeholder="Diabetes familiar, hipertensión, cardiopatías..."></textarea>
                </label>

                <label>
                  <span>Condiciones Crónicas</span>
                  <textarea formControlName="chronicConditions" rows="3" placeholder="Diagnósticos crónicos permanentes..."></textarea>
                </label>
              </div>

              <!-- Sección Dinámica de Alergias -->
              <div style="background: #f8fbfa; border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <b style="color: var(--ink); font-size: 13px;">Alergias Estructuradas</b>
                    <small style="display: block; color: var(--muted); font-size: 10px;">Gestión de hipersensibilidades del paciente</small>
                  </div>
                  <button type="button" class="secondary-button" (click)="addAllergy()">
                    + Añadir Alergia
                  </button>
                </div>

                <div formArrayName="allergies">
                  @if (allergies.length === 0) {
                    <p style="color: var(--muted); font-size: 11px; margin: 8px 0;">No se han agregado alergias específicas para este paciente.</p>
                  }
                  @for (allergy of allergies.controls; track $index) {
                    <div [formGroupName]="$index" style="display: grid; grid-template-columns: 2fr 1.5fr 2fr 35px; gap: 8px; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; margin-bottom: 8px;">
                      <div>
                        <label style="font-size: 9px; margin-bottom: 3px; color: var(--muted); font-weight: 700;">ALÉRGENO *</label>
                        <input formControlName="allergen" placeholder="Ej. Penicilina, Látex, Polen" style="font-size: 11px; padding: 6px 8px;" />
                      </div>
                      <div>
                        <label style="font-size: 9px; margin-bottom: 3px; color: var(--muted); font-weight: 700;">SEVERIDAD *</label>
                        <select formControlName="severity" style="font-size: 11px; padding: 6px 8px;">
                          <option value="LOW">Baja</option>
                          <option value="MEDIUM">Media</option>
                          <option value="HIGH">Alta (Riesgo)</option>
                        </select>
                      </div>
                      <div>
                        <label style="font-size: 9px; margin-bottom: 3px; color: var(--muted); font-weight: 700;">REACCIÓN OBSERVADA</label>
                        <input formControlName="reaction" placeholder="Ej. Erupción cutánea, anafilaxia" style="font-size: 11px; padding: 6px 8px;" />
                      </div>
                      <button type="button" (click)="removeAllergy($index)" title="Eliminar alergia" style="background: #ffebeb; color: #b34e4e; border: 0; border-radius: 6px; height: 32px; width: 32px; font-weight: 900; cursor: pointer; margin-top: 14px;">
                        ✕
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Observaciones -->
              <label style="margin-bottom: 20px;">
                <span>Observaciones Clínicas Generales</span>
                <textarea formControlName="observations" rows="2" placeholder="Notas complementarias sobre la entrevista inicial o anamnesis..."></textarea>
              </label>

              <!-- Mensajes de Estado -->
              @if (errorMessage()) {
                <div style="background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
                  ⚠️ {{ errorMessage() }}
                </div>
              }
              @if (successMessage()) {
                <div style="background: #dcfce7; border: 1px solid #bbf7d0; color: #166534; border-radius: 8px; padding: 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
                  ✓ {{ successMessage() }}
                </div>
              }

              <!-- Botones de Acción: súper visibles con los estilos corporativos -->
              <div class="form-actions" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #edf3f1;">
                <button type="button" class="cancel-button" (click)="resetForm()">
                  Limpiar Formulario
                </button>
                <button type="submit" class="primary-button" [disabled]="historyForm.invalid || isSaving()" style="min-width: 190px; justify-content: center; font-size: 13px; padding: 11px 20px; box-shadow: 0 4px 12px rgba(15, 157, 154, 0.25);">
                  {{ isSaving() ? 'Guardando en Base de Datos...' : 'Guardar Antecedentes' }}
                </button>
              </div>

            </form>
          }
        </section>

        <!-- Panel Lateral Informativo y de Protocolo Clínico -->
        <aside class="dashboard-card note-panel">
          <span class="side-kicker">SEGURIDAD Y PROTOCOLO</span>
          <h2>Guía Operativa Clínica</h2>
          <p>Lineamientos para el registro del expediente médico:</p>
          <ul>
            <li><strong>Verificación de Identidad:</strong> Asegúrese de corroborar el documento y datos del paciente antes de actualizar su historial.</li>
            <li><strong>Precaución de Alergias:</strong> El registro de alérgenos de alta severidad activa advertencias preventivas para enfermería y farmacia.</li>
            <li><strong>Confidencialidad:</strong> La información clínica consignada queda protegida bajo estrictos estándares de integridad documental.</li>
          </ul>

          <div class="simulated-note" style="margin-top: 20px;">
            <b>Expediente Digital Activo</b>
            <span>Los cambios guardados se integran automáticamente al historial clínico centralizado.</span>
          </div>
        </aside>

      </div>
    </div>
  `,
})
export class ClinicalHistoryPage implements OnInit {
  private readonly clinicalService = inject(ClinicalService);
  private readonly fb = inject(FormBuilder);

  readonly patients = signal<PatientResponse[]>([]);
  readonly isLoadingPatients = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  historyForm: FormGroup = this.fb.group({
    patientId: ['', Validators.required],
    bloodType: [''],
    pathologicalAntecedents: [''],
    nonPathologicalAntecedents: [''],
    familyAntecedents: [''],
    chronicConditions: [''],
    observations: [''],
    allergies: this.fb.array([]),
  });

  ngOnInit() {
    this.loadPatients();
  }

  loadPatients() {
    this.isLoadingPatients.set(true);
    this.clinicalService.getPatients().subscribe({
      next: (page) => {
        this.patients.set(page.content);
        this.isLoadingPatients.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set('No fue posible cargar la lista de pacientes.');
        this.isLoadingPatients.set(false);
      }
    });
  }

  get allergies(): FormArray {
    return this.historyForm.get('allergies') as FormArray;
  }

  addAllergy() {
    this.allergies.push(this.fb.group({
      allergen: ['', Validators.required],
      severity: ['LOW', Validators.required],
      reaction: ['']
    }));
  }

  removeAllergy(index: number) {
    this.allergies.removeAt(index);
  }

  hasHighSeverityAllergy(): boolean {
    const arr = this.historyForm.value.allergies || [];
    return arr.some((a: any) => a?.severity === 'HIGH');
  }

  resetForm() {
    this.historyForm.reset({
      patientId: '',
      bloodType: '',
      pathologicalAntecedents: '',
      nonPathologicalAntecedents: '',
      familyAntecedents: '',
      chronicConditions: '',
      observations: '',
    });
    this.allergies.clear();
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  saveHistory() {
    if (this.historyForm.invalid) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formValue = this.historyForm.value;

    this.clinicalService.createClinicalHistory(formValue).subscribe({
      next: () => {
        this.successMessage.set('¡Antecedentes y diagnósticos guardados exitosamente en la base de datos!');
        this.isSaving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        if (err.status === 403) {
          this.errorMessage.set('Acceso denegado: El usuario no posee permisos para registrar historias clínicas.');
        } else {
          this.errorMessage.set(err.error?.message || 'Error al comunicarse con el servidor.');
        }
      }
    });
  }
}
