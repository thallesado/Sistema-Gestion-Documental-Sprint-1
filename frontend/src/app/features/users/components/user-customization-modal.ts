import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdministrationApiService,
  ApiUser,
  ApiUserCustomization,
  UserCustomizationPayload,
} from '../../../core/api/administration-api.service';
import { ApiDocumentType, DocumentApiService } from '../../../core/api/document-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';

type Section = 'profile' | 'interface' | 'notifications' | 'access' | 'documents';

/** Debe coincidir con UserCustomizationService.LANDING_PAGES del backend. */
export const LANDING_PAGES: { value: string; label: string }[] = [
  { value: '/', label: 'Tablero principal' },
  { value: '/documents', label: 'Documentos · Todos' },
  { value: '/documents/mine', label: 'Documentos · Mis documentos' },
  { value: '/documents/shared', label: 'Documentos · Compartidos conmigo' },
  { value: '/documents/recent', label: 'Documentos · Recientes' },
  { value: '/expedients', label: 'Expedientes' },
  { value: '/clinical/patients', label: 'Pacientes' },
  { value: '/digitization', label: 'Digitalización · Escanear' },
  { value: '/digitization/ocr', label: 'Digitalización · Procesamiento OCR' },
  { value: '/workflows', label: 'Flujos de trabajo' },
  { value: '/workflows/tasks', label: 'Flujos · Mis tareas' },
  { value: '/reports', label: 'Reportes' },
  { value: '/audit', label: 'Auditoría' },
];

const WEEKDAYS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' }, { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 7, label: 'Dom' },
];

/** Formulario editable: los números vacíos se envían como null ("sin límite"). */
interface CustomizationForm {
  jobTitle: string; phone: string; biography: string;
  language: '' | 'es' | 'en' | 'fr' | 'zh'; landingPage: string;
  emailNotifications: boolean; pushNotifications: boolean; mustChangePassword: boolean;
  accessExpiresOn: string; accessWeekdays: number[]; accessStartTime: string; accessEndTime: string;
  maxUploadMb: number | null; storageQuotaMb: number | null; allowedDocumentTypeIds: string[];
}

@Component({
  selector: 'app-user-customization-modal',
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" role="presentation">
      <section class="admin-modal customization-modal" role="dialog" aria-modal="true" aria-labelledby="customize-title">
        <h2 id="customize-title">Personalizar usuario</h2>
        <p class="form-note">{{ user.firstName }} {{ user.lastName }} · {{ user.username }}</p>

        @if (loading()) {
          <p class="admin-empty">Cargando personalización…</p>
        } @else if (loadError()) {
          <div class="admin-state error" role="alert">{{ loadError() }}</div>
          <div class="form-actions">
            <button class="admin-secondary" type="button" (click)="closed.emit()">Cerrar</button>
            <button class="admin-primary" type="button" (click)="load()">Reintentar</button>
          </div>
        } @else {
          <div class="admin-tabs customization-tabs" role="tablist">
            @for (tab of tabs; track tab.key) {
              <button type="button" role="tab" class="admin-tab" [class.active]="section() === tab.key"
                      [attr.aria-selected]="section() === tab.key" (click)="section.set(tab.key)">{{ tab.label }}</button>
            }
          </div>
          @if (error()) { <div class="admin-state error" role="alert">{{ error() }}</div> }
          @if (notice()) { <div class="admin-state" role="status">{{ notice() }}</div> }

          @switch (section()) {
            @case ('profile') {
              <div class="form-grid">
                <label>Cargo o puesto<input name="jobTitle" [(ngModel)]="form.jobTitle" maxlength="120" placeholder="Ej. Archivista, Jefe de área" /></label>
                <label>Teléfono<input name="phone" [(ngModel)]="form.phone" maxlength="30" /></label>
                <label class="wide">Biografía o descripción<textarea name="biography" [(ngModel)]="form.biography" maxlength="500" rows="3"></textarea></label>
              </div>
              <p class="form-note">El nombre, el correo, el estado y los grupos se cambian desde «Editar».</p>
            }
            @case ('interface') {
              <div class="form-grid">
                <label>Idioma predeterminado
                  <select name="language" [(ngModel)]="form.language">
                    <option value="">El que elija el usuario</option>
                    <option value="es">Español</option><option value="en">English</option>
                    <option value="fr">Français</option><option value="zh">中文</option>
                  </select>
                </label>
                <label>Pantalla de inicio
                  <select name="landingPage" [(ngModel)]="form.landingPage">
                    <option value="">Predeterminada</option>
                    @for (page of landingPages; track page.value) { <option [value]="page.value">{{ page.label }}</option> }
                  </select>
                </label>
              </div>
              <p class="form-note">Se aplican al iniciar sesión. Si el usuario no tiene permiso para la pantalla elegida, entra al tablero.</p>
            }
            @case ('notifications') {
              <div class="toggle-list">
                <label class="switch-label"><input type="checkbox" name="emailNotifications" [(ngModel)]="form.emailNotifications" /><span>Notificaciones por correo electrónico</span></label>
                <label class="switch-label"><input type="checkbox" name="pushNotifications" [(ngModel)]="form.pushNotifications" /><span>Notificaciones push (aplicación móvil y navegador)</span></label>
              </div>
            }
            @case ('access') {
              @if (data()?.self) {
                <div class="admin-state" role="note">No puede cambiar su propio acceso; solo se muestra la configuración actual.</div>
              }
              <fieldset class="plain-fieldset" [disabled]="data()?.self">
                <div class="toggle-list">
                  <label class="switch-label"><input type="checkbox" name="mustChangePassword" [(ngModel)]="form.mustChangePassword" /><span>Exigir cambio de contraseña en el próximo inicio de sesión</span></label>
                </div>
                <div class="form-grid">
                  <label>Acceso válido hasta (inclusive)<input type="date" name="accessExpiresOn" [(ngModel)]="form.accessExpiresOn" /></label>
                  <span></span>
                  <label>Hora de inicio<input type="time" name="accessStartTime" [(ngModel)]="form.accessStartTime" /></label>
                  <label>Hora de fin<input type="time" name="accessEndTime" [(ngModel)]="form.accessEndTime" /></label>
                  <div class="chip-field">Días permitidos
                    <div class="role-chip-list" role="group" aria-label="Días permitidos">
                      @for (day of weekdays; track day.value) {
                        <button type="button" class="role-chip" [class.selected]="form.accessWeekdays.includes(day.value)"
                                [attr.aria-pressed]="form.accessWeekdays.includes(day.value)" (click)="toggleDay(day.value)">{{ day.label }}</button>
                      }
                    </div>
                  </div>
                </div>
              </fieldset>
              <p class="form-note">Sin días seleccionados se permiten todos. El horario usa la zona horaria de la organización ({{ data()?.timezone }}); si la hora de fin es anterior a la de inicio, la franja cruza la medianoche. Al guardar cambios de acceso se cierran las sesiones abiertas del usuario.</p>
              <div class="session-row">
                <span>Sesión activa: <b>{{ data()?.hasActiveSession ? 'Sí' : 'No' }}</b></span>
                <button class="admin-secondary" type="button" (click)="revokeSessions()" [disabled]="saving() || data()?.self || !data()?.hasActiveSession">Cerrar todas sus sesiones</button>
              </div>
            }
            @case ('documents') {
              <div class="form-grid">
                <label>Tamaño máximo por archivo (MB)<input type="number" name="maxUploadMb" min="1" max="25" [(ngModel)]="form.maxUploadMb" placeholder="Límite del sistema (25 MB)" /></label>
                <label>Cuota de almacenamiento (MB)<input type="number" name="storageQuotaMb" min="1" [(ngModel)]="form.storageQuotaMb" placeholder="Sin cuota propia" /></label>
              </div>
              <p class="form-note">Espacio usado por sus versiones subidas: <b>{{ usedStorage() }}</b>. Los límites del plan de la organización se aplican siempre.</p>
              <div class="chip-field">Tipos documentales que puede crear
                @if (typesError()) { <div class="admin-state error" role="alert">{{ typesError() }}</div> }
                @else if (!documentTypes().length) { <p class="admin-empty">No hay tipos documentales activos.</p> }
                @else {
                  <div class="role-chip-list" role="group" aria-label="Tipos documentales permitidos">
                    @for (type of documentTypes(); track type.id) {
                      <button type="button" class="role-chip" [class.selected]="form.allowedDocumentTypeIds.includes(type.id)"
                              [attr.aria-pressed]="form.allowedDocumentTypeIds.includes(type.id)" (click)="toggleType(type.id)">{{ type.name }}</button>
                    }
                  </div>
                }
              </div>
              <p class="form-note">Sin selección puede crear documentos de cualquier tipo.</p>
            }
          }

          <div class="form-actions">
            <button class="admin-secondary" type="button" (click)="closed.emit()">Cancelar</button>
            <button class="admin-primary" type="button" (click)="save()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar personalización' }}</button>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .customization-modal { max-height: calc(100dvh - 32px); max-width: 720px; overflow-y: auto; }
    .customization-tabs { flex-wrap: wrap; margin: 16px 0 4px; }
    .form-grid .wide { grid-column: 1 / -1; }
    .form-grid textarea { border: 1px solid var(--line); border-radius: 8px; color: var(--ink); font: inherit; padding: 8px 10px; resize: vertical; }
    .form-grid .chip-field { color: var(--muted); font-size: 11px; font-weight: 800; }
    .chip-field { color: var(--muted); font-size: 11px; font-weight: 800; margin-top: 16px; }
    .toggle-list { display: grid; gap: 12px; margin-top: 18px; }
    .switch-label { align-items: center; display: flex; font-size: 13px; gap: 10px; }
    .plain-fieldset { border: 0; margin: 0; min-width: 0; padding: 0; }
    .session-row { align-items: center; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; font-size: 13px; gap: 12px; justify-content: space-between; margin-top: 16px; padding-top: 14px; }
  `,
})
export class UserCustomizationModal implements OnInit {
  private readonly api = inject(AdministrationApiService);
  private readonly documentApi = inject(DocumentApiService);
  @Input({ required: true }) user!: ApiUser;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<void>();

  readonly tabs: { key: Section; label: string }[] = [
    { key: 'profile', label: 'Perfil' }, { key: 'interface', label: 'Interfaz' },
    { key: 'notifications', label: 'Notificaciones' }, { key: 'access', label: 'Seguridad y acceso' },
    { key: 'documents', label: 'Documentos' },
  ];
  readonly landingPages = LANDING_PAGES;
  readonly weekdays = WEEKDAYS;
  readonly section = signal<Section>('profile');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  readonly typesError = signal('');
  readonly data = signal<ApiUserCustomization | null>(null);
  readonly documentTypes = signal<ApiDocumentType[]>([]);
  readonly usedStorage = computed(() => formatBytes(this.data()?.storageUsedBytes ?? 0));
  form: CustomizationForm = emptyForm();

  ngOnInit(): void {
    this.load();
    this.documentApi.documentTypes('', 0, 200).subscribe({
      next: (page) => this.documentTypes.set(page.content),
      error: () => this.typesError.set('No se pudieron cargar los tipos documentales.'),
    });
  }

  load(): void {
    this.loading.set(true); this.loadError.set('');
    this.api.userCustomization(this.user.id).subscribe({
      next: (data) => { this.apply(data); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.loadError.set(apiError(err, 'No se pudo cargar la personalización.')); },
    });
  }

  toggleDay(day: number): void { this.form.accessWeekdays = toggle(this.form.accessWeekdays, day); }
  toggleType(id: string): void { this.form.allowedDocumentTypeIds = toggle(this.form.allowedDocumentTypeIds, id); }

  save(): void {
    this.error.set(''); this.notice.set('');
    if (!!this.form.accessStartTime !== !!this.form.accessEndTime) {
      this.section.set('access');
      this.error.set('Indica la hora de inicio y la de fin, o deja ambas vacías.');
      return;
    }
    this.saving.set(true);
    this.api.updateUserCustomization(this.user.id, this.payload()).subscribe({
      next: (data) => { this.saving.set(false); this.apply(data); this.saved.emit(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.error.set(apiError(err, 'No se pudo guardar la personalización.')); },
    });
  }

  revokeSessions(): void {
    this.error.set(''); this.notice.set(''); this.saving.set(true);
    this.api.revokeUserSessions(this.user.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.notice.set('Se cerraron todas las sesiones del usuario.');
        const current = this.data();
        if (current) this.data.set({ ...current, hasActiveSession: false });
      },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.error.set(apiError(err, 'No se pudieron cerrar las sesiones.')); },
    });
  }

  private apply(data: ApiUserCustomization): void {
    this.data.set(data);
    this.form = {
      jobTitle: data.jobTitle ?? '', phone: data.phone ?? '', biography: data.biography ?? '',
      language: data.language ?? '', landingPage: data.landingPage ?? '',
      emailNotifications: data.emailNotifications, pushNotifications: data.pushNotifications,
      mustChangePassword: data.mustChangePassword,
      accessExpiresOn: data.accessExpiresOn ?? '', accessWeekdays: [...(data.accessWeekdays ?? [])],
      accessStartTime: (data.accessStartTime ?? '').slice(0, 5), accessEndTime: (data.accessEndTime ?? '').slice(0, 5),
      maxUploadMb: data.maxUploadMb, storageQuotaMb: data.storageQuotaMb,
      allowedDocumentTypeIds: [...(data.allowedDocumentTypeIds ?? [])],
    };
  }

  private payload(): UserCustomizationPayload {
    const f = this.form;
    return {
      jobTitle: blank(f.jobTitle), phone: blank(f.phone), biography: blank(f.biography),
      language: f.language || null, landingPage: f.landingPage || null,
      emailNotifications: f.emailNotifications, pushNotifications: f.pushNotifications,
      mustChangePassword: f.mustChangePassword,
      accessExpiresOn: f.accessExpiresOn || null, accessWeekdays: [...f.accessWeekdays].sort(),
      accessStartTime: f.accessStartTime || null, accessEndTime: f.accessEndTime || null,
      maxUploadMb: positive(f.maxUploadMb), storageQuotaMb: positive(f.storageQuotaMb),
      allowedDocumentTypeIds: [...f.allowedDocumentTypeIds],
    };
  }
}

function emptyForm(): CustomizationForm {
  return {
    jobTitle: '', phone: '', biography: '', language: '', landingPage: '',
    emailNotifications: true, pushNotifications: true, mustChangePassword: false,
    accessExpiresOn: '', accessWeekdays: [], accessStartTime: '', accessEndTime: '',
    maxUploadMb: null, storageQuotaMb: null, allowedDocumentTypeIds: [],
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function blank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

function positive(value: number | null): number | null {
  return value === null || value === undefined || `${value}` === '' || Number(value) <= 0 ? null : Math.floor(Number(value));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function apiError(error: HttpErrorResponse, fallback: string): string {
  if (error.status === 0) return 'No se pudo conectar con la API. Comprueba que el backend esté ejecutándose.';
  const serverMessage = error.error?.message;
  if (serverMessage) return friendlyApiMessage(serverMessage, fallback);
  if (error.status === 401 || error.status === 403) return 'No tienes permisos para realizar esta operación.';
  return fallback;
}
