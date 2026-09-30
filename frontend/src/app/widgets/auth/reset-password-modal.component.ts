import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reset-password-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <div class="modal-card">
        <div class="modal-header">
          <h2 id="reset-title">Restablecer contraseña</h2>
          <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar modal">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">Ingresa el token de verificación recibido y tu nueva contraseña.</p>
          <div class="field">
            <label for="reset-token">Token de verificación</label>
            <input
              id="reset-token"
              type="text"
              placeholder="Ingresa tu token"
              [value]="token()"
              (input)="tokenChange.emit($any($event.target).value)"
            >
          </div>
          <div class="field">
            <label for="reset-new-password">Nueva contraseña</label>
            <input
              id="reset-new-password"
              type="password"
              placeholder="••••••••"
              [value]="newPassword()"
              (input)="newPasswordChange.emit($any($event.target).value)"
              autocomplete="new-password"
            >
          </div>
          @if (error()) {
            <div class="form-error-banner" role="alert">{{ error() }}</div>
          }
          @if (success()) {
            <div class="form-success-banner" role="status">{{ success() }}</div>
          }
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" (click)="close.emit()">Cancelar</button>
          <button type="button" class="btn-primary" [disabled]="loading() || !token() || !newPassword()" (click)="submit.emit()">
            {{ loading() ? 'Restableciendo…' : 'Restablecer contraseña' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordModalComponent {
  readonly token = input<string>('');
  readonly newPassword = input<string>('');
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly success = input<string | null>(null);

  readonly tokenChange = output<string>();
  readonly newPasswordChange = output<string>();
  readonly close = output<void>();
  readonly submit = output<void>();
}
