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
  templateUrl: './antecedentes.page.html',
  styleUrl: './antecedentes.page.css'
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
