import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiPatient, ClinicalApiService } from '../../../core/api/clinical-api.service';

@Component({
  selector: 'app-antecedentes-page',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="page" style="max-width: 1440px; margin: auto; padding: 30px 36px 48px;">
      <!-- Encabezado corporativo estilo NexoDocs -->
      <header class="dashboard-welcome">
        <div>
          <p class="eyebrow" style="color: #087f7b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em;">MÓDULO CLÍNICO · HISTORIA CLÍNICA</p>
          <h1 style="margin: 5px 0; color: #153a39; font-size: 34px; letter-spacing: -.04em;">Captura de Antecedentes</h1>
          <p class="welcome-copy" style="color: #6b8583; font-size: 13px;">
            Registro estructurado de diagnósticos base, antecedentes y alergias vinculados al expediente único del paciente.
          </p>
        </div>
      </header>

      <!-- Grid principal: Formulario a la izquierda y Panel de Trazabilidad a la derecha -->
      <div class="content-grid" style="margin-top: 20px; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px;">
        
        <!-- Formulario Principal -->
        <section class="dashboard-card form-panel" style="background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px;">
          <div class="form-title" style="margin-bottom: 20px;">
            <h2 style="font-size: 18px; margin: 0 0 4px; color: #153a39;">Expediente Clínico del Paciente</h2>
            <span class="required-note" style="font-size: 11px; color: #6b8583;">Trazabilidad y firma digital activa</span>
          </div>

          @if (isLoadingPatients()) {
            <p style="color: #6b8583; font-size: 13px;">Cargando lista de pacientes de la clínica...</p>
          } @else {
            <form [formGroup]="historyForm" (ngSubmit)="saveHistory()">
              
              <!-- Alerta visual de alta severidad según especificación técnica -->
              @if (hasHighSeverityAllergy()) {
                <div class="critical-banner" style="background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                  <span style="background: #e11d48; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 12px;">!</span>
                  <div>
                    <b style="font-size: 12px;">¡ALERTA CLÍNICA DE RIESGO ALTO!</b>
                    <small style="display: block; font-size: 11px;">El paciente tiene registrada al menos una alergia con severidad ALTA. Requiere precaución médica.</small>
                  </div>
                </div>
              }

              <!-- Selección de Paciente y Grupo Sanguíneo en Grid -->
              <div class="form-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Seleccionar Paciente *</span>
                  <select formControlName="patientId" style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff;">
                    <option value="">-- Seleccione un paciente --</option>
                    @for (p of patients(); track p.id) {
                      <option [value]="p.id">{{ p.firstName }} {{ p.lastName }} (Doc: {{ p.documentType }} {{ p.documentNumber }})</option>
                    }
                  </select>
                </label>

                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Grupo Sanguíneo</span>
                  <select formControlName="bloodType" style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff;">
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
              <div class="form-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Antecedentes Patológicos</span>
                  <textarea formControlName="pathologicalAntecedents" rows="3" placeholder="Enfermedades previas, cirugías, traumas..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>

                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Antecedentes No Patológicos</span>
                  <textarea formControlName="nonPathologicalAntecedents" rows="3" placeholder="Hábitos, inmunizaciones, estilo de vida..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>

                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Antecedentes Familiares</span>
                  <textarea formControlName="familyAntecedents" rows="3" placeholder="Diabetes familiar, hipertensión, cardiopatías..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>

                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Condiciones Crónicas</span>
                  <textarea formControlName="chronicConditions" rows="3" placeholder="Diagnósticos crónicos permanentes..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>
              </div>

              <!-- Sección Dinámica de Alergias -->
              <div style="background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <b style="color: #153a39; font-size: 13px;">Alergias Estructuradas</b>
                    <small style="display: block; color: #6b8583; font-size: 10px;">Gestión de hipersensibilidades del paciente</small>
                  </div>
                  <button type="button" class="secondary-button" (click)="addAllergy()" style="background: #fff; border: 1px solid #9dd8d1; color: #087f7b; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;">
                    + Añadir Alergia
                  </button>
                </div>

                <div formArrayName="allergies">
                  @if (allergies.length === 0) {
                    <p style="color: #6b8583; font-size: 11px; margin: 8px 0;">No se han agregado alergias específicas para este paciente.</p>
                  }
                  @for (allergy of allergies.controls; track $index) {
                    <div [formGroupName]="$index" style="display: grid; grid-template-columns: 2fr 1.5fr 2fr 35px; gap: 8px; align-items: center; background: #fff; border: 1px solid #dcebe8; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px;">
                      <div>
                        <label style="font-size: 9px; margin-bottom: 3px; color: #6b8583; font-weight: 700; display: block;">ALÉRGENO *</label>
                        <input formControlName="allergen" placeholder="Ej. Penicilina, Látex, Polen" style="font-size: 11px; padding: 6px 8px; border: 1px solid #dcebe8; border-radius: 6px; width: 100%;" />
                      </div>
                      <div>
                        <label style="font-size: 9px; margin-bottom: 3px; color: #6b8583; font-weight: 700; display: block;">SEVERIDAD *</label>
                        <select formControlName="severity" style="font-size: 11px; padding: 6px 8px; border: 1px solid #dcebe8; border-radius: 6px; width: 100%; background: #fff;">
                          <option value="LOW">Baja</option>
                          <option value="MEDIUM">Media</option>
                          <option value="HIGH">Alta (Riesgo)</option>
                        </select>
                      </div>
                      <div>
                        <label style="font-size: 9px; margin-bottom: 3px; color: #6b8583; font-weight: 700; display: block;">REACCIÓN OBSERVADA</label>
                        <input formControlName="reaction" placeholder="Ej. Erupción cutánea, anafilaxia" style="font-size: 11px; padding: 6px 8px; border: 1px solid #dcebe8; border-radius: 6px; width: 100%;" />
                      </div>
                      <button type="button" (click)="removeAllergy($index)" title="Eliminar alergia" style="background: #ffebeb; color: #b34e4e; border: 0; border-radius: 6px; height: 32px; width: 32px; font-weight: 900; cursor: pointer; margin-top: 14px;">
                        ✕
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Observaciones -->
              <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700; margin-bottom: 20px;">
                <span>Observaciones Clínicas Generales</span>
                <textarea formControlName="observations" rows="2" placeholder="Notas complementarias sobre la entrevista inicial o anamnesis..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
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

              <!-- Botones de Acción -->
              <div class="form-actions" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #edf3f1; display: flex; justify-content: flex-end; gap: 12px;">
                <button type="button" class="cancel-button" (click)="resetForm()" style="background: #f1f5f9; color: #475569; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer;">
                  Limpiar Formulario
                </button>
                <button type="submit" class="primary-button" [disabled]="historyForm.invalid || isSaving()" style="background: #087f7b; color: #fff; border: 0; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; min-width: 190px; justify-content: center; box-shadow: 0 4px 12px rgba(15, 157, 154, 0.25);">
                  {{ isSaving() ? 'Guardando en Base de Datos...' : 'Guardar Antecedentes' }}
                </button>
              </div>

            </form>
          }
        </section>

        <!-- Panel Lateral Informativo y de Protocolo Clínico -->
        <aside class="dashboard-card note-panel" style="background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px; height: fit-content;">
          <span class="side-kicker" style="color: #087f7b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; display: block; margin-bottom: 6px;">SEGURIDAD Y PROTOCOLO</span>
          <h2 style="font-size: 16px; margin: 0 0 12px; color: #153a39;">Guía Operativa Clínica</h2>
          <p style="font-size: 12px; color: #6b8583; margin-bottom: 12px;">Lineamientos para el registro del expediente médico:</p>
          <ul style="font-size: 12px; color: #466765; padding-left: 18px; margin: 0; display: grid; gap: 8px;">
            <li><strong>Verificación de Identidad:</strong> Asegúrese de corroborar el documento y datos del paciente antes de actualizar su historial.</li>
            <li><strong>Precaución de Alergias:</strong> El registro de alérgenos de alta severidad activa advertencias preventivas para enfermería y farmacia.</li>
            <li><strong>Confidencialidad:</strong> La información clínica consignada queda protegida bajo estrictos estándares de integridad documental.</li>
          </ul>

          <div class="simulated-note" style="margin-top: 20px; background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 10px; padding: 12px; font-size: 11px;">
            <b style="color: #153a39; display: block; margin-bottom: 4px;">Expediente Digital Activo</b>
            <span style="color: #6b8583;">Los cambios guardados se integran automáticamente al historial clínico centralizado.</span>
          </div>
        </aside>

      </div>
    </div>
  `,
})
export class AntecedentesPage implements OnInit {
  private readonly clinicalService = inject(ClinicalApiService);
  private readonly fb = inject(FormBuilder);

  readonly patients = signal<ApiPatient[]>([]);
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
    this.clinicalService.patients().subscribe({
      next: (page) => {
        this.patients.set(page.content);
        this.isLoadingPatients.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar la lista de pacientes.');
        this.isLoadingPatients.set(false);
      },
    });
  }

  get allergies(): FormArray {
    return this.historyForm.get('allergies') as FormArray;
  }

  addAllergy() {
    this.allergies.push(
      this.fb.group({
        allergen: ['', Validators.required],
        severity: ['LOW', Validators.required],
        reaction: [''],
      })
    );
  }

  removeAllergy(index: number) {
    this.allergies.removeAt(index);
  }

  hasHighSeverityAllergy(): boolean {
    const arr = this.historyForm.value.allergies || [];
    return arr.some((a: { severity?: string }) => a?.severity === 'HIGH');
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

    this.clinicalService.createHistory(formValue).subscribe({
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
      },
    });
  }
}
