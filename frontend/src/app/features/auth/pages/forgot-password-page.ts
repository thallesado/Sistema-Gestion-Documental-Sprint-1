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
    <main class="login-page">
      <form class="login-card" (ngSubmit)="submit()">
        <a routerLink="/login" class="login-back">← Volver al inicio de sesión</a>
        <div class="brand-mark">ND</div>
        <p class="eyebrow">NexoDocs</p>
        <h1>Recupera tu acceso</h1>
        <p>Selecciona tu organización e ingresa tu correo. Si los datos son válidos, recibirás un enlace de un solo uso.</p>
        @if (errorMessage()) {
          <div class="login-error" role="alert">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="login-success" role="status">{{ successMessage() }}</div>
        } @else {
          <label>
            Organización
            <select name="tenantId" [(ngModel)]="tenantId" [disabled]="tenantsLoading()" required>
              <option [ngValue]="null" disabled>{{ tenantsLoading() ? 'Cargando organizaciones…' : 'Selecciona tu organización' }}</option>
              @for (tenant of tenants(); track tenant.id) {
                <option [ngValue]="tenant.id">{{ tenant.name }}</option>
              }
            </select>
            @if (tenantsError()) { <small class="tenants-error" role="alert">{{ tenantsError() }}</small> }
          </label>
          <label>
            Correo
            <input name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
          </label>
          <button class="primary-link" type="submit" [disabled]="isSubmitting() || !tenantId">
            {{ isSubmitting() ? 'Enviando...' : 'Enviar enlace de recuperación' }}
          </button>
        }
      </form>
    </main>
  `,
  styles: [`
    .login-back { color: #0f817e; display: inline-block; font-size: 12px; margin-bottom: 18px; text-decoration: none; }
    select { border: 1px solid #dbe6e4; border-radius: 9px; box-sizing: border-box; font: inherit; height: 42px; padding: 0 10px; width: 100%; }
    .tenants-error { color: #b45356; font-size: 12px; }
    .login-success { background: #e9f8f1; border: 1px solid #a8dec3; border-radius: 9px; color: #17663f; font-size: 13px; line-height: 1.5; padding: 11px; }
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
