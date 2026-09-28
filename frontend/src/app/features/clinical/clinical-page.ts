import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, finalize, switchMap, tap } from 'rxjs';
import {
  ApiPatient,
  ClinicalApiService,
  ClinicalHistory,
  ClinicalHistoryPayload,
  PatientQuickSummary,
  TimelineEvent,
} from '../../core/api/clinical-api.service';
import { DocumentApiService, MedicalNote } from '../../core/api/document-api.service';

type TimelineItem = {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
  source: string;
  status: string;
};

@Component({
  selector: 'app-clinical-page',
  standalone: true,
  imports: [CommonModule],
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
          <b>No fue posible consultar los pacientes.</b>
          <span>{{ apiError() }}</span>
          <button type="button" (click)="loadPatients()">Reintentar consulta</button>
        </div>
      }

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
            (click)="togglePatientForm()"
          >{{ showNewPatient() ? 'Cerrar alta' : '＋ Alta de paciente' }}</button>
        </div>

        <div class="search-bar">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Buscar paciente por nombre o documento"
            autocomplete="off"
            placeholder="Nombre o CI…"
            [value]="searchTerm()"
            (input)="search($event)"
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
              (click)="select(patient)"
            >
              <span class="avatar" aria-hidden="true">{{ initials(patientLabel(patient)) }}</span>
              <span class="patient-info">
                <b>{{ patientLabel(patient) }}</b>
                <small>{{ patientDocument(patient) }} · {{ patient.gender || 'Sin género informado' }}</small>
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

      @if (showNewPatient()) {
        <section id="patient-registration" class="panel form-panel" aria-labelledby="patient-registration-title">
          <div class="panel-title">
            <div>
              <h2 id="patient-registration-title">Alta de paciente</h2>
              <p>HU-03 · registro real mediante <code>POST /api/v1/patients</code>.</p>
            </div>
          </div>

          @if (patientFormError()) {
            <div class="state error" role="alert">{{ patientFormError() }}</div>
          }
          @if (patientFormMessage()) {
            <p class="success" role="status">{{ patientFormMessage() }}</p>
          }

          <form (submit)="createPatient($event)">
            <div class="form-grid">
              <label>Tipo de documento
                <select [value]="newDocumentType()" (change)="newDocumentType.set(value($event))">
                  <option value="CI">CI</option>
                  <option value="SEGURO">Seguro</option>
                </select>
              </label>
              <label>Número de documento
                <input required maxlength="40" [value]="newDocument()" (input)="newDocument.set(value($event))">
              </label>
              <label>Nombres
                <input required maxlength="100" [value]="newFirstName()" (input)="newFirstName.set(value($event))">
              </label>
              <label>Apellidos
                <input required maxlength="100" [value]="newLastName()" (input)="newLastName.set(value($event))">
              </label>
              <label>Fecha de nacimiento
                <input type="date" [value]="newBirthDate()" (input)="newBirthDate.set(value($event))">
              </label>
              <label>Género
                <input maxlength="30" [value]="newGender()" (input)="newGender.set(value($event))">
              </label>
              <label>Teléfono
                <input maxlength="30" inputmode="tel" [value]="newPhone()" (input)="newPhone.set(value($event))">
              </label>
              <label>Correo electrónico
                <input type="email" maxlength="150" [value]="newEmail()" (input)="newEmail.set(value($event))">
              </label>
            </div>
            <button class="primary" type="submit" [disabled]="savingPatient() || !canCreatePatient()">
              {{ savingPatient() ? 'Guardando…' : 'Guardar alta' }}
            </button>
          </form>
        </section>
      }

      @if (isNotes()) {
        <section class="panel notes-panel" aria-labelledby="medical-note-title">
          <div class="panel-title">
            <div>
              <h2 id="medical-note-title">Registrar nota médica</h2>
              <p>HU-08 · la nota se guarda de forma inmutable en la historia seleccionada.</p>
            </div>
            <span class="badge">API clínica</span>
          </div>

          @if (noteError()) {
            <div class="state error" role="alert">{{ noteError() }}</div>
          }
          @if (noteMessage()) {
            <p class="success" role="status">{{ noteMessage() }}</p>
          }

          <form (submit)="saveNote($event)">
            <div class="form-grid">
              <label>Paciente
                <input disabled [value]="selected() ? patientLabel(selected()!) : 'Selecciona un paciente'">
              </label>
              <label>Tipo de nota
                <select [value]="noteType()" (change)="noteType.set(value($event))">
                  <option value="EVOLUTION">Evolución</option>
                  <option value="CONSULTATION">Consulta</option>
                  <option value="ASSESSMENT">Evaluación</option>
                </select>
              </label>
              <label class="wide">Título
                <input required maxlength="200" [value]="noteTitle()" (input)="noteTitle.set(value($event))" placeholder="Motivo o encabezado de la nota">
              </label>
              <label class="wide">Contenido
                <textarea required maxlength="20000" [value]="noteBody()" (input)="noteBody.set(value($event))" placeholder="Describe hallazgos, indicaciones y seguimiento"></textarea>
              </label>
            </div>
            <button class="primary" type="submit" [disabled]="!history() || savingNote() || !noteTitle().trim() || !noteBody().trim()">
              {{ savingNote() ? 'Guardando…' : 'Guardar nota' }}
            </button>
          </form>

          <div class="note-history" aria-live="polite">
            @if (notesLoading()) {
              <div class="inline-state" role="status">Cargando notas médicas…</div>
            } @else if (notesError()) {
              <div class="state error" role="alert">
                <span>{{ notesError() }}</span>
                @if (history()) {
                  <button type="button" (click)="loadMedicalNotes(selected()!.id, history()!.id, detailRequestId)">Reintentar consulta</button>
                }
              </div>
            } @else {
              @for (note of medicalNotes(); track note.id) {
                <article class="summary">
                  <b>{{ note.noteType }} · {{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</b>
                  <span class="multiline">{{ note.content }}</span>
                </article>
              } @empty {
                @if (selected() && history()) {
                  <div class="empty">No hay notas médicas registradas para esta historia.</div>
                }
              }
            }
          </div>
        </section>
      }

      @if (selected(); as patient) {
        <section class="detail-grid">
          <article class="panel patient-detail">
            <div class="panel-title">
              <div>
                <h2>{{ patientLabel(patient) }}</h2>
                <p>{{ patientDocument(patient) }} · {{ patientStatus(patient) }}</p>
              </div>
              <span class="badge">Expediente único</span>
            </div>
            <dl class="data">
              <div><dt>Fecha de nacimiento</dt><dd>{{ patient.birthDate ? (patient.birthDate | date:'dd/MM/yyyy') : '—' }}</dd></div>
              <div><dt>Teléfono</dt><dd>{{ patient.phone || '—' }}</dd></div>
              <div><dt>Correo</dt><dd>{{ patient.email || '—' }}</dd></div>
            </dl>
          </article>

          <article class="panel quick-summary-panel" aria-labelledby="quick-summary-title" [attr.aria-busy]="quickSummaryLoading()">
            <div class="panel-title">
              <div>
                <h2 id="quick-summary-title">Resumen rápido</h2>
                <p>HU-10 · alergias, diagnósticos y las cinco notas más recientes.</p>
              </div>
              <button class="secondary" type="button" (click)="reloadSelectedPatient()">Actualizar</button>
            </div>

            @if (quickSummaryLoading()) {
              <div class="state" role="status">Consultando resumen rápido…</div>
            } @else if (quickSummaryError()) {
              <div class="state error" role="alert">
                <b>No fue posible cargar el resumen rápido.</b>
                <span>{{ quickSummaryError() }}</span>
                <button type="button" (click)="reloadSelectedPatient()">Reintentar consulta</button>
              </div>
            } @else if (quickSummary(); as summary) {
              <div class="quick-summary-grid">
                <section>
                  <h3>Alergias</h3>
                  @for (allergy of summary.allergies; track allergy.allergen) {
                    <div class="quick-item">
                      <b>{{ allergy.allergen }}</b>
                      <span>{{ allergy.severity || 'Severidad no indicada' }}{{ allergy.reaction ? ' · ' + allergy.reaction : '' }}</span>
                    </div>
                  } @empty {
                    <p class="empty">No hay alergias registradas.</p>
                  }
                </section>
                <section>
                  <h3>Diagnósticos base</h3>
                  @for (diagnosis of summary.baseDiagnoses; track diagnosis.code + diagnosis.description) {
                    <div class="quick-item">
                      <b>{{ diagnosis.description }}</b>
                      <span>{{ diagnosis.code || 'Sin código' }}{{ diagnosis.diagnosedAt ? ' · ' + (diagnosis.diagnosedAt | date:'dd/MM/yyyy') : '' }}</span>
                    </div>
                  } @empty {
                    <p class="empty">No hay diagnósticos base registrados.</p>
                  }
                </section>
                <section class="recent-notes">
                  <h3>Notas recientes</h3>
                  @for (note of summary.recentNotes; track note.id) {
                    <div class="quick-item">
                      <b>{{ note.type }} · {{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</b>
                      <span class="multiline">{{ note.content }}</span>
                    </div>
                  } @empty {
                    <p class="empty">No hay notas médicas recientes.</p>
                  }
                </section>
              </div>
            }
          </article>

          <article class="panel history-panel" aria-labelledby="clinical-history-title">
            <div class="panel-title">
              <div>
                <h2 id="clinical-history-title">Antecedentes y diagnósticos</h2>
                <p>HU-04 · captura estructurada de la historia clínica.</p>
              </div>
            </div>

            @if (historyLoading()) {
              <div class="state" role="status">Cargando historia clínica…</div>
            } @else if (historyError()) {
              <div class="state error" role="alert">
                <span>{{ historyError() }}</span>
                <button type="button" (click)="reloadSelectedPatient()">Reintentar consulta</button>
              </div>
            } @else {
              @if (history(); as clinicalHistory) {
                <div class="summary"><b>Historia {{ clinicalHistory.code }}</b><span>Actualiza los antecedentes clínicos mediante la API.</span></div>
              } @else {
                <div class="state warning">No hay una historia clínica disponible. Puedes registrar los antecedentes iniciales.</div>
              }
            }

            @if (historySaveError()) {
              <div class="state error" role="alert">{{ historySaveError() }}</div>
            }
            @if (historyMessage()) {
              <p class="success" role="status">{{ historyMessage() }}</p>
            }

            <form (submit)="saveHistory($event)">
              <div class="form-grid">
                <label>Tipo sanguíneo
                  <input maxlength="10" [value]="bloodType()" (input)="bloodType.set(value($event))">
                </label>
                <label>Condiciones crónicas
                  <input maxlength="2000" [value]="chronic()" (input)="chronic.set(value($event))">
                </label>
                <label>Alergia / sustancia
                  <input maxlength="255" [value]="allergy()" (input)="allergy.set(value($event))" placeholder="Ej. penicilina">
                </label>
                <label>Severidad
                  <select [value]="allergySeverity()" (change)="allergySeverity.set(value($event))">
                    <option value="">No indicada</option>
                    <option value="LEVE">Leve</option>
                    <option value="MODERADA">Moderada</option>
                    <option value="GRAVE">Grave</option>
                  </select>
                </label>
                <label class="wide">Reacción alérgica
                  <input maxlength="255" [value]="allergyReaction()" (input)="allergyReaction.set(value($event))" placeholder="Ej. urticaria">
                </label>
                <label>Código diagnóstico
                  <input maxlength="40" [value]="diagnosisCode()" (input)="diagnosisCode.set(value($event))" placeholder="Ej. CIE-10">
                </label>
                <label>Diagnóstico base
                  <input maxlength="500" [value]="diagnosisDescription()" (input)="diagnosisDescription.set(value($event))">
                </label>
                <label>Fecha del diagnóstico
                  <input type="date" [value]="diagnosisDate()" (input)="diagnosisDate.set(value($event))">
                </label>
                <label>Medicamento actual
                  <input maxlength="255" [value]="medicationName()" (input)="medicationName.set(value($event))">
                </label>
                <label>Dosis
                  <input maxlength="120" [value]="medicationDose()" (input)="medicationDose.set(value($event))" placeholder="Ej. 500 mg">
                </label>
                <label>Frecuencia
                  <input maxlength="120" [value]="medicationFrequency()" (input)="medicationFrequency.set(value($event))" placeholder="Ej. cada 8 h">
                </label>
                <label>Antecedentes patológicos
                  <textarea maxlength="4000" [value]="pathological()" (input)="pathological.set(value($event))"></textarea>
                </label>
                <label>Antecedentes no patológicos
                  <textarea maxlength="4000" [value]="nonPathological()" (input)="nonPathological.set(value($event))"></textarea>
                </label>
                <label>Antecedentes familiares
                  <textarea maxlength="4000" [value]="family()" (input)="family.set(value($event))"></textarea>
                </label>
                <label>Observaciones
                  <textarea maxlength="4000" [value]="observations()" (input)="observations.set(value($event))"></textarea>
                </label>
              </div>
              <button class="primary" type="submit" [disabled]="historyLoading() || savingHistory()">
                {{ savingHistory() ? 'Guardando…' : 'Guardar historia clínica' }}
              </button>
            </form>
          </article>

          <article class="panel timeline-panel" aria-labelledby="timeline-title">
            <div class="panel-title">
              <div>
                <h2 id="timeline-title">Línea cronológica</h2>
                <p>HU-07 · eventos disponibles para este expediente.</p>
              </div>
            </div>

            @if (timelineLoading()) {
              <div class="state" role="status">Cargando eventos clínicos…</div>
            } @else if (timelineError()) {
              <div class="state error" role="alert">
                <span>{{ timelineError() }}</span>
                <button type="button" (click)="reloadSelectedPatient()">Reintentar consulta</button>
              </div>
            } @else if (timeline().length) {
              <div class="timeline">
                @for (event of timeline(); track event.id) {
                  <div class="event">
                    <i aria-hidden="true"></i>
                    <div>
                      <time>{{ event.occurredAt | date:'dd/MM/yyyy HH:mm' }}</time>
                      <b>{{ event.title }}</b>
                      <p>{{ event.description }}</p>
                      <small>{{ event.source }} · {{ event.status }}</small>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty">No hay eventos clínicos registrados.</div>
            }
          </article>
        </section>
      }
    </section>
  `,
  styles: [`
    .clinical-page{max-width:1440px;margin:auto;padding:30px 36px 48px}.clinical-header{display:flex;gap:14px;align-items:center;margin-bottom:22px}.clinical-icon{background:#dff7f3;border-radius:14px;padding:15px;font-size:25px}.eyebrow{color:#087f7b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.clinical-header h1{margin:5px 0;color:#153a39;font-size:34px;letter-spacing:-.04em}.clinical-header p:last-child{color:#6b8583;font-size:13px}.panel{background:#fff;border:1px solid #dcebe8;border-radius:16px;padding:20px;margin-bottom:18px}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:15px}.panel h2{font-size:16px;margin:0 0 4px;color:#153a39}.panel h3{font-size:12px;color:#153a39;margin:0 0 9px}.panel-title p{font-size:11px;color:#6b8583;margin:0}.primary,.secondary{border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary{background:#087f7b;color:#fff;border:0}.secondary{background:#fff;border:1px solid #9dd8d1;color:#087f7b}.primary:disabled{opacity:.55;cursor:not-allowed}.search-bar{display:flex;align-items:center;background:#f8fbfa;border:1px solid #dcebe8;border-radius:11px;padding:0 12px}.search-bar input{border:0;background:transparent;outline:0;height:44px;width:100%;padding-left:10px}.patient-list{display:grid;gap:3px;margin-top:12px}.patient-row{display:flex;align-items:center;gap:12px;text-align:left;background:transparent;border:1px solid transparent;border-radius:10px;padding:10px;cursor:pointer;color:#153a39}.patient-row:hover,.patient-row:focus-visible,.patient-row.selected{background:#dff7f3;border-color:#bfeae5}.avatar{background:#d5f5f1;color:#087f7b;border-radius:50%;height:38px;width:38px;display:grid;place-items:center;font-weight:800}.patient-info{display:grid;gap:4px;flex:1}.patient-info small,.empty{color:#6b8583;font-size:11px}.inline-state{color:#356d9e;font-size:11px;padding:10px 0}.state{background:#eef7ff;border:1px solid #cfe3f5;border-radius:10px;color:#356d9e;padding:12px;margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap}.state.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}.state.warning{background:#fff8e8;border-color:#f3e1b6;color:#8b671c}.state button{border:0;background:transparent;text-decoration:underline;color:inherit;cursor:pointer;padding:0}.success{color:#087f7b;font-size:11px;font-weight:700}.detail-grid{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(360px,1.2fr);gap:18px}.quick-summary-panel,.timeline-panel{grid-column:1/-1}.badge{background:#dff7f3;color:#087f7b;border-radius:99px;padding:5px 9px;font-size:10px;font-weight:800}.data{display:grid;grid-template-columns:1fr 1fr;gap:12px}.data dt{font-size:10px;color:#6b8583;text-transform:uppercase;font-weight:800}.data dd{margin:4px 0;color:#153a39;font-size:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px}.form-grid label{display:grid;gap:5px;font-size:11px;color:#6b8583;font-weight:800}.form-grid input,.form-grid select,.form-grid textarea{border:1px solid #dcebe8;border-radius:8px;padding:9px;color:#153a39;min-width:0;background:#fff}.form-grid input:disabled{background:#f3f7f6;color:#6b8583}.form-grid textarea{min-height:70px;resize:vertical}.form-grid .wide{grid-column:1/-1}.summary{display:grid;gap:5px;background:#f8fbfa;border-radius:9px;padding:11px;margin-bottom:15px;font-size:11px;color:#6b8583}.quick-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.quick-summary-grid section{background:#f8fbfa;border-radius:10px;padding:12px}.quick-item{display:grid;gap:4px;padding:9px 0;border-bottom:1px solid #e4efed;font-size:11px;color:#6b8583}.quick-item:last-child{border-bottom:0;padding-bottom:0}.quick-item b{color:#153a39}.multiline{white-space:pre-line}.timeline{display:grid;gap:0}.event{display:flex;gap:13px;border-bottom:1px solid #edf3f1;padding:10px 0}.event i{width:11px;height:11px;border-radius:50%;background:#087f7b;margin-top:4px;flex:0 0 auto}.event div{display:grid;gap:4px}.event time,.event small{color:#6b8583;font-size:10px}.event p{margin:0;color:#466765;font-size:11px}.event b{font-size:13px}@media(max-width:800px){.clinical-page{padding:22px 16px}.detail-grid{grid-template-columns:1fr}.quick-summary-panel,.timeline-panel{grid-column:auto}.form-grid,.data,.quick-summary-grid{grid-template-columns:1fr}.clinical-header{align-items:flex-start}.panel-title{align-items:flex-start;flex-direction:column}}
  `],
})
export class ClinicalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ClinicalApiService);
  private readonly documentApi = inject(DocumentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms = new Subject<string>();
  private readonly patientRequests = new Subject<string>();
  private patientRequestId = 0;
  detailRequestId = 0;

  readonly isNotes = signal(this.route.snapshot.data['mode'] === 'notes');
  readonly loading = signal(false);
  readonly historyLoading = signal(false);
  readonly quickSummaryLoading = signal(false);
  readonly timelineLoading = signal(false);
  readonly notesLoading = signal(false);
  readonly savingPatient = signal(false);
  readonly savingHistory = signal(false);
  readonly savingNote = signal(false);

  readonly apiError = signal('');
  readonly patientFormError = signal('');
  readonly patientFormMessage = signal('');
  readonly historyError = signal('');
  readonly historySaveError = signal('');
  readonly historyMessage = signal('');
  readonly quickSummaryError = signal('');
  readonly timelineError = signal('');
  readonly notesError = signal('');
  readonly noteError = signal('');
  readonly noteMessage = signal('');

  readonly searchTerm = signal('');
  readonly patients = signal<ApiPatient[]>([]);
  readonly selected = signal<ApiPatient | null>(null);
  readonly history = signal<ClinicalHistory | null>(null);
  readonly quickSummary = signal<PatientQuickSummary | null>(null);
  readonly timeline = signal<TimelineItem[]>([]);
  readonly medicalNotes = signal<MedicalNote[]>([]);
  readonly showNewPatient = signal(false);

  readonly newDocumentType = signal('CI');
  readonly newDocument = signal('');
  readonly newFirstName = signal('');
  readonly newLastName = signal('');
  readonly newBirthDate = signal('');
  readonly newGender = signal('');
  readonly newPhone = signal('');
  readonly newEmail = signal('');

  readonly bloodType = signal('');
  readonly pathological = signal('');
  readonly nonPathological = signal('');
  readonly family = signal('');
  readonly chronic = signal('');
  readonly allergy = signal('');
  readonly allergySeverity = signal('');
  readonly allergyReaction = signal('');
  readonly diagnosisCode = signal('');
  readonly diagnosisDescription = signal('');
  readonly diagnosisDate = signal('');
  readonly medicationName = signal('');
  readonly medicationDose = signal('');
  readonly medicationFrequency = signal('');
  readonly observations = signal('');

  readonly noteTitle = signal('');
  readonly noteBody = signal('');
  readonly noteType = signal('EVOLUTION');

  constructor() {
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((filter) => this.patientRequests.next(filter));

    this.patientRequests.pipe(
      switchMap((filter) => this.fetchPatients(filter)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();

    this.loadPatients();
  }

  loadPatients(): void {
    this.patientRequests.next(this.searchTerm().trim());
  }

  search(event: Event): void {
    const filter = this.value(event);
    this.searchTerm.set(filter);
    this.searchTerms.next(filter.trim());
  }

  togglePatientForm(): void {
    this.showNewPatient.update((isVisible) => !isVisible);
    this.patientFormError.set('');
    this.patientFormMessage.set('');
  }

  select(patient: ApiPatient): void {
    this.selected.set(patient);
    this.resetPatientDetails();
    this.loadPatientDetails(patient.id);
  }

  reloadSelectedPatient(): void {
    const patient = this.selected();
    if (patient) this.loadPatientDetails(patient.id);
  }

  createPatient(event: Event): void {
    event.preventDefault();
    if (!this.canCreatePatient() || this.savingPatient()) return;

    this.savingPatient.set(true);
    this.patientFormError.set('');
    this.patientFormMessage.set('');
    this.api.createPatient({
      documentType: this.newDocumentType(),
      documentNumber: this.newDocument().trim(),
      firstName: this.newFirstName().trim(),
      lastName: this.newLastName().trim(),
      birthDate: this.newBirthDate() || undefined,
      gender: this.newGender().trim() || undefined,
      phone: this.newPhone().trim() || undefined,
      email: this.newEmail().trim() || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (patient) => {
        this.savingPatient.set(false);
        this.patientFormMessage.set('Paciente registrado correctamente.');
        this.resetPatientForm();
        this.showNewPatient.set(false);
        this.select(patient);
        this.searchTerm.set('');
        this.loadPatients();
      },
      error: () => {
        this.savingPatient.set(false);
        this.patientFormError.set('No se pudo completar el alta. Verifica los datos, la disponibilidad de la API y el permiso patient:create. No se guardó información localmente.');
      },
    });
  }

  saveHistory(event: Event): void {
    event.preventDefault();
    const patient = this.selected();
    if (!patient || this.savingHistory() || this.historyLoading()) return;

    this.savingHistory.set(true);
    this.historySaveError.set('');
    this.historyMessage.set('');
    const payload = this.historyPayload(patient.id);
    const request = this.history()
      ? this.api.updateHistory(this.history()!.id, payload)
      : this.api.createHistory(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.savingHistory.set(false);
        this.historyMessage.set('Historia clínica guardada correctamente.');
        this.loadPatientDetails(patient.id);
      },
      error: () => {
        this.savingHistory.set(false);
        this.historySaveError.set('No se pudo guardar la historia clínica. Verifica los permisos patient:create o patient:update; no se guardó información localmente.');
      },
    });
  }

  saveNote(event: Event): void {
    event.preventDefault();
    const history = this.history();
    if (!history || this.savingNote() || !this.noteTitle().trim() || !this.noteBody().trim()) return;

    this.savingNote.set(true);
    this.noteError.set('');
    this.noteMessage.set('');
    this.documentApi.createMedicalNote({
      clinicalHistoryId: history.id,
      noteType: this.noteType(),
      content: `${this.noteTitle().trim()}\n${this.noteBody().trim()}`,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.savingNote.set(false);
        this.noteTitle.set('');
        this.noteBody.set('');
        this.noteMessage.set('Nota médica guardada correctamente.');
        this.reloadSelectedPatient();
      },
      error: () => {
        this.savingNote.set(false);
        this.noteError.set('No se pudo guardar la nota. Verifica el permiso medical_note:create; no se guardó información localmente.');
      },
    });
  }

  loadMedicalNotes(patientId: string, historyId: string, requestId: number): void {
    this.notesLoading.set(true);
    this.notesError.set('');
    this.documentApi.medicalNotes(historyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.medicalNotes.set(page.content);
        this.notesLoading.set(false);
      },
      error: () => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.medicalNotes.set([]);
        this.notesError.set('No fue posible consultar las notas médicas. La lista se mantiene vacía.');
        this.notesLoading.set(false);
      },
    });
  }

  canCreatePatient(): boolean {
    return Boolean(
      this.newDocumentType().trim()
      && this.newDocument().trim()
      && this.newFirstName().trim()
      && this.newLastName().trim(),
    );
  }

  patientLabel(patient: ApiPatient): string {
    return `${patient.firstName} ${patient.lastName}`.trim();
  }

  patientDocument(patient: ApiPatient): string {
    return `${patient.documentType} ${patient.documentNumber}`.trim();
  }

  patientStatus(patient: ApiPatient): string {
    return patient.status || 'Sin estado informado';
  }

  initials(value: string): string {
    return value.split(' ').filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  private fetchPatients(filter: string) {
    const requestId = ++this.patientRequestId;
    this.loading.set(true);
    this.apiError.set('');

    return this.api.patients(filter).pipe(
      tap((page) => {
        if (requestId !== this.patientRequestId) return;
        this.patients.set(page.content);
        const selectedId = this.selected()?.id;
        if (selectedId && !page.content.some((patient) => patient.id === selectedId)) {
          this.clearSelection();
        }
      }),
      catchError(() => {
        if (requestId === this.patientRequestId) {
          this.patients.set([]);
          this.clearSelection();
          this.apiError.set('La API no respondió o devolvió datos no válidos. La lista permanece vacía.');
        }
        return EMPTY;
      }),
      finalize(() => {
        if (requestId === this.patientRequestId) this.loading.set(false);
      }),
    );
  }

  private loadPatientDetails(patientId: string): void {
    const requestId = ++this.detailRequestId;
    this.historyLoading.set(true);
    this.historyError.set('');
    this.quickSummaryLoading.set(true);
    this.quickSummaryError.set('');
    this.timelineLoading.set(false);
    this.timelineError.set('');
    this.notesLoading.set(false);
    this.notesError.set('');
    this.medicalNotes.set([]);
    this.timeline.set([]);

    this.api.histories(patientId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        const clinicalHistory = page.content[0] ?? null;
        this.history.set(clinicalHistory);
        this.historyLoading.set(false);
        if (clinicalHistory) {
          this.fillHistoryForm(clinicalHistory);
          this.loadTimeline(patientId, clinicalHistory.id, requestId);
          if (this.isNotes()) this.loadMedicalNotes(patientId, clinicalHistory.id, requestId);
        } else {
          this.resetHistoryForm();
        }
      },
      error: () => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.history.set(null);
        this.resetHistoryForm();
        this.historyError.set('No fue posible consultar la historia clínica. No hay datos alternativos para mostrar.');
        this.historyLoading.set(false);
      },
    });

    this.api.quickSummary(patientId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (summary) => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.quickSummary.set(summary);
        this.quickSummaryLoading.set(false);
      },
      error: () => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.quickSummary.set(null);
        this.quickSummaryError.set('La API no pudo devolver alergias, diagnósticos y notas recientes. No hay un resumen alternativo para mostrar.');
        this.quickSummaryLoading.set(false);
      },
    });
  }

  private loadTimeline(patientId: string, historyId: string, requestId: number): void {
    this.timelineLoading.set(true);
    this.timelineError.set('');
    this.api.timeline(historyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (events) => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.timeline.set(events.map((event) => this.mapTimeline(event)));
        this.timelineLoading.set(false);
      },
      error: () => {
        if (!this.isCurrentDetail(patientId, requestId)) return;
        this.timeline.set([]);
        this.timelineError.set('No fue posible consultar la línea cronológica. La lista se mantiene vacía.');
        this.timelineLoading.set(false);
      },
    });
  }

  private historyPayload(patientId: string): ClinicalHistoryPayload {
    const previous = this.history();
    const allergy = this.allergy().trim();
    const diagnosis = this.diagnosisDescription().trim();
    const medication = this.medicationName().trim();
    const preservedAllergies = (previous?.allergies.slice(1) ?? []).map((entry) => ({
      allergen: entry.allergen,
      severity: entry.severity ?? '',
      reaction: entry.reaction ?? '',
    }));
    const preservedMedications = (previous?.currentMedications.slice(1) ?? []).map((entry) => ({
      name: entry.name,
      dose: entry.dose ?? '',
      frequency: entry.frequency ?? '',
    }));
    const preservedDiagnoses = (previous?.baseDiagnoses.slice(1) ?? []).map((entry) => ({
      code: entry.code ?? '',
      description: entry.description,
      diagnosedAt: entry.diagnosedAt ?? '',
    }));

    return {
      patientId,
      bloodType: this.bloodType().trim(),
      pathologicalAntecedents: this.pathological().trim(),
      nonPathologicalAntecedents: this.nonPathological().trim(),
      familyAntecedents: this.family().trim(),
      allergies: allergy
        ? [{ allergen: allergy, severity: this.allergySeverity(), reaction: this.allergyReaction().trim() }, ...preservedAllergies]
        : preservedAllergies,
      chronicConditions: this.chronic().trim(),
      currentMedications: medication
        ? [{
            name: medication,
            dose: this.medicationDose().trim(),
            frequency: this.medicationFrequency().trim(),
            }, ...preservedMedications]
        : preservedMedications,
      baseDiagnoses: diagnosis
        ? [{
            code: this.diagnosisCode().trim(),
            description: diagnosis,
            diagnosedAt: this.diagnosisDate() || new Date().toISOString().slice(0, 10),
          }, ...preservedDiagnoses]
        : preservedDiagnoses,
      observations: this.observations().trim(),
    };
  }

  private fillHistoryForm(history: ClinicalHistory): void {
    const allergy = history.allergies[0];
    const diagnosis = history.baseDiagnoses[0];
    const medication = history.currentMedications[0];
    this.bloodType.set(history.bloodType ?? '');
    this.pathological.set(history.pathologicalAntecedents ?? '');
    this.nonPathological.set(history.nonPathologicalAntecedents ?? '');
    this.family.set(history.familyAntecedents ?? '');
    this.chronic.set(history.chronicConditions ?? '');
    this.allergy.set(allergy?.allergen ?? '');
    this.allergySeverity.set(allergy?.severity ?? '');
    this.allergyReaction.set(allergy?.reaction ?? '');
    this.diagnosisCode.set(diagnosis?.code ?? '');
    this.diagnosisDescription.set(diagnosis?.description ?? '');
    this.diagnosisDate.set(diagnosis?.diagnosedAt ?? '');
    this.medicationName.set(medication?.name ?? '');
    this.medicationDose.set(medication?.dose ?? '');
    this.medicationFrequency.set(medication?.frequency ?? '');
    this.observations.set(history.observations ?? '');
  }

  private resetPatientDetails(): void {
    this.history.set(null);
    this.quickSummary.set(null);
    this.timeline.set([]);
    this.medicalNotes.set([]);
    this.historyError.set('');
    this.quickSummaryError.set('');
    this.timelineError.set('');
    this.notesError.set('');
    this.noteError.set('');
    this.noteMessage.set('');
    this.historySaveError.set('');
    this.historyMessage.set('');
    this.resetHistoryForm();
  }

  private clearSelection(): void {
    this.selected.set(null);
    this.resetPatientDetails();
    this.historyLoading.set(false);
    this.quickSummaryLoading.set(false);
    this.timelineLoading.set(false);
    this.notesLoading.set(false);
  }

  private resetPatientForm(): void {
    this.newDocumentType.set('CI');
    this.newDocument.set('');
    this.newFirstName.set('');
    this.newLastName.set('');
    this.newBirthDate.set('');
    this.newGender.set('');
    this.newPhone.set('');
    this.newEmail.set('');
  }

  private resetHistoryForm(): void {
    this.bloodType.set('');
    this.pathological.set('');
    this.nonPathological.set('');
    this.family.set('');
    this.chronic.set('');
    this.allergy.set('');
    this.allergySeverity.set('');
    this.allergyReaction.set('');
    this.diagnosisCode.set('');
    this.diagnosisDescription.set('');
    this.diagnosisDate.set('');
    this.medicationName.set('');
    this.medicationDose.set('');
    this.medicationFrequency.set('');
    this.observations.set('');
  }

  private isCurrentDetail(patientId: string, requestId: number): boolean {
    return this.selected()?.id === patientId && this.detailRequestId === requestId;
  }

  private mapTimeline(event: TimelineEvent): TimelineItem {
    return {
      id: event.referenceId ?? `${event.occurredAt}-${event.eventType}-${event.code ?? ''}`,
      occurredAt: event.occurredAt,
      title: event.eventType || 'Evento clínico',
      description: event.description || 'Sin descripción',
      source: event.code || 'Historia clínica',
      status: event.status || 'Registrado',
    };
  }
}
