import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-change-password-page',
  imports: [FormsModule],
  template: `
    <main class="login-page">
      <form class="login-card" (ngSubmit)="submit()">
        <div class="brand-mark">ND</div>
        <p class="eyebrow">NexoDocs</p>
        <h1>Cambia tu contraseña temporal</h1>
        <p>Por seguridad debes definir una contraseña propia antes de usar el sistema. Después tendrás que iniciar sesión de nuevo.</p>
        @if (errorMessage()) {
          <div class="login-error" role="alert">{{ errorMessage() }}</div>
        }
        <label>
          Contraseña temporal actual
          <input name="currentPassword" [(ngModel)]="currentPassword" type="password" autocomplete="current-password" required />
        </label>
        <label>
          Nueva contraseña
          <input name="newPassword" [(ngModel)]="newPassword" type="password" minlength="10" autocomplete="new-password" required />
        </label>
        <label>
          Confirmar contraseña
          <input name="confirmation" [(ngModel)]="confirmation" type="password" minlength="10" autocomplete="new-password" required />
        </label>
        <button class="primary-link" type="submit" [disabled]="isSubmitting()">
          {{ isSubmitting() ? 'Guardando...' : 'Cambiar contraseña' }}
        </button>
        <button class="secondary-link" type="button" (click)="auth.logout()">Cerrar sesión</button>
      </form>
    </main>
  `,
  styles: [`
    .login-page { align-items: center; background: #f4f8f7; display: flex; justify-content: center; min-height: 100vh; padding: 24px; }
    .login-card { background: #fff; border: 1px solid #dbe7e4; border-radius: 16px; box-shadow: 0 12px 32px rgba(15, 59, 56, .08); display: grid; gap: 14px; max-width: 440px; padding: 32px; width: 100%; }
    .brand-mark { align-items: center; background: var(--teal, #0f817e); border-radius: 12px; color: #fff; display: flex; font-weight: 800; height: 44px; justify-content: center; width: 44px; }
    .eyebrow { color: var(--teal, #0f817e); font-size: 12px; font-weight: 700; letter-spacing: .08em; margin: 0; }
    h1 { color: #12302d; font-size: 24px; line-height: 1.2; margin: 0; }
    p { color: #4a5d5a; font-size: 14px; line-height: 1.5; margin: 0; }
    label { color: #12302d; display: grid; font-size: 13px; font-weight: 600; gap: 6px; }
    input { border: 1px solid #c7d8d5; border-radius: 10px; font: inherit; padding: 10px 12px; }
    input:focus-visible, button:focus-visible { outline: 3px solid var(--teal, #0f817e); outline-offset: 2px; }
    .primary-link { background: var(--teal, #0f817e); border: 0; border-radius: 10px; color: #fff; cursor: pointer; font: inherit; font-weight: 700; padding: 12px 16px; }
    .primary-link:disabled { cursor: progress; opacity: .6; }
    .login-error { background: #fdecec; border: 1px solid #f3b6b6; border-radius: 10px; color: #8a1c1c; font-size: 13px; padding: 10px 12px; }
    .secondary-link { background: none; border: 0; color: #0f817e; cursor: pointer; display: block; font-size: 13px; margin: 14px auto 0; text-decoration: underline; }
  `],
})
export class ChangePasswordPage {
  readonly auth = inject(AuthService);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  currentPassword = '';
  newPassword = '';
  confirmation = '';

  submit(): void {
    this.errorMessage.set('');
    if (this.newPassword.length < 10) {
      this.errorMessage.set('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmation) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }
    if (this.newPassword === this.currentPassword) {
      this.errorMessage.set('La nueva contraseña debe ser distinta de la temporal.');
      return;
    }
    this.isSubmitting.set(true);
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.auth.completeForcedPasswordChange();
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.errorMessage.set(error.status === 400
          ? (error.error?.message || 'La contraseña no cumple las reglas requeridas.')
          : 'No fue posible cambiar la contraseña. Intenta nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }
}
