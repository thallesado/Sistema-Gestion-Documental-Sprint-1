import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiPatient, ClinicalApiService, ClinicalHistory, ClinicalLinkedDocument } from '../../../core/api/clinical-api.service';
import { DocumentApiService, MedicalNote, ApiDocument } from '../../../core/api/document-api.service';

export interface SignosVitales {
  peso?: number | null;
  talla?: number | null;
  imc?: number | null;
  presionArterial?: string | null;
  frecuenciaCardiaca?: number | null;
  frecuenciaRespiratoria?: number | null;
  temperatura?: number | null;
  saturacionOxigeno?: number | null;
  glicemia?: number | null;
}

export interface ConsultaMedicaData {
  fecha: string;
  establecimiento: string;
  motivoConsulta: string;
  signosVitales: SignosVitales;
}

export interface ConsultaMedicaItem {
  id: string;
  clinicalHistoryId: string;
  createdAt: string;
  data: ConsultaMedicaData;
  rawContent?: string;
}

export function computeIMCStatus(imc: number | null | undefined): { label: string; color: string; bg: string } {
  if (!imc || isNaN(imc) || imc <= 0) return { label: 'Sin calcular', color: '#64748b', bg: '#f1f5f9' };
  if (imc < 18.5) return { label: 'Bajo peso', color: '#0284c7', bg: '#e0f2fe' };
  if (imc < 25) return { label: 'Normal', color: '#16a34a', bg: '#dcfce7' };
  if (imc < 30) return { label: 'Sobrepeso', color: '#d97706', bg: '#fef3c7' };
  return { label: 'Obesidad', color: '#dc2626', bg: '#fee2e2' };
}

function getCurrentDateTimeString(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatMedicalDate(val: string | number | undefined | null): string {
  if (!val) return 'Sin fecha';
  let d: Date;
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('T'))) {
    const num = Number(val);
    d = new Date(num > 10000000000 ? num : num * 1000);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('es-BO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseConsulta(note: MedicalNote): ConsultaMedicaItem {
  try {
    const parsed = JSON.parse(note.content);
    if (parsed && typeof parsed === 'object') {
      const sv = parsed.signosVitales || {};
      return {
        id: note.id,
        clinicalHistoryId: note.clinicalHistoryId,
        createdAt: note.createdAt,
        data: {
          fecha: parsed.fecha || note.createdAt,
          establecimiento: parsed.establecimiento || 'Clínica Central',
          motivoConsulta: parsed.motivoConsulta || parsed.motivo || '',
          signosVitales: {
            peso: sv.peso ?? parsed.peso ?? null,
            talla: sv.talla ?? parsed.talla ?? null,
            imc: sv.imc ?? parsed.imc ?? null,
            presionArterial: sv.presionArterial ?? parsed.presionArterial ?? null,
            frecuenciaCardiaca: sv.frecuenciaCardiaca ?? parsed.frecuenciaCardiaca ?? null,
            frecuenciaRespiratoria: sv.frecuenciaRespiratoria ?? parsed.frecuenciaRespiratoria ?? null,
            temperatura: sv.temperatura ?? parsed.temperatura ?? null,
            saturacionOxigeno: sv.saturacionOxigeno ?? parsed.saturacionOxigeno ?? null,
            glicemia: sv.glicemia ?? parsed.glicemia ?? null,
          }
        }
      };
    }
  } catch {
    // Si no es JSON, fallback a texto plano
  }
  return {
    id: note.id,
    clinicalHistoryId: note.clinicalHistoryId,
    createdAt: note.createdAt,
    data: {
      fecha: note.createdAt,
      establecimiento: 'Clínica Central',
      motivoConsulta: note.content,
      signosVitales: {},
    },
    rawContent: note.content,
  };
}

@Component({
  selector: 'app-historia-clinica-page',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  template: `
    <div class="page" style="max-width: 1400px; margin: auto; padding: 24px 32px 48px; font-family: system-ui, -apple-system, sans-serif;">
      
      <!-- Encabezado superior -->
      <header style="margin-bottom: 20px;">
        <p style="color: #087f7b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 4px;">
          EXPEDIENTES · GESTIÓN CLÍNICA Y CONSULTAS MÉDICAS
        </p>
        <h1 style="margin: 0 0 6px; color: #153a39; font-size: 26px; font-weight: 800; letter-spacing: -.03em;">
          Historia Clínica y Consultas Realizadas
        </h1>
        <p style="color: #557573; font-size: 13px; margin: 0; line-height: 1.5;">
          Búsqueda de paciente, consulta de antecedentes oficiales y registro inmutable de consultas médicas.
        </p>
      </header>

      <!-- 1. BUSCADOR ARRIBA -->
      <section style="background: #ffffff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 24px; margin-bottom: 22px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
        <label style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #087f7b; margin-bottom: 6px; letter-spacing: 0.05em;">
          Buscar Paciente (Nombre, Apellido o C.I.)
        </label>
        <div style="position: relative;">
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchInput($event)"
            placeholder="Escribe para buscar: Ej. Silvia, Yesenia, Condori, 93868..."
            style="width: 100%; border: 2px solid; border-radius: 8px; padding: 11px 14px; font-size: 14px; outline: none; transition: all .2s; box-sizing: border-box;"
            [style.borderColor]="searchQuery().trim() ? (filteredPatients().length > 0 ? '#2563eb' : '#dc2626') : '#cbd5e1'"
            [style.background]="searchQuery().trim() ? '#fafcff' : '#ffffff'"
          />
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <small style="font-size: 12px;">
            @if (searchQuery().trim()) {
              @if (filteredPatients().length > 0) {
                <span style="color: #2563eb; font-weight: 700;">
                  Coincidencias encontradas: {{ filteredPatients().length }} paciente(s) remarcado(s) en azul en la lista izquierda.
                </span>
              } @else {
                <span style="color: #dc2626; font-weight: 700;">
                  Paciente no encontrado. No se hallaron resultados para "{{ searchQuery() }}".
                </span>
              }
            } @else {
              <span style="color: #64748b;">
                Filtra en tiempo real. Al escribir, los pacientes coincidentes se remarcarán en color azul.
              </span>
            }
          </small>
          <small style="color: #64748b; font-size: 11px;">
            Total pacientes en sistema: <strong>{{ patients().length }}</strong>
          </small>
        </div>
      </section>

      <!-- 2. DIVISIÓN: LISTA DE PACIENTES A LA IZQUIERDA Y RESULTADOS A LA DERECHA -->
      <div style="display: grid; grid-template-columns: 350px 1fr; gap: 20px; align-items: stretch;">
        
        <!-- ========================================== -->
        <!-- COLUMNA IZQUIERDA: LISTA DE PACIENTES       -->
        <!-- ========================================== -->
        <aside style="background: #ffffff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
            <strong style="font-size: 12px; text-transform: uppercase; color: #087f7b; letter-spacing: 0.05em;">
              Lista de Pacientes
            </strong>
            <span style="font-size: 11px; background: #e6f6f5; color: #087f7b; font-weight: 800; padding: 2px 8px; border-radius: 10px;">
              {{ filteredPatients().length }}
            </span>
          </div>

          <!-- Contenedor scrollable de pacientes -->
          <div class="patients-scroll" style="max-height: calc(100vh - 300px); min-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
            
            @if (filteredPatients().length === 0) {
              <!-- Mensaje exacto de paciente no encontrado solicitado por el usuario -->
              <div style="text-align: center; padding: 48px 16px; background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 10px; color: #991b1b;">
                <strong style="font-size: 14px; display: block; margin-bottom: 4px;">Paciente no encontrado</strong>
                <span style="font-size: 12px; color: #b91c1c;">No hay pacientes que coincidan con la búsqueda.</span>
              </div>
            } @else {
              @for (p of filteredPatients(); track p.id) {
                <div
                  (click)="onSelectPatient(p.id)"
                  [style.borderColor]="isHighlighted(p) ? '#2563eb' : (p.id === selectedPatientId() ? '#087f7b' : '#e2e8f0')"
                  [style.background]="isHighlighted(p) ? '#eff6ff' : (p.id === selectedPatientId() ? '#f0fdfa' : '#ffffff')"
                  [style.boxShadow]="isHighlighted(p) ? '0 0 0 2px rgba(37, 99, 235, 0.25)' : 'none'"
                  style="border-radius: 10px; padding: 12px 14px; border: 2px solid; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 4px;"
                >
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <strong [style.color]="isHighlighted(p) ? '#1d4ed8' : '#153a39'" style="font-size: 13px;">
                      {{ p.firstName }} {{ p.lastName }}
                    </strong>
                    @if (isHighlighted(p)) {
                      <span style="background: #2563eb; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                        Coincidencia
                      </span>
                    } @else if (p.id === selectedPatientId()) {
                      <span style="background: #087f7b; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
                        Activo
                      </span>
                    }
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
                    <span>C.I.: <strong [style.color]="isHighlighted(p) ? '#1e40af' : '#334155'">{{ p.documentNumber }}</strong></span>
                    <span>{{ p.gender || 'Sin sexo' }}</span>
                  </div>
                </div>
              }
            }

          </div>
        </aside>

        <!-- ========================================== -->
        <!-- COLUMNA DERECHA: RESULTADOS Y DETALLE      -->
        <!-- ========================================== -->
        <main style="background: #ffffff; border: 1px solid #dcebe8; border-radius: 14px; padding: 22px 26px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
          
          @if (!selectedPatient()) {
            <div style="text-align: center; padding: 80px 20px; color: #64748b;">
              <h3 style="margin: 0 0 8px; color: #153a39; font-size: 18px; font-weight: 700;">Selecciona un paciente</h3>
              <p style="margin: 0; font-size: 13px; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                Haz clic en cualquier paciente de la lista izquierda para cargar sus antecedentes clínicos o revisar sus consultas médicas.
              </p>
            </div>
          } @else {
            
            <!-- CABECERA DEL PANEL DE RESULTADOS -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #edf4f3;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #153a39;">
                    {{ selectedPatient()?.firstName }} {{ selectedPatient()?.lastName }}
                  </h2>
                  <span style="background: #e6f6f5; color: #087f7b; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
                    Doc: {{ selectedPatient()?.documentType }} {{ selectedPatient()?.documentNumber }}
                  </span>
                  @if (currentHistory()?.code; as code) {
                    <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
                      {{ code }}
                    </span>
                  }
                </div>
                <small style="color: #64748b; font-size: 12px; display: block; margin-top: 4px;">
                  Grupo Sanguíneo: <strong>{{ historyForm.value.bloodType || 'Sin registrar' }}</strong> · 
                  Consultas realizadas: <strong>{{ patientConsultations().length }}</strong>
                </small>
              </div>

              <!-- EN LA ESQUINA SUPERIOR DERECHA: LOS DOS BOTONES (HISTORIAL O CONSULTAS) -->
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                
                <!-- Toggle Switch: Historial vs Consultas vs Documentos -->
                <div style="display: inline-flex; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #cbd5e1;">
                  <button
                    type="button"
                    (click)="activeTab.set('historial')"
                    [style.background]="activeTab() === 'historial' ? '#087f7b' : 'transparent'"
                    [style.color]="activeTab() === 'historial' ? '#ffffff' : '#334155'"
                    [style.boxShadow]="activeTab() === 'historial' ? '0 2px 6px rgba(8, 127, 123, 0.25)' : 'none'"
                    style="border: 0; border-radius: 7px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .15s;"
                  >
                    Historial
                  </button>
                  <button
                    type="button"
                    (click)="activeTab.set('consultas')"
                    [style.background]="activeTab() === 'consultas' ? '#087f7b' : 'transparent'"
                    [style.color]="activeTab() === 'consultas' ? '#ffffff' : '#334155'"
                    [style.boxShadow]="activeTab() === 'consultas' ? '0 2px 6px rgba(8, 127, 123, 0.25)' : 'none'"
                    style="border: 0; border-radius: 7px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .15s;"
                  >
                    Consultas ({{ patientConsultations().length }})
                  </button>
                  <button
                    type="button"
                    (click)="activeTab.set('documentos'); loadLinkedDocuments()"
                    [style.background]="activeTab() === 'documentos' ? '#087f7b' : 'transparent'"
                    [style.color]="activeTab() === 'documentos' ? '#ffffff' : '#334155'"
                    [style.boxShadow]="activeTab() === 'documentos' ? '0 2px 6px rgba(8, 127, 123, 0.25)' : 'none'"
                    style="border: 0; border-radius: 7px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .15s;"
                  >
                    Documentos ({{ linkedDocuments().length }})
                  </button>
                </div>

                <!-- Botón de acción adicional según la opción activa -->
                @if (activeTab() === 'historial') {
                  <button
                    type="button"
                    (click)="openOfficialPreview()"
                    style="background: #ffffff; color: #087f7b; border: 1px solid #c9dedb; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer;"
                    title="Ver formato oficial del Ministerio de Salud (INE 101/2010)"
                  >
                    Ver Hoja Oficial
                  </button>
                  @if (currentHistory()?.id) {
                    <button
                      type="button"
                      (click)="openDeleteModal()"
                      style="background: #ffffff; color: #dc2626; border: 1px solid #fca5a5; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer;"
                      title="Dar de baja historia clínica con justificación y auditoría"
                    >
                      Dar de Baja
                    </button>
                  }
                } @else if (activeTab() === 'consultas') {
                  <button
                    type="button"
                    (click)="openNewConsultationModal()"
                    style="background: #087f7b; color: #ffffff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(8, 127, 123, 0.2);"
                  >
                    + Nueva Consulta
                  </button>
                } @else if (activeTab() === 'documentos' && currentHistory()?.id) {
                  <button
                    type="button"
                    (click)="openLinkDocModal()"
                    style="background: #087f7b; color: #ffffff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(8, 127, 123, 0.2);"
                  >
                    + Vincular Documento
                  </button>
                }

              </div>
            </div>

            <!-- CONTENIDO DE LA OPCIÓN 1: HISTORIAL CLÍNICO -->
            @if (activeTab() === 'historial') {
              <form [formGroup]="historyForm" (ngSubmit)="saveHistory()">
                
                <!-- Alerta visual de alta severidad de alergia -->
                @if (hasHighSeverityAllergy()) {
                  <div style="background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-size: 12px;">
                    <span style="background: #e11d48; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">
                      ALERTA
                    </span>
                    <span>El paciente presenta alergias de <strong>alta severidad</strong> consignadas.</span>
                  </div>
                }

                <!-- SECCIÓN 1: DATOS GENERALES -->
                <div style="margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid #edf4f3;">
                  <h3 style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #087f7b; margin: 0 0 10px; letter-spacing: 0.05em;">
                    1. Identificación y Grupo Sanguíneo
                  </h3>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <label style="display: grid; gap: 5px; font-size: 12px; color: #153a39; font-weight: 700;">
                      <span>Grupo Sanguíneo y Factor Rh *</span>
                      <select formControlName="bloodType" style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; background: #fff; font-size: 13px;">
                        <option value="">-- No especificado --</option>
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

                    <div style="display: grid; gap: 5px; font-size: 12px; color: #153a39; font-weight: 700;">
                      <span>Código de Historia Clínica</span>
                      <input
                        type="text"
                        [value]="currentHistory() ? currentHistory()?.code : 'Se generará automáticamente (Ej. HC-2026-XXXX)'"
                        disabled
                        style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px; background: #f8fafc; color: #64748b; font-size: 13px;"
                      />
                    </div>
                  </div>
                </div>

                <!-- SECCIÓN 2: ANTECEDENTES MÉDICOS -->
                <div style="margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid #edf4f3;">
                  <h3 style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #087f7b; margin: 0 0 10px; letter-spacing: 0.05em;">
                    2. Antecedentes Médicos y Clínicos
                  </h3>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px;">
                    <label style="display: grid; gap: 5px; font-size: 12px; color: #153a39; font-weight: 700;">
                      <span>Antecedentes Patológicos (Hospitalizaciones, cirugías, traumas)</span>
                      <textarea
                        formControlName="pathologicalAntecedents"
                        rows="3"
                        placeholder="Ej. Colecistectomía (2020), fractura de cúbito..."
                        style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 13px; resize: vertical;"
                      ></textarea>
                    </label>

                    <label style="display: grid; gap: 5px; font-size: 12px; color: #153a39; font-weight: 700;">
                      <span>Antecedentes No Patológicos (Hábitos, vacunas, estilo de vida)</span>
                      <textarea
                        formControlName="nonPathologicalAntecedents"
                        rows="3"
                        placeholder="Ej. Esquema de vacunación completo, no fumador..."
                        style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 13px; resize: vertical;"
                      ></textarea>
                    </label>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <label style="display: grid; gap: 5px; font-size: 12px; color: #153a39; font-weight: 700;">
                      <span>Antecedentes Familiares (Diabetes, hipertensión, cardiopatías)</span>
                      <textarea
                        formControlName="familyAntecedents"
                        rows="3"
                        placeholder="Ej. Madre con hipertensión arterial, padre diabético..."
                        style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 13px; resize: vertical;"
                      ></textarea>
                    </label>

                    <label style="display: grid; gap: 5px; font-size: 12px; color: #153a39; font-weight: 700;">
                      <span>Condiciones Crónicas y Diagnósticos Permanentes</span>
                      <textarea
                        formControlName="chronicConditions"
                        rows="3"
                        placeholder="Ej. Hipertensión esencial, Asma bronquial..."
                        style="border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 13px; resize: vertical;"
                      ></textarea>
                    </label>
                  </div>
                </div>

                <!-- SECCIÓN 3: ALERGIAS -->
                <div style="margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid #edf4f3;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                      <h3 style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #087f7b; margin: 0; letter-spacing: 0.05em;">
                        3. Alergias Estructuradas del Paciente
                      </h3>
                      <small style="color: #64748b; font-size: 11px;">Registro con grado de severidad</small>
                    </div>
                    <button
                      type="button"
                      (click)="addAllergy()"
                      style="background: #fff; border: 1px solid #087f7b; color: #087f7b; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer;"
                    >
                      + Añadir Alergia
                    </button>
                  </div>

                  <div formArrayName="allergies">
                    @if (allergies.length === 0) {
                      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; color: #64748b; font-size: 12px;">
                        No se registran alergias activas para este paciente.
                      </div>
                    }

                    @for (a of allergies.controls; track $index) {
                      <div [formGroupName]="$index" style="display: grid; grid-template-columns: 2fr 1.3fr 2fr auto; gap: 8px; align-items: center; margin-bottom: 8px;">
                        <div>
                          <label style="font-size: 10px; font-weight: 700; color: #557573; text-transform: uppercase;">Alérgeno *</label>
                          <input
                            type="text"
                            formControlName="allergen"
                            placeholder="Ej. Penicilina..."
                            style="width: 100%; border: 1px solid #dcebe8; border-radius: 6px; padding: 7px; font-size: 12px; box-sizing: border-box;"
                          />
                        </div>
                        <div>
                          <label style="font-size: 10px; font-weight: 700; color: #557573; text-transform: uppercase;">Severidad *</label>
                          <select
                            formControlName="severity"
                            style="width: 100%; border: 1px solid #dcebe8; border-radius: 6px; padding: 7px; font-size: 12px; box-sizing: border-box;"
                          >
                            <option value="LOW">Baja (Leve)</option>
                            <option value="MEDIUM">Media (Moderada)</option>
                            <option value="HIGH">Alta (Grave)</option>
                          </select>
                        </div>
                        <div>
                          <label style="font-size: 10px; font-weight: 700; color: #557573; text-transform: uppercase;">Reacción observada</label>
                          <input
                            type="text"
                            formControlName="reaction"
                            placeholder="Ej. Urticaria..."
                            style="width: 100%; border: 1px solid #dcebe8; border-radius: 6px; padding: 7px; font-size: 12px; box-sizing: border-box;"
                          />
                        </div>
                        <div style="padding-top: 14px;">
                          <button
                            type="button"
                            (click)="removeAllergy($index)"
                            style="background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48; border-radius: 6px; padding: 6px 10px; font-size: 11px; cursor: pointer;"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- SECCIÓN 4: OBSERVACIONES -->
                <div style="margin-bottom: 20px;">
                  <h3 style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #087f7b; margin: 0 0 8px; letter-spacing: 0.05em;">
                    4. Observaciones Generales y Factores de Riesgo
                  </h3>
                  <textarea
                    formControlName="observations"
                    rows="2"
                    placeholder="Observaciones de seguimiento o notas relevantes..."
                    style="width: 100%; border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; font-size: 13px; box-sizing: border-box; resize: vertical;"
                  ></textarea>
                </div>

                <!-- Mensajes -->
                @if (errorMessage()) {
                  <div style="background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px;">
                    <strong>Error:</strong> {{ errorMessage() }}
                  </div>
                }
                @if (successMessage()) {
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px;">
                    <strong>Éxito:</strong> {{ successMessage() }}
                  </div>
                }

                <!-- Botón Guardar -->
                <div style="display: flex; justify-content: flex-end;">
                  <button
                    type="submit"
                    [disabled]="isSaving()"
                    style="background: #087f7b; color: #fff; border: 0; border-radius: 8px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(8, 127, 123, 0.2);"
                    [style.opacity]="isSaving() ? '0.6' : '1'"
                  >
                    {{ isSaving() ? 'Guardando en base de datos...' : (currentHistory() ? 'Guardar Cambios de Historial' : 'Crear Historia Clínica') }}
                  </button>
                </div>

              </form>
            }

            <!-- CONTENIDO DE LA OPCIÓN 2: CONSULTAS HECHAS (FEED CON SCROLL) -->
            @if (activeTab() === 'consultas') {
              <div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <div>
                    <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #087f7b; margin: 0; letter-spacing: 0.05em;">
                      Consultas Médicas Registradas ({{ patientConsultations().length }})
                    </h3>
                    <small style="color: #64748b; font-size: 11px;">
                      Registros clínicos inmutables con signos vitales y motivo de consulta.
                    </small>
                  </div>
                  <button
                    type="button"
                    (click)="openNewConsultationModal()"
                    style="background: #087f7b; color: #fff; border: 0; border-radius: 6px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer;"
                  >
                    + Registrar Consulta
                  </button>
                </div>

                <!-- CONTENEDOR CON SCROLL VERTICAL PARA LAS CONSULTAS HECHAS -->
                <div class="consultations-feed" style="max-height: calc(100vh - 360px); min-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 6px;">
                  
                  @if (consultationsLoading()) {
                    <div style="text-align: center; padding: 40px; color: #64748b; font-size: 13px;">
                      Cargando consultas del paciente...
                    </div>
                  } @else if (patientConsultations().length === 0) {
                    <div style="text-align: center; padding: 48px 20px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px;">
                      <h4 style="margin: 0 0 6px; color: #1e293b; font-size: 15px; font-weight: 700;">Sin consultas previas</h4>
                      <p style="margin: 0 0 16px; font-size: 13px; color: #64748b; max-width: 400px; margin-left: auto; margin-right: auto;">
                        Este paciente aún no registra ninguna consulta médica. Puedes registrar la primera ahora.
                      </p>
                      <button
                        type="button"
                        (click)="openNewConsultationModal()"
                        style="background: #087f7b; color: #fff; border: 0; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer;"
                      >
                        + Registrar primera consulta médica
                      </button>
                    </div>
                  } @else {
                    @for (c of patientConsultations(); track c.id) {
                      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                        
                        <!-- Barra superior de la consulta -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                          <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <span style="background: #087f7b; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
                                Consulta #{{ patientConsultations().length - $index }}
                              </span>
                              <strong style="color: #0f172a; font-size: 13px;">
                                {{ formatMedicalDate(c.data.fecha) }}
                              </strong>
                            </div>
                            <small style="color: #64748b; font-size: 11px; display: block; margin-top: 2px;">
                              Establecimiento: <strong>{{ c.data.establecimiento || 'Clínica Central' }}</strong>
                            </small>
                          </div>

                          <div style="display: flex; gap: 6px; align-items: center;">
                            <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                              Registro Inmutable
                            </span>
                            <button
                              type="button"
                              (click)="openOfficialConsultationPreview(c)"
                              style="background: #f8fafc; border: 1px solid #cbd5e1; color: #087f7b; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer;"
                            >
                              Ver Hoja Oficial
                            </button>
                          </div>
                        </div>

                        <!-- Motivo de la consulta -->
                        <div style="margin-bottom: 12px;">
                          <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; display: block; margin-bottom: 3px;">
                            Motivo de la Consulta
                          </span>
                          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 13px; color: #1e293b;">
                            {{ c.data.motivoConsulta || 'Sin motivo especificado.' }}
                          </div>
                        </div>

                        <!-- Signos Vitales Grilla -->
                        <div>
                          <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #087f7b; display: block; margin-bottom: 6px;">
                            Signos Vitales
                          </span>
                          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px;">
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">Peso</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.peso ? c.data.signosVitales.peso + ' kg' : '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">Talla</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.talla ? c.data.signosVitales.talla + ' cm' : '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">IMC</small>
                              @if (c.data.signosVitales.imc) {
                                <div style="display: flex; align-items: center; gap: 3px;">
                                  <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.imc }}</strong>
                                  <span [style.color]="getIMCStatus(c.data.signosVitales.imc).color" style="font-size: 9px; font-weight: 800;">
                                    {{ getIMCStatus(c.data.signosVitales.imc).label }}
                                  </span>
                                </div>
                              } @else {
                                <strong style="color: #64748b; font-size: 12px;">--</strong>
                              }
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">P. Arterial</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.presionArterial || '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">F. Cardíaca</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.frecuenciaCardiaca ? c.data.signosVitales.frecuenciaCardiaca + ' lpm' : '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">F. Resp.</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.frecuenciaRespiratoria ? c.data.signosVitales.frecuenciaRespiratoria + ' rpm' : '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">Temp.</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.temperatura ? c.data.signosVitales.temperatura + ' °C' : '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">Sat. O₂</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.saturacionOxigeno ? c.data.signosVitales.saturacionOxigeno + ' %' : '--' }}</strong>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
                              <small style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; display: block;">Glicemia</small>
                              <strong style="color: #1e293b; font-size: 12px;">{{ c.data.signosVitales.glicemia ? c.data.signosVitales.glicemia + ' mg/dl' : '--' }}</strong>
                            </div>
                          </div>
                        </div>

                      </div>
                    }
                  }

                </div>

              </div>
            }

            <!-- CONTENIDO DE LA OPCIÓN 3: DOCUMENTOS ANEXOS AL EXPEDIENTE -->
            @if (activeTab() === 'documentos') {
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <div>
                    <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #087f7b; margin: 0; letter-spacing: 0.05em;">
                      Documentos Anexos al Expediente ({{ linkedDocuments().length }})
                    </h3>
                    <small style="color: #64748b; font-size: 11px;">
                      Trazabilidad de informes de laboratorio, consentimientos informados y estudios clínicos asociados.
                    </small>
                  </div>
                  @if (currentHistory()?.id) {
                    <button
                      type="button"
                      (click)="openLinkDocModal()"
                      style="background: #087f7b; color: #ffffff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(8, 127, 123, 0.2);"
                    >
                      + Vincular Documento
                    </button>
                  }
                </div>

                @if (linkedDocsLoading()) {
                  <div style="text-align: center; padding: 40px; color: #64748b; font-size: 13px;">
                    Cargando documentos vinculados...
                  </div>
                } @else if (linkedDocuments().length === 0) {
                  <div style="text-align: center; padding: 48px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b;">
                    <strong style="font-size: 14px; display: block; margin-bottom: 4px; color: #334155;">Sin documentos vinculados</strong>
                    <span style="font-size: 12px;">No hay documentos clínicos asociados a esta historia clínica. Usa el botón "+ Vincular Documento" para adjuntar estudios o informes.</span>
                  </div>
                } @else {
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    @for (doc of linkedDocuments(); track doc.id) {
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                          <div style="background: #e0f2fe; color: #0284c7; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px;">
                            {{ doc.code }}
                          </div>
                          <div>
                            <strong style="color: #1e293b; font-size: 13px; display: block;">{{ doc.name }}</strong>
                            <small style="color: #64748b; font-size: 11px;">
                              Estado: <strong>{{ doc.status }}</strong> · Creado: {{ formatMedicalDate(doc.createdAt) }}
                            </small>
                          </div>
                        </div>
                        <button
                          type="button"
                          (click)="unlinkDoc(doc.id)"
                          style="background: #fef2f2; color: #dc2626; border: 1px solid #fecdd3; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;"
                          title="Desvincular este documento de la historia clínica"
                        >
                          Desvincular
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }

          }

        </main>
      </div>

      <!-- ========================================================================================= -->
      <!-- MODAL: REGISTRO DE NUEVA CONSULTA MÉDICA (Registro_Consulta_Medica.docx)                  -->
      <!-- ========================================================================================= -->
      @if (showNewConsultationModal()) {
        <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div class="modal-card" style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 860px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); overflow: hidden;">
            
            <div style="padding: 16px 22px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #087f7b; letter-spacing: .06em;">
                  REGISTRO DE CONSULTA MÉDICA
                </span>
                <h2 style="margin: 2px 0 0; font-size: 17px; font-weight: 800; color: #1e293b;">
                  Motivo de la Consulta y Signos Vitales
                </h2>
              </div>
              <button
                type="button"
                (click)="closeNewConsultationModal()"
                style="background: #e2e8f0; color: #475569; border: 0; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;"
              >
                ✕ Cerrar
              </button>
            </div>

            <!-- Aviso inmutabilidad -->
            <div style="background: #fffbeb; border-bottom: 1px solid #fde68a; padding: 9px 22px; font-size: 12px; color: #92400e;">
              <strong>Registro Inmutable:</strong> Una vez guardada, la consulta médica formará parte legal del expediente clínico y no podrá ser alterada ni eliminada.
            </div>

            <div style="padding: 20px 22px; overflow-y: auto; max-height: calc(90vh - 160px);">
              
              @if (consultationSuccessMsg()) {
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; font-size: 13px;">
                  <strong style="display: block; font-size: 14px; margin-bottom: 4px;">Consulta guardada con éxito</strong>
                  <span>{{ consultationSuccessMsg() }}</span>
                  <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button
                      type="button"
                      (click)="clearSuccessAndPrepareAnother()"
                      style="background: #166534; color: #fff; border: 0; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer;"
                    >
                      + Agregar otra consulta
                    </button>
                    <button
                      type="button"
                      (click)="closeNewConsultationModal(); activeTab.set('consultas')"
                      style="background: #fff; border: 1px solid #166534; color: #166534; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer;"
                    >
                      Ver consultas realizadas ({{ patientConsultations().length }})
                    </button>
                  </div>
                </div>
              }

              @if (consultationErrorMsg()) {
                <div style="background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px;">
                  <strong>Error:</strong> {{ consultationErrorMsg() }}
                </div>
              }

              <form [formGroup]="consultationForm" (ngSubmit)="saveConsultation()">
                
                <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 14px; margin-bottom: 12px;">
                  <label style="display: grid; gap: 4px; font-size: 11px; font-weight: 700; color: #1e293b;">
                    <span>Fecha y Hora de la Consulta *</span>
                    <input
                      type="datetime-local"
                      formControlName="fecha"
                      style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; font-size: 13px;"
                    />
                  </label>

                  <label style="display: grid; gap: 4px; font-size: 11px; font-weight: 700; color: #1e293b;">
                    <span>Establecimiento de Salud *</span>
                    <input
                      type="text"
                      formControlName="establecimiento"
                      placeholder="Ej. Clínica Central"
                      style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; font-size: 13px;"
                    />
                  </label>
                </div>

                <div style="margin-bottom: 14px;">
                  <label style="display: grid; gap: 4px; font-size: 11px; font-weight: 700; color: #1e293b;">
                    <span>Nombre del Paciente</span>
                    <input
                      type="text"
                      [value]="selectedPatient() ? selectedPatient()!.firstName + ' ' + selectedPatient()!.lastName + ' (C.I. ' + selectedPatient()!.documentNumber + ')' : ''"
                      disabled
                      style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 13px; background: #f8fafc; color: #475569;"
                    />
                  </label>
                </div>

                <!-- Motivo -->
                <div style="margin-bottom: 16px;">
                  <label style="display: grid; gap: 4px; font-size: 11px; font-weight: 700; color: #1e293b;">
                    <span>Motivo de la Consulta *</span>
                    <textarea
                      formControlName="motivoConsulta"
                      rows="3"
                      placeholder="Describa el motivo de la consulta, síntomas principales y molestias que refiere el paciente..."
                      style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 10px; font-size: 13px; resize: vertical;"
                    ></textarea>
                  </label>
                </div>

                <!-- SIGNOS VITALES -->
                <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #f8fafc; margin-bottom: 18px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                      <h4 style="margin: 0; font-size: 11px; font-weight: 800; color: #087f7b; text-transform: uppercase;">
                        SIGNOS VITALES
                      </h4>
                      <small style="color: #64748b; font-size: 10px;">IMC = Peso (kg) / Talla² (m)</small>
                    </div>
                    @if (currentLiveIMC(); as imcInfo) {
                      <div style="display: flex; align-items: center; gap: 6px; background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <span style="font-size: 11px; color: #475569;">IMC:</span>
                        <strong style="font-size: 12px; color: #0f172a;">{{ imcInfo.imc }}</strong>
                        <span
                          [style.color]="imcInfo.color"
                          [style.background]="imcInfo.bg"
                          style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;"
                        >
                          {{ imcInfo.label }}
                        </span>
                      </div>
                    }
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Peso (kg)</span>
                      <input type="number" step="0.1" formControlName="peso" placeholder="Ej. 65" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Talla (cm)</span>
                      <input type="number" formControlName="talla" placeholder="Ej. 165" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Presión Arterial (mmHg)</span>
                      <input type="text" formControlName="presionArterial" placeholder="Ej. 120/80" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Frecuencia Cardíaca (lpm)</span>
                      <input type="number" formControlName="frecuenciaCardiaca" placeholder="Ej. 72" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Frecuencia Resp. (rpm)</span>
                      <input type="number" formControlName="frecuenciaRespiratoria" placeholder="Ej. 18" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Temperatura (°C)</span>
                      <input type="number" step="0.1" formControlName="temperatura" placeholder="Ej. 36.5" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Saturación de Oxígeno (%)</span>
                      <input type="number" formControlName="saturacionOxigeno" placeholder="Ej. 98" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                    <label style="display: grid; gap: 3px; font-size: 10px; font-weight: 700; color: #475569;">
                      <span>Glicemia (mg/dl)</span>
                      <input type="number" formControlName="glicemia" placeholder="Ej. 95" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font-size: 12px; background: #fff;" />
                    </label>
                  </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                  <button
                    type="button"
                    (click)="closeNewConsultationModal()"
                    style="background: #f1f5f9; color: #475569; border: 0; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer;"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    [disabled]="isSavingConsultation() || consultationForm.invalid"
                    style="background: #087f7b; color: #fff; border: 0; border-radius: 6px; padding: 8px 20px; font-size: 12px; font-weight: 700; cursor: pointer;"
                    [style.opacity]="(isSavingConsultation() || consultationForm.invalid) ? '0.5' : '1'"
                  >
                    {{ isSavingConsultation() ? 'Guardando consulta...' : 'Guardar Consulta Médica' }}
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>
      }

      <!-- ========================================================================================= -->
      <!-- MODAL: HOJA OFICIAL IMPRESIÓN DE CONSULTA INDIVIDUAL (Registro_Consulta_Medica.docx)      -->
      <!-- ========================================================================================= -->
      @if (showOfficialConsultationModal(); as item) {
        <div class="modal-backdrop print-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 10000; overflow-y: auto; padding: 30px 15px; display: flex; justify-content: center; align-items: flex-start;">
          <div class="print-modal-content" style="background: #ffffff; border-radius: 8px; width: 100%; max-width: 820px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; margin: auto;">
            
            <div class="no-print" style="background: #1e293b; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 13px;">Formato Oficial: Registro de Consulta Médica</span>
              <div style="display: flex; gap: 8px;">
                <button
                  type="button"
                  (click)="closeOfficialConsultationPreview()"
                  style="background: #334155; color: #fff; border: 0; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  (click)="printDocument()"
                  style="background: #087f7b; color: #fff; border: 0; border-radius: 6px; padding: 6px 16px; font-size: 12px; font-weight: 700; cursor: pointer;"
                >
                  Imprimir Consulta
                </button>
              </div>
            </div>

            <!-- HOJA IMPRIMIBLE DE LA CONSULTA MÉDICA (Formato Registro_Consulta_Medica.docx) -->
            <div class="printable-sheet" style="padding: 40px; background: #ffffff; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.35; font-size: 13px;">
              
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
                  REGISTRO DE CONSULTA MÉDICA
                </h1>
                <p style="margin: 4px 0 0; font-size: 14px; font-style: italic;">
                  Motivo de la consulta y signos vitales
                </p>
              </div>

              <!-- TABLA 1: Fecha, Establecimiento, Paciente -->
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 16px;">
                <tr>
                  <td style="border: 1px solid #000; padding: 8px 12px; width: 45%;">
                    <strong>Fecha:</strong> {{ formatMedicalDate(item.data.fecha) }}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px 12px; width: 55%;">
                    <strong>Establecimiento de salud:</strong> {{ item.data.establecimiento || 'Clínica Central' }}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Nombre del paciente:</strong> 
                    @if (selectedPatient(); as p) {
                      {{ p.firstName }} {{ p.lastName }} (C.I. {{ p.documentNumber }})
                    } @else {
                      {{ item.data.motivoConsulta }}
                    }
                  </td>
                </tr>
              </table>

              <!-- TABLA 2: Motivo -->
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px;">
                <tr>
                  <td style="border: 1px solid #000; padding: 10px 12px; min-height: 80px; vertical-align: top;">
                    <strong>Motivo de la consulta:</strong>
                    <p style="margin: 8px 0 0; font-size: 13px; white-space: pre-wrap; line-height: 1.45;">
                      {{ item.data.motivoConsulta }}
                    </p>
                  </td>
                </tr>
              </table>

              <div style="margin-bottom: 8px;">
                <h2 style="margin: 0 0 8px; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                  SIGNOS VITALES
                </h2>
              </div>

              <!-- TABLA 3: Grilla de Signos Vitales -->
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 12px;">
                <tr>
                  <td style="border: 1px solid #000; padding: 8px 12px; width: 33.3%;">
                    <strong>Peso (kg):</strong> {{ item.data.signosVitales.peso ?? '--' }}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px 12px; width: 33.3%;">
                    <strong>Talla (cm):</strong> {{ item.data.signosVitales.talla ?? '--' }}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px 12px; width: 33.4%;">
                    <strong>IMC:</strong> {{ item.data.signosVitales.imc ?? '--' }}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Presión Arterial (mmHg):</strong> {{ item.data.signosVitales.presionArterial ?? '--' }}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Frecuencia Cardíaca (lpm):</strong> {{ item.data.signosVitales.frecuenciaCardiaca ?? '--' }}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Frecuencia Respiratoria (rpm):</strong> {{ item.data.signosVitales.frecuenciaRespiratoria ?? '--' }}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Temperatura (°C):</strong> {{ item.data.signosVitales.temperatura ?? '--' }}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Saturación de Oxígeno (%):</strong> {{ item.data.signosVitales.saturacionOxigeno ?? '--' }}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px 12px;">
                    <strong>Glicemia (mg/dl):</strong> {{ item.data.signosVitales.glicemia ?? '--' }}
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 36px; font-size: 11px; font-style: italic; color: #333;">
                IMC = Peso (kg) ÷ Talla² (m).
              </p>

              <!-- Bloque de Firmas -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; margin-top: 40px; padding-top: 20px;">
                <div>
                  <div style="border-top: 1px solid #000; width: 80%; margin: auto; padding-top: 4px;">
                    <strong>Firma / Sello del Médico Tratante</strong><br />
                    <small style="font-size: 10px; color: #555;">Matrícula Profesional</small>
                  </div>
                </div>
                <div>
                  <div style="border-top: 1px solid #000; width: 80%; margin: auto; padding-top: 4px;">
                    <strong>Firma del Paciente / Responsable</strong><br />
                    <small style="font-size: 10px; color: #555;">C.I.: {{ selectedPatient()?.documentNumber || '' }}</small>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      }

      <!-- ========================================================================================= -->
      <!-- MODAL: HOJA OFICIAL HISTORIA CLÍNICA GENERAL (INE 101/2010)                              -->
      <!-- ========================================================================================= -->
      @if (showOfficialModal() && selectedPatient(); as patient) {
        <div class="modal-backdrop print-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 10000; overflow-y: auto; padding: 30px 15px; display: flex; justify-content: center; align-items: flex-start;">
          <div class="print-modal-content" style="background: #ffffff; border-radius: 8px; width: 100%; max-width: 860px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; margin: auto;">
            
            <div class="no-print" style="background: #1e293b; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 13px;">Vista Previa Formato Oficial: Historia Clínica (INE 101/2010)</span>
              <div style="display: flex; gap: 8px;">
                <button
                  type="button"
                  (click)="closeOfficialPreview()"
                  style="background: #334155; color: #fff; border: 0; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  (click)="printDocument()"
                  style="background: #087f7b; color: #fff; border: 0; border-radius: 6px; padding: 6px 16px; font-size: 12px; font-weight: 700; cursor: pointer;"
                >
                  Imprimir Documento
                </button>
              </div>
            </div>

            <!-- HOJA IMPRIMIBLE DE HISTORIA GENERAL -->
            <div class="printable-sheet" style="padding: 40px; background: #ffffff; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.3; font-size: 12px;">
              <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">ESTADO PLURINACIONAL DE BOLIVIA</div>
                <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">MINISTERIO DE SALUD Y DEPORTES</div>
                <h2 style="margin: 4px 0 2px; font-size: 16px; font-weight: bold; text-transform: uppercase;">HISTORIA CLÍNICA</h2>
                <div style="font-size: 10px; color: #333;">FORMULARIO OFICIAL INE 101/2010 · REGISTRO MÉDICO DEL PACIENTE</div>
              </div>

              <!-- B. IDENTIFICACIÓN DEL PACIENTE -->
              <div style="border: 1px solid #333; margin-bottom: 10px; padding: 6px 10px;">
                <b style="font-size: 11px; text-transform: uppercase; display: block; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                  B. IDENTIFICACIÓN DEL PACIENTE / USUARIO
                </b>
                <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: 8px; margin-bottom: 4px;">
                  <div><strong>Paciente:</strong> {{ patient.firstName }} {{ patient.lastName }}</div>
                  <div><strong>Documento:</strong> {{ patient.documentType }} {{ patient.documentNumber }}</div>
                  <div><strong>Grupo Sanguíneo:</strong> {{ historyForm.value.bloodType || 'Sin registrar' }}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                  <div><strong>Teléfono:</strong> {{ patient.phone || 'No registrado' }}</div>
                  <div><strong>Email:</strong> {{ patient.email || 'No registrado' }}</div>
                  <div><strong>Estado:</strong> {{ patient.status }}</div>
                </div>
              </div>

              <!-- F. ANTECEDENTES PATOLÓGICOS Y ALERGIAS -->
              <div style="border: 1px solid #333; margin-bottom: 10px; padding: 6px 10px;">
                <b style="font-size: 11px; text-transform: uppercase; display: block; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                  F. ANTECEDENTES PATOLÓGICOS Y ALERGIAS
                </b>
                <div style="margin-bottom: 6px;">
                  <strong>Hospitalizaciones / Cirugías / Traumas:</strong>
                  <p style="margin: 2px 0 0; padding-left: 8px; color: #222;">
                    {{ historyForm.value.pathologicalAntecedents || 'Sin antecedentes patológicos consignados.' }}
                  </p>
                </div>
                <div>
                  <strong>Alergias Conocidas:</strong>
                  @if (allergies.length === 0) {
                    <span style="margin-left: 6px;">No se registran alergias conocidas.</span>
                  } @else {
                    <ul style="margin: 4px 0 0; padding-left: 20px;">
                      @for (a of allergies.controls; track $index) {
                        <li>
                          <strong>{{ a.value.allergen }}</strong> (Severidad: {{ a.value.severity }})
                          @if (a.value.reaction) { - Reacción: {{ a.value.reaction }} }
                        </li>
                      }
                    </ul>
                  }
                </div>
              </div>

              <!-- ANTECEDENTES NO PATOLÓGICOS Y FAMILIARES -->
              <div style="border: 1px solid #333; margin-bottom: 10px; padding: 6px 10px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <b style="font-size: 11px; text-transform: uppercase; display: block; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                      ANTECEDENTES NO PATOLÓGICOS
                    </b>
                    <p style="margin: 2px 0 0; color: #222;">
                      {{ historyForm.value.nonPathologicalAntecedents || 'Sin particularidades.' }}
                    </p>
                  </div>
                  <div>
                    <b style="font-size: 11px; text-transform: uppercase; display: block; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                      ANTECEDENTES FAMILIARES
                    </b>
                    <p style="margin: 2px 0 0; color: #222;">
                      {{ historyForm.value.familyAntecedents || 'Sin antecedentes hereditarios de relevancia.' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- G. MEDICAMENTOS Y CONDICIONES CRÓNICAS -->
              <div style="border: 1px solid #333; margin-bottom: 10px; padding: 6px 10px;">
                <b style="font-size: 11px; text-transform: uppercase; display: block; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                  G. ENFERMEDADES CRÓNICAS Y MEDICACIÓN
                </b>
                <div>
                  <strong>Condiciones Crónicas:</strong>
                  <p style="margin: 2px 0 0; padding-left: 8px;">
                    {{ historyForm.value.chronicConditions || 'Ninguna registrada.' }}
                  </p>
                </div>
              </div>

              <!-- J. OBSERVACIONES GENERALES -->
              <div style="border: 1px solid #333; margin-bottom: 24px; padding: 6px 10px;">
                <b style="font-size: 11px; text-transform: uppercase; display: block; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                  J. OBSERVACIONES CLÍNICAS Y FACTORES DE RIESGO
                </b>
                <p style="margin: 2px 0 0; padding-left: 8px;">
                  {{ historyForm.value.observations || 'Sin observaciones adicionales.' }}
                </p>
              </div>

              <!-- Bloque de Firmas -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; margin-top: 30px; padding-top: 20px;">
                <div>
                  <div style="border-top: 1px solid #000; width: 80%; margin: auto; padding-top: 4px;">
                    <strong>Firma / Sello del Médico Tratante</strong><br />
                    <small style="font-size: 10px; color: #555;">Matrícula Profesional</small>
                  </div>
                </div>
                <div>
                  <div style="border-top: 1px solid #000; width: 80%; margin: auto; padding-top: 4px;">
                    <strong>Firma del Paciente / Responsable</strong><br />
                    <small style="font-size: 10px; color: #555;">C.I.: {{ patient.documentNumber }}</small>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      }

      <!-- MODAL: BAJA JUSTIFICADA DE HISTORIA CLÍNICA (HU-11) -->
      @if (showDeleteModal()) {
        <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div class="modal-card" style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 540px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); overflow: hidden;">
            <div style="padding: 16px 20px; border-bottom: 1px solid #fee2e2; background: #fef2f2; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #dc2626; letter-spacing: .06em;">
                  SEGURIDAD Y AUDITORÍA CLÍNICA
                </span>
                <h2 style="margin: 2px 0 0; font-size: 17px; font-weight: 800; color: #991b1b;">
                  Dar de Baja Historia Clínica
                </h2>
              </div>
              <button
                type="button"
                (click)="closeDeleteModal()"
                style="background: transparent; border: 0; font-size: 20px; color: #991b1b; cursor: pointer; padding: 4px;"
              >✕</button>
            </div>
            
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
              <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                Estás a punto de dar de baja la historia clínica <strong>{{ currentHistory()?.code }}</strong> del paciente <strong>{{ selectedPatient()?.firstName }} {{ selectedPatient()?.lastName }}</strong>.
              </p>
              <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #92400e;">
                <strong>Requisito reglamentario:</strong> Es obligatorio justificar formalmente el motivo de la baja clínica. Esta acción queda registrada de forma inmutable en la bitácora de auditoría.
              </div>

              @if (deleteError()) {
                <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; padding: 8px 12px; border-radius: 6px; font-size: 12px;">
                  {{ deleteError() }}
                </div>
              }

              <div>
                <label style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin-bottom: 6px;">
                  Motivo justificado de la baja (mínimo 10 caracteres) *
                </label>
                <textarea
                  [ngModel]="deleteReason()"
                  (ngModelChange)="deleteReason.set($event)"
                  rows="4"
                  placeholder="Ej. Duplicidad detectada en admisión con el expediente HC-2025-0012, verificado por dirección médica."
                  style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 13px; box-sizing: border-box; resize: vertical;"
                ></textarea>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 4px;">
                  <span>Mínimo 10 caracteres</span>
                  <span [style.color]="deleteReason().trim().length >= 10 ? '#16a34a' : '#dc2626'">
                    {{ deleteReason().trim().length }} / 500
                  </span>
                </div>
              </div>
            </div>

            <div style="padding: 14px 20px; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: flex-end; gap: 10px;">
              <button
                type="button"
                (click)="closeDeleteModal()"
                style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer;"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="isDeleting() || deleteReason().trim().length < 10"
                (click)="confirmDelete()"
                style="background: #dc2626; border: 0; color: #ffffff; border-radius: 8px; padding: 8px 18px; font-size: 12px; font-weight: 700; cursor: pointer;"
                [style.opacity]="deleteReason().trim().length < 10 || isDeleting() ? '0.5' : '1'"
              >
                {{ isDeleting() ? 'Dando de baja...' : 'Confirmar Baja Clínica' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: VINCULAR DOCUMENTO A LA HISTORIA CLÍNICA (HU-11) -->
      @if (showLinkDocModal()) {
        <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div class="modal-card" style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 600px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); overflow: hidden;">
            <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #087f7b; letter-spacing: .06em;">
                  TRAZABILIDAD DOCUMENTAL
                </span>
                <h2 style="margin: 2px 0 0; font-size: 17px; font-weight: 800; color: #1e293b;">
                  Vincular Documento Clínico
                </h2>
              </div>
              <button
                type="button"
                (click)="showLinkDocModal.set(false)"
                style="background: transparent; border: 0; font-size: 20px; color: #64748b; cursor: pointer; padding: 4px;"
              >✕</button>
            </div>

            <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto;">
              <p style="margin: 0; font-size: 13px; color: #475569;">
                Selecciona un documento del repositorio para asociarlo al expediente del paciente:
              </p>

              @if (availableDocuments().length === 0) {
                <div style="text-align: center; padding: 24px; color: #64748b; font-size: 13px;">
                  No hay documentos disponibles para vincular o ya están asociados.
                </div>
              } @else {
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  @for (doc of availableDocuments(); track doc.id) {
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fafafa;">
                      <div>
                        <strong style="font-size: 13px; color: #1e293b; display: block;">{{ doc.code }} - {{ doc.name }}</strong>
                        <small style="color: #64748b; font-size: 11px;">Estado: {{ doc.status }}</small>
                      </div>
                      <button
                        type="button"
                        [disabled]="isLinkingDoc()"
                        (click)="confirmLinkDoc(doc.id)"
                        style="background: #087f7b; color: #ffffff; border: 0; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;"
                      >
                        Vincular
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <div style="padding: 14px 20px; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: flex-end;">
              <button
                type="button"
                (click)="showLinkDocModal.set(false)"
                style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer;"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .patients-scroll::-webkit-scrollbar,
    .consultations-feed::-webkit-scrollbar {
      width: 5px;
    }
    .patients-scroll::-webkit-scrollbar-track,
    .consultations-feed::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }
    .patients-scroll::-webkit-scrollbar-thumb,
    .consultations-feed::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    .patients-scroll::-webkit-scrollbar-thumb:hover,
    .consultations-feed::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    @media print {
      body * {
        visibility: hidden;
      }
      .print-modal-backdrop, .print-modal-content {
        position: static !important;
        width: 100% !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: none !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
      }
      .printable-sheet, .printable-sheet * {
        visibility: visible !important;
      }
      .printable-sheet {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        padding: 20px !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `]
})
export class HistoriaClinicaPage implements OnInit {
  private readonly clinicalService = inject(ClinicalApiService);
  private readonly documentApi = inject(DocumentApiService);
  private readonly fb = inject(FormBuilder);

  readonly patients = signal<ApiPatient[]>([]);
  readonly searchQuery = signal<string>('');
  readonly selectedPatientId = signal<string>('');
  readonly selectedPatient = signal<ApiPatient | null>(null);

  // Tab activo en la esquina superior derecha: 'historial' | 'consultas' | 'documentos'
  readonly activeTab = signal<'historial' | 'consultas' | 'documentos'>('historial');

  // Baja justificada (HU-11)
  readonly showDeleteModal = signal<boolean>(false);
  readonly deleteReason = signal<string>('');
  readonly isDeleting = signal<boolean>(false);
  readonly deleteError = signal<string>('');

  // Documentos vinculados (HU-11)
  readonly linkedDocuments = signal<ClinicalLinkedDocument[]>([]);
  readonly linkedDocsLoading = signal<boolean>(false);
  readonly availableDocuments = signal<ApiDocument[]>([]);
  readonly showLinkDocModal = signal<boolean>(false);
  readonly isLinkingDoc = signal<boolean>(false);

  readonly historyLoading = signal<boolean>(false);
  readonly currentHistory = signal<ClinicalHistory | null>(null);

  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly successMessage = signal<string>('');
  readonly showOfficialModal = signal<boolean>(false);

  // Consultas Médicas
  readonly patientConsultations = signal<ConsultaMedicaItem[]>([]);
  readonly consultationsLoading = signal<boolean>(false);
  readonly showNewConsultationModal = signal<boolean>(false);
  readonly showOfficialConsultationModal = signal<ConsultaMedicaItem | null>(null);

  readonly isSavingConsultation = signal<boolean>(false);
  readonly consultationSuccessMsg = signal<string>('');
  readonly consultationErrorMsg = signal<string>('');

  readonly filteredPatients = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.patients();
    if (!query) return list;
    return list.filter(p =>
      p.firstName.toLowerCase().includes(query) ||
      p.lastName.toLowerCase().includes(query) ||
      (p.documentNumber && p.documentNumber.toLowerCase().includes(query))
    );
  });

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

  consultationForm: FormGroup = this.fb.group({
    fecha: [getCurrentDateTimeString(), Validators.required],
    establecimiento: ['Clínica Central', Validators.required],
    motivoConsulta: ['', Validators.required],
    peso: [null, [Validators.min(0.5), Validators.max(300)]],
    talla: [null, [Validators.min(20), Validators.max(250)]],
    presionArterial: [''],
    frecuenciaCardiaca: [null],
    frecuenciaRespiratoria: [null],
    temperatura: [null],
    saturacionOxigeno: [null],
    glicemia: [null],
  });

  ngOnInit() {
    this.loadPatients();
  }

  loadPatients() {
    this.clinicalService.patients('', 0, 100).subscribe({
      next: (page) => {
        this.patients.set(page.content);
        if (page.content.length > 0 && !this.selectedPatientId()) {
          this.onSelectPatient(page.content[0].id);
        }
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar la lista de pacientes.');
      },
    });
  }

  // Verifica si un paciente coincide con la búsqueda para remarcarlo en azul
  isHighlighted(p: ApiPatient): boolean {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return false;
    return p.firstName.toLowerCase().includes(query) ||
           p.lastName.toLowerCase().includes(query) ||
           Boolean(p.documentNumber && p.documentNumber.toLowerCase().includes(query));
  }

  onSearchInput(query: string) {
    this.searchQuery.set(query);
    const matches = this.filteredPatients();
    if (matches.length > 0) {
      const currentStillMatches = matches.some(p => p.id === this.selectedPatientId());
      if (!currentStillMatches) {
        this.onSelectPatient(matches[0].id);
      }
    } else {
      this.selectedPatientId.set('');
      this.selectedPatient.set(null);
      this.currentHistory.set(null);
      this.patientConsultations.set([]);
    }
  }

  onSelectPatient(patientId: string) {
    this.selectedPatientId.set(patientId);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.consultationSuccessMsg.set('');
    this.consultationErrorMsg.set('');

    const patient = this.patients().find(p => p.id === patientId) || null;
    this.selectedPatient.set(patient);

    if (!patientId) {
      this.currentHistory.set(null);
      this.patientConsultations.set([]);
      this.resetForm();
      return;
    }

    this.historyForm.patchValue({ patientId });
    this.fetchClinicalHistory(patientId);
  }

  fetchClinicalHistory(patientId: string) {
    this.historyLoading.set(true);
    this.currentHistory.set(null);
    this.patientConsultations.set([]);

    this.clinicalService.histories(patientId).subscribe({
      next: (res) => {
        this.historyLoading.set(false);
        if (res.content && res.content.length > 0) {
          const hist = res.content[0];
          this.currentHistory.set(hist);
          this.populateForm(hist);
          this.loadPatientConsultations(hist.id);
          this.loadLinkedDocuments(hist.id);
        } else {
          this.currentHistory.set(null);
          this.resetFormFieldsKeepPatient(patientId);
          this.patientConsultations.set([]);
          this.linkedDocuments.set([]);
        }
      },
      error: () => {
        this.historyLoading.set(false);
        this.currentHistory.set(null);
        this.patientConsultations.set([]);
        this.linkedDocuments.set([]);
      }
    });
  }

  loadPatientConsultations(historyId: string) {
    this.consultationsLoading.set(true);
    this.documentApi.medicalNotes(historyId, 0, 100).subscribe({
      next: (page) => {
        this.consultationsLoading.set(false);
        const items = (page.content || []).map(note => parseConsulta(note));
        this.patientConsultations.set(items);
      },
      error: () => {
        this.consultationsLoading.set(false);
        this.patientConsultations.set([]);
      }
    });
  }

  populateForm(hist: ClinicalHistory) {
    this.historyForm.patchValue({
      patientId: hist.patientId,
      bloodType: hist.bloodType || '',
      pathologicalAntecedents: hist.pathologicalAntecedents || '',
      nonPathologicalAntecedents: hist.nonPathologicalAntecedents || '',
      familyAntecedents: hist.familyAntecedents || '',
      chronicConditions: hist.chronicConditions || '',
      observations: hist.observations || '',
    });

    this.allergies.clear();
    if (hist.allergies && Array.isArray(hist.allergies)) {
      hist.allergies.forEach(a => {
        this.allergies.push(
          this.fb.group({
            allergen: [a.allergen || '', Validators.required],
            severity: [a.severity || 'LOW', Validators.required],
            reaction: [a.reaction || ''],
          })
        );
      });
    }
  }

  resetFormFieldsKeepPatient(patientId: string) {
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
    this.historyForm.reset();
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
    const existing = this.currentHistory();

    if (existing && existing.id) {
      this.clinicalService.updateHistory(existing.id, formValue).subscribe({
        next: (updated) => {
          this.currentHistory.set(updated);
          this.successMessage.set(`Historia clínica ${updated.code} actualizada exitosamente.`);
          this.isSaving.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          if (err.status === 409) {
            this.errorMessage.set('Conflicto de concurrencia: Otro usuario modificó este expediente simultáneamente. Se recargarán los datos más recientes para prevenir pérdida de información.');
            if (this.selectedPatientId()) {
              this.fetchClinicalHistory(this.selectedPatientId());
            }
          } else {
            this.errorMessage.set(err.error?.message || 'Error al actualizar la historia clínica.');
          }
        }
      });
    } else {
      this.clinicalService.createHistory(formValue).subscribe({
        next: (created) => {
          this.currentHistory.set(created);
          this.successMessage.set(`Historia clínica ${created.code} creada y guardada exitosamente.`);
          this.isSaving.set(false);
          this.loadPatientConsultations(created.id);
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.errorMessage.set(err.error?.message || 'Error al registrar la nueva historia clínica.');
        }
      });
    }
  }

  currentLiveIMC(): { imc: number; label: string; color: string; bg: string } | null {
    const peso = Number(this.consultationForm.get('peso')?.value);
    const talla = Number(this.consultationForm.get('talla')?.value);
    if (!peso || !talla || talla <= 0 || peso <= 0) return null;
    const tallaM = talla > 3 ? talla / 100 : talla;
    const imc = parseFloat((peso / (tallaM * tallaM)).toFixed(2));
    const status = computeIMCStatus(imc);
    return { imc, label: status.label, color: status.color, bg: status.bg };
  }

  getIMCStatus(imc: number | null | undefined) {
    return computeIMCStatus(imc);
  }

  openNewConsultationModal() {
    this.consultationSuccessMsg.set('');
    this.consultationErrorMsg.set('');
    this.consultationForm.patchValue({
      fecha: getCurrentDateTimeString(),
      establecimiento: 'Clínica Central',
      motivoConsulta: '',
      peso: null,
      talla: null,
      presionArterial: '',
      frecuenciaCardiaca: null,
      frecuenciaRespiratoria: null,
      temperatura: null,
      saturacionOxigeno: null,
      glicemia: null,
    });
    this.showNewConsultationModal.set(true);
  }

  closeNewConsultationModal() {
    this.showNewConsultationModal.set(false);
    this.consultationSuccessMsg.set('');
    this.consultationErrorMsg.set('');
  }

  clearSuccessAndPrepareAnother() {
    this.consultationSuccessMsg.set('');
    this.consultationErrorMsg.set('');
    this.consultationForm.patchValue({
      fecha: getCurrentDateTimeString(),
      motivoConsulta: '',
      peso: null,
      talla: null,
      presionArterial: '',
      frecuenciaCardiaca: null,
      frecuenciaRespiratoria: null,
      temperatura: null,
      saturacionOxigeno: null,
      glicemia: null,
    });
  }

  saveConsultation() {
    if (this.consultationForm.invalid) return;
    const patient = this.selectedPatient();
    if (!patient) return;

    this.isSavingConsultation.set(true);
    this.consultationErrorMsg.set('');
    this.consultationSuccessMsg.set('');

    const formVal = this.consultationForm.value;
    const peso = formVal.peso ? Number(formVal.peso) : null;
    const talla = formVal.talla ? Number(formVal.talla) : null;
    let imc: number | null = null;
    if (peso && talla && talla > 0) {
      const tallaM = talla > 3 ? talla / 100 : talla;
      imc = parseFloat((peso / (tallaM * tallaM)).toFixed(2));
    }

    const payloadData: ConsultaMedicaData = {
      fecha: formVal.fecha || getCurrentDateTimeString(),
      establecimiento: formVal.establecimiento || 'Clínica Central',
      motivoConsulta: formVal.motivoConsulta.trim(),
      signosVitales: {
        peso,
        talla,
        imc,
        presionArterial: formVal.presionArterial?.trim() || null,
        frecuenciaCardiaca: formVal.frecuenciaCardiaca ? Number(formVal.frecuenciaCardiaca) : null,
        frecuenciaRespiratoria: formVal.frecuenciaRespiratoria ? Number(formVal.frecuenciaRespiratoria) : null,
        temperatura: formVal.temperatura ? Number(formVal.temperatura) : null,
        saturacionOxigeno: formVal.saturacionOxigeno ? Number(formVal.saturacionOxigeno) : null,
        glicemia: formVal.glicemia ? Number(formVal.glicemia) : null,
      }
    };

    const contentJson = JSON.stringify(payloadData);

    const history = this.currentHistory();
    if (!history || !history.id) {
      this.clinicalService.createHistory({
        patientId: patient.id,
        bloodType: this.historyForm.value.bloodType || 'O+',
        allergies: [],
        currentMedications: [],
        baseDiagnoses: []
      }).subscribe({
        next: (newHist) => {
          this.currentHistory.set(newHist);
          this.doCreateMedicalNote(newHist.id, contentJson, payloadData);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingConsultation.set(false);
          this.consultationErrorMsg.set('No se pudo inicializar la historia clínica del paciente para asociar la consulta.');
        }
      });
    } else {
      this.doCreateMedicalNote(history.id, contentJson, payloadData);
    }
  }

  private doCreateMedicalNote(historyId: string, contentJson: string, data: ConsultaMedicaData) {
    this.documentApi.createMedicalNote({
      clinicalHistoryId: historyId,
      noteType: 'CONSULTA_MEDICA',
      content: contentJson,
    }).subscribe({
      next: (createdNote) => {
        this.isSavingConsultation.set(false);
        const item: ConsultaMedicaItem = {
          id: createdNote.id,
          clinicalHistoryId: historyId,
          createdAt: createdNote.createdAt || data.fecha,
          data
        };
        this.patientConsultations.update(list => [item, ...list]);
        this.consultationSuccessMsg.set('Consulta médica guardada exitosamente. Este registro es inmutable.');
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingConsultation.set(false);
        this.consultationErrorMsg.set(err.error?.message || 'Error al guardar la consulta médica.');
      }
    });
  }

  openOfficialConsultationPreview(item: ConsultaMedicaItem) {
    this.showOfficialConsultationModal.set(item);
  }

  closeOfficialConsultationPreview() {
    this.showOfficialConsultationModal.set(null);
  }

  formatMedicalDate(val: string | number | undefined | null): string {
    return formatMedicalDate(val);
  }

  openOfficialPreview() {
    this.showOfficialModal.set(true);
  }

  closeOfficialPreview() {
    this.showOfficialModal.set(false);
  }

  printDocument() {
    window.print();
  }

  // --- MÉTODOS HU-11: BAJA JUSTIFICADA Y TRAZABILIDAD DOCUMENTAL ---

  openDeleteModal() {
    this.deleteReason.set('');
    this.deleteError.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deleteReason.set('');
    this.deleteError.set('');
  }

  confirmDelete() {
    const reason = this.deleteReason().trim();
    if (reason.length < 10) {
      this.deleteError.set('El motivo justificado debe tener al menos 10 caracteres.');
      return;
    }
    const hist = this.currentHistory();
    if (!hist) return;

    this.isDeleting.set(true);
    this.deleteError.set('');
    this.clinicalService.deleteHistory(hist.id, reason).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.successMessage.set('Historia clínica dada de baja exitosamente con registro inmutable en auditoría.');
        this.currentHistory.set(null);
        this.resetForm();
        this.linkedDocuments.set([]);
        this.patientConsultations.set([]);
        if (this.selectedPatientId()) {
          this.fetchClinicalHistory(this.selectedPatientId());
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isDeleting.set(false);
        this.deleteError.set(err.error?.message || 'Error al dar de baja la historia clínica.');
      }
    });
  }

  loadLinkedDocuments(historyId?: string) {
    const id = historyId || this.currentHistory()?.id;
    if (!id) {
      this.linkedDocuments.set([]);
      return;
    }
    this.linkedDocsLoading.set(true);
    this.clinicalService.getLinkedDocuments(id).subscribe({
      next: (docs) => {
        this.linkedDocsLoading.set(false);
        this.linkedDocuments.set(docs || []);
      },
      error: () => {
        this.linkedDocsLoading.set(false);
      }
    });
  }

  openLinkDocModal() {
    this.showLinkDocModal.set(true);
    this.documentApi.documents('', undefined, 0, 50).subscribe({
      next: (res) => {
        const linkedIds = new Set(this.linkedDocuments().map(d => d.id));
        this.availableDocuments.set((res.content || []).filter(d => !linkedIds.has(d.id)));
      }
    });
  }

  confirmLinkDoc(docId: string) {
    const hist = this.currentHistory();
    if (!hist) return;

    this.isLinkingDoc.set(true);
    this.clinicalService.linkDocument(hist.id, docId).subscribe({
      next: () => {
        this.isLinkingDoc.set(false);
        this.showLinkDocModal.set(false);
        this.loadLinkedDocuments(hist.id);
      },
      error: (err: HttpErrorResponse) => {
        this.isLinkingDoc.set(false);
        alert(err.error?.message || 'No fue posible vincular el documento.');
      }
    });
  }

  unlinkDoc(docId: string) {
    const hist = this.currentHistory();
    if (!hist) return;

    if (!confirm('¿Desea desvincular este documento de la historia clínica?')) return;

    this.clinicalService.unlinkDocument(hist.id, docId).subscribe({
      next: () => {
        this.loadLinkedDocuments(hist.id);
      },
      error: (err: HttpErrorResponse) => {
        alert(err.error?.message || 'Error al desvincular el documento.');
      }
    });
  }
}
