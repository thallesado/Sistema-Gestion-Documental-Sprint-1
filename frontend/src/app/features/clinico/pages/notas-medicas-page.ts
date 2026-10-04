import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiPatient, ClinicalApiService, ClinicalHistory, MedicalNoteItem, MedicalNoteStatus } from '../../../core/api/clinical-api.service';

@Component({
  selector: 'app-notas-medicas-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <!-- Encabezado Corporativo NexoDocs -->
      <header class="dashboard-welcome">
        <div>
          <p class="eyebrow">MÓDULO CLÍNICO · NOTAS MÉDICAS</p>
          <h1>Formulario de Notas Médicas y Buscador de Pacientes</h1>
          <p class="welcome-copy">
            Búsqueda en tiempo real de pacientes y registro digital de notas de evolución médica y recetas con trazabilidad inmutable.
          </p>
        </div>
      </header>

      <!-- Buscador en Tiempo Real (Criterio 1 de HU-08) -->
      <section class="search-panel dashboard-card">
        <div class="search-header">
          <div>
            <h2>Buscador de Pacientes en Tiempo Real</h2>
            <small>Filtra instantáneamente por número de CI, nombres o apellidos del paciente</small>
          </div>
          <span class="realtime-badge">⚡ Búsqueda Reactiva</span>
        </div>

        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Escribe el CI (ej. 7845129) o nombre (ej. Valeria) para buscar..."
            autocomplete="off"
          />
          @if (searchQuery()) {
            <button type="button" class="clear-search-btn" (click)="searchQuery.set('')">✕</button>
          }
        </div>

        <!-- Resultados Rápidos del Buscador -->
        <div class="quick-results">
          @for (p of filteredPatients(); track p.id) {
            <button
              type="button"
              class="patient-pill"
              [class.active]="selectedPatient()?.id === p.id"
              (click)="selectPatient(p)"
            >
              <span class="pill-avatar">{{ getInitials(p.firstName, p.lastName) }}</span>
              <div class="pill-text">
                <strong>{{ p.firstName }} {{ p.lastName }}</strong>
                <small>{{ p.documentType }} {{ p.documentNumber }}</small>
              </div>
            </button>
          } @empty {
            <p class="no-results-msg">No se encontraron pacientes que coincidan con "{{ searchQuery() }}"</p>
          }
        </div>
      </section>

      <!-- Si hay un paciente seleccionado, mostramos su contexto y el formulario -->
      @if (selectedPatient(); as patient) {
        
        <!-- Ficha Resumen de Contexto Médico y Seguridad -->
        <div class="patient-context-banner">
          <div class="context-left">
            <div class="context-avatar">{{ getInitials(patient.firstName, patient.lastName) }}</div>
            <div>
              <h3>{{ patient.firstName }} {{ patient.lastName }}</h3>
              <p class="context-meta">
                <span><b>Doc:</b> {{ patient.documentType }} {{ patient.documentNumber }}</span>
                <span><b>Nacimiento:</b> {{ patient.birthDate ? (patient.birthDate | date:'dd/MM/yyyy') : 'No registrado' }}</span>
                <span><b>Género:</b> {{ patient.gender || 'Sin especificar' }}</span>
                @if (patientHistory()?.bloodType) {
                  <span class="blood-badge">Grupo: {{ patientHistory()?.bloodType }}</span>
                }
              </p>
            </div>
          </div>

          <div class="context-right">
            @if (patientHistory(); as history) {
              <div class="history-chip active">
                <span>Expediente: <strong>{{ history.code }}</strong></span>
                <small>Aperturado el {{ history.createdAt | date:'dd/MM/yyyy' }}</small>
              </div>
            } @else if (isLoadingHistory()) {
              <span class="history-chip loading">Consultando expediente...</span>
            } @else {
              <div class="history-chip warning">
                <span>Sin Expediente Base</span>
                <a [routerLink]="['/clinical/history']" [queryParams]="{ patientId: patient.id }">Aperturar historia clínica →</a>
              </div>
            }
          </div>
        </div>

        <!-- Alerta Crítica Preventiva de Alergias si existen -->
        @if (hasCriticalAllergies()) {
          <div class="critical-safety-alert">
            <div class="alert-icon">!</div>
            <div>
              <b>¡ALERTA DE SEGURIDAD PARA PRESCRIPCIÓN MÉDICA!</b>
              <p>El paciente presenta antecedentes de hipersensibilidad alta a: 
                <strong>{{ getCriticalAllergiesList() }}</strong>. Verifique antes de indicar medicamentos.
              </p>
            </div>
          </div>
        }

        <!-- Grid: Formulario a la Izquierda y Línea de Tiempo de Evolución a la Derecha -->
        <div class="notes-grid">
          
          <!-- Panel Izquierdo: Formulario de Redacción -->
          <section class="dashboard-card form-panel">
            <div class="panel-title">
              <div>
                <h2>Registrar Nota Médica / Receta</h2>
                <small>Evolución clínica estructurada vinculada inalterablemente al expediente</small>
              </div>
              <div class="status-selector">
                <button
                  type="button"
                  class="status-btn"
                  [class.active]="noteStatus() === 'DRAFT'"
                  (click)="noteStatus.set('DRAFT')"
                >
                  🟡 Borrador (DRAFT)
                </button>
                <button
                  type="button"
                  class="status-btn"
                  [class.active]="noteStatus() === 'APPROVED'"
                  (click)="noteStatus.set('APPROVED')"
                >
                  🟢 Vigente (Emitida)
                </button>
              </div>
            </div>

            <!-- Selector de Tipo de Nota -->
            <div class="type-tabs">
              <button
                type="button"
                class="tab-btn"
                [class.active]="noteType() === 'EVOLUTION'"
                (click)="noteType.set('EVOLUTION')"
              >
                🩺 Nota de Evolución
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="noteType() === 'PRESCRIPTION'"
                (click)="noteType.set('PRESCRIPTION')"
              >
                💊 Receta / Prescripción
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="noteType() === 'CONSULTATION'"
                (click)="noteType.set('CONSULTATION')"
              >
                📋 Consulta Médica
              </button>
            </div>

            @if (errorMessage()) {
              <div class="msg-box error">⚠️ {{ errorMessage() }}</div>
            }
            @if (successMessage()) {
              <div class="msg-box success">✓ {{ successMessage() }}</div>
            }

            <form [formGroup]="noteForm" (ngSubmit)="saveNote()">
              
              <!-- Título / Motivo Principal -->
              <div class="form-group">
                <label>
                  <span>Motivo de Consulta o Título de la Nota *</span>
                  <input
                    formControlName="title"
                    placeholder="Ej. Control de presión arterial y evolución favorable de cuadro respiratorio"
                  />
                </label>
              </div>

              <!-- Estructura Clínica SOAP -->
              <div class="soap-fields">
                <label>
                  <span class="soap-label">S - SUBJETIVO (Síntomas y relato del paciente)</span>
                  <textarea
                    formControlName="subjective"
                    rows="2"
                    (input)="autoResizeTextarea($event)"
                    placeholder="Paciente refiere que los síntomas han disminuido tras 48 horas..."
                  ></textarea>
                </label>

                <label>
                  <span class="soap-label">O - OBJETIVO (Signos vitales y examen físico)</span>
                  <textarea
                    formControlName="objective"
                    rows="2"
                    (input)="autoResizeTextarea($event)"
                    placeholder="PA: 120/80 mmHg, FC: 72 lpm, T: 36.5°C. Murmullo vesicular conservado..."
                  ></textarea>
                </label>

                <label>
                  <span class="soap-label">A - ANÁLISIS / DIAGNÓSTICO DE EVOLUCIÓN</span>
                  <textarea
                    formControlName="assessment"
                    rows="2"
                    (input)="autoResizeTextarea($event)"
                    placeholder="Evolución clínica favorable con buena tolerancia al esquema terapéutico..."
                  ></textarea>
                </label>

                <label>
                  <span class="soap-label">P - PLAN TERAPÉUTICO Y PRESCRIPCIÓN DE MEDICAMENTOS *</span>
                  <textarea
                    formControlName="plan"
                    rows="3"
                    (input)="autoResizeTextarea($event)"
                    placeholder="1. Continuar medicación habitual. 2. Paracetamol 500mg cada 8 horas si hay dolor. 3. Reevaluación en 7 días..."
                  ></textarea>
                </label>
              </div>

              <!-- Botones de Acción -->
              <div class="form-actions">
                <button type="button" class="cancel-btn" (click)="resetForm()">
                  Limpiar Formulario
                </button>
                <button
                  type="submit"
                  class="primary-btn"
                  [disabled]="noteForm.invalid || isSaving() || !patientHistory()"
                >
                  {{ isSaving() ? 'Guardando en Base de Datos...' : (noteStatus() === 'DRAFT' ? '💾 Guardar como Borrador' : '✍️ Firmar y Emitir Nota Médica') }}
                </button>
              </div>

              @if (!patientHistory() && !isLoadingHistory()) {
                <p class="warning-footer">
                  * Este paciente aún no cuenta con un expediente clínico base registrado. 
                  <a [routerLink]="['/clinical/history']" [queryParams]="{ patientId: patient.id }">Aperturar historia aquí</a> para poder registrar notas.
                </p>
              }

            </form>
          </section>

          <!-- Panel Derecho: Historial de Notas del Paciente -->
          <aside class="dashboard-card history-panel">
            <div class="panel-title">
              <div>
                <h2>Evolución Médica Cronológica</h2>
                <small>Historial inalterable de notas y recetas</small>
              </div>
              <span class="count-tag">{{ notesList().length }} nota(s)</span>
            </div>

            @if (isLoadingNotes()) {
              <div class="notes-state">
                <p>Cargando notas médicas del paciente...</p>
              </div>
            } @else if (notesList().length === 0) {
              <div class="notes-state empty">
                <div class="empty-icon">📝</div>
                <b>Sin notas registradas</b>
                <p>Aún no se han redactado notas de evolución o recetas para este paciente.</p>
              </div>
            } @else {
              <div class="timeline-list">
                @for (note of notesList(); track note.id) {
                  <div class="timeline-card" [class.draft-card]="note.status === 'DRAFT'" [class.voided-card]="note.status === 'VOIDED'">
                    <div class="timeline-card-header">
                      <div class="note-type-badge" [class.prescription]="note.noteType === 'PRESCRIPTION'">
                        {{ getNoteTypeLabel(note.noteType) }}
                      </div>
                      <span class="note-status-badge" [class.draft]="note.status === 'DRAFT'" [class.voided]="note.status === 'VOIDED'">
                        {{ getStatusLabel(note.status) }}
                      </span>
                      <small class="note-time">{{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</small>
                    </div>

                    <div class="note-body-content">
                      <pre>{{ note.content }}</pre>
                    </div>

                    <div class="note-card-footer">
                      <small>✍️ Médico Tratante: <strong>Laura Martínez</strong></small>
                      <div class="note-actions">
                        @if (note.status === 'DRAFT') {
                          <button type="button" class="action-btn approve-btn" [disabled]="isUpdatingStatus()" (click)="changeStatus(note, 'APPROVED')">
                            ✓ Emitir
                          </button>
                          <button type="button" class="action-btn void-btn" [disabled]="isUpdatingStatus()" (click)="changeStatus(note, 'VOIDED')">
                            ✕ Anular
                          </button>
                        }
                        <button type="button" class="print-note-btn" (click)="openPrintNote(note)">
                          🖨️ Imprimir
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </aside>

        </div>
      } @else {
        <!-- Estado Inicial: Seleccione un Paciente -->
        <div class="empty-selection-card dashboard-card">
          <div class="empty-icon-wrap">🔍</div>
          <h2>Selecciona un paciente en el buscador superior</h2>
          <p>Utiliza el buscador en tiempo real para localizar a un paciente por su CI o nombre e iniciar la redacción de sus notas médicas o recetas.</p>
        </div>
      }

      <!-- Modal Imprimir Nota / Receta -->
      @if (selectedNoteForPrint(); as note) {
        <div class="modal-backdrop" (click)="selectedNoteForPrint.set(null)">
          <div class="modal-card print-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Ficha Médica de Evolución</h2>
              <button type="button" class="close-btn" (click)="selectedNoteForPrint.set(null)">✕</button>
            </div>

            <div class="printable-doc" id="printable-note">
              <div class="doc-header">
                <div>
                  <h2 style="color: #087f7b; margin: 0;">NexoDocs Medical Suite</h2>
                  <small>Clínica FinoCode · Centro de Gestión Documental y Salud</small>
                </div>
                <div style="text-align: right;">
                  <b>{{ getNoteTypeLabel(note.noteType) | uppercase }}</b>
                  <p style="margin: 2px 0; font-size: 11px;">Fecha: {{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</p>
                </div>
              </div>

              <div class="doc-patient-box">
                <p><strong>Paciente:</strong> {{ selectedPatient()?.firstName }} {{ selectedPatient()?.lastName }}</p>
                <p><strong>Documento:</strong> {{ selectedPatient()?.documentType }} {{ selectedPatient()?.documentNumber }}</p>
                <p><strong>Expediente:</strong> {{ patientHistory()?.code || 'N/A' }}</p>
                <p><strong>Estado Nota:</strong> {{ getStatusLabel(note.status) }}</p>
              </div>

              <div class="doc-body">
                <h3>Contenido del Registro Médico</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6;">{{ note.content }}</pre>
              </div>

              <div class="doc-signature">
                <div class="sig-line">
                  <p>Dr(a). Laura Martínez</p>
                  <small>Médico Especialista · Reg. Profesional 45920-LP</small>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="cancel-btn" (click)="selectedNoteForPrint.set(null)">Cerrar</button>
              <button type="button" class="primary-btn" (click)="printCurrentNote()">Imprimir / Guardar PDF</button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .page { max-width: 1440px; margin: auto; padding: 30px 36px 48px; box-sizing: border-box; }
    .dashboard-welcome { margin-bottom: 24px; }
    .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #087f7b; text-transform: uppercase; margin: 0; }
    h1 { font-size: 34px; color: #153a39; margin: 5px 0; letter-spacing: -0.04em; }
    .welcome-copy { font-size: 13px; color: #6b8583; margin: 0; }

    /* Dashboard Card Base */
    .dashboard-card { background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px; box-sizing: border-box; }

    /* Search Panel */
    .search-panel { margin-bottom: 24px; }
    .search-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .search-header h2 { font-size: 18px; margin: 0 0 4px; color: #153a39; }
    .search-header small { color: #6b8583; font-size: 12px; }
    .realtime-badge { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 10px; }

    .search-input-wrap { position: relative; width: 100%; margin-bottom: 16px; }
    .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #8fa8a5; }
    .search-input-wrap input { width: 100%; border: 1px solid #dcebe8; border-radius: 10px; padding: 12px 40px 12px 42px; font-size: 14px; color: #153a39; background: #fff; outline: none; box-sizing: border-box; }
    .search-input-wrap input:focus { border-color: #087f7b; box-shadow: 0 0 0 2px rgba(8, 127, 123, 0.15); }
    .clear-search-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: 0; font-size: 16px; color: #8fa8a5; cursor: pointer; }

    .quick-results { display: flex; gap: 10px; flex-wrap: wrap; }
    .patient-pill { display: inline-flex; align-items: center; gap: 10px; background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 10px; padding: 8px 14px; cursor: pointer; text-align: left; transition: all 0.15s ease; font-family: inherit; }
    .patient-pill:hover { background: #eef8f6; border-color: #9dd8d1; }
    .patient-pill.active { background: #087f7b; color: #fff; border-color: #087f7b; box-shadow: 0 4px 12px rgba(8, 127, 123, 0.25); }
    .pill-avatar { width: 28px; height: 28px; border-radius: 50%; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 800; display: grid; place-items: center; }
    .patient-pill.active .pill-avatar { background: rgba(255,255,255,0.25); color: #fff; }
    .pill-text strong { display: block; font-size: 12px; }
    .pill-text small { display: block; font-size: 10px; opacity: 0.8; }
    .no-results-msg { color: #8fa8a5; font-size: 12px; margin: 6px 0; }

    /* Patient Context Banner */
    .patient-context-banner { background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
    .context-left { display: flex; align-items: center; gap: 16px; }
    .context-avatar { width: 48px; height: 48px; border-radius: 50%; background: #e6f7f5; color: #087f7b; font-size: 18px; font-weight: 800; display: grid; place-items: center; flex-shrink: 0; }
    .context-left h3 { margin: 0 0 4px; font-size: 18px; color: #153a39; }
    .context-meta { display: flex; gap: 12px; font-size: 12px; color: #6b8583; margin: 0; flex-wrap: wrap; }
    .blood-badge { background: #fee2e2; color: #991b1b; font-weight: 700; border-radius: 4px; padding: 1px 6px; }

    .history-chip { border-radius: 8px; padding: 8px 14px; font-size: 12px; text-align: right; }
    .history-chip.active { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .history-chip.active small { display: block; font-size: 10px; opacity: 0.85; }
    .history-chip.warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .history-chip.warning a { color: #087f7b; font-weight: 700; text-decoration: none; margin-left: 6px; }

    /* Critical Safety Alert */
    .critical-safety-alert { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 14px; color: #9f1239; }
    .alert-icon { width: 28px; height: 28px; border-radius: 50%; background: #e11d48; color: #fff; font-size: 14px; font-weight: 800; display: grid; place-items: center; flex-shrink: 0; }
    .critical-safety-alert b { font-size: 13px; }
    .critical-safety-alert p { margin: 4px 0 0; font-size: 12px; }

    /* Notes Grid */
    .notes-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(360px, 1fr); gap: 24px; }

    .panel-title { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
    .panel-title h2 { font-size: 18px; margin: 0 0 4px; color: #153a39; }
    .panel-title small { font-size: 12px; color: #6b8583; }

    /* Status Selector */
    .status-selector { display: flex; gap: 6px; }
    .status-btn { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: #475569; }
    .status-btn.active { background: #153a39; color: #fff; border-color: #153a39; }

    /* Type Tabs */
    .type-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
    .tab-btn { flex: 1; background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 12px; font-weight: 700; color: #4b6b69; cursor: pointer; transition: all 0.15s ease; font-family: inherit; }
    .tab-btn:hover { background: #eef8f6; }
    .tab-btn.active { background: #087f7b; color: #fff; border-color: #087f7b; box-shadow: 0 2px 8px rgba(8, 127, 123, 0.2); }

    /* Form Fields */
    .form-group { margin-bottom: 14px; }
    .form-group label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: #153a39; }
    .soap-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
    .soap-fields label { display: flex; flex-direction: column; gap: 5px; width: 100%; box-sizing: border-box; }
    .soap-label { font-size: 11px; font-weight: 800; color: #087f7b; text-transform: uppercase; letter-spacing: 0.04em; }

    input, select, textarea { border: 1px solid #dcebe8; border-radius: 8px; padding: 10px; font-size: 13px; color: #153a39; background: #fff; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; }
    input:focus, select:focus, textarea:focus { border-color: #087f7b; box-shadow: 0 0 0 2px rgba(8, 127, 123, 0.15); }
    textarea { resize: none; field-sizing: content; min-height: 64px; line-height: 1.5; overflow-y: hidden; }

    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #edf3f1; }
    .cancel-btn { background: #f1f5f9; color: #475569; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .primary-btn { background: #087f7b; color: #fff; border: 0; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(8, 127, 123, 0.25); text-decoration: none; }
    .primary-btn:hover { background: #066b67; }
    .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .warning-footer { font-size: 11px; color: #d97706; margin-top: 12px; }
    .warning-footer a { color: #087f7b; font-weight: 700; text-decoration: none; }

    .msg-box { border-radius: 8px; padding: 12px 16px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .msg-box.error { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }
    .msg-box.success { background: #dcfce7; border: 1px solid #bbf7d0; color: #166534; }

    /* Timeline History Panel */
    .history-panel { display: flex; flex-direction: column; }
    .count-tag { background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 10px; }
    .notes-state { padding: 40px 20px; text-align: center; color: #6b8583; font-size: 13px; }
    .notes-state.empty .empty-icon { font-size: 32px; margin-bottom: 8px; }

    .timeline-list { display: flex; flex-direction: column; gap: 14px; margin-top: 10px; max-height: 700px; overflow-y: auto; padding-right: 4px; }
    .timeline-card { background: #fbfdfc; border: 1px solid #dcebe8; border-radius: 12px; padding: 16px; transition: all 0.15s ease; }
    .timeline-card:hover { border-color: #9dd8d1; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .timeline-card.draft-card { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .timeline-card.voided-card { border-left: 4px solid #ef4444; background: #fef2f2; opacity: 0.85; }

    .timeline-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .note-type-badge { background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 800; border-radius: 4px; padding: 2px 6px; text-transform: uppercase; }
    .note-type-badge.prescription { background: #fef3c7; color: #92400e; }
    .note-status-badge { font-size: 10px; font-weight: 800; border-radius: 4px; padding: 2px 6px; background: #ecfdf5; color: #065f46; }
    .note-status-badge.draft { background: #fef3c7; color: #b45309; }
    .note-status-badge.voided { background: #fee2e2; color: #991b1b; }
    .note-time { margin-left: auto; color: #8fa8a5; font-size: 11px; }

    .note-body-content pre { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 12px; color: #1e293b; line-height: 1.5; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .note-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 11px; color: #64748b; flex-wrap: wrap; gap: 8px; }
    .note-actions { display: flex; align-items: center; gap: 6px; }
    .action-btn { border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .approve-btn { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .approve-btn:hover:not(:disabled) { background: #bbf7d0; }
    .void-btn { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .void-btn:hover:not(:disabled) { background: #fecaca; }
    .print-note-btn { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; color: #334155; cursor: pointer; }
    .print-note-btn:hover { background: #e2e8f0; }

    /* Empty Initial State */
    .empty-selection-card { text-align: center; padding: 60px 24px; }
    .empty-icon-wrap { font-size: 44px; margin-bottom: 12px; }
    .empty-selection-card h2 { font-size: 20px; color: #153a39; margin: 0 0 8px; }
    .empty-selection-card p { font-size: 13px; color: #6b8583; max-width: 500px; margin: auto; }

    /* Modal Imprimir */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-card { background: #fff; border-radius: 16px; max-width: 700px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); overflow: hidden; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; }
    .modal-header h2 { margin: 0; font-size: 18px; color: #153a39; }
    .close-btn { background: transparent; border: 0; font-size: 18px; color: #64748b; cursor: pointer; padding: 4px; }
    .printable-doc { padding: 24px; }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #087f7b; padding-bottom: 12px; }
    .doc-patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
    .doc-body h3 { font-size: 13px; color: #087f7b; margin: 0 0 8px; }
    .doc-signature { margin-top: 40px; display: flex; justify-content: flex-end; }
    .sig-line { width: 240px; text-align: center; border-top: 1px solid #000; padding-top: 6px; font-size: 11px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; }

    @media print {
      body * { visibility: hidden; }
      #printable-note, #printable-note * { visibility: visible; }
      #printable-note { position: absolute; left: 0; top: 0; width: 100%; }
    }
  `]
})
export class NotasMedicasPage implements OnInit {
  private readonly clinicalService = inject(ClinicalApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly patients = signal<ApiPatient[]>([]);
  readonly searchQuery = signal<string>('');
  readonly selectedPatient = signal<ApiPatient | null>(null);
  readonly patientHistory = signal<ClinicalHistory | null>(null);
  readonly notesList = signal<MedicalNoteItem[]>([]);

  readonly isLoadingPatients = signal<boolean>(true);
  readonly isLoadingHistory = signal<boolean>(false);
  readonly isLoadingNotes = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly noteType = signal<'EVOLUTION' | 'PRESCRIPTION' | 'CONSULTATION'>('EVOLUTION');
  readonly noteStatus = signal<MedicalNoteStatus>('APPROVED');
  readonly isUpdatingStatus = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly successMessage = signal<string>('');
  readonly selectedNoteForPrint = signal<MedicalNoteItem | null>(null);

  noteForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    subjective: [''],
    objective: [''],
    assessment: [''],
    plan: ['', Validators.required],
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

        // Preselección mediante queryParam ?patientId=...
        const paramPatientId = this.route.snapshot.queryParamMap.get('patientId');
        if (paramPatientId) {
          const matched = page.content.find((p) => p.id === paramPatientId);
          if (matched) {
            this.selectPatient(matched);
          }
        }
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar el padrón de pacientes.');
        this.isLoadingPatients.set(false);
      }
    });
  }

  filteredPatients(): ApiPatient[] {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.patients();
    return this.patients().filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.documentNumber.toLowerCase().includes(q)
    );
  }

  selectPatient(patient: ApiPatient) {
    this.selectedPatient.set(patient);
    this.resetForm();
    this.loadHistoryAndNotes(patient.id);
  }

  loadHistoryAndNotes(patientId: string) {
    this.isLoadingHistory.set(true);
    this.isLoadingNotes.set(true);
    this.patientHistory.set(null);
    this.notesList.set([]);

    this.clinicalService.histories(patientId).subscribe({
      next: (page) => {
        this.isLoadingHistory.set(false);
        const history = page.content && page.content.length > 0 ? page.content[0] : null;
        this.patientHistory.set(history);

        if (history) {
          this.loadNotes(history.id);
        } else {
          this.isLoadingNotes.set(false);
        }
      },
      error: () => {
        this.isLoadingHistory.set(false);
        this.isLoadingNotes.set(false);
      }
    });
  }

  loadNotes(historyId: string) {
    this.isLoadingNotes.set(true);
    this.clinicalService.notes(historyId).subscribe({
      next: (page) => {
        this.notesList.set(page.content || []);
        this.isLoadingNotes.set(false);
      },
      error: () => {
        this.isLoadingNotes.set(false);
      }
    });
  }

  hasCriticalAllergies(): boolean {
    const history = this.patientHistory();
    if (!history || !history.allergies) return false;
    return history.allergies.some((a) => a.severity === 'HIGH');
  }

  getCriticalAllergiesList(): string {
    const history = this.patientHistory();
    if (!history || !history.allergies) return '';
    return history.allergies
      .filter((a) => a.severity === 'HIGH')
      .map((a) => a.allergen)
      .join(', ');
  }

  autoResizeTextarea(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
    }
  }

  resetForm() {
    this.noteForm.reset({
      title: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    });
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  saveNote() {
    const history = this.patientHistory();
    if (!history) {
      this.errorMessage.set('Se requiere que el paciente tenga un expediente clínico aperturado previamente.');
      return;
    }

    if (this.noteForm.invalid) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formVal = this.noteForm.value;

    // Ensamblaje estructurado del contenido médico según SOAP (sin prefijos fake)
    let formattedContent = `${formVal.title.trim()}\n\n`;
    if (formVal.subjective?.trim()) {
      formattedContent += `[SUBJETIVO]\n${formVal.subjective.trim()}\n\n`;
    }
    if (formVal.objective?.trim()) {
      formattedContent += `[OBJETIVO]\n${formVal.objective.trim()}\n\n`;
    }
    if (formVal.assessment?.trim()) {
      formattedContent += `[DIAGNÓSTICO / EVOLUCIÓN]\n${formVal.assessment.trim()}\n\n`;
    }
    formattedContent += `[PLAN / PRESCRIPCIÓN]\n${formVal.plan.trim()}`;

    this.clinicalService.createNote({
      clinicalHistoryId: history.id,
      noteType: this.noteType(),
      content: formattedContent,
      status: this.noteStatus(),
    }).subscribe({
      next: (savedNote) => {
        this.isSaving.set(false);
        this.successMessage.set(
          this.noteStatus() === 'DRAFT'
            ? '¡Nota médica guardada como BORRADOR exitosamente!'
            : '¡Nota médica firmada y registrada como VIGENTE en el expediente!'
        );
        this.resetForm();
        this.loadNotes(history.id);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al guardar la nota médica en el servidor.');
      }
    });
  }

  changeStatus(note: MedicalNoteItem, targetStatus: MedicalNoteStatus) {
    const history = this.patientHistory();
    if (!history) return;
    this.isUpdatingStatus.set(true);
    this.clinicalService.updateNoteStatus(note.id, targetStatus).subscribe({
      next: () => {
        this.isUpdatingStatus.set(false);
        this.successMessage.set(
          targetStatus === 'APPROVED'
            ? 'Nota médica emitida como VIGENTE con éxito.'
            : 'Nota médica marcada como ANULADA.'
        );
        this.loadNotes(history.id);
      },
      error: (err: HttpErrorResponse) => {
        this.isUpdatingStatus.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al cambiar el estado de la nota.');
      }
    });
  }

  getStatusLabel(status: MedicalNoteStatus | string): string {
    switch (status) {
      case 'DRAFT': return '🟡 BORRADOR';
      case 'APPROVED': return '🟢 VIGENTE';
      case 'VOIDED': return '🔴 ANULADA';
      default: return status || '🟢 VIGENTE';
    }
  }

  getNoteTypeLabel(type: string): string {
    switch (type) {
      case 'EVOLUTION': return 'Nota de Evolución';
      case 'PRESCRIPTION': return 'Receta Médica';
      case 'CONSULTATION': return 'Consulta';
      default: return type;
    }
  }

  getInitials(firstName: string, lastName: string): string {
    const f = firstName ? firstName.charAt(0).toUpperCase() : '';
    const l = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${f}${l}` || 'P';
  }

  openPrintNote(note: MedicalNoteItem) {
    this.selectedNoteForPrint.set(note);
  }

  printCurrentNote() {
    window.print();
  }
}
