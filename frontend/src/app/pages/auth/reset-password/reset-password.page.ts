import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PasswordRecoveryService } from '../../../features/auth/services/password-recovery.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.css',
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
