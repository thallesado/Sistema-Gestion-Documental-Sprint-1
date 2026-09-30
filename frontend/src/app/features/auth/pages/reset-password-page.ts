import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PasswordRecoveryService } from '../services/password-recovery.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="fp-wrapper">
      <form class="fp-card" (ngSubmit)="submit()">
        <a routerLink="/login" class="fp-back">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
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
          <p class="fp-eyebrow">SEGURIDAD DE LA CUENTA</p>
          <h1>Define una nueva contraseña</h1>
          <p class="fp-subtitle">El enlace es de un solo uso y expira después de un período limitado.</p>
        </header>

        @if (errorMessage()) {
          <div class="fp-error" role="alert">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="fp-success" role="status">{{ successMessage() }}</div>
          <a routerLink="/login" class="fp-submit">Ir al inicio de sesión</a>
        } @else {
          <div class="fp-field">
            <label for="rp-pass">Nueva contraseña</label>
            <div class="fp-input-wrap">
              <span class="fp-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="rp-pass"
                name="newPassword"
                [(ngModel)]="newPassword"
                type="password"
                minlength="10"
                autocomplete="new-password"
                placeholder="Mínimo 10 caracteres"
                required
              />
            </div>
          </div>

          <div class="fp-field">
            <label for="rp-confirm">Confirmar contraseña</label>
            <div class="fp-input-wrap">
              <span class="fp-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="rp-confirm"
                name="confirmation"
                [(ngModel)]="confirmation"
                type="password"
                minlength="10"
                autocomplete="new-password"
                placeholder="Repite la contraseña"
                required
              />
            </div>
          </div>

          <button class="fp-submit" type="submit" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Guardando…' : 'Cambiar contraseña' }}
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
    .fp-brand { align-items: center; display: flex; gap: 12px; }
    .fp-brand-text { display: flex; flex-direction: column; }
    .fp-brand-text strong { color: #102d2a; font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
    .fp-brand-text small { color: #087f7b; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; margin-top: 1px; text-transform: uppercase; }
    .fp-header { margin-top: 4px; }
    .fp-eyebrow { color: #087f7b; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; margin: 0 0 8px; }
    .fp-header h1 { color: #102d2a; font-size: 26px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 8px; }
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
    .fp-input-wrap { align-items: center; display: flex; position: relative; }
    .fp-icon { align-items: center; color: #7b9997; display: flex; left: 14px; pointer-events: none; position: absolute; }
    .fp-input-wrap input {
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
    .fp-input-wrap input:focus { border-color: #087f7b; box-shadow: 0 0 0 3px rgba(8, 127, 123, 0.12); }
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
    @media (max-width: 520px) {
      .fp-card { padding: 32px 24px 28px; }
    }
  `],
})
export class ResetPasswordPage {
  private readonly recovery = inject(PasswordRecoveryService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly token = this.route.snapshot.paramMap.get('token')
    ?? this.route.snapshot.queryParamMap.get('token')
    ?? '';
  newPassword = '';
  confirmation = '';

  submit(): void {
    this.errorMessage.set('');
    if (!this.token) {
      this.errorMessage.set('El enlace de recuperación no es válido.');
      return;
    }
    if (this.newPassword.length < 10) {
      this.errorMessage.set('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmation) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }
    this.isSubmitting.set(true);
    this.recovery.resetPassword(this.token, this.newPassword).subscribe({
      next: (response) => {
        this.auth.establishSession(response);
        this.isSubmitting.set(false);
        void this.router.navigateByUrl('/', { replaceUrl: true });
      },
      error: (error: { status?: number }) => {
        this.errorMessage.set(error.status === 400
          ? 'La contraseña no cumple las reglas requeridas.'
          : error.status === 401
            ? 'El enlace es inválido, ya fue utilizado o expiró. Solicita uno nuevo.'
            : 'No fue posible completar la recuperación. Intenta nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }
}
