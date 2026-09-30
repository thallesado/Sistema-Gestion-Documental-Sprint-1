import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiPatient, ClinicalApiService, ClinicalHistory } from '../../../core/api/clinical-api.service';
import { AntecedentesSidebarComponent } from '../../../widgets/clinico/antecedentes-sidebar.component';
import { AntecedentesAllergiesComponent } from '../../../widgets/clinico/antecedentes-allergies.component';

@Component({
  selector: 'app-antecedentes-page',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, AntecedentesSidebarComponent, AntecedentesAllergiesComponent],
  template: `
    <div class="page" style="max-width: 1440px; margin: auto; padding: 30px 36px 48px;">
      <header class="dashboard-welcome">
        <div>
          <p class="eyebrow" style="color: #087f7b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em;">MÓDULO CLÍNICO · HISTORIA CLÍNICA</p>
          <h1 style="margin: 5px 0; color: #153a39; font-size: 34px; letter-spacing: -.04em;">Captura de Antecedentes</h1>
          <p class="welcome-copy" style="color: #6b8583; font-size: 13px;">
            Registro estructurado de diagnósticos base, antecedentes y alergias vinculados al expediente único del paciente.
          </p>
        </div>
      </header>

      <div class="content-grid" style="margin-top: 20px; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px;">
        <section class="dashboard-card form-panel" style="background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px;">
          <div class="form-title" style="margin-bottom: 20px;">
            <h2 style="font-size: 18px; margin: 0 0 4px; color: #153a39;">Expediente Clínico del Paciente</h2>
            <span class="required-note" style="font-size: 11px; color: #6b8583;">Trazabilidad y firma digital activa</span>
          </div>

          @if (isLoadingPatients()) {
            <p style="color: #6b8583; font-size: 13px;">Cargando lista de pacientes de la clínica...</p>
          } @else {
            <form [formGroup]="historyForm" (ngSubmit)="saveHistory()">
              @if (hasHighSeverityAllergy()) {
                <div class="critical-banner" style="background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                  <span style="background: #e11d48; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 12px;">!</span>
                  <div>
                    <b style="font-size: 12px;">¡ALERTA CLÍNICA DE RIESGO ALTO!</b>
                    <small style="display: block; font-size: 11px;">El paciente tiene registrada al menos una alergia con severidad ALTA.</small>
                  </div>
                </div>
              }

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

              <div class="form-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Antecedentes Patológicos</span>
                  <textarea formControlName="pathologicalAntecedents" rows="3" placeholder="Enfermedades previas, cirugías, traumas..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>
                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Antecedentes No Patológicos</span>
                  <textarea formControlName="nonPathologicalAntecedents" rows="3" placeholder="Hábitos, inmunizaciones..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>
                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Antecedentes Familiares</span>
                  <textarea formControlName="familyAntecedents" rows="3" placeholder="Diabetes familiar, cardiopatías..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>
                <label style="display: grid; gap: 6px; font-size: 12px; color: #153a39; font-weight: 700;">
                  <span>Condiciones Crónicas</span>
                  <textarea formControlName="chronicConditions" rows="3" placeholder="Diagnósticos crónicos permanentes..." style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-family: inherit;"></textarea>
                </label>
              </div>

              <app-antecedentes-allergies
                [parentForm]="historyForm"
                [allergiesArray]="allergies"
                (addAllergy)="addAllergy()"
                (removeAllergy)="removeAllergy($event)"
              />

              <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button type="submit" [disabled]="historyForm.invalid || isSaving()" style="background: #087f7b; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 700; cursor: pointer;">
                  {{ isSaving() ? 'Guardando Antecedentes...' : 'Guardar y Certificar' }}
                </button>
                <button type="button" (click)="resetForm()" style="background: #fff; color: #153a39; border: 1px solid #dcebe8; border-radius: 8px; padding: 10px 20px; font-weight: 700; cursor: pointer;">
                  Limpiar Formulario
                </button>
              </div>
            </form>
          }
        </section>

        <app-antecedentes-sidebar />
      </div>
    </div>
  `
})
export class AntecedentesPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clinicalApi = inject(ClinicalApiService);

  patients = signal<ApiPatient[]>([]);
  selectedPatient = signal<ApiPatient | null>(null);
  activeHistory = signal<ClinicalHistory | null>(null);
  isLoadingPatients = signal(false);
  isSaving = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  historyForm: FormGroup = this.fb.group({
    patientId: ['', Validators.required],
    bloodType: [''],
    pathologicalAntecedents: [''],
    nonPathologicalAntecedents: [''],
    familyAntecedents: [''],
    chronicConditions: [''],
    allergies: this.fb.array([])
  });

  get allergies(): FormArray { return this.historyForm.get('allergies') as FormArray; }

  ngOnInit(): void {
    this.loadPatients();
    this.historyForm.get('patientId')?.valueChanges.subscribe(patientId => {
      if (patientId) {
        const found = this.patients().find(p => p.id === patientId) || null;
        this.selectedPatient.set(found);
        this.loadPatientHistory(patientId);
      } else {
        this.selectedPatient.set(null);
        this.activeHistory.set(null);
      }
    });
  }

  loadPatients(): void {
    this.isLoadingPatients.set(true);
    this.clinicalApi.patients('', 0, 100).subscribe({
      next: (res: any) => { this.patients.set(res.content || []); this.isLoadingPatients.set(false); },
      error: () => { this.errorMessage.set('No se pudo conectar con el catálogo de pacientes.'); this.isLoadingPatients.set(false); }
    });
  }

  loadPatientHistory(patientId: string): void {
    this.clinicalApi.clinicalHistory(patientId).subscribe({
      next: (history: any) => {
        this.activeHistory.set(history);
        this.historyForm.patchValue({
          bloodType: history.bloodType || '',
          pathologicalAntecedents: history.pathologicalAntecedents || '',
          nonPathologicalAntecedents: history.nonPathologicalAntecedents || '',
          familyAntecedents: history.familyAntecedents || '',
          chronicConditions: history.chronicConditions || ''
        });
        this.allergies.clear();
        if (history.allergies) {
          history.allergies.forEach((a: any) => this.allergies.push(this.fb.group({ allergen: [a.allergen], severity: [a.severity], reaction: [a.reaction] })));
        }
      },
      error: () => this.activeHistory.set(null)
    });
  }

  addAllergy(): void { this.allergies.push(this.fb.group({ allergen: ['', Validators.required], severity: ['BAJA', Validators.required], reaction: [''] })); }
  removeAllergy(index: number): void { this.allergies.removeAt(index); }
  hasHighSeverityAllergy(): boolean { return this.allergies.controls.some(c => c.get('severity')?.value === 'ALTA'); }
  resetForm(): void { this.historyForm.reset({ patientId: '', bloodType: '' }); this.allergies.clear(); this.selectedPatient.set(null); this.activeHistory.set(null); }

  saveHistory(): void {
    if (this.historyForm.invalid) return;
    this.isSaving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    const formVal = this.historyForm.value;
    const payload = {
      patientId: formVal.patientId,
      bloodType: formVal.bloodType || undefined,
      pathologicalAntecedents: formVal.pathologicalAntecedents || undefined,
      nonPathologicalAntecedents: formVal.nonPathologicalAntecedents || undefined,
      familyAntecedents: formVal.familyAntecedents || undefined,
      chronicConditions: formVal.chronicConditions || undefined,
      allergies: formVal.allergies?.length ? formVal.allergies : undefined
    };
    this.clinicalApi.saveClinicalHistory(payload).subscribe({
      next: (saved: any) => { this.activeHistory.set(saved); this.successMessage.set('Antecedentes guardados.'); this.isSaving.set(false); },
      error: (err: HttpErrorResponse) => { this.errorMessage.set(err.error?.message || 'Error al guardar.'); this.isSaving.set(false); }
    });
  }
}
export const AntecedentesPage = AntecedentesPageComponent;
