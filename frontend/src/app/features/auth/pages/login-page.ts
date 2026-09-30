import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PublicTenant } from '../../../core/auth/auth.types';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <main class="login-wrapper">
      <div class="login-container">
        <!-- Columna Izquierda: Banner Ilustrativo -->
        <section class="login-banner">
          <div class="brand-header">
            <div class="brand-icon">
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="28" height="28" rx="8" fill="#087f7b"/>
                <path d="M9 7h7l4 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="#ffffff" fill-opacity="0.9"/>
                <path d="M16 7v4h4" fill="#d0ede8"/>
              </svg>
            </div>
            <div class="brand-text">
              <strong>NexoDocs</strong>
              <small>GESTIÓN DOCUMENTAL</small>
            </div>
          </div>

          <div class="banner-content">
            <h1>Tu espacio de trabajo, siempre contigo</h1>
            <p>Accede a tu organización y gestiona tus documentos de forma segura, rápida y sencilla.</p>

            <div class="banner-illustration">
              <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="folder-svg">
                <!-- Fondo circular difuminado -->
                <circle cx="120" cy="90" r="75" fill="#d9f3ee" fill-opacity="0.7" />
                <!-- Hoja botánica superior derecha -->
                <path d="M178 40 C194 36 206 48 202 65 C192 65 180 54 178 40 Z" fill="#8bc9bd"/>
                <path d="M192 30 C207 27 217 37 214 50 C207 50 197 42 192 30 Z" fill="#a4dcce"/>
                <!-- Hoja botánica inferior derecha -->
                <path d="M188 112 C204 118 208 133 198 143 C188 138 183 123 188 112 Z" fill="#78bfb2"/>

                <!-- Hoja de papel saliendo del folder -->
                <rect x="74" y="42" width="72" height="92" rx="8" fill="#ffffff" stroke="#c8e4de" stroke-width="2"/>
                <!-- Líneas simuladas del documento -->
                <rect x="88" y="58" width="44" height="4" rx="2" fill="#d4ece7"/>
                <rect x="88" y="68" width="36" height="4" rx="2" fill="#d4ece7"/>
                <rect x="88" y="78" width="28" height="4" rx="2" fill="#d4ece7"/>

                <!-- Pestaña trasera del folder -->
                <path d="M58 84 C58 78 63 74 69 74 L98 74 L110 84 L171 84 C177 84 182 89 182 95 L182 136 C182 143 177 148 170 148 L70 148 C63 148 58 143 58 136 Z" fill="#4ea99b"/>
                <!-- Cuerpo frontal del folder con solapa redondeada -->
                <path d="M58 92 C58 86 63 82 69 82 L171 82 C177 82 182 87 182 93 L182 136 C182 143 177 148 170 148 L70 148 C63 148 58 143 58 136 Z" fill="#138072"/>
              </svg>
            </div>
          </div>

          <div class="banner-footer">
            <div class="shield-badge">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#087f7b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              <div>
                <strong>Seguridad y control</strong>
                <small>Tus documentos, en buenas manos.</small>
              </div>
            </div>
          </div>
        </section>

        <!-- Columna Derecha: Formulario de Login -->
        <section class="login-form-section">
          <form class="login-form" (ngSubmit)="submit()">
            <header class="form-header">
              <p class="eyebrow">BIENVENIDO DE NUEVO</p>
              <h2>Inicia sesión</h2>
              <p class="subtitle">Ingresa con tu usuario y contraseña para acceder a tu cuenta.</p>
            </header>

            @if (errorMessage()) {
              <div class="login-error" role="alert">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <div class="field-group">
              <label for="tenant-input">Organización</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 18h6v4H9z"/>
                  </svg>
                </span>
                <select id="tenant-input" name="tenantId" [(ngModel)]="tenantId" [disabled]="tenantsLoading()">
                  <option [ngValue]="null">[ Plataforma / Administración Global ]</option>
                  @for (tenant of tenants(); track tenant.id) {
                    <option [value]="tenant.id">{{ tenant.name }}</option>
                  }
                </select>
              </div>
              @if (tenantsError()) { <small class="login-error-text" role="alert">{{ tenantsError() }}</small> }
            </div>

            <div class="field-group">
              <label for="email-input">Correo electrónico</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </span>
                <input
                  id="email-input"
                  name="usernameOrEmail"
                  [(ngModel)]="usernameOrEmail"
                  placeholder="usuario@ejemplo.com"
                  autocomplete="username"
                  required
                />
              </div>
            </div>

            <div class="field-group">
              <label for="password-input">Contraseña</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="password-input"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  placeholder="Ingresa tu contraseña"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  class="toggle-password"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Ver contraseña'"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <button class="submit-btn" type="submit" [disabled]="isSubmitting()">
              <span>{{ isSubmitting() ? 'Validando...' : 'Iniciar sesión' }}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>

            <button type="button" class="recovery-btn" (click)="requestRecovery()">
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </section>
      </div>

      <!-- Decoraciones orgánicas de fondo -->
      <div class="bg-shape bg-shape-bottom-left" aria-hidden="true">
        <svg viewBox="0 0 350 350" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 350 C150 350 280 250 280 100 C280 40 220 0 160 0 C60 0 0 160 0 350 Z" fill="#8bc9bd" fill-opacity="0.3"/>
          <path d="M0 350 C90 350 180 290 190 200 C200 130 150 90 90 120 C30 150 0 240 0 350 Z" fill="#58b3a4" fill-opacity="0.25"/>
        </svg>
      </div>
      <div class="bg-shape bg-shape-top-right" aria-hidden="true">
        <svg viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="260" cy="60" r="220" fill="#a4dcce" fill-opacity="0.25"/>
        </svg>
      </div>
    </main>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eef6f5;
      padding: 24px;
      position: relative;
      overflow: hidden;
      font-family: Inter, system-ui, -apple-system, sans-serif;
    }

    .bg-shape {
      position: absolute;
      pointer-events: none;
      z-index: 0;
    }

    .bg-shape-bottom-left {
      bottom: -40px;
      left: -40px;
      width: 380px;
      height: 380px;
    }

    .bg-shape-top-right {
      top: -80px;
      right: -80px;
      width: 360px;
      height: 360px;
    }

    .login-container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 960px;
      background: #ffffff;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(10, 60, 56, 0.08), 0 2px 10px rgba(0, 0, 0, 0.02);
      display: grid;
      grid-template-columns: 1.05fr 1.15fr;
      overflow: hidden;
      border: 1px solid rgba(220, 235, 232, 0.8);
    }

    /* Columna izquierda (Banner) */
    .login-banner {
      background: #f2faf8;
      padding: 44px 40px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-right: 1px solid #e5f0ed;
    }

    .brand-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-text strong {
      font-size: 19px;
      font-weight: 800;
      color: #102d2a;
      letter-spacing: -0.02em;
    }

    .brand-text small {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #087f7b;
      text-transform: uppercase;
      margin-top: 1px;
    }

    .banner-content {
      margin: 36px 0;
    }

    .banner-content h1 {
      font-size: 24px;
      font-weight: 800;
      color: #123330;
      line-height: 1.3;
      letter-spacing: -0.02em;
      margin: 0 0 12px;
    }

    .banner-content p {
      font-size: 13px;
      color: #557573;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .banner-illustration {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10px 0;
    }

    .folder-svg {
      width: 100%;
      max-width: 220px;
      height: auto;
      filter: drop-shadow(0 12px 24px rgba(8, 127, 123, 0.12));
    }

    .banner-footer {
      padding-top: 16px;
    }

    .shield-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .shield-badge div {
      display: flex;
      flex-direction: column;
    }

    .shield-badge strong {
      font-size: 12px;
      font-weight: 700;
      color: #1a3836;
    }

    .shield-badge small {
      font-size: 11px;
      color: #6d8a88;
    }

    /* Columna derecha (Formulario) */
    .login-form-section {
      background: #ffffff;
      padding: 48px 44px;
      display: flex;
      align-items: center;
    }

    .login-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .form-header .eyebrow {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #087f7b;
      margin: 0 0 8px;
    }

    .form-header h2 {
      font-size: 28px;
      font-weight: 800;
      color: #102d2a;
      letter-spacing: -0.03em;
      margin: 0 0 8px;
    }

    .form-header .subtitle {
      font-size: 13px;
      color: #638280;
      line-height: 1.5;
      margin: 0 0 8px;
    }

    .login-error {
      background: #fdf2f2;
      border: 1px solid #f8d7da;
      border-radius: 10px;
      padding: 11px 14px;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-group label {
      font-size: 12px;
      font-weight: 700;
      color: #244644;
    }

    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 14px;
      color: #7b9997;
      display: flex;
      align-items: center;
      pointer-events: none;
    }

    .input-wrap input {
      width: 100%;
      height: 46px;
      background: #ffffff;
      border: 1.5px solid #dbe6e4;
      border-radius: 12px;
      padding: 0 14px 0 42px;
      font-size: 13px;
      color: #143634;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-wrap select {
      width: 100%;
      height: 46px;
      background: #ffffff;
      border: 1.5px solid #dbe6e4;
      border-radius: 12px;
      padding: 0 14px 0 42px;
      font-size: 13px;
      color: #143634;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-wrap select:focus {
      border-color: #087f7b;
      box-shadow: 0 0 0 3px rgba(8, 127, 123, 0.12);
    }

    .login-error-text {
      color: #b45356;
      font-size: 12px;
    }

    .input-wrap input::placeholder {
      color: #9cb5b3;
    }

    .input-wrap input:focus {
      border-color: #087f7b;
      box-shadow: 0 0 0 3px rgba(8, 127, 123, 0.12);
    }

    .toggle-password {
      position: absolute;
      right: 12px;
      background: transparent;
      border: 0;
      color: #7b9997;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 4px;
    }

    .toggle-password:hover {
      color: #087f7b;
    }

    .submit-btn {
      width: 100%;
      height: 46px;
      background: #087f7b;
      border: 0;
      border-radius: 12px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 6px;
      box-shadow: 0 6px 18px rgba(8, 127, 123, 0.22);
      transition: background 0.2s, transform 0.1s;
    }

    .submit-btn:hover {
      background: #066b67;
    }

    .submit-btn:active {
      transform: scale(0.99);
    }

    .submit-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .recovery-btn {
      width: 100%;
      height: 44px;
      background: #ffffff;
      border: 1.5px solid #087f7b;
      border-radius: 12px;
      color: #087f7b;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .recovery-btn:hover {
      background: #eef8f6;
    }

    @media (max-width: 800px) {
      .login-container {
        grid-template-columns: 1fr;
        max-width: 480px;
      }
      .login-banner {
        display: none;
      }
      .login-form-section {
        padding: 36px 28px;
      }
    }
  `]
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly errorMessage = signal('');
  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);

  readonly tenants = signal<PublicTenant[]>([]);
  readonly tenantsLoading = signal(true);
  readonly tenantsError = signal('');

  tenantId: string | null = null; // null = Plataforma / Administración Global
  usernameOrEmail = '';
  password = '';

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

    this.auth.login({
      tenantId: this.tenantId,
      usernameOrEmail: this.usernameOrEmail,
      password: this.password,
    }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl, { replaceUrl: true });
        this.isSubmitting.set(false);
      },
      error: (error: { status?: number }) => {
        this.errorMessage.set(error.status === 401
          ? 'Las credenciales no son válidas.'
          : 'No fue posible conectar con el servidor. Intenta nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }

  requestRecovery(): void {
    void this.router.navigateByUrl('/forgot-password');
  }
}
