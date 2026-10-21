import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PublicTenant } from '../../../core/auth/auth.types';
import { PasswordRecoveryService } from '../services/password-recovery.service';

@Component({
  selector: 'app-forgot-password-page',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="fp-wrapper">
      <form class="fp-card" (ngSubmit)="submit()">
        <a routerLink="/login" class="fp-back">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Volver al inicio de sesión
        </a>

        <div class="fp-brand">
          <svg viewBox="0 0 28 28" width="34" height="34" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="8" fill="#087f7b"/>
            <path d="M8 6h8l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="#ffffff" stroke-width="2"/>
            <path d="M16 6v5h5" stroke="#ffffff" stroke-width="2"/>
          </svg>
          <div class="fp-brand-text"><strong>NexoDocs</strong><small>Gestión Documental</small></div>
        </div>

        <header class="fp-header">
          <p class="fp-eyebrow">RECUPERAR ACCESO</p>
          <h1>Recupera tu acceso</h1>
          <p class="fp-subtitle">Selecciona tu organización e ingresa tu correo. Si los datos son válidos, recibirás un enlace de un solo uso.</p>
        </header>

        @if (errorMessage()) {
          <div class="fp-error" role="alert">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="fp-success" role="status">{{ successMessage() }}</div>
          <a routerLink="/login" class="fp-submit">Volver al inicio de sesión</a>
        } @else {
          <div class="fp-field">
            <label for="fp-tenant">Organización</label>
            <div class="fp-input-wrap">
              <span class="fp-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><path d="M9 18h6v4H9z"/></svg>
              </span>
              <select id="fp-tenant" name="tenantId" [(ngModel)]="tenantId" [disabled]="tenantsLoading()" required>
                <option [ngValue]="null" disabled>{{ tenantsLoading() ? 'Cargando organizaciones…' : 'Selecciona tu organización' }}</option>
                @for (tenant of tenants(); track tenant.id) {
                  <option [ngValue]="tenant.id">{{ tenant.name }}</option>
                }
              </select>
            </div>
            @if (tenantsError()) { <small class="fp-field-error" role="alert">{{ tenantsError() }}</small> }
          </div>

          <div class="fp-field">
            <label for="fp-email">Correo electrónico</label>
            <div class="fp-input-wrap">
              <span class="fp-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </span>
              <input id="fp-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" placeholder="usuario@ejemplo.com" required />
            </div>
          </div>

          <button class="fp-submit" type="submit" [disabled]="isSubmitting() || !tenantId || !email.trim()">
            {{ isSubmitting() ? 'Enviando...' : 'Enviar enlace de recuperación' }}
          </button>
        }
      </form>
    </main>
  `,
  styles: [`
    .fp-wrapper {
      align-items: center;
      background: #eef6f5;
      box-sizing: border-box;
      display: flex;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }

    .fp-card {
      background: #ffffff;
      border: 1px solid rgba(220, 235, 232, 0.8);
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(10, 60, 56, 0.08), 0 2px 10px rgba(0, 0, 0, 0.02);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-width: 460px;
      padding: 40px 40px 36px;
      width: 100%;
    }

    .fp-back {
      align-items: center;
      align-self: flex-start;
      border-radius: 8px;
      color: #638280;
      display: inline-flex;
      font-size: 13px;
      font-weight: 600;
      gap: 6px;
      margin: -8px 0 0 -6px;
      padding: 6px;
      text-decoration: none;
      transition: color 0.15s, background 0.15s;
    }
    .fp-back:hover { background: #eef8f6; color: #087f7b; }
    .fp-back:focus-visible { outline: 2px solid #087f7b; outline-offset: 2px; }

    .fp-brand { align-items: center; display: flex; gap: 12px; }
    .fp-brand-text { display: flex; flex-direction: column; }
    .fp-brand-text strong { color: #102d2a; font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
    .fp-brand-text small { color: #087f7b; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; margin-top: 1px; text-transform: uppercase; }

    .fp-header { margin-top: 4px; }
    .fp-eyebrow { color: #087f7b; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; margin: 0 0 8px; }
    .fp-header h1 { color: #102d2a; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 8px; }
    .fp-subtitle { color: #638280; font-size: 13px; line-height: 1.5; margin: 0; }

    .fp-error {
      background: #fdf2f2;
      border: 1px solid #f8d7da;
      border-radius: 10px;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 600;
      padding: 11px 14px;
    }
    .fp-success {
      background: #e9f8f1;
      border: 1px solid #a8dec3;
      border-radius: 10px;
      color: #17663f;
      font-size: 13px;
      line-height: 1.5;
      padding: 12px 14px;
    }

    .fp-field { display: flex; flex-direction: column; gap: 6px; }
    .fp-field label { color: #244644; font-size: 12px; font-weight: 700; }
    .fp-field-error { color: #b45356; font-size: 12px; }

    .fp-input-wrap { align-items: center; display: flex; position: relative; }
    .fp-icon { align-items: center; color: #7b9997; display: flex; left: 14px; pointer-events: none; position: absolute; }

    .fp-input-wrap input,
    .fp-input-wrap select {
      background: #ffffff;
      border: 1.5px solid #dbe6e4;
      border-radius: 12px;
      box-sizing: border-box;
      color: #143634;
      display: block;
      font-family: inherit;
      font-size: 13px;
      height: 46px;
      outline: none;
      padding: 0 14px 0 42px;
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
    }
    .fp-input-wrap input::placeholder { color: #9cb5b3; }
    .fp-input-wrap input:focus,
    .fp-input-wrap select:focus { border-color: #087f7b; box-shadow: 0 0 0 3px rgba(8, 127, 123, 0.12); }
    .fp-input-wrap select:disabled { background: #f4f8f7; color: #7b9997; }

    .fp-submit {
      align-items: center;
      background: #087f7b;
      border: 0;
      border-radius: 12px;
      box-shadow: 0 6px 18px rgba(8, 127, 123, 0.22);
      box-sizing: border-box;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      gap: 8px;
      height: 46px;
      justify-content: center;
      margin-top: 6px;
      text-decoration: none;
      transition: background 0.2s, transform 0.1s;
      width: 100%;
    }
    .fp-submit:hover:not(:disabled) { background: #066b67; }
    .fp-submit:active:not(:disabled) { transform: scale(0.99); }
    .fp-submit:disabled { cursor: not-allowed; opacity: 0.65; }
    .fp-submit:focus-visible { outline: 2px solid #102d2a; outline-offset: 2px; }

    @media (max-width: 520px) {
      .fp-card { padding: 32px 24px 28px; }
    }
  `],
})
export class ForgotPasswordPage implements OnInit {
  private readonly recovery = inject(PasswordRecoveryService);
  private readonly auth = inject(AuthService);
  readonly tenants = signal<PublicTenant[]>([]);
  readonly tenantsLoading = signal(true);
  readonly tenantsError = signal('');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  tenantId: string | null = null;
  email = '';

  ngOnInit(): void {
    this.auth.publicTenants().subscribe({
      next: (list) => { this.tenants.set(list); this.tenantsLoading.set(false); },
      error: (error: { status?: number }) => {
        this.tenantsError.set(error.status === 429
          ? 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.'
          : 'No se pudo cargar la lista de organizaciones.');
        this.tenantsLoading.set(false);
      },
    });
  }

  submit(): void {
    this.errorMessage.set('');
    this.isSubmitting.set(true);
    this.recovery.requestRecovery(this.tenantId ?? '', this.email.trim()).subscribe({
      next: (response) => {
        this.successMessage.set(response.message);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible procesar la solicitud. Intenta nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }
}
