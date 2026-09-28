import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiPatient, ClinicalApiService, ClinicalHistory, ClinicalHistoryPayload } from '../../../core/api/clinical-api.service';

@Component({
  selector: 'app-antecedentes-page',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  template: `
    <div class="page">
      <!-- Encabezado corporativo estilo NexoDocs -->
      <header class="dashboard-welcome">
        <div>
          <p class="eyebrow">MÓDULO CLÍNICO · HISTORIA CLÍNICA</p>
          <h1>Captura de Antecedentes y Anamnesis</h1>
          <p class="welcome-copy">
            Registro estructurado de diagnósticos base, antecedentes patológicos, alergias y medicación vinculados al expediente único del paciente.
          </p>
        </div>
      </header>

      <!-- Grid principal: Formulario a la izquierda y Panel de Trazabilidad a la derecha -->
      <div class="content-grid">
        
        <!-- Formulario Principal -->
        <section class="dashboard-card form-panel">
          <div class="form-title">
            <div>
              <h2>Expediente Clínico del Paciente</h2>
              @if (currentHistory(); as history) {
                <span class="status-badge edit">
                  ● MODO EDICIÓN: {{ history.code }} (Registrado el {{ history.createdAt | date:'dd/MM/yyyy' }})
                </span>
              } @else if (selectedPatient()) {
                <span class="status-badge new">
                  ● MODO APERTURA: Nuevo Expediente Clínico
                </span>
              } @else {
                <span class="required-note">Seleccione un paciente para comenzar</span>
              }
            </div>

            @if (currentHistory()) {
              <button type="button" class="preview-btn" (click)="openPreviewModal()">
                🖨️ Imprimir / Ficha Médica
              </button>
            }
          </div>

          @if (isLoadingPatients()) {
            <p style="color: #6b8583; font-size: 13px;">Cargando lista de pacientes de la clínica...</p>
          } @else {
            <form [formGroup]="historyForm" (ngSubmit)="saveHistory()">
              
              <!-- Alerta visual de alta severidad según especificación técnica -->
              @if (hasHighSeverityAllergy()) {
                <div class="critical-banner">
                  <span class="alert-icon">!</span>
                  <div>
                    <b>¡ALERTA CLÍNICA DE RIESGO ALTO!</b>
                    <small>El paciente tiene registrada al menos una alergia con severidad ALTA. Requiere precaución médica.</small>
                  </div>
                </div>
              }

              <!-- Búsqueda y Selección de Paciente -->
              <div class="patient-selector-box">
                <div class="form-fields">
                  <label style="flex: 1;">
                    <span>Filtrar Paciente por Nombre o Documento</span>
                    <input
                      type="text"
                      [ngModel]="patientSearch()"
                      (ngModelChange)="onPatientSearchChange($event)"
                      [ngModelOptions]="{standalone: true}"
                      placeholder="Buscar por nombre o CI..."
                      style="margin-bottom: 8px;"
                    />
                  </label>
                </div>

                <div class="form-fields">
                  <label style="flex: 1;">
                    <span>Seleccionar Paciente *</span>
                    <select formControlName="patientId" (change)="onPatientChange($event)">
                      <option value="">-- Seleccione un paciente --</option>
                      @for (p of filteredPatients(); track p.id) {
                        <option [value]="p.id">{{ p.firstName }} {{ p.lastName }} (Doc: {{ p.documentType }} {{ p.documentNumber }})</option>
                      }
                    </select>
                  </label>

                  <label style="max-width: 180px;">
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

                @if (isLoadingHistory()) {
                  <p class="loading-hint">Consultando antecedentes del paciente en base de datos...</p>
                }
              </div>

              <!-- Bloque de Antecedentes en dos columnas -->
              <div class="form-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <label>
                  <span>Antecedentes Patológicos</span>
                  <textarea formControlName="pathologicalAntecedents" rows="3" placeholder="Enfermedades previas, cirugías, traumas, hospitalizaciones..."></textarea>
                </label>

                <label>
                  <span>Antecedentes No Patológicos</span>
                  <textarea formControlName="nonPathologicalAntecedents" rows="3" placeholder="Hábitos, inmunizaciones, estilo de vida..."></textarea>
                </label>

                <label>
                  <span>Antecedentes Familiares</span>
                  <textarea formControlName="familyAntecedents" rows="3" placeholder="Diabetes familiar, hipertensión, cardiopatías, neoplasias..."></textarea>
                </label>

                <label>
                  <span>Condiciones Crónicas</span>
                  <textarea formControlName="chronicConditions" rows="3" placeholder="Diagnósticos crónicos permanentes o en tratamiento..."></textarea>
                </label>
              </div>

              <!-- Sección Dinámica de Alergias -->
              <div class="dynamic-section">
                <div class="dynamic-header">
                  <div>
                    <b>Alergias Estructuradas</b>
                    <small>Gestión de hipersensibilidades del paciente</small>
                  </div>
                  <button type="button" class="add-button" (click)="addAllergy()">
                    + Añadir Alergia
                  </button>
                </div>

                <div formArrayName="allergies">
                  @if (allergies.length === 0) {
                    <p class="empty-list-note">No se han registrado alergias específicas para este paciente.</p>
                  }
                  @for (allergy of allergies.controls; track $index) {
                    <div [formGroupName]="$index" class="dynamic-row">
                      <div style="flex: 2;">
                        <label>ALÉRGENO / SUSTANCIA *</label>
                        <input formControlName="allergen" placeholder="Ej. Penicilina, Látex, Polen" />
                      </div>
                      <div style="flex: 1.2;">
                        <label>SEVERIDAD *</label>
                        <select formControlName="severity">
                          <option value="LOW">Baja</option>
                          <option value="MEDIUM">Media</option>
                          <option value="HIGH">Alta (Riesgo)</option>
                        </select>
                      </div>
                      <div style="flex: 2;">
                        <label>REACCIÓN OBSERVADA</label>
                        <input formControlName="reaction" placeholder="Ej. Erupción cutánea, anafilaxia" />
                      </div>
                      <button type="button" (click)="removeAllergy($index)" title="Eliminar alergia" class="remove-btn">
                        ✕
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Sección Dinámica de Medicación Actual -->
              <div class="dynamic-section" style="margin-top: 16px;">
                <div class="dynamic-header">
                  <div>
                    <b>Medicación Actual / Prescripciones Activas</b>
                    <small>Fármacos que el paciente toma actualmente de forma regular</small>
                  </div>
                  <button type="button" class="add-button" (click)="addMedication()">
                    + Añadir Medicamento
                  </button>
                </div>

                <div formArrayName="currentMedications">
                  @if (currentMedications.length === 0) {
                    <p class="empty-list-note">No se registran medicamentos crónicos o prescripciones activas.</p>
                  }
                  @for (med of currentMedications.controls; track $index) {
                    <div [formGroupName]="$index" class="dynamic-row">
                      <div style="flex: 2;">
                        <label>NOMBRE DEL FÁRMACO *</label>
                        <input formControlName="name" placeholder="Ej. Losartán, Metformina, Omeprazol" />
                      </div>
                      <div style="flex: 1.2;">
                        <label>DOSIS</label>
                        <input formControlName="dose" placeholder="Ej. 50 mg, 1 comprimido" />
                      </div>
                      <div style="flex: 2;">
                        <label>FRECUENCIA / HORARIO</label>
                        <input formControlName="frequency" placeholder="Ej. Cada 12 horas, en ayunas" />
                      </div>
                      <button type="button" (click)="removeMedication($index)" title="Eliminar medicamento" class="remove-btn">
                        ✕
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Observaciones -->
              <label style="margin-top: 16px; margin-bottom: 20px; display: block;">
                <span style="display: block; font-size: 12px; font-weight: 700; color: #153a39; margin-bottom: 6px;">Observaciones Clínicas Generales</span>
                <textarea formControlName="observations" rows="2" placeholder="Notas complementarias sobre la entrevista inicial o anamnesis..."></textarea>
              </label>

              <!-- Mensajes de Estado -->
              @if (errorMessage()) {
                <div class="msg-box error">
                  ⚠️ {{ errorMessage() }}
                </div>
              }
              @if (successMessage()) {
                <div class="msg-box success">
                  ✓ {{ successMessage() }}
                </div>
              }

              <!-- Botones de Acción -->
              <div class="form-actions">
                <button type="button" class="cancel-button" (click)="resetForm()">
                  Limpiar Formulario
                </button>
                <button type="submit" class="primary-button" [disabled]="historyForm.invalid || isSaving()">
                  {{ isSaving() ? 'Guardando en Base de Datos...' : (currentHistory() ? 'Actualizar Historia Clínica' : 'Aperturar Historia Clínica') }}
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
            <li><strong>Confidencialidad:</strong> La información clínica consignada queda protegida bajo estrictos estándares de integridad documental y aislamiento multi-tenant.</li>
          </ul>

          @if (currentHistory(); as history) {
            <div class="history-summary-box">
              <h3>Ficha Activa</h3>
              <p><strong>Código:</strong> {{ history.code }}</p>
              <p><strong>Paciente:</strong> {{ history.patientLabel }}</p>
              <p><strong>Grupo Sanguíneo:</strong> {{ history.bloodType || 'No registrado' }}</p>
              <p><strong>Alergias:</strong> {{ (history.allergies?.length || 0) }} registradas</p>
              <p><strong>Medicamentos:</strong> {{ (history.currentMedications?.length || 0) }} activos</p>
            </div>
          }
        </aside>

      </div>

      <!-- Modal de Vista Previa / Impresión de Ficha Médica -->
      @if (showPreviewModal() && currentHistory(); as history) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <div>
                <h2>Ficha Médica Imprimible</h2>
                <small>Expediente Único · NexoDocs Sistema de Gestión Documental</small>
              </div>
              <button type="button" class="close-btn" (click)="closePreviewModal()">✕</button>
            </div>

            <div class="printable-content" id="printable-history">
              <div class="print-header">
                <div class="clinic-info">
                  <h2>NexoDocs Health Care</h2>
                  <p>Gestión Documental Clínica y Hospitalaria</p>
                  <p>Código de Ficha: <strong>{{ history.code }}</strong></p>
                </div>
                <div class="print-date">
                  <p>Fecha de emisión: {{ today | date:'dd/MM/yyyy HH:mm' }}</p>
                  <p>Estado: <strong>ACTIVO</strong></p>
                </div>
              </div>

              <hr />

              <section class="print-section">
                <h3>1. DATOS DEL PACIENTE</h3>
                <div class="print-grid">
                  <div><strong>Paciente:</strong> {{ history.patientLabel }}</div>
                  <div><strong>Grupo Sanguíneo:</strong> {{ history.bloodType || 'Sin registrar' }}</div>
                  <div><strong>Fecha de Registro:</strong> {{ history.createdAt | date:'dd/MM/yyyy' }}</div>
                </div>
              </section>

              <section class="print-section">
                <h3>2. ANTECEDENTES Y ANAMNESIS</h3>
                <p><strong>Antecedentes Patológicos:</strong> {{ history.pathologicalAntecedents || 'Ninguno informado' }}</p>
                <p><strong>Antecedentes No Patológicos:</strong> {{ history.nonPathologicalAntecedents || 'Ninguno informado' }}</p>
                <p><strong>Antecedentes Familiares:</strong> {{ history.familyAntecedents || 'Ninguno informado' }}</p>
                <p><strong>Condiciones Crónicas:</strong> {{ history.chronicConditions || 'Ninguna registrada' }}</p>
              </section>

              <section class="print-section">
                <h3>3. ALERGIAS IDENTIFICADAS</h3>
                @if ((history.allergies?.length || 0) > 0) {
                  <table class="print-table">
                    <thead>
                      <tr>
                        <th>Alérgeno</th>
                        <th>Severidad</th>
                        <th>Reacción</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of history.allergies; track item.allergen) {
                        <tr>
                          <td><b>{{ item.allergen }}</b></td>
                          <td>
                            <span [class.high-sev]="item.severity === 'HIGH'">{{ item.severity }}</span>
                          </td>
                          <td>{{ item.reaction || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p>No registra alergias conocidas.</p>
                }
              </section>

              <section class="print-section">
                <h3>4. MEDICACIÓN ACTUAL</h3>
                @if ((history.currentMedications?.length || 0) > 0) {
                  <table class="print-table">
                    <thead>
                      <tr>
                        <th>Fármaco</th>
                        <th>Dosis</th>
                        <th>Frecuencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (med of history.currentMedications; track med.name) {
                        <tr>
                          <td><b>{{ med.name }}</b></td>
                          <td>{{ med.dose || '—' }}</td>
                          <td>{{ med.frequency || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p>Sin medicación crónica activa.</p>
                }
              </section>

              <section class="print-section">
                <h3>5. OBSERVACIONES CLÍNICAS</h3>
                <p>{{ history.observations || 'Sin observaciones complementarias.' }}</p>
              </section>

              <div class="print-signature">
                <div class="sig-line">
                  <p>Firma y Sello del Médico Tratante</p>
                  <small>Matrícula Profesional / Especialidad</small>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="cancel-button" (click)="closePreviewModal()">Cerrar</button>
              <button type="button" class="primary-button" (click)="printDocument()">Imprimir / Guardar PDF</button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .page { max-width: 1440px; margin: auto; padding: 30px 36px 48px; }
    .dashboard-welcome { margin-bottom: 24px; }
    .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #087f7b; text-transform: uppercase; margin: 0; }
    h1 { font-size: 34px; color: #153a39; margin: 5px 0; letter-spacing: -0.04em; }
    .welcome-copy { font-size: 13px; color: #6b8583; margin: 0; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; margin-top: 20px; }
    .dashboard-card { background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px; }
    .form-title { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .form-title h2 { font-size: 18px; margin: 0 0 4px; color: #153a39; }
    .status-badge { display: inline-block; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 8px; margin-top: 4px; }
    .status-badge.new { background: #e0f2fe; color: #0369a1; }
    .status-badge.edit { background: #dcfce7; color: #15803d; }
    .required-note { font-size: 11px; color: #6b8583; }
    .preview-btn { background: #f0fdfa; border: 1px solid #99f6e4; color: #0f766e; border-radius: 8px; padding: 8px 12px; font-weight: 700; font-size: 12px; cursor: pointer; }
    .preview-btn:hover { background: #ccfbf1; }
    .critical-banner { background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
    .alert-icon { background: #e11d48; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 12px; }
    .critical-banner b { font-size: 12px; }
    .critical-banner small { display: block; font-size: 11px; }
    .patient-selector-box { background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .form-fields { display: flex; gap: 16px; margin-bottom: 12px; }
    .form-fields label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: #153a39; }
    input, select, textarea { border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 13px; color: #153a39; background: #fff; outline: none; font-family: inherit; }
    input:focus, select:focus, textarea:focus { border-color: #087f7b; box-shadow: 0 0 0 2px rgba(8, 127, 123, 0.15); }
    .loading-hint { font-size: 11px; color: #087f7b; margin: 8px 0 0; font-weight: 600; }
    .dynamic-section { background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 12px; padding: 16px; }
    .dynamic-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .dynamic-header b { font-size: 13px; color: #153a39; }
    .dynamic-header small { display: block; font-size: 10px; color: #6b8583; }
    .add-button { background: #fff; border: 1px solid #9dd8d1; color: #087f7b; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer; }
    .add-button:hover { background: #e6f7f5; }
    .empty-list-note { color: #6b8583; font-size: 11px; margin: 8px 0; }
    .dynamic-row { display: flex; gap: 8px; align-items: flex-end; background: #fff; border: 1px solid #dcebe8; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .dynamic-row label { font-size: 9px; font-weight: 800; color: #6b8583; margin-bottom: 3px; display: block; }
    .remove-btn { background: #ffebeb; color: #b34e4e; border: 0; border-radius: 6px; height: 36px; width: 36px; font-weight: 900; cursor: pointer; }
    .remove-btn:hover { background: #fca5a5; }
    .msg-box { border-radius: 8px; padding: 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .msg-box.error { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }
    .msg-box.success { background: #dcfce7; border: 1px solid #bbf7d0; color: #166534; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #edf3f1; }
    .cancel-button { background: #f1f5f9; color: #475569; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .primary-button { background: #087f7b; color: #fff; border: 0; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; min-width: 190px; justify-content: center; box-shadow: 0 4px 12px rgba(15, 157, 154, 0.25); }
    .primary-button:disabled { opacity: 0.5; cursor: not-allowed; }
    .note-panel h2 { font-size: 16px; margin: 0 0 12px; color: #153a39; }
    .side-kicker { color: #087f7b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 6px; }
    .note-panel p { font-size: 12px; color: #6b8583; margin-bottom: 12px; }
    .note-panel ul { font-size: 12px; color: #466765; padding-left: 18px; margin: 0; display: grid; gap: 8px; }
    .history-summary-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 14px; margin-top: 20px; }
    .history-summary-box h3 { font-size: 13px; color: #0f766e; margin: 0 0 8px; }
    .history-summary-box p { font-size: 11px; margin: 4px 0; color: #115e59; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-card { background: #fff; border-radius: 16px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .modal-header h2 { margin: 0; font-size: 20px; color: #153a39; }
    .close-btn { background: transparent; border: 0; font-size: 20px; cursor: pointer; color: #64748b; }
    .printable-content { padding: 12px; font-size: 12px; color: #1e293b; line-height: 1.5; }
    .print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .clinic-info h2 { margin: 0 0 4px; color: #087f7b; font-size: 22px; }
    .clinic-info p { margin: 2px 0; color: #64748b; font-size: 11px; }
    .print-date p { margin: 2px 0; text-align: right; font-size: 11px; }
    .print-section { margin-bottom: 18px; }
    .print-section h3 { font-size: 13px; color: #087f7b; border-bottom: 1px solid #dcebe8; padding-bottom: 4px; margin-bottom: 8px; }
    .print-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .print-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 11px; }
    .print-table th { background: #f8fafc; font-weight: 700; }
    .high-sev { color: #dc2626; font-weight: 800; }
    .print-signature { margin-top: 40px; display: flex; justify-content: flex-end; }
    .sig-line { width: 250px; text-align: center; border-top: 1px solid #000; padding-top: 6px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; }

    @media print {
      body * { visibility: hidden; }
      #printable-history, #printable-history * { visibility: visible; }
      #printable-history { position: absolute; left: 0; top: 0; width: 100%; }
    }
  `]
})
export class AntecedentesPage implements OnInit {
  private readonly clinicalService = inject(ClinicalApiService);
  private readonly fb = inject(FormBuilder);

  readonly patients = signal<ApiPatient[]>([]);
  readonly patientSearch = signal<string>('');
  readonly selectedPatient = signal<ApiPatient | null>(null);
  readonly currentHistory = signal<ClinicalHistory | null>(null);
  readonly isLoadingPatients = signal<boolean>(true);
  readonly isLoadingHistory = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly successMessage = signal<string>('');
  readonly showPreviewModal = signal<boolean>(false);
  readonly today = new Date();

  historyForm: FormGroup = this.fb.group({
    patientId: ['', Validators.required],
    bloodType: [''],
    pathologicalAntecedents: [''],
    nonPathologicalAntecedents: [''],
    familyAntecedents: [''],
    chronicConditions: [''],
    observations: [''],
    allergies: this.fb.array([]),
    currentMedications: this.fb.array([]),
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

  filteredPatients(): ApiPatient[] {
    const q = this.patientSearch().trim().toLowerCase();
    if (!q) return this.patients();
    return this.patients().filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.documentNumber.toLowerCase().includes(q)
    );
  }

  onPatientSearchChange(query: string) {
    this.patientSearch.set(query);
  }

  onPatientChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const patientId = select.value;
    if (!patientId) {
      this.selectedPatient.set(null);
      this.currentHistory.set(null);
      this.resetForm();
      return;
    }

    const patient = this.patients().find((p) => p.id === patientId) || null;
    this.selectedPatient.set(patient);
    this.loadPatientHistory(patientId);
  }

  loadPatientHistory(patientId: string) {
    this.isLoadingHistory.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.clinicalService.histories(patientId).subscribe({
      next: (page) => {
        this.isLoadingHistory.set(false);
        const existing = page.content && page.content.length > 0 ? page.content[0] : null;
        if (existing) {
          this.currentHistory.set(existing);
          this.populateForm(existing);
        } else {
          this.currentHistory.set(null);
          this.resetFormValues(patientId);
        }
      },
      error: () => {
        this.isLoadingHistory.set(false);
        this.currentHistory.set(null);
        this.resetFormValues(patientId);
      },
    });
  }

  populateForm(history: ClinicalHistory) {
    this.historyForm.patchValue({
      patientId: history.patientId,
      bloodType: history.bloodType || '',
      pathologicalAntecedents: history.pathologicalAntecedents || '',
      nonPathologicalAntecedents: history.nonPathologicalAntecedents || '',
      familyAntecedents: history.familyAntecedents || '',
      chronicConditions: history.chronicConditions || '',
      observations: history.observations || '',
    });

    // Populate allergies
    this.allergies.clear();
    if (history.allergies && history.allergies.length > 0) {
      history.allergies.forEach((allergy) => {
        this.allergies.push(this.fb.group({
          allergen: [allergy.allergen, Validators.required],
          severity: [allergy.severity || 'LOW', Validators.required],
          reaction: [allergy.reaction || '']
        }));
      });
    }

    // Populate current medications
    this.currentMedications.clear();
    if (history.currentMedications && history.currentMedications.length > 0) {
      history.currentMedications.forEach((med) => {
        this.currentMedications.push(this.fb.group({
          name: [med.name, Validators.required],
          dose: [med.dose || ''],
          frequency: [med.frequency || '']
        }));
      });
    }
  }

  resetFormValues(patientId: string) {
    this.historyForm.patchValue({
      patientId,
      bloodType: '',
      pathologicalAntecedents: '',
      nonPathologicalAntecedents: '',
      familyAntecedents: '',
      chronicConditions: '',
      observations: '',
    });
    this.allergies.clear();
    this.currentMedications.clear();
  }

  get allergies(): FormArray {
    return this.historyForm.get('allergies') as FormArray;
  }

  get currentMedications(): FormArray {
    return this.historyForm.get('currentMedications') as FormArray;
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

  addMedication() {
    this.currentMedications.push(
      this.fb.group({
        name: ['', Validators.required],
        dose: [''],
        frequency: [''],
      })
    );
  }

  removeMedication(index: number) {
    this.currentMedications.removeAt(index);
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
    this.currentMedications.clear();
    this.currentHistory.set(null);
    this.selectedPatient.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  saveHistory() {
    if (this.historyForm.invalid) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formValue = this.historyForm.value as ClinicalHistoryPayload;
    const history = this.currentHistory();

    const request$ = history
      ? this.clinicalService.updateHistory(history.id, formValue)
      : this.clinicalService.createHistory(formValue);

    request$.subscribe({
      next: (saved) => {
        this.currentHistory.set(saved);
        this.successMessage.set(
          history
            ? `¡Historia clínica ${saved.code} actualizada correctamente en base de datos!`
            : `¡Historia clínica ${saved.code} aperturada exitosamente en base de datos!`
        );
        this.isSaving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        if (err.status === 403) {
          this.errorMessage.set('Acceso denegado: El usuario no posee permisos para gestionar historias clínicas.');
        } else {
          this.errorMessage.set(err.error?.message || 'Error al comunicarse con el servidor.');
        }
      },
    });
  }

  openPreviewModal() {
    this.showPreviewModal.set(true);
  }

  closePreviewModal() {
    this.showPreviewModal.set(false);
  }

  printDocument() {
    window.print();
  }
}
