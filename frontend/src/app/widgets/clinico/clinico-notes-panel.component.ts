import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiPatient, ClinicalHistory } from '../../core/api/clinical-api.service';
import { MedicalNote } from '../../core/api/document-api.service';

@Component({
  selector: 'app-clinico-notes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel notes-panel" aria-labelledby="medical-note-title">
      <div class="panel-title">
        <div>
          <h2 id="medical-note-title">Registrar nota médica</h2>
          <p>HU-08 · la nota se guarda de forma inmutable en la historia seleccionada.</p>
        </div>
        <span class="badge">API clínica</span>
      </div>

      @if (noteError) { <div class="state error" role="alert">{{ noteError }}</div> }
      @if (noteMessage) { <p class="success" role="status">{{ noteMessage }}</p> }

      <form (submit)="saveNote.emit($event)">
        <div class="form-grid">
          <label>Paciente
            <input disabled [value]="selected ? (selected.firstName + ' ' + selected.lastName) : 'Selecciona un paciente'">
          </label>
          <label>Tipo de nota
            <select [ngModel]="noteType" (ngModelChange)="noteTypeChange.emit($event)" name="nt">
              <option value="EVOLUTION">Evolución</option>
              <option value="CONSULTATION">Consulta</option>
              <option value="ASSESSMENT">Evaluación</option>
            </select>
          </label>
          <label class="wide">Título
            <input required maxlength="200" [ngModel]="noteTitle" (ngModelChange)="noteTitleChange.emit($event)" name="ntitle" placeholder="Motivo o encabezado de la nota">
          </label>
          <label class="wide">Contenido
            <textarea required maxlength="20000" [ngModel]="noteBody" (ngModelChange)="noteBodyChange.emit($event)" name="nbody" placeholder="Describe hallazgos, indicaciones y seguimiento"></textarea>
          </label>
        </div>
        <button class="primary" type="submit" [disabled]="!history || savingNote || !noteTitle.trim() || !noteBody.trim()">
          {{ savingNote ? 'Guardando…' : 'Guardar nota' }}
        </button>
      </form>

      <div class="note-history" aria-live="polite">
        @if (notesLoading) {
          <div class="inline-state" role="status">Cargando notas médicas…</div>
        } @else if (notesError) {
          <div class="state error" role="alert">
            <span>{{ notesError }}</span>
            @if (history && selected) {
              <button type="button" (click)="retryNotes.emit()">Reintentar consulta</button>
            }
          </div>
        } @else {
          @for (note of medicalNotes; track note.id) {
            <article class="summary">
              <b>{{ note.noteType }} · {{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</b>
              <span class="multiline">{{ note.content }}</span>
            </article>
          } @empty {
            @if (selected && history) {
              <div class="empty">No hay notas médicas registradas para esta historia.</div>
            }
          }
        }
      </div>
    </section>
  `
})
export class ClinicoNotesPanelComponent {
  @Input() selected: ApiPatient | null = null;
  @Input() history: ClinicalHistory | null = null;
  @Input() noteType = 'EVOLUTION';
  @Input() noteTitle = '';
  @Input() noteBody = '';
  @Input() savingNote = false;
  @Input() noteError: string | null = null;
  @Input() noteMessage: string | null = null;
  @Input() notesLoading = false;
  @Input() notesError: string | null = null;
  @Input() medicalNotes: MedicalNote[] = [];

  @Output() noteTypeChange = new EventEmitter<string>();
  @Output() noteTitleChange = new EventEmitter<string>();
  @Output() noteBodyChange = new EventEmitter<string>();
  @Output() saveNote = new EventEmitter<Event>();
  @Output() retryNotes = new EventEmitter<void>();
}
