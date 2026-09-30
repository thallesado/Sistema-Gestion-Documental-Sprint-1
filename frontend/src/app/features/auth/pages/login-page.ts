import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ForgotPasswordModalComponent } from '../../../widgets/auth/forgot-password-modal.component';
import { ResetPasswordModalComponent } from '../../../widgets/auth/reset-password-modal.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ForgotPasswordModalComponent, ResetPasswordModalComponent],
  template: `
    <main class="login-page">
      <section class="login-card">
        <div class="brand-badge">
          <span class="brand-dot"></span>
          <span>NexoDocs · Plataforma de Gestión Documental</span>
        </div>

        <header class="login-header">
          <h1>Iniciar sesión</h1>
          <p>Ingresa a tu organización o accede con tus credenciales.</p>
        </header>

        <form class="login-form" (ngSubmit)="submitLogin()">
          <div class="field">
            <label for="username">Usuario o Correo</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              placeholder="ejemplo@organizacion.com"
              autocomplete="username"
            >
          </div>

          <div class="field">
            <div class="field-label-row">
              <label for="password">Contraseña</label>
              <button type="button" class="btn-link" (click)="showForgotModal.set(true)">¿Olvidaste tu contraseña?</button>
            </div>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="••••••••"
              autocomplete="current-password"
            >
          </div>

          @if (errorMessage()) {
            <div class="error-banner" role="alert">{{ errorMessage() }}</div>
          }

          <button type="submit" class="btn-submit" [disabled]="loading()">
            {{ loading() ? 'Iniciando sesión…' : 'Ingresar al sistema' }}
          </button>
        </form>

        <footer class="login-footer">
          <p>¿Problemas para acceder? Contacta al administrador del sistema.</p>
        </footer>
      </section>

      @if (showForgotModal()) {
        <app-forgot-password-modal
          [email]="recoveryEmail"
          [loading]="recoveryLoading()"
          [error]="recoveryError()"
          [success]="recoverySuccess()"
          (emailChange)="recoveryEmail = $event"
          (close)="showForgotModal.set(false)"
          (submit)="submitForgotPassword()"
        />
      }

      @if (showResetModal()) {
        <app-reset-password-modal
          [token]="resetToken"
          [newPassword]="resetNewPassword"
          [loading]="recoveryLoading()"
          [error]="recoveryError()"
          [success]="recoverySuccess()"
          (tokenChange)="resetToken = $event"
          (newPasswordChange)="resetNewPassword = $event"
          (close)="showResetModal.set(false)"
          (submit)="submitResetPassword()"
        />
      }
    </main>
  `
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  username = '';
  password = '';

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly showForgotModal = signal(false);
  readonly showResetModal = signal(false);
  readonly recoveryLoading = signal(false);
  readonly recoveryError = signal<string | null>(null);
  readonly recoverySuccess = signal<string | null>(null);
  recoveryEmail = '';
  resetToken = '';
  resetNewPassword = '';

  submitLogin(): void {
    if (!this.username || !this.password) {
      this.errorMessage.set('Por favor completa todos los campos.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login({ usernameOrEmail: this.username, password: this.password, tenantId: null }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message || 'Credenciales inválidas o error de conexión.');
      }
    });
  }

  submitForgotPassword(): void {
    if (!this.recoveryEmail) return;
    this.recoveryLoading.set(true);
    this.recoveryError.set(null);
    this.recoverySuccess.set(null);

    this.http.post<{ message: string }>('/api/v1/auth/forgot-password', { email: this.recoveryEmail }).subscribe({
      next: () => {
        this.recoveryLoading.set(false);
        this.recoverySuccess.set('Se ha enviado un token de recuperación a tu correo.');
        setTimeout(() => {
          this.showForgotModal.set(false);
          this.showResetModal.set(true);
        }, 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.recoveryLoading.set(false);
        this.recoveryError.set(err?.error?.message || 'No se pudo enviar la solicitud.');
      }
    });
  }

  submitResetPassword(): void {
    if (!this.resetToken || !this.resetNewPassword) return;
    this.recoveryLoading.set(true);
    this.recoveryError.set(null);

    this.http.post<{ message: string }>('/api/v1/auth/reset-password', {
      token: this.resetToken,
      newPassword: this.resetNewPassword
    }).subscribe({
      next: () => {
        this.recoveryLoading.set(false);
        this.recoverySuccess.set('Contraseña restablecida exitosamente.');
        setTimeout(() => {
          this.showResetModal.set(false);
        }, 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.recoveryLoading.set(false);
        this.recoveryError.set(err?.error?.message || 'Token inválido o expirado.');
      }
    });
  }
}
