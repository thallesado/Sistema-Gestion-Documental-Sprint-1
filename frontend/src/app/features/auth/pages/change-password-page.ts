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
