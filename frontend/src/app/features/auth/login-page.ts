import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <main class="login-page">
      <form class="login-card" (ngSubmit)="submit()">
        <div class="brand-mark">ND</div>
        <p class="eyebrow">NexoDocs</p>
        <h1>Ingresa al espacio documental</h1>
        <p>Autentica tu identidad y organización para acceder a tus documentos.</p>
        @if (errorMessage()) {
          <div class="login-error" role="alert">{{ errorMessage() }}</div>
        }
        <label>
          Organización
          <input name="tenantId" [(ngModel)]="tenantId" required />
          <small>Usa el identificador asignado por tu organización.</small>
        </label>
        <label>
          Correo
          <input name="usernameOrEmail" [(ngModel)]="usernameOrEmail" autocomplete="username" required />
        </label>
        <label>
          Contrasena
          <input name="password" [(ngModel)]="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="primary-link" type="submit" [disabled]="isSubmitting()">
          {{ isSubmitting() ? 'Validando...' : 'Iniciar sesión' }}
        </button>
        <button type="button" class="login-link" (click)="requestRecovery()">¿Olvidaste tu contraseña?</button>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly errorMessage = signal('');
  readonly isSubmitting = signal(false);
  tenantId = '';
  usernameOrEmail = '';
  password = '';

  submit(): void {
    this.errorMessage.set('');
    this.isSubmitting.set(true);
    this.auth.login({
      tenantId: this.tenantId,
      usernameOrEmail: this.usernameOrEmail,
      password: this.password,
    }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl);
        this.isSubmitting.set(false);
      },
      error: (error: { status?: number }) => {
        this.errorMessage.set(error.status === 401
          ? 'Las credenciales o la organización no son válidas.'
          : 'No fue posible conectar con el servidor. Intenta nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }

  requestRecovery(): void {
    void this.router.navigateByUrl('/forgot-password');
  }
}
