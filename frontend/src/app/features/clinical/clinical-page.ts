import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClinicalApiService, ClinicalHistory, ClinicalHistoryPayload, ApiPatient, TimelineEvent } from '../../core/api/clinical-api.service';
import { DocumentApiService, MedicalNote } from '../../core/api/document-api.service';
import { patients, Patient } from '../../core/data/nexodocs-data';

type ViewPatient = ApiPatient | Patient;

@Component({
  selector: 'app-clinical-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="clinical-page">
      <header class="clinical-header"><div class="clinical-icon">⚕</div><div>
        <p class="eyebrow">Expedientes · {{ isNotes() ? 'Notas médicas' : 'Expediente clínico' }}</p>
        <h1>{{ isNotes() ? 'Notas médicas' : 'Expediente clínico' }}</h1>
        <p>HU-03, HU-04 y HU-07 · información restringida al tenant activo y al rol autorizado.</p>
      </div></header>

      @if (apiError()) { <div class="state error" role="alert"><b>No fue posible consultar la API clínica.</b><span>{{ apiError() }}</span><button type="button" (click)="loadPatients()">Reintentar</button></div> }
      @if (loading()) { <div class="state" role="status">Cargando pacientes e historias clínicas…</div> }

      <section class="panel">
        <div class="panel-title"><div><h2>Buscar paciente</h2><p>Nombre o documento; la consulta se filtra en el tenant autenticado.</p></div><button class="primary" type="button" (click)="showNewPatient.set(!showNewPatient())">＋ Alta de paciente</button></div>
        <div class="search-bar"><span>⌕</span><input aria-label="Buscar paciente" placeholder="Nombre o CI…" [value]="searchTerm()" (input)="search($event)"></div>
        @if (usingDemo()) { <p class="demo-note">Modo demo: se muestran datos locales porque la API no respondió. No representan persistencia.</p> }
        <div class="patient-list">
          @for (patient of filteredPatients(); track patient.id) {
            <button class="patient-row" [class.selected]="selected()?.id === patient.id" (click)="select(patient)">
              <span class="avatar">{{ initials(label(patient)) }}</span><span class="patient-info"><b>{{ label(patient) }}</b><small>{{ document(patient) }} · {{ patient.gender }}</small></span><span>›</span>
            </button>
          } @empty { <div class="empty">No se encontraron pacientes.</div> }
        </div>
      </section>

      @if (showNewPatient()) {
        <section class="panel form-panel"><div class="panel-title"><div><h2>Alta de paciente</h2><p>HU-03 · se enviará a <code>POST /api/v1/patients</code>.</p></div></div>
          <div class="state">El alta se enviará al tenant autenticado. Requiere el permiso <code>patient:create</code>.</div>
          <div class="form-grid"><label>Tipo de documento<select disabled><option>CI</option></select></label><label>Número<input [value]="newDocument()" (input)="newDocument.set(value($event))"></label><label>Nombres<input [value]="newFirstName()" (input)="newFirstName.set(value($event))"></label><label>Apellidos<input [value]="newLastName()" (input)="newLastName.set(value($event))"></label><label>Fecha de nacimiento<input type="date" [value]="newBirthDate()" (input)="newBirthDate.set(value($event))"></label><label>Género<input [value]="newGender()" (input)="newGender.set(value($event))"></label></div>
          <button class="primary" type="button" (click)="createPatient()" [disabled]="!newDocument() || !newFirstName() || !newLastName()">Guardar alta</button>
        </section>
      }

      @if (isNotes()) {
        <section class="panel notes-panel">
          <div class="panel-title"><div><h2>Registrar nota médica</h2><p>HU-08 · notas inmutables persistidas en la historia seleccionada.</p></div><span class="badge">API clínica</span></div>
          <div class="form-grid"><label>Paciente<select disabled><option>{{ selected() ? label(selected()!) : 'Selecciona un paciente' }}</option></select></label><label>Tipo de nota<select [value]="noteType()" (change)="noteType.set(value($event))"><option value="EVOLUTION">Evolución</option><option value="CONSULTATION">Consulta</option><option value="ASSESSMENT">Evaluación</option></select></label><label class="wide">Título<input [value]="noteTitle()" (input)="noteTitle.set(value($event))" placeholder="Motivo o encabezado de la nota"></label><label class="wide">Contenido<textarea [value]="noteBody()" (input)="noteBody.set(value($event))" placeholder="Describe hallazgos, indicaciones y seguimiento"></textarea></label></div>
          <button class="primary" type="button" (click)="saveDemoNote()" [disabled]="!history() || !noteTitle() || !noteBody() || saving()">{{ saving() ? 'Guardando…' : 'Guardar nota' }}</button>
          @if (noteMessage()) { <p class="success" role="status">{{ noteMessage() }}</p> }
          @for (note of medicalNotes(); track note.id) { <article class="summary"><b>{{ note.noteType }} · {{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</b><span>{{ note.content }}</span></article> }
        </section>
      }

      @if (selected(); as patient) {
        <section class="detail-grid">
          <article class="panel"><div class="panel-title"><div><h2>{{ label(patient) }}</h2><p>{{ document(patient) }} · {{ status(patient) }}</p></div><span class="badge">Expediente único</span></div>
            <dl class="data"><div><dt>Fecha de nacimiento</dt><dd>{{ patient.birthDate | date:'dd/MM/yyyy' }}</dd></div><div><dt>Teléfono</dt><dd>{{ patient.phone || '—' }}</dd></div><div><dt>Correo</dt><dd>{{ patient.email || '—' }}</dd></div></dl>
          </article>
          <article class="panel"><div class="panel-title"><div><h2>Antecedentes y diagnósticos</h2><p>HU-04 · captura estructurada de la historia clínica.</p></div></div>
            @if (historyLoading()) { <div class="state">Cargando historia…</div> }
            @if (history(); as h) { <div class="summary"><b>Historia {{ h.code }}</b><span>{{ h.chronicConditions || 'Sin diagnósticos crónicos registrados' }}</span><span>Alergias: {{ allergyText(h) }}</span></div> }
            <div class="form-grid"><label>Tipo sanguíneo<input [value]="bloodType()" (input)="bloodType.set(value($event))"></label><label>Condiciones crónicas<input [value]="chronic()" (input)="chronic.set(value($event))"></label><label>Alergia / sustancia<input [value]="allergies()" (input)="allergies.set(value($event))" placeholder="Ej. penicilina"></label><label>Severidad<select [value]="allergySeverity()" (change)="allergySeverity.set(value($event))"><option value="">No indicada</option><option>LEVE</option><option>MODERADA</option><option>GRAVE</option></select></label><label class="wide">Reacción alérgica<input [value]="allergyReaction()" (input)="allergyReaction.set(value($event))" placeholder="Ej. urticaria"></label><label>Código diagnóstico<input [value]="diagnosisCode()" (input)="diagnosisCode.set(value($event))" placeholder="Ej. CIE-10"></label><label>Diagnóstico base<input [value]="diagnosisDescription()" (input)="diagnosisDescription.set(value($event))"></label><label>Medicamento actual<input [value]="medicationName()" (input)="medicationName.set(value($event))"></label><label>Dosis / frecuencia<input [value]="medicationDose()" (input)="medicationDose.set(value($event))" placeholder="500 mg cada 8 h"></label><label>Antecedentes patológicos<textarea [value]="pathological()" (input)="pathological.set(value($event))"></textarea></label><label>Antecedentes no patológicos<textarea [value]="nonPathological()" (input)="nonPathological.set(value($event))"></textarea></label><label>Antecedentes familiares<textarea [value]="family()" (input)="family.set(value($event))"></textarea></label><label>Observaciones<textarea [value]="observations()" (input)="observations.set(value($event))"></textarea></label></div>
            <button class="primary" type="button" (click)="saveHistory()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar historia clínica' }}</button>
            @if (saveMessage()) { <p class="success" role="status">{{ saveMessage() }}</p> }
          </article>
          <article class="panel timeline-panel"><div class="panel-title"><div><h2>Línea cronológica</h2><p>HU-07 · eventos disponibles para este expediente.</p></div></div>
            @if (timeline().length) { <div class="timeline">@for (event of timeline(); track event.date + event.title) { <div class="event"><i></i><div><time>{{ event.date | date:'dd/MM/yyyy' }}</time><b>{{ event.title }}</b><p>{{ event.description }}</p><small>{{ event.doctor }} · {{ event.status }}</small></div></div> }</div> } @else { <div class="empty">No hay eventos clínicos registrados.</div> }
          </article>
        </section>
      }
    </section>
  `,
  styles: [`
    .clinical-page{max-width:1440px;margin:auto;padding:30px 36px 48px}.clinical-header{display:flex;gap:14px;align-items:center;margin-bottom:22px}.clinical-icon{background:#dff7f3;border-radius:14px;padding:15px;font-size:25px}.eyebrow{color:#087f7b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.clinical-header h1{margin:5px 0;color:#153a39;font-size:34px;letter-spacing:-.04em}.clinical-header p:last-child{color:#6b8583;font-size:13px}.panel{background:#fff;border:1px solid #dcebe8;border-radius:16px;padding:20px;margin-bottom:18px}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:15px}.panel h2{font-size:16px;margin:0 0 4px;color:#153a39}.panel-title p{font-size:11px;color:#6b8583;margin:0}.primary{background:#087f7b;color:white;border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary:disabled{opacity:.55}.search-bar{display:flex;align-items:center;background:#f8fbfa;border:1px solid #dcebe8;border-radius:11px;padding:0 12px}.search-bar input{border:0;background:transparent;outline:0;height:44px;width:100%;padding-left:10px}.patient-list{display:grid;gap:3px;margin-top:12px}.patient-row{display:flex;align-items:center;gap:12px;text-align:left;background:transparent;border:1px solid transparent;border-radius:10px;padding:10px;cursor:pointer;color:#153a39}.patient-row:hover,.patient-row.selected{background:#dff7f3;border-color:#bfeae5}.avatar{background:#d5f5f1;color:#087f7b;border-radius:50%;height:38px;width:38px;display:grid;place-items:center;font-weight:800}.patient-info{display:grid;gap:4px;flex:1}.patient-info small,.empty{color:#6b8583;font-size:11px}.state{background:#eef7ff;border:1px solid #cfe3f5;border-radius:10px;color:#356d9e;padding:12px;margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap}.state.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}.state.warning{background:#fff8e8;border-color:#f3e1b6;color:#8b671c}.state button{border:0;background:transparent;text-decoration:underline;color:inherit;cursor:pointer}.demo-note,.success{color:#6b8583;font-size:11px}.detail-grid{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(360px,1.2fr);gap:18px}.timeline-panel{grid-column:1/-1}.badge{background:#dff7f3;color:#087f7b;border-radius:99px;padding:5px 9px;font-size:10px;font-weight:800}.data{display:grid;grid-template-columns:1fr 1fr;gap:12px}.data dt{font-size:10px;color:#6b8583;text-transform:uppercase;font-weight:800}.data dd{margin:4px 0;color:#153a39;font-size:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px}.form-grid label{display:grid;gap:5px;font-size:11px;color:#6b8583;font-weight:800}.form-grid input,.form-grid select,.form-grid textarea{border:1px solid #dcebe8;border-radius:8px;padding:9px;color:#153a39;min-width:0}.form-grid textarea{min-height:70px;resize:vertical}.form-grid .wide{grid-column:1/-1}.summary{display:grid;gap:5px;background:#f8fbfa;border-radius:9px;padding:11px;margin-bottom:15px;font-size:11px;color:#6b8583}.timeline{display:grid;gap:0}.event{display:flex;gap:13px;border-bottom:1px solid #edf3f1;padding:10px 0}.event i{width:11px;height:11px;border-radius:50%;background:#087f7b;margin-top:4px;flex:0 0 auto}.event div{display:grid;gap:4px}.event time,.event small{color:#6b8583;font-size:10px}.event p{margin:0;color:#466765;font-size:11px}.event b{font-size:13px}@media(max-width:800px){.clinical-page{padding:22px 16px}.detail-grid{grid-template-columns:1fr}.timeline-panel{grid-column:auto}.form-grid,.data{grid-template-columns:1fr}.clinical-header{align-items:flex-start}.panel-title{align-items:flex-start;flex-direction:column}}
  `],
})
export class ClinicalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ClinicalApiService);
  private readonly documentApi = inject(DocumentApiService);
  readonly isNotes = signal(this.route.snapshot.data['mode'] === 'notes');
  readonly loading = signal(false); readonly historyLoading = signal(false); readonly saving = signal(false);
  readonly apiError = signal(''); readonly usingDemo = signal(false); readonly searchTerm = signal('');
  readonly patients = signal<ViewPatient[]>([]); readonly selected = signal<ViewPatient | null>(null); readonly history = signal<ClinicalHistory | null>(null);
  readonly showNewPatient = signal(false); readonly saveMessage = signal('');
  readonly newDocument = signal(''); readonly newFirstName = signal(''); readonly newLastName = signal(''); readonly newBirthDate = signal(''); readonly newGender = signal('');
  readonly bloodType = signal(''); readonly pathological = signal(''); readonly nonPathological = signal(''); readonly family = signal(''); readonly chronic = signal(''); readonly allergies = signal(''); readonly observations = signal('');
  readonly allergySeverity = signal(''); readonly allergyReaction = signal('');
  readonly diagnosisCode = signal(''); readonly diagnosisDescription = signal('');
  readonly medicationName = signal(''); readonly medicationDose = signal('');
  readonly noteTitle = signal(''); readonly noteBody = signal(''); readonly noteMessage = signal('');
  readonly noteType = signal('EVOLUTION'); readonly medicalNotes = signal<MedicalNote[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  readonly filteredPatients = computed(() => { const q = this.searchTerm().toLowerCase().trim(); return this.patients().filter(p => !q || this.label(p).toLowerCase().includes(q) || this.document(p).toLowerCase().includes(q)); });
  readonly timeline = signal<{date:string;title:string;description:string;doctor:string;status:string}[]>([]);

  constructor() { this.loadPatients(); }
  saveDemoNote(): void {
    const history = this.history();
    if (!history || 'events' in (this.selected() ?? {})) {
      this.noteMessage.set('Nota preparada en demo. Selecciona una historia cargada desde la API para persistirla.');
      return;
    }
    this.saving.set(true);
    this.documentApi.createMedicalNote({
      clinicalHistoryId: history.id,
      noteType: this.noteType(),
      content: `${this.noteTitle().trim()}\n${this.noteBody().trim()}`,
    }).subscribe({
      next: note => { this.medicalNotes.update(notes => [note, ...notes]); this.noteMessage.set('Nota médica guardada en la API para el tenant autenticado.'); this.noteTitle.set(''); this.noteBody.set(''); this.saving.set(false); },
      error: () => { this.noteMessage.set('No se pudo guardar la nota. Verifica medical_note:create; no se guardó localmente.'); this.saving.set(false); },
    });
  }
  loadPatients(): void { this.loading.set(true); this.apiError.set(''); this.api.patients(this.searchTerm()).subscribe({ next: r => { this.patients.set(r.content); this.usingDemo.set(false); this.loading.set(false); }, error: () => { this.patients.set(patients); this.usingDemo.set(true); this.apiError.set('Se habilitó la referencia local para continuar la revisión visual.'); this.loading.set(false); } }); }
  search(e: Event): void { this.searchTerm.set(this.value(e)); if (this.usingDemo()) return; if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer=setTimeout(()=>this.loadPatients(),300); }
  select(patient: ViewPatient): void { this.selected.set(patient); this.history.set(null); this.medicalNotes.set([]); this.timeline.set('events' in patient ? [...patient.events].sort((a,b) => b.date.localeCompare(a.date)).map(e=>({date:e.date,title:e.title,description:e.description,doctor:e.doctor,status:e.status})) : []); this.resetHistoryForm(); if ('events' in patient) return; this.historyLoading.set(true); this.api.histories(patient.id).subscribe({ next: r => { const h = r.content[0] ?? null; this.history.set(h); if (h) { this.fillHistory(h); this.api.timeline(h.id).subscribe({next: events => this.timeline.set(events.map(event => this.mapTimeline(event))), error: () => this.timeline.set([])}); if (this.isNotes()) this.documentApi.medicalNotes(h.id).subscribe({next: notes => this.medicalNotes.set(notes.content), error: () => this.medicalNotes.set([])}); } this.historyLoading.set(false); }, error: () => this.historyLoading.set(false) }); }
  createPatient(): void { this.api.createPatient({documentType:'CI',documentNumber:this.newDocument(),firstName:this.newFirstName(),lastName:this.newLastName(),birthDate:this.newBirthDate(),gender:this.newGender()}).subscribe({next:p=>{this.patients.update(x=>[p,...x]);this.showNewPatient.set(false)},error:()=>this.apiError.set('No se pudo completar el alta. Verifica la disponibilidad de la API y el permiso patient:create; no se guardó localmente.')}); }
  saveHistory(): void { const p=this.selected(); if(!p || 'events' in p) { this.saveMessage.set('La referencia demo es de solo lectura.'); return; } const payload: ClinicalHistoryPayload={patientId:p.id,bloodType:this.bloodType(),pathologicalAntecedents:this.pathological(),nonPathologicalAntecedents:this.nonPathological(),familyAntecedents:this.family(),allergies:this.allergies()?[{allergen:this.allergies().trim(),severity:this.allergySeverity(),reaction:this.allergyReaction()}]:[],chronicConditions:this.chronic(),currentMedications:this.medicationName()?[{name:this.medicationName().trim(),dose:this.medicationDose(),frequency:''}]:[],baseDiagnoses:this.diagnosisDescription()?[{code:this.diagnosisCode(),description:this.diagnosisDescription().trim(),diagnosedAt:new Date().toISOString().slice(0,10)}]:[],observations:this.observations()}; this.saving.set(true); const request=this.history()?this.api.updateHistory(this.history()!.id,payload):this.api.createHistory(payload); request.subscribe({next:h=>{this.history.set(h);this.fillHistory(h);this.saveMessage.set('Historia clínica guardada en la API para el tenant autenticado.');this.saving.set(false)},error:()=>{this.saveMessage.set('No se pudo guardar. Verifica permisos patient:create/patient:update.');this.saving.set(false)}}); }
  fillHistory(h: ClinicalHistory): void { const allergy=h.allergies[0];const diagnosis=h.baseDiagnoses?.[0];const medication=h.currentMedications[0];this.bloodType.set(h.bloodType??'');this.pathological.set(h.pathologicalAntecedents??'');this.nonPathological.set(h.nonPathologicalAntecedents??'');this.family.set(h.familyAntecedents??'');this.chronic.set(h.chronicConditions??'');this.allergies.set(allergy?.allergen??'');this.allergySeverity.set(allergy?.severity??'');this.allergyReaction.set(allergy?.reaction??'');this.diagnosisCode.set(diagnosis?.code??'');this.diagnosisDescription.set(diagnosis?.description??'');this.medicationName.set(medication?.name??'');this.medicationDose.set(medication?.dose??'');this.observations.set(h.observations??''); }
  resetHistoryForm(): void { [this.bloodType,this.pathological,this.nonPathological,this.family,this.chronic,this.allergies,this.allergySeverity,this.allergyReaction,this.diagnosisCode,this.diagnosisDescription,this.medicationName,this.medicationDose,this.observations].forEach(s=>s.set('')); this.saveMessage.set(''); }
  label(p: ViewPatient): string { return 'name' in p ? p.name : `${p.firstName} ${p.lastName}`; } document(p: ViewPatient): string { return 'documentId' in p ? p.documentId : `${p.documentType} ${p.documentNumber}`; } status(p: ViewPatient): string { return 'status' in p ? p.status : 'Demo local'; }
  mapTimeline(event: TimelineEvent): {date:string;title:string;description:string;doctor:string;status:string} { return { date: event.occurredAt, title: event.eventType || 'Evento clínico', description: event.description || 'Sin descripción', doctor: event.code || 'Historia clínica', status: event.status || 'Registrado' }; }
  initials(s:string):string{return s.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()} value(e:Event):string{return (e.target as HTMLInputElement|HTMLTextAreaElement).value} allergyText(h:ClinicalHistory):string{return h.allergies.length?h.allergies.map(a=>a.allergen).join(', '):'Ninguna registrada'}
}
