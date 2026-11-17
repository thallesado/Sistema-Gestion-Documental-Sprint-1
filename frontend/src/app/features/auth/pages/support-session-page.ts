import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { supportTokenFromHash } from './support-session.logic';

/**
 * Pestaña de soporte (/support-session#token=...). La plataforma la abre con el token de solo lectura en
 * el fragmento (que el navegador no envía al servidor); se guarda en esta pestaña, se borra de la URL y se
 * entra a la organización con la identidad de la cuenta de plataforma, nunca la de un usuario del tenant.
 */
@Component({
  selector: 'app-support-session-page',
  standalone: true,
  template: `
    <main class="support-landing">
      @if (error()) {
        <h1>No se pudo abrir la sesión de soporte</h1>
        <p>{{ error() }}</p>
        <a href="/platform/support-access">Volver a Acceso de soporte</a>
      } @else {
        <p>Abriendo la sesión de soporte de solo lectura…</p>
      }
    </main>
  `,
  styles: [`
    .support-landing { max-width: 520px; margin: 80px auto; padding: 24px; font-family: inherit; color: #153a39; text-align: center; }
    h1 { font-size: 20px; }
    a { color: #087f7b; font-weight: 700; }
  `],
})
export class SupportSessionPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal('');

  ngOnInit(): void {
    const token = supportTokenFromHash(window.location.hash);
    // El token no debe quedar en la URL ni en el historial.
    history.replaceState(null, '', window.location.pathname);
    if (!token) {
      this.error.set('El enlace no contiene una sesión válida. Ábrela de nuevo desde la plataforma.');
      return;
    }
    this.auth.startSupportSession(token);
    void this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
