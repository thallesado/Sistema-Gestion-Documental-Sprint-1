import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PasswordRecoveryService } from './password-recovery.service';

@Component({
  selector: 'app-forgot-password-page',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="login-page">
      <form class="login-card" (ngSubmit)="submit()">
        <a routerLink="/login" class="login-back">← Volver al inicio de sesión</a>
        <div class="brand-mark">ND</div>
        <p class="eyebrow">NexoDocs</p>
        <h1>Recupera tu acceso</h1>
        <p>Ingresa tu correo y el identificador de tu organización. Si los datos son válidos, recibirás un enlace de un solo uso.</p>
        @if (errorMessage()) {
          <div class="login-error" role="alert">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="login-success" role="status">{{ successMessage() }}</div>
        } @else {
          <label>
            Organización
            <input name="tenantId" [(ngModel)]="tenantId" required />
          </label>
          <label>
            Correo
            <input name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
          </label>
          <button class="primary-link" type="submit" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Enviando...' : 'Enviar enlace de recuperación' }}
          </button>
        }
      </form>
    </main>
  `,
  styles: [`
    .login-back { color: #0f817e; display: inline-block; font-size: 12px; margin-bottom: 18px; text-decoration: none; }
    .login-success { background: #e9f8f1; border: 1px solid #a8dec3; border-radius: 9px; color: #17663f; font-size: 13px; line-height: 1.5; padding: 11px; }
  `],
})
export class ForgotPasswordPage {
  private readonly recovery = inject(PasswordRecoveryService);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  tenantId = '20000000-0000-0000-0000-000000000001';
  email = 'laura@acme.com';

  submit(): void {
    this.errorMessage.set('');
    this.isSubmitting.set(true);
    this.recovery.requestRecovery(this.tenantId.trim(), this.email.trim()).subscribe({
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
