import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PasswordRecoveryService } from './password-recovery.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="login-page">
      <form class="login-card" (ngSubmit)="submit()">
        <a routerLink="/login" class="login-back">← Volver al inicio de sesión</a>
        <div class="brand-mark">ND</div>
        <p class="eyebrow">NexoDocs</p>
        <h1>Define una nueva contraseña</h1>
        <p>El enlace es de un solo uso y expira después de un período limitado.</p>
        @if (errorMessage()) {
          <div class="login-error" role="alert">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="login-success" role="status">{{ successMessage() }}</div>
          <a routerLink="/login" class="primary-link">Ir al inicio de sesión</a>
        } @else {
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
        }
      </form>
    </main>
  `,
  styles: [`
    .login-back { color: #0f817e; display: inline-block; font-size: 12px; margin-bottom: 18px; text-decoration: none; }
    .login-success { background: #e9f8f1; border: 1px solid #a8dec3; border-radius: 9px; color: #17663f; font-size: 13px; line-height: 1.5; margin-bottom: 12px; padding: 11px; }
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
        void this.router.navigateByUrl('/');
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
