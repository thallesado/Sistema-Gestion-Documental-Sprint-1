import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PublicTenant } from '../../../core/auth/auth.types';
import { PasswordRecoveryService } from '../services/password-recovery.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.css',
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
      next: (list) => {
        this.tenants.set(list);
        this.tenantsLoading.set(false);
      },
      error: (error: { status?: number }) => {
        this.tenantsError.set(
          error.status === 429
            ? 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.'
            : 'No se pudo cargar la lista de organizaciones.'
        );
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
