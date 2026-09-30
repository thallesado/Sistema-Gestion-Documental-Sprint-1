import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiPatient, ClinicalApiService, CreatePatientPayload } from '../../../core/api/clinical-api.service';

@Component({
  selector: 'app-pacientes-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <!-- Encabezado Corporativo NexoDocs -->
      <header class="dashboard-welcome">
        <div>
          <p class="eyebrow">MÓDULO CLÍNICO · PACIENTES</p>
          <h1>Directorio y Registro de Pacientes</h1>
          <p class="welcome-copy">
            Padrón unificado de pacientes del tenant, identificación unívoca y acceso directo a historias clínicas y antecedentes.
          </p>
        </div>
      </header>

      <!-- Tarjetas Métricas KPI -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrap teal">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div class="stat-value">{{ patients().length }}</div>
            <div class="stat-label">Pacientes en Directorio</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrap blue">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <div class="stat-value">Activo</div>
            <div class="stat-label">Padrón Tenant Actual</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrap green">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <div class="stat-value">Estructurada</div>
            <div class="stat-label">Diagnósticos y Antecedentes</div>
          </div>
        </div>
      </div>

      <!-- Barra de Acción y Búsqueda -->
      <div class="actions-bar">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Buscar por nombre, apellidos o número de documento..."
          />
        </div>

        <button type="button" class="primary-btn" (click)="openCreateModal()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Alta de Paciente</span>
        </button>
      </div>

      <!-- Tabla Principal de Pacientes -->
      <section class="dashboard-card table-panel">
        <div class="panel-header">
          <div>
            <h2>Pacientes Registrados</h2>
            <p>Selecciona un paciente para revisar o aperturar sus antecedentes clínicos.</p>
          </div>
          <span class="count-tag">{{ filteredPatients().length }} resultado(s)</span>
        </div>

        @if (isLoading()) {
          <div class="loading-state">
            <p>Cargando padrón de pacientes de la clínica...</p>
          </div>
        } @else if (errorMessage()) {
          <div class="msg-box error">
            ⚠️ {{ errorMessage() }}
          </div>
        } @else if (filteredPatients().length === 0) {
          <div class="empty-state">
            <p>No se encontraron pacientes que coincidan con la búsqueda.</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Documento</th>
                  <th>Fecha de Nacimiento</th>
                  <th>Género</th>
                  <th>Contacto</th>
                  <th style="text-align: right;">Acciones Clínicas</th>
                </tr>
              </thead>
              <tbody>
                @for (p of filteredPatients(); track p.id) {
                  <tr>
                    <td>
                      <div class="patient-cell">
                        <span class="avatar-circle">{{ getInitials(p.firstName, p.lastName) }}</span>
                        <div>
                          <strong>{{ p.firstName }} {{ p.lastName }}</strong>
                          <small>ID: {{ p.id.slice(0, 8) }}...</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="doc-badge">{{ p.documentType }}</span>
                      <span class="doc-num">{{ p.documentNumber }}</span>
                    </td>
                    <td>
                      {{ p.birthDate ? (p.birthDate | date:'dd/MM/yyyy') : 'No registrado' }}
                    </td>
                    <td>
                      {{ p.gender || 'Sin especificar' }}
                    </td>
                    <td>
                      <div class="contact-info">
                        @if (p.email) {
                          <small>✉ {{ p.email }}</small>
                        }
                        @if (p.phone) {
                          <small>📞 {{ p.phone }}</small>
                        }
                        @if (!p.email && !p.phone) {
                          <small class="muted">-</small>
                        }
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 8px; justify-content: flex-end;">
                        <a
                          class="history-btn"
                          [routerLink]="['/clinical/history']"
                          [queryParams]="{ patientId: p.id }"
                        >
                          📋 Antecedentes
                        </a>
                        <a
                          class="note-action-btn"
                          [routerLink]="['/clinical/notes']"
                          [queryParams]="{ patientId: p.id }"
                        >
                          📝 Nueva Nota
                        </a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Modal Alta de Paciente (HU-03) -->
      @if (showCreateModal()) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h2>Nuevo Registro de Paciente</h2>
                <small>Alta médica para asignación de expediente e historia clínica</small>
              </div>
              <button type="button" class="close-btn" (click)="closeCreateModal()">✕</button>
            </div>

            @if (createError()) {
              <div class="msg-box error" style="margin: 16px 24px 0;">
                ⚠️ {{ createError() }}
              </div>
            }

            <form [formGroup]="patientForm" (ngSubmit)="submitCreatePatient()">
              <div class="form-body">
                <div class="form-row">
                  <label style="max-width: 140px;">
                    <span>Tipo Documento *</span>
                    <select formControlName="documentType">
                      <option value="CI">CI</option>
                      <option value="SEGURO">Seguro</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </label>

                  <label style="flex: 1;">
                    <span>Número de Documento *</span>
                    <input formControlName="documentNumber" placeholder="Ej. 6849201" />
                  </label>
                </div>

                <div class="form-row">
                  <label style="flex: 1;">
                    <span>Nombres *</span>
                    <input formControlName="firstName" placeholder="Ej. Juan Carlos" />
                  </label>

                  <label style="flex: 1;">
                    <span>Apellidos *</span>
                    <input formControlName="lastName" placeholder="Ej. Pérez Gómez" />
                  </label>
                </div>

                <div class="form-row">
                  <label style="flex: 1;">
                    <span>Fecha de Nacimiento</span>
                    <input type="date" formControlName="birthDate" />
                  </label>

                  <label style="flex: 1;">
                    <span>Género</span>
                    <select formControlName="gender">
                      <option value="">-- Seleccionar --</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </label>
                </div>

                <div class="form-row">
                  <label style="flex: 1;">
                    <span>Teléfono</span>
                    <input formControlName="phone" placeholder="Ej. +591 71234567" />
                  </label>

                  <label style="flex: 1;">
                    <span>Correo Electrónico</span>
                    <input type="email" formControlName="email" placeholder="paciente@ejemplo.com" />
                  </label>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="cancel-btn" (click)="closeCreateModal()">Cancelar</button>
                <button type="submit" class="primary-btn" [disabled]="patientForm.invalid || isSubmitting()">
                  {{ isSubmitting() ? 'Registrando...' : 'Guardar Paciente' }}
                </button>
              </div>
            </form>
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

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; }
    .stat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
    .stat-icon-wrap.teal { background: #e6f7f5; color: #087f7b; }
    .stat-icon-wrap.blue { background: #eff6ff; color: #2563eb; }
    .stat-icon-wrap.green { background: #ecfdf5; color: #059669; }
    .stat-value { font-size: 20px; font-weight: 800; color: #153a39; line-height: 1.2; }
    .stat-label { font-size: 12px; color: #6b8583; font-weight: 600; }

    /* Actions Bar */
    .actions-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-input-wrap { position: relative; flex: 1; max-width: 480px; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #8fa8a5; }
    .search-input-wrap input { width: 100%; border: 1px solid #dcebe8; border-radius: 10px; padding: 10px 14px 10px 38px; font-size: 13px; color: #153a39; background: #fff; outline: none; box-sizing: border-box; }
    .search-input-wrap input:focus { border-color: #087f7b; box-shadow: 0 0 0 2px rgba(8, 127, 123, 0.15); }

    .primary-btn { background: #087f7b; color: #fff; border: 0; border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(8, 127, 123, 0.25); text-decoration: none; }
    .primary-btn:hover { background: #066b67; }
    .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Dashboard Card & Table */
    .dashboard-card { background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px; box-sizing: border-box; }
    .panel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .panel-header h2 { font-size: 18px; margin: 0 0 4px; color: #153a39; }
    .panel-header p { font-size: 12px; color: #6b8583; margin: 0; }
    .count-tag { background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 10px; }

    .table-responsive { width: 100%; overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; }
    .data-table th { padding: 12px 14px; font-size: 11px; font-weight: 800; color: #6b8583; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #edf3f1; background: #fbfdfc; }
    .data-table td { padding: 14px; font-size: 13px; color: #153a39; border-bottom: 1px solid #edf3f1; vertical-align: middle; }
    .data-table tr:hover td { background: #f7fbfa; }

    .patient-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-circle { width: 34px; height: 34px; border-radius: 50%; background: #e6f7f5; color: #087f7b; font-weight: 800; font-size: 12px; display: grid; place-items: center; flex-shrink: 0; }
    .patient-cell strong { display: block; font-size: 13px; color: #153a39; }
    .patient-cell small { display: block; font-size: 11px; color: #8fa8a5; }

    .doc-badge { background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 800; border-radius: 4px; padding: 2px 6px; margin-right: 6px; }
    .doc-num { font-weight: 600; color: #1e293b; }
    .contact-info small { display: block; font-size: 11px; color: #64748b; }

    .history-btn { background: #f0fdfa; border: 1px solid #99f6e4; color: #0f766e; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .history-btn:hover { background: #087f7b; color: #fff; border-color: #087f7b; }

    .note-action-btn { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .note-action-btn:hover { background: #2563eb; color: #fff; border-color: #2563eb; }

    .loading-state, .empty-state { padding: 48px; text-align: center; color: #6b8583; font-size: 13px; }
    .msg-box { border-radius: 8px; padding: 12px 16px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .msg-box.error { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }

    /* Modal Formulario */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-card { background: #fff; border-radius: 16px; max-width: 640px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); overflow: hidden; }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
    .modal-header h2 { margin: 0 0 4px; font-size: 18px; color: #153a39; }
    .modal-header small { color: #64748b; font-size: 12px; }
    .close-btn { background: transparent; border: 0; font-size: 18px; color: #64748b; cursor: pointer; padding: 4px; }

    .form-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
    .form-row { display: flex; gap: 16px; }
    .form-row label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: #153a39; }
    input, select { border: 1px solid #dcebe8; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #153a39; background: #fff; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; }
    input:focus, select:focus { border-color: #087f7b; box-shadow: 0 0 0 2px rgba(8, 127, 123, 0.15); }

    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .cancel-btn { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; }
    .cancel-btn:hover { background: #f1f5f9; }
  `]
})
export class PacientesPage implements OnInit {
  private readonly clinicalService = inject(ClinicalApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly patients = signal<ApiPatient[]>([]);
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');
  readonly showCreateModal = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly createError = signal<string>('');

  patientForm: FormGroup = this.fb.group({
    documentType: ['CI', Validators.required],
    documentNumber: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    birthDate: [''],
    gender: [''],
    phone: [''],
    email: [''],
  });

  ngOnInit() {
    this.loadPatients();
  }

  loadPatients() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.clinicalService.patients().subscribe({
      next: (page) => {
        this.patients.set(page.content);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar el listado de pacientes desde el servidor.');
        this.isLoading.set(false);
      },
    });
  }

  filteredPatients(): ApiPatient[] {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.patients();
    return this.patients().filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.documentNumber.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }

  getInitials(firstName: string, lastName: string): string {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}` || 'P';
  }

  openCreateModal() {
    this.patientForm.reset({
      documentType: 'CI',
      documentNumber: '',
      firstName: '',
      lastName: '',
      birthDate: '',
      gender: '',
      phone: '',
      email: '',
    });
    this.createError.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  submitCreatePatient() {
    if (this.patientForm.invalid) return;

    this.isSubmitting.set(true);
    this.createError.set('');

    const formVal = this.patientForm.value;
    const payload: CreatePatientPayload = {
      documentType: formVal.documentType,
      documentNumber: formVal.documentNumber.trim(),
      firstName: formVal.firstName.trim(),
      lastName: formVal.lastName.trim(),
      birthDate: formVal.birthDate || undefined,
      gender: formVal.gender || undefined,
      phone: formVal.phone?.trim() || undefined,
      email: formVal.email?.trim() || undefined,
    };

    this.clinicalService.createPatient(payload).subscribe({
      next: (newPatient) => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.loadPatients();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.createError.set(err?.error?.message || 'Error al registrar el paciente en el servidor.');
      }
    });
  }
}
