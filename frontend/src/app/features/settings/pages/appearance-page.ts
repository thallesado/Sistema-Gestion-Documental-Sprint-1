import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppCurrencyPipe, AppDatePipe } from '../../../core/i18n/format.pipe';
import { TenantSettings } from '../../../core/theme/theme-variables';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-appearance-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe, AppDatePipe],
  template: `
    <div class="appearance-container">
      <header class="appearance-header">
        <div>
          <p class="eyebrow">Configuración del sistema · Marca y regionalización (E2)</p>
          <h1>Apariencia y Regionalización</h1>
          <p class="subtitle">Personaliza la identidad visual, colores, logotipos, moneda, zona horaria y formato de fechas de tu organización.</p>
        </div>
      </header>

      @if (loading()) {
        <div class="loading-box">
          <div class="spinner"></div>
          <p>Cargando ajustes de la organización…</p>
        </div>
      } @else {
        @if (successMessage()) {
          <div class="alert success" role="alert">
            <span class="alert-icon">✓</span>
            <span>{{ successMessage() }}</span>
          </div>
        }
        @if (errorMessage()) {
          <div class="alert error" role="alert">
            <span class="alert-icon">⚠</span>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <div class="appearance-grid">
          <!-- Formulario de Configuración -->
          <form class="settings-card" (ngSubmit)="saveSettings()">
            <h2>Identidad Visual</h2>
            <p class="section-desc">Configura el color distintivo y el imagotipo de tu institución médica o empresa.</p>

            <div class="form-group">
              <label for="primary-color">Color primario de la marca</label>
              <div class="color-picker-row">
                <input
                  id="primary-color-picker"
                  type="color"
                  [(ngModel)]="form.primaryColor"
                  name="primaryColorPicker"
                  (input)="onColorChange()"
                  class="color-picker"
                />
                <input
                  id="primary-color-text"
                  type="text"
                  [(ngModel)]="form.primaryColor"
                  name="primaryColorText"
                  (input)="onColorChange()"
                  placeholder="#087f7b"
                  maxlength="7"
                  class="text-input color-input"
                  required
                />
              </div>
              <div class="color-presets">
                <span class="preset-label">Sugeridos:</span>
                @for (preset of presets; track preset) {
                  <button
                    type="button"
                    class="preset-dot"
                    [style.background]="preset"
                    [title]="preset"
                    (click)="selectPreset(preset)"
                  ></button>
                }
              </div>
            </div>

            <div class="form-group">
              <label for="logo-url">URL del Logotipo</label>
              <input
                id="logo-url"
                type="url"
                [(ngModel)]="form.logoUrl"
                name="logoUrl"
                placeholder="https://ejemplo.com/logo.png"
                class="text-input"
              />
              <span class="field-hint">Aparecerá en el encabezado de la plataforma y en los reportes impresos.</span>
            </div>

            <div class="divider"></div>

            <h2>Regionalización y Formatos</h2>
            <p class="section-desc">Ajusta la moneda, la zona horaria y los formatos de fecha para tu equipo.</p>

            <div class="form-row">
              <div class="form-group half">
                <label for="currency-select">Moneda</label>
                <select id="currency-select" [(ngModel)]="form.currency" name="currency" class="select-input">
                  <option value="USD">USD ($) - Dólar Estadounidense</option>
                  <option value="BOB">BOB (Bs.) - Boliviano</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="MXN">MXN ($) - Peso Mexicano</option>
                  <option value="COP">COP ($) - Peso Colombiano</option>
                  <option value="CLP">CLP ($) - Peso Chileno</option>
                </select>
              </div>

              <div class="form-group half">
                <label for="timezone-select">Zona Horaria</label>
                <select id="timezone-select" [(ngModel)]="form.timezone" name="timezone" class="select-input">
                  <option value="America/La_Paz">Bolivia (UTC-4: America/La_Paz)</option>
                  <option value="America/Santiago">Chile (UTC-4/3: America/Santiago)</option>
                  <option value="America/Bogota">Colombia / Perú (UTC-5: America/Bogota)</option>
                  <option value="America/Buenos_Aires">Argentina (UTC-3: America/Buenos_Aires)</option>
                  <option value="America/Mexico_City">México (UTC-6: America/Mexico_City)</option>
                  <option value="Europe/Madrid">España (UTC+1/2: Europe/Madrid)</option>
                  <option value="UTC">UTC (Tiempo Universal Coordinado)</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label for="date-format-select">Formato de Fecha</label>
                <select id="date-format-select" [(ngModel)]="form.dateFormat" name="dateFormat" class="select-input">
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 estándar)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (Latinoamérica y Europa)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (EE. UU.)</option>
                </select>
              </div>

              <div class="form-group half">
                <label for="language-select">Idioma por Defecto</label>
                <select id="language-select" [(ngModel)]="form.defaultLanguage" name="defaultLanguage" class="select-input">
                  <option value="es">Español (Castellano)</option>
                  <option value="en">English (Inglés)</option>
                </select>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="save-button" [disabled]="saving()">
                @if (saving()) {
                  <span>Guardando cambios…</span>
                } @else {
                  <span>Guardar configuración</span>
                }
              </button>
            </div>
          </form>

          <!-- Previsualización en Vivo -->
          <div class="preview-panel">
            <h2>Vista Previa en Vivo</h2>
            <p class="section-desc">Observa en tiempo real cómo lucirá NexoDocs con tus ajustes corporativos.</p>

            <div class="preview-card" [style.--preview-primary]="form.primaryColor || '#087f7b'">
              <div class="preview-header">
                @if (form.logoUrl) {
                  <img [src]="form.logoUrl" alt="Logo corporativo" class="preview-logo" (error)="onLogoError()" />
                } @else {
                  <div class="preview-logo-placeholder">✦ {{ tenantName() || 'NexoDocs' }}</div>
                }
                <span class="preview-badge">Organización Activa</span>
              </div>

              <div class="preview-body">
                <h3>Ejemplo de Documento Clínico</h3>
                <p class="preview-meta">DOC-2026-089 · Historia Clínica Electrónica</p>

                <div class="preview-stats">
                  <div class="stat-item">
                    <span class="stat-label">Fecha de Emisión</span>
                    <span class="stat-val">{{ today | appDate }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Costo Arancelario</span>
                    <span class="stat-val">{{ sampleAmount | appCurrency: form.currency }}</span>
                  </div>
                </div>

                <div class="preview-buttons">
                  <button type="button" class="btn-demo primary">Botón Principal</button>
                  <button type="button" class="btn-demo secondary">Botón Secundario</button>
                </div>
              </div>
            </div>

            <div class="preview-notes">
              <p>💡 <b>Nota:</b> Al guardar, el color y formatos se aplicarán de inmediato a todo el sistema y para todos los usuarios de tu organización.</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .appearance-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      font-family: inherit;
    }
    .appearance-header {
      margin-bottom: 2rem;
    }
    .eyebrow {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--teal, #087f7b);
      margin: 0 0 0.5rem;
    }
    .appearance-header h1 {
      font-size: 2rem;
      font-weight: 800;
      color: #111827;
      margin: 0 0 0.5rem;
    }
    .subtitle {
      color: #6b7280;
      font-size: 0.95rem;
      margin: 0;
    }
    .loading-box {
      text-align: center;
      padding: 4rem;
      color: #6b7280;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e5e7eb;
      border-top-color: var(--teal, #087f7b);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .alert {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    .alert.success {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .alert.error {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .alert-icon {
      font-weight: bold;
    }

    .appearance-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 2rem;
    }
    @media (max-width: 900px) {
      .appearance-grid {
        grid-template-columns: 1fr;
      }
    }

    .settings-card, .preview-panel {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .settings-card h2, .preview-panel h2 {
      font-size: 1.2rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 0.25rem;
    }
    .section-desc {
      color: #6b7280;
      font-size: 0.85rem;
      margin: 0 0 1.5rem;
    }
    .divider {
      height: 1px;
      background: #e5e7eb;
      margin: 1.75rem 0;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-group label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.4rem;
    }
    .form-row {
      display: flex;
      gap: 1rem;
    }
    .form-group.half {
      flex: 1;
    }
    .text-input, .select-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.6rem 0.85rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
      background: #f9fafb;
      color: #111827;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .text-input:focus, .select-input:focus {
      border-color: var(--teal, #087f7b);
      background: #ffffff;
    }
    .color-picker-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .color-picker {
      width: 44px;
      height: 40px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
      padding: 2px;
      background: #ffffff;
    }
    .color-input {
      flex: 1;
      font-family: monospace;
      font-weight: 600;
    }
    .color-presets {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.6rem;
    }
    .preset-label {
      font-size: 0.75rem;
      color: #6b7280;
    }
    .preset-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px #d1d5db;
      cursor: pointer;
      padding: 0;
      transition: transform 0.15s ease;
    }
    .preset-dot:hover {
      transform: scale(1.15);
    }
    .field-hint {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.35rem;
      display: block;
    }

    .form-actions {
      margin-top: 1.75rem;
      display: flex;
      justify-content: flex-end;
    }
    .save-button {
      background: var(--teal, #087f7b);
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .save-button:hover:not(:disabled) {
      opacity: 0.9;
    }
    .save-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Previsualización en Vivo */
    .preview-card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .preview-header {
      background: var(--preview-primary, #087f7b);
      color: #ffffff;
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .preview-logo {
      max-height: 36px;
      max-width: 140px;
      object-fit: contain;
    }
    .preview-logo-placeholder {
      font-weight: 800;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }
    .preview-badge {
      font-size: 0.75rem;
      background: rgba(255,255,255,0.25);
      padding: 0.25rem 0.6rem;
      border-radius: 20px;
      font-weight: 600;
    }
    .preview-body {
      padding: 1.25rem;
      background: #fafafa;
    }
    .preview-body h3 {
      margin: 0 0 0.25rem;
      font-size: 1rem;
      color: #111827;
    }
    .preview-meta {
      font-size: 0.8rem;
      color: #6b7280;
      margin: 0 0 1rem;
    }
    .preview-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .stat-label {
      font-size: 0.75rem;
      color: #6b7280;
      display: block;
    }
    .stat-val {
      font-size: 0.9rem;
      font-weight: 700;
      color: #111827;
    }
    .preview-buttons {
      display: flex;
      gap: 0.75rem;
    }
    .btn-demo {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: default;
    }
    .btn-demo.primary {
      background: var(--preview-primary, #087f7b);
      color: #ffffff;
      border: 1px solid var(--preview-primary, #087f7b);
    }
    .btn-demo.secondary {
      background: #ffffff;
      color: var(--preview-primary, #087f7b);
      border: 1px solid var(--preview-primary, #087f7b);
    }
    .preview-notes {
      margin-top: 1rem;
      font-size: 0.8rem;
      color: #6b7280;
      line-height: 1.4;
    }
  `],
})
export class AppearancePage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly themeService = inject(ThemeService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly tenantName = signal('Mi Organización');

  readonly today = new Date();
  readonly sampleAmount = 145.5;

  readonly presets = ['#087f7b', '#2563eb', '#7c3aed', '#059669', '#ea580c', '#0f766e'];

  form: TenantSettings = {
    primaryColor: '#087f7b',
    logoUrl: '',
    currency: 'USD',
    timezone: 'America/La_Paz',
    dateFormat: 'YYYY-MM-DD',
    defaultLanguage: 'es',
  };

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.http.get<any>('/api/v1/tenants/current/settings').subscribe({
      next: (data) => {
        this.tenantName.set(data.name || 'Mi Organización');
        this.form = {
          primaryColor: data.primaryColor || '#087f7b',
          logoUrl: data.logoUrl || '',
          currency: data.currency || 'USD',
          timezone: data.timezone || 'America/La_Paz',
          dateFormat: data.dateFormat || 'YYYY-MM-DD',
          defaultLanguage: data.defaultLanguage || 'es',
        };
        this.themeService.apply(this.form);
        this.loading.set(false);
      },
      error: () => {
        // Fallback si no está autenticado o en entorno local
        const current = this.themeService.settings();
        if (current.primaryColor) this.form.primaryColor = current.primaryColor;
        this.loading.set(false);
      },
    });
  }

  onColorChange(): void {
    if (this.form.primaryColor && /^#[0-9a-fA-F]{6}$/.test(this.form.primaryColor)) {
      this.themeService.apply(this.form);
    }
  }

  selectPreset(preset: string): void {
    this.form.primaryColor = preset;
    this.onColorChange();
  }

  onLogoError(): void {
    this.form.logoUrl = '';
  }

  saveSettings(): void {
    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.http.patch<any>('/api/v1/tenants/current/settings', this.form).subscribe({
      next: (updated) => {
        this.form = {
          primaryColor: updated.primaryColor || this.form.primaryColor,
          logoUrl: updated.logoUrl,
          currency: updated.currency || this.form.currency,
          timezone: updated.timezone || this.form.timezone,
          dateFormat: updated.dateFormat || this.form.dateFormat,
          defaultLanguage: updated.defaultLanguage || this.form.defaultLanguage,
        };
        this.themeService.apply(this.form);
        this.saving.set(false);
        this.successMessage.set('¡Ajustes de marca y regionalización guardados exitosamente!');
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err?.error?.message || 'No se pudieron guardar los ajustes de apariencia.');
      },
    });
  }
}
