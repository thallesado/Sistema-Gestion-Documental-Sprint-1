import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { patients, Patient, ClinicalEvent } from '../../core/data/nexodocs-data';

@Component({
  selector: 'app-clinical-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="clinical-page">
      <header class="clinical-header">
        <div class="clinical-icon">⚕</div>
        <div class="clinical-heading">
          <p class="eyebrow">Expedientes · Expediente clínico</p>
          <h1>Expediente Clínico</h1>
          <p>Visualiza la historia clínica del paciente y registra notas de evolución.</p>
        </div>
      </header>

      <!-- ── Buscador de Pacientes ── -->
      <section class="panel search-panel">
        <div class="panel-title">
          <div><h2>Buscador de pacientes</h2><p>Busca por nombre o documento de identidad</p></div>
          <span class="patient-count">{{ filteredPatients().length }} pacientes encontrados</span>
        </div>
        <div class="search-bar">
          <span class="search-icon">⌕</span>
          <input
            placeholder="Escribe el nombre o CI del paciente..."
            [value]="searchTerm()"
            (input)="onSearch($event)"
            aria-label="Buscar paciente"
          />
          @if (searchTerm()) {
            <button type="button" class="clear-search" (click)="clearSearch()" aria-label="Limpiar búsqueda">✕</button>
          }
        </div>
        <div class="patient-list">
          @for (patient of filteredPatients(); track patient.id) {
            <article
              class="patient-row"
              [class.selected]="selectedPatient()?.id === patient.id"
              (click)="selectPatient(patient)"
            >
              <span class="patient-avatar">{{ initials(patient.name) }}</span>
              <div class="patient-info">
                <h3>{{ patient.name }}</h3>
                <p>CI: {{ patient.documentId }} · {{ patient.gender }} · {{ age(patient.birthDate) }} años · {{ patient.bloodType }}</p>
              </div>
              <span class="patient-events-count">{{ patient.events.length }} {{ patient.events.length === 1 ? 'evento' : 'eventos' }}</span>
              <span class="patient-chevron">›</span>
            </article>
          } @empty {
            <div class="empty-state"><strong>No se encontraron pacientes</strong><span>Intenta con otro nombre o número de documento.</span></div>
          }
        </div>
      </section>

      <!-- ── Detalle del Paciente Seleccionado ── -->
      @if (selectedPatient()) {
        <div class="patient-detail-grid">
          <!-- Ficha del paciente -->
          <section class="panel patient-card">
            <div class="panel-title"><div><h2>Ficha del paciente</h2><p>Información personal y de contacto</p></div>
              <a [href]="pdfUrl(selectedPatient()!)" target="_blank" class="view-pdf-button">▤ Ver historia clínica PDF</a>
            </div>
            <div class="patient-data">
              <dl>
                <div><dt>Nombre completo</dt><dd>{{ selectedPatient()!.name }}</dd></div>
                <div><dt>Documento de identidad</dt><dd>{{ selectedPatient()!.documentId }}</dd></div>
                <div><dt>Fecha de nacimiento</dt><dd>{{ formatDate(selectedPatient()!.birthDate) }}</dd></div>
                <div><dt>Edad</dt><dd>{{ age(selectedPatient()!.birthDate) }} años</dd></div>
                <div><dt>Género</dt><dd>{{ selectedPatient()!.gender }}</dd></div>
                <div><dt>Tipo de sangre</dt><dd><span class="blood-badge">{{ selectedPatient()!.bloodType }}</span></dd></div>
                <div><dt>Teléfono</dt><dd>{{ selectedPatient()!.phone }}</dd></div>
                <div><dt>Email</dt><dd>{{ selectedPatient()!.email }}</dd></div>
                <div class="full-width"><dt>Dirección</dt><dd>{{ selectedPatient()!.address }}</dd></div>
                <div><dt>Seguro médico</dt><dd>{{ selectedPatient()!.insuranceProvider }}</dd></div>
              </dl>
            </div>
          </section>

          <!-- Línea de tiempo del expediente clínico (HU-07) -->
          <section class="panel timeline-panel">
            <div class="panel-title">
              <div><h2>Expediente cronológico</h2><p>Historia clínica ordenada por fecha</p></div>
              <span class="status review">{{ selectedPatient()!.events.length }} registros</span>
            </div>
            <div class="timeline">
              @for (event of selectedPatient()!.events; track $index) {
                <article class="timeline-event">
                  <div class="timeline-connector">
                    <span class="timeline-dot" [class]="eventDotClass(event)"></span>
                    @if (!$last) { <span class="timeline-line"></span> }
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="event-type-badge" [class]="eventTypeClass(event)">{{ event.type }}</span>
                      <time>{{ formatDate(event.date) }}</time>
                    </div>
                    <h3>{{ event.title }}</h3>
                    <p>{{ event.description }}</p>
                    <div class="event-footer">
                      <span class="event-doctor">👤 {{ event.doctor }}</span>
                      <span [class]="eventStatusClass(event)">{{ event.status }}</span>
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        </div>

        <!-- Formulario de Notas Médicas (HU-08) -->
        <section class="panel notes-form-panel">
            <div class="panel-title"><div><h2>Registrar nota de evolución</h2><p>Paciente: {{ selectedPatient()!.name }} — CI: {{ selectedPatient()!.documentId }}</p></div></div>
            <form class="notes-form" (submit)="$event.preventDefault(); saveNote()">
              <div class="notes-form-fields">
                <label>Tipo de evento *
                  <select [value]="noteType()" (change)="noteType.set(asSelectValue($event))">
                    <option value="Consulta">Consulta</option>
                    <option value="Nota de evolución">Nota de evolución</option>
                    <option value="Laboratorio">Laboratorio</option>
                    <option value="Imagen">Imagen</option>
                    <option value="Receta">Receta</option>
                    <option value="Cirugía">Cirugía</option>
                    <option value="Urgencia">Urgencia</option>
                    <option value="Ecografía">Ecografía</option>
                  </select>
                </label>
                <label>Título de la nota *
                  <input placeholder="Ej. Control de rutina" [value]="noteTitle()" (input)="noteTitle.set(asInputValue($event))" />
                </label>
                <label>Médico responsable *
                  <input placeholder="Ej. Dr. Carlos Mendoza" [value]="noteDoctor()" (input)="noteDoctor.set(asInputValue($event))" />
                </label>
                <label>Estado
                  <select [value]="noteStatus()" (change)="noteStatus.set(asSelectValue($event))">
                    <option value="Completado">Completado</option>
                    <option value="En tratamiento">En tratamiento</option>
                    <option value="Vigente">Vigente</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </label>
              </div>
              <label class="full-label">Descripción clínica *
                <textarea rows="4" placeholder="Escriba la descripción detallada de la nota médica..." [value]="noteDescription()" (input)="noteDescription.set(asTextareaValue($event))"></textarea>
              </label>
              <div class="form-actions">
                <button type="button" class="cancel-button" (click)="resetNoteForm()">Cancelar</button>
                <button type="submit" [disabled]="!isNoteValid()">Guardar nota de evolución</button>
              </div>
            </form>
          </section>
      }

      @if (actionMessage()) { <div class="inline-toast" role="status">{{ actionMessage() }}</div> }
      <footer class="demo-note"><span>ⓘ</span> Módulo clínico opcional con datos simulados de <b>Acme Consulting</b>. Los PDFs se sirven desde el backend estático.</footer>
    </section>
  `,
  styles: [`
    :host {
      --ink: #153a39;
      --muted: #6b8583;
      --line: #dcebe8;
      --surface: #fff;
      --canvas: #f6faf9;
      --teal: #087f7b;
      --teal-strong: #05635f;
      --mint: #dff7f3;
    }

    .clinical-page { margin: 0 auto; max-width: 1440px; padding: 30px 36px 42px; }

    .clinical-header { align-items: flex-end; display: flex; gap: 14px; margin: 4px 0 22px; }
    .clinical-icon { align-items: center; background: var(--mint); border-radius: 14px; color: var(--teal); display: flex; flex: 0 0 auto; font-size: 26px; height: 54px; justify-content: center; width: 54px; }
    .clinical-heading { flex: 1; }
    .clinical-heading .eyebrow { color: #0f9d9a; font-size: 11px; font-weight: 800; letter-spacing: .08em; margin: 0 0 7px; text-transform: uppercase; }
    .clinical-heading h1 { color: #163a39; font-size: clamp(26px, 3vw, 34px); letter-spacing: -.04em; margin: 0 0 7px; }
    .clinical-heading p { color: var(--muted); font-size: 13px; line-height: 1.6; margin: 0; }

    .panel { background: #fff; border: 1px solid var(--line); border-radius: 17px; box-shadow: 0 5px 16px rgba(20,78,75,.035); padding: 20px; margin-bottom: 18px; }
    .panel-title { align-items: center; display: flex; gap: 15px; justify-content: space-between; margin-bottom: 16px; }
    .panel-title h2 { color: #163a39; font-size: 16px; margin: 0 0 4px; }
    .panel-title p { color: var(--muted); font-size: 11px; margin: 0; }

    /* ── Buscador ── */
    .search-bar { align-items: center; display: flex; position: relative; margin-bottom: 14px; }
    .search-icon { color: #87a3a1; font-size: 23px; left: 14px; line-height: 1; position: absolute; top: 10px; }
    .search-bar input { background: #f8fbfa; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); font-size: 14px; height: 46px; outline: none; padding: 0 40px 0 42px; width: 100%; }
    .search-bar input:focus { border-color: #0f9d9a; box-shadow: 0 0 0 3px rgba(15,157,154,.12); }
    .clear-search { background: transparent; border: 0; color: var(--muted); cursor: pointer; font-size: 16px; position: absolute; right: 14px; top: 12px; }
    .patient-count { background: var(--mint); border-radius: 999px; color: var(--teal); font-size: 11px; font-weight: 800; padding: 5px 12px; white-space: nowrap; }

    /* ── Lista de pacientes ── */
    .patient-list { display: grid; gap: 2px; max-height: 420px; overflow-y: auto; }
    .patient-row { align-items: center; border: 1px solid transparent; border-radius: 12px; cursor: pointer; display: flex; gap: 12px; padding: 12px 14px; transition: all .15s; }
    .patient-row:hover { background: #fbfefd; border-color: var(--line); }
    .patient-row.selected { background: var(--mint); border-color: #bfeae5; }
    .patient-avatar { align-items: center; background: #d5f5f1; border-radius: 50%; color: var(--teal); display: inline-flex; flex: 0 0 auto; font-size: 11px; font-weight: 900; height: 40px; justify-content: center; width: 40px; }
    .patient-row.selected .patient-avatar { background: var(--teal); color: #fff; }
    .patient-info { flex: 1; min-width: 0; }
    .patient-info h3 { color: #244b49; font-size: 13px; margin: 0 0 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .patient-info p { color: #8aa19f; font-size: 10px; margin: 0; }
    .patient-events-count { color: var(--muted); font-size: 10px; font-weight: 700; white-space: nowrap; }
    .patient-chevron { color: #aac0bd; font-size: 22px; }

    /* ── Detalle del paciente ── */
    .patient-detail-grid { display: grid; gap: 18px; grid-template-columns: minmax(320px, .9fr) minmax(0, 1.3fr); }

    /* ── Ficha ── */
    .patient-data dl { display: grid; gap: 1px; grid-template-columns: 1fr 1fr; }
    .patient-data dl > div { border-bottom: 1px solid #edf3f1; padding: 10px 0; }
    .patient-data dl > div.full-width { grid-column: 1 / -1; }
    .patient-data dt { color: var(--muted); font-size: 10px; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .06em; }
    .patient-data dd { color: var(--ink); font-size: 12px; font-weight: 600; margin: 0; }
    .blood-badge { background: #fee2e2; border-radius: 6px; color: #b91c1c; font-size: 11px; font-weight: 900; padding: 3px 8px; }
    .view-pdf-button { align-items: center; background: var(--teal); border: 0; border-radius: 9px; color: #fff; cursor: pointer; display: inline-flex; font-size: 11px; font-weight: 800; gap: 5px; padding: 9px 13px; text-decoration: none; white-space: nowrap; }
    .view-pdf-button:hover { background: var(--teal-strong); }

    /* ── Timeline ── */
    .timeline { display: grid; gap: 0; }
    .timeline-event { display: flex; gap: 16px; }
    .timeline-connector { align-items: center; display: flex; flex-direction: column; padding-top: 4px; width: 20px; }
    .timeline-dot { border-radius: 50%; flex: 0 0 auto; height: 12px; width: 12px; }
    .timeline-dot.consulta { background: #0f9d9a; }
    .timeline-dot.laboratorio { background: #6366f1; }
    .timeline-dot.receta { background: #f59e0b; }
    .timeline-dot.imagen { background: #3b82f6; }
    .timeline-dot.cirugia { background: #ef4444; }
    .timeline-dot.urgencia { background: #dc2626; }
    .timeline-dot.nota { background: #8b5cf6; }
    .timeline-dot.otro { background: #64748b; }
    .timeline-line { background: #dcebe8; flex: 1; min-height: 20px; width: 2px; }
    .timeline-content { border-bottom: 1px solid #edf3f1; flex: 1; padding-bottom: 18px; margin-bottom: 4px; }
    .timeline-event:last-child .timeline-content { border-bottom: 0; }
    .timeline-header { align-items: center; display: flex; gap: 10px; margin-bottom: 8px; }
    .timeline-header time { color: #78918f; font-size: 10px; margin-left: auto; }
    .timeline-content h3 { color: #244b49; font-size: 13px; margin: 0 0 6px; }
    .timeline-content p { color: #66817f; font-size: 11px; line-height: 1.65; margin: 0 0 10px; }
    .event-type-badge { border-radius: 6px; font-size: 10px; font-weight: 800; padding: 4px 9px; }
    .event-type-badge.type-consulta { background: var(--mint); color: var(--teal); }
    .event-type-badge.type-laboratorio { background: #eef2ff; color: #4f46e5; }
    .event-type-badge.type-receta { background: #fef3c7; color: #92400e; }
    .event-type-badge.type-imagen, .event-type-badge.type-ecografia, .event-type-badge.type-espirometria { background: #dbeafe; color: #1d4ed8; }
    .event-type-badge.type-cirugia { background: #fee2e2; color: #b91c1c; }
    .event-type-badge.type-urgencia { background: #fef2f2; color: #dc2626; }
    .event-type-badge.type-nota { background: #f3e8ff; color: #7c3aed; }
    .event-type-badge.type-otro { background: #f1f5f9; color: #475569; }
    .event-footer { align-items: center; display: flex; gap: 12px; }
    .event-doctor { color: #8aa19f; font-size: 10px; }

    /* ── Status badges ── */
    .status { border-radius: 999px; font-size: 10px; font-weight: 900; padding: 5px 9px; white-space: nowrap; }
    .status.ok { background: #dcfce7; color: #166534; }
    .status.review { background: #dbeafe; color: #1d4ed8; }
    .status.pending { background: #fef3c7; color: #92400e; }
    .status.danger { background: #fee2e2; color: #b91c1c; }
    .status.muted { background: #f1f5f9; color: #475569; }
    .status.active { background: #dff7f3; color: #05635f; }

    /* ── Formulario de notas ── */
    .notes-form { display: grid; gap: 16px; }
    .notes-form-fields { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .notes-form label, .full-label { color: #315a57; display: grid; font-size: 11px; font-weight: 800; gap: 6px; }
    .notes-form input, .notes-form select, .notes-form textarea { background: #f8fbfa; border: 1px solid var(--line); border-radius: 9px; color: var(--ink); font: inherit; outline: none; padding: 10px; width: 100%; }
    .notes-form input:focus, .notes-form select:focus, .notes-form textarea:focus { border-color: #0f9d9a; box-shadow: 0 0 0 3px rgba(15,157,154,.1); }
    .notes-form textarea { resize: vertical; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .form-actions .cancel-button { background: #fff; border: 1px solid var(--line); border-radius: 10px; color: #5a7775; cursor: pointer; font-size: 11px; font-weight: 800; padding: 10px 14px; }
    .form-actions button[type="submit"] { background: #0f9d9a; border: 0; border-radius: 10px; color: #fff; cursor: pointer; font-size: 12px; font-weight: 800; padding: 11px 14px; }
    .form-actions button[type="submit"]:disabled { opacity: .5; cursor: not-allowed; }

    /* ── Toast y notas ── */
    .inline-toast { background: #eafaf7; border: 1px solid #bfeae5; border-radius: 9px; color: #17635f; font-size: 11px; font-weight: 700; margin-top: 14px; padding: 10px 12px; }
    .demo-note { align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 11px; color: #78918f; display: flex; font-size: 10px; gap: 5px; margin-top: 17px; padding: 11px 13px; }
    .demo-note span { color: #0f9d9a; font-size: 14px; }
    .empty-state { color: var(--muted); display: grid; gap: 6px; justify-items: center; padding: 34px 20px; text-align: center; }
    .empty-state strong { color: var(--ink); font-size: 13px; }
    .empty-state span { font-size: 11px; }

    @media (max-width: 900px) {
      .patient-detail-grid { grid-template-columns: 1fr; }
      .notes-form-fields { grid-template-columns: 1fr; }
    }
    @media (max-width: 620px) {
      .clinical-page { padding: 20px 14px 30px; }
      .clinical-header { flex-direction: column; align-items: flex-start; }
      .patient-data dl { grid-template-columns: 1fr; }
    }
  `],
})
export class ClinicalPage {
  private readonly route = inject(ActivatedRoute);
  readonly searchTerm = signal('');
  readonly selectedPatient = signal<Patient | null>(null);
  readonly actionMessage = signal('');

  // Form signals for HU-08
  readonly noteType = signal('Consulta');
  readonly noteTitle = signal('');
  readonly noteDoctor = signal('');
  readonly noteStatus = signal('Completado');
  readonly noteDescription = signal('');

  readonly allPatients = patients;

  readonly filteredPatients = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return this.allPatients;
    return this.allPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.documentId.includes(query),
    );
  });

  readonly isNoteValid = computed(() =>
    this.noteTitle().trim() !== '' &&
    this.noteDoctor().trim() !== '' &&
    this.noteDescription().trim() !== ''
  );

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  selectPatient(patient: Patient): void {
    this.selectedPatient.set(patient);
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  age(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    return a;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  pdfUrl(patient: Patient): string {
    return `/docs/${patient.pdfFile}`;
  }

  eventDotClass(event: ClinicalEvent): string {
    const t = event.type.toLowerCase();
    if (t.includes('consulta')) return 'consulta';
    if (t.includes('laboratorio')) return 'laboratorio';
    if (t.includes('receta')) return 'receta';
    if (t.includes('imagen') || t.includes('ecograf') || t.includes('espiro') || t.includes('densito') || t.includes('radiograf')) return 'imagen';
    if (t.includes('cirug')) return 'cirugia';
    if (t.includes('urgencia')) return 'urgencia';
    if (t.includes('nota')) return 'nota';
    return 'otro';
  }

  eventTypeClass(event: ClinicalEvent): string {
    return 'event-type-badge type-' + this.eventDotClass(event);
  }

  eventStatusClass(event: ClinicalEvent): string {
    const s = event.status;
    if (['Completado'].includes(s)) return 'status ok';
    if (['En tratamiento', 'Vigente'].includes(s)) return 'status active';
    if (['Pendiente'].includes(s)) return 'status pending';
    if (['Vencida'].includes(s)) return 'status danger';
    return 'status muted';
  }

  saveNote(): void {
    if (!this.isNoteValid() || !this.selectedPatient()) return;
    const patient = this.selectedPatient()!;
    const newEvent: ClinicalEvent = {
      date: new Date().toISOString().split('T')[0],
      type: this.noteType(),
      title: this.noteTitle(),
      description: this.noteDescription(),
      doctor: this.noteDoctor(),
      status: this.noteStatus(),
    };
    patient.events.unshift(newEvent);
    this.selectedPatient.set({ ...patient });
    this.resetNoteForm();
    this.showToast(`Nota de evolución "${newEvent.title}" registrada para ${patient.name} (demo local)`);
  }

  resetNoteForm(): void {
    this.noteType.set('Consulta');
    this.noteTitle.set('');
    this.noteDoctor.set('');
    this.noteStatus.set('Completado');
    this.noteDescription.set('');
  }

  showToast(message: string): void {
    this.actionMessage.set(message);
    setTimeout(() => this.actionMessage.set(''), 5000);
  }

  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asSelectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  asTextareaValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
