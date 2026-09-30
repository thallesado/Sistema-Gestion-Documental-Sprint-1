import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, finalize, switchMap, tap } from 'rxjs';
import { ApiPatient, ClinicalApiService, ClinicalHistory, PatientQuickSummary } from '../../../core/api/clinical-api.service';
import { DocumentApiService, MedicalNote } from '../../../core/api/document-api.service';
import { ClinicoNewPatientModalComponent } from '../../../widgets/clinico/clinico-new-patient-modal.component';
import { ClinicoNotesPanelComponent } from '../../../widgets/clinico/clinico-notes-panel.component';
import { ClinicoPatientDetailComponent } from '../../../widgets/clinico/clinico-patient-detail.component';
import { PatientSearchPanelComponent } from '../../../widgets/clinico/patient-search-panel.component';

@Component({
  selector: 'app-clinical-page',
  standalone: true,
  imports: [CommonModule, ClinicoNewPatientModalComponent, ClinicoNotesPanelComponent, ClinicoPatientDetailComponent, PatientSearchPanelComponent],
  template: `
    <section class="clinical-page">
      <header class="clinical-header">
        <div class="clinical-icon" aria-hidden="true">⚕</div>
        <div>
          <p class="eyebrow">Expedientes · {{ isNotes() ? 'Notas médicas' : 'Expediente clínico' }}</p>
          <h1>{{ isNotes() ? 'Notas médicas' : 'Expediente clínico' }}</h1>
          <p>HU-03, HU-04, HU-07, HU-08 y HU-10 · información del tenant autenticado.</p>
        </div>
      </header>

      @if (apiError()) {
        <div class="state error" role="alert">
          <b>No fue posible consultar los pacientes.</b><span>{{ apiError() }}</span>
          <button type="button" (click)="loadPatients()">Reintentar consulta</button>
        </div>
      }

      <app-patient-search-panel
        [searchTerm]="searchTerm()" [loading]="loading()" [patients]="patients()"
        [selected]="selected()" [showNewPatient]="showNewPatient()" [apiError]="apiError()"
        (search)="onSearchTerm($event)" (select)="select($event)" (togglePatientForm)="togglePatientForm()"
      />

      @if (showNewPatient()) {
        <app-clinico-new-patient-modal
          [newDocumentType]="patientForm.documentType" [newDocument]="patientForm.documentNumber"
          [newFirstName]="patientForm.firstName" [newLastName]="patientForm.lastName"
          [newBirthDate]="patientForm.birthDate" [newGender]="patientForm.gender"
          [newPhone]="patientForm.phone" [newEmail]="patientForm.email"
          [savingPatient]="savingPatient()" [canCreatePatient]="canCreatePatient()"
          [patientFormError]="patientFormError()" [patientFormMessage]="patientFormMessage()"
          (documentTypeChange)="patientForm.documentType = $event" (documentChange)="patientForm.documentNumber = $event"
          (firstNameChange)="patientForm.firstName = $event" (lastNameChange)="patientForm.lastName = $event"
          (birthDateChange)="patientForm.birthDate = $event" (genderChange)="patientForm.gender = $event"
          (phoneChange)="patientForm.phone = $event" (emailChange)="patientForm.email = $event"
          (createPatient)="createPatient($event)"
        />
      }

      @if (isNotes()) {
        <app-clinico-notes-panel
          [selected]="selected()" [history]="history()" [noteType]="noteType()"
          [noteTitle]="noteTitle()" [noteBody]="noteBody()" [savingNote]="savingNote()"
          [noteError]="noteError()" [noteMessage]="noteMessage()" [notesLoading]="notesLoading()"
          [notesError]="notesError()" [medicalNotes]="medicalNotes()"
          (noteTypeChange)="noteType.set($event)" (noteTitleChange)="noteTitle.set($event)"
          (noteBodyChange)="noteBody.set($event)" (saveNote)="saveNote($event)"
          (retryNotes)="reloadSelectedPatient()"
        />
      }

      @if (selected(); as patient) {
        <app-clinico-patient-detail
          [patient]="patient" [quickSummary]="quickSummary()"
          [quickSummaryLoading]="quickSummaryLoading()" [quickSummaryError]="quickSummaryError()"
          (reload)="reloadSelectedPatient()"
        />
      }
    </section>
  `
})
export class ClinicoPage {
  private readonly clinicalApi = inject(ClinicalApiService);
  private readonly documentApi = inject(DocumentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  readonly isNotes = signal(this.route.snapshot.url.some(s => s.path === 'notes'));
  readonly searchTerm = signal('');
  readonly patients = signal<ApiPatient[]>([]);
  readonly selected = signal<ApiPatient | null>(null);
  readonly history = signal<ClinicalHistory | null>(null);
  readonly medicalNotes = signal<MedicalNote[]>([]);
  readonly quickSummary = signal<PatientQuickSummary | null>(null);

  readonly loading = signal(false);
  readonly savingPatient = signal(false);
  readonly savingNote = signal(false);
  readonly notesLoading = signal(false);
  readonly quickSummaryLoading = signal(false);
  readonly showNewPatient = signal(false);

  readonly apiError = signal<string | null>(null);
  readonly patientFormError = signal<string | null>(null);
  readonly patientFormMessage = signal<string | null>(null);
  readonly noteError = signal<string | null>(null);
  readonly noteMessage = signal<string | null>(null);
  readonly notesError = signal<string | null>(null);
  readonly quickSummaryError = signal<string | null>(null);

  patientForm = { documentType: 'CI', documentNumber: '', firstName: '', lastName: '', birthDate: '', gender: '', phone: '', email: '' };
  readonly noteType = signal('EVOLUTION');
  readonly noteTitle = signal('');
  readonly noteBody = signal('');

  constructor() {
    this.loadPatients();
    this.searchSubject.pipe(
      debounceTime(300), distinctUntilChanged(), tap(() => this.loading.set(true)),
      switchMap(term => this.clinicalApi.patients(term, 0, 50).pipe(catchError(() => EMPTY), finalize(() => this.loading.set(false)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: any) => this.patients.set(res.content || []));
  }

  loadPatients(): void {
    this.loading.set(true);
    this.clinicalApi.patients('', 0, 50).subscribe({
      next: (res: any) => { this.patients.set(res.content || []); this.loading.set(false); },
      error: (err: any) => { this.apiError.set(err?.message || 'Error al cargar pacientes.'); this.loading.set(false); }
    });
  }

  onSearchTerm(term: string): void { this.searchTerm.set(term); this.searchSubject.next(term); }
  select(patient: ApiPatient): void { this.selected.set(patient); this.reloadSelectedPatient(); }

  reloadSelectedPatient(): void {
    const p = this.selected();
    if (!p) return;
    this.quickSummaryLoading.set(true);
    this.clinicalApi.quickSummary(p.id).subscribe({
      next: (qs: any) => { this.quickSummary.set(qs); this.quickSummaryLoading.set(false); },
      error: () => this.quickSummaryLoading.set(false)
    });
    this.clinicalApi.clinicalHistory(p.id).subscribe({
      next: (h: any) => {
        this.history.set(h);
        if (h?.id) {
          this.notesLoading.set(true);
          this.documentApi.medicalNotes(h.id, 0, 20).subscribe({
            next: (n: any) => { this.medicalNotes.set(n.content || []); this.notesLoading.set(false); },
            error: () => this.notesLoading.set(false)
          });
        }
      }
    });
  }

  togglePatientForm(): void { this.showNewPatient.update(v => !v); }
  canCreatePatient(): boolean { return !!this.patientForm.firstName.trim() && !!this.patientForm.lastName.trim() && !!this.patientForm.documentNumber.trim(); }

  createPatient(event: Event): void {
    event.preventDefault();
    if (!this.canCreatePatient()) return;
    this.savingPatient.set(true);
    this.patientFormError.set(null);
    this.clinicalApi.createPatient({
      ...this.patientForm,
      birthDate: this.patientForm.birthDate || undefined,
      gender: this.patientForm.gender || undefined,
      phone: this.patientForm.phone || undefined,
      email: this.patientForm.email || undefined
    }).subscribe({
      next: (p: any) => {
        this.savingPatient.set(false);
        this.patientFormMessage.set('Paciente registrado con éxito.');
        this.loadPatients();
        this.select(p);
      },
      error: (err: any) => { this.savingPatient.set(false); this.patientFormError.set(err?.message || 'Error al guardar.'); }
    });
  }

  saveNote(event: Event): void {
    event.preventDefault();
    const h = this.history();
    if (!h) return;
    this.savingNote.set(true);
    this.noteError.set(null);
    this.documentApi.createMedicalNote({
      clinicalHistoryId: h.id,
      noteType: this.noteType(),
      content: `${this.noteTitle()}\n\n${this.noteBody()}`
    }).subscribe({
      next: () => {
        this.savingNote.set(false);
        this.noteMessage.set('Nota registrada exitosamente.');
        this.noteTitle.set('');
        this.noteBody.set('');
        this.reloadSelectedPatient();
      },
      error: (err: any) => { this.savingNote.set(false); this.noteError.set(err?.message || 'Error al guardar nota.'); }
    });
  }
}
export const ClinicalPage = ClinicoPage;
