import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <div class="modal-card">
        <div class="modal-header">
          <h2 id="forgot-title">Recuperar contraseña</h2>
          <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar modal">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">Ingresa tu correo electrónico registrado y te enviaremos instrucciones para restablecer tu contraseña.</p>
          <div class="field">
            <label for="recovery-email">Correo electrónico</label>
            <input
              id="recovery-email"
              type="email"
              placeholder="ejemplo@organizacion.com"
              [value]="email()"
              (input)="emailChange.emit($any($event.target).value)"
              autocomplete="email"
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
          <button type="button" class="btn-primary" [disabled]="loading() || !email()" (click)="submit.emit()">
            {{ loading() ? 'Enviando…' : 'Enviar instrucciones' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ForgotPasswordModalComponent {
  readonly email = input<string>('');
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly success = input<string | null>(null);

  readonly emailChange = output<string>();
  readonly close = output<void>();
  readonly submit = output<void>();
}
