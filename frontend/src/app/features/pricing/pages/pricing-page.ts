import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface SubscriptionCheckoutSession {
  sessionId: string;
  url: string;
}

type DisplayCurrency = 'USD' | 'BOB' | 'BRL' | 'EUR';

/**
 * Display-only conversion: Stripe always charges the USD price. Reference rates (units per 1 USD);
 * update them here when they drift.
 */
const CURRENCIES: ReadonlyArray<{ code: DisplayCurrency; label: string; symbol: string; perUsd: number }> = [
  { code: 'USD', label: 'Dólares (USD)', symbol: '$', perUsd: 1 },
  { code: 'BOB', label: 'Bolivianos (BOB)', symbol: 'Bs', perUsd: 6.96 },
  { code: 'BRL', label: 'Reales (BRL)', symbol: 'R$', perUsd: 5.5 },
  { code: 'EUR', label: 'Euros (EUR)', symbol: '€', perUsd: 0.92 },
];
const CURRENCY_STORAGE_KEY = 'nexodocs.pricing.currency';

interface PlanLimit {
  resourceKey: string;
  resourceValue: number;
  unit: string | null;
}

interface PlanFeature {
  featureKey: string;
  enabled: boolean;
  description: string;
}

interface PlanCatalog {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimit[];
  features: PlanFeature[];
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pricing-layout">
      <!-- Barra de navegación pública -->
      <nav class="pricing-nav">
        <div class="nav-content">
          <a routerLink="/welcome" class="brand">
            <span class="brand-icon">✦</span>
            <span class="brand-name">NexoDocs</span>
          </a>
          <div class="nav-actions">
            <a routerLink="/welcome" class="nav-link">Inicio</a>
            <a routerLink="/login" class="nav-link">Iniciar sesión</a>
            <a routerLink="/register" class="nav-cta">Solicitar demo</a>
          </div>
        </div>
      </nav>

      <!-- Encabezado de la página de precios -->
      <header class="pricing-hero">
        <span class="hero-badge">SaaS universal para salud y empresas</span>
        <h1>Planes diseñados para cada etapa de <span class="hero-accent">tu institución</span></h1>
        <p class="hero-subtitle">
          Elige el plan ideal, registra los datos de tu empresa y comienza a operar en minutos con una cuenta de administración completa.
        </p>

        <div class="controls">
          <!-- Conmutador Mensual / Anual -->
          <div class="segmented" role="group" aria-label="Ciclo de facturación">
            <button type="button" [class.active]="billingCycle() === 'MONTHLY'" [attr.aria-pressed]="billingCycle() === 'MONTHLY'" (click)="setCycle('MONTHLY')">Mensual</button>
            <button type="button" [class.active]="billingCycle() === 'ANNUAL'" [attr.aria-pressed]="billingCycle() === 'ANNUAL'" (click)="setCycle('ANNUAL')">
              Anual <span class="discount-pill">−2 meses</span>
            </button>
          </div>
          <div class="segmented currency-switch" role="group" aria-label="Divisa para ver los precios">
            @for (option of currencies; track option.code) {
              <button
                type="button"
                [class.active]="currency() === option.code"
                [attr.aria-pressed]="currency() === option.code"
                [attr.title]="option.label"
                (click)="setCurrency(option.code)"
              >
                {{ option.code }}
              </button>
            }
          </div>
        </div>
        @if (currency() !== 'USD') {
          <p class="currency-note">Precios convertidos con un tipo de cambio referencial. El cobro se realiza en dólares (USD).</p>
        }
        @if (checkoutCancelled()) {
          <p class="checkout-notice" role="status">El pago fue cancelado y no se realizó ningún cobro. Puedes elegir un plan nuevamente.</p>
        }
      </header>

      <!-- Rejilla de planes -->
      <main class="plans-container">
        @if (loading()) {
          <div class="plans-loading">
            <div class="spinner"></div>
            <p>Cargando planes vigentes…</p>
          </div>
        } @else if (loadError()) {
          <div class="plans-loading" role="alert">
            <p>No se pudieron cargar los planes y precios vigentes.</p>
            <button type="button" class="plans-retry" (click)="loadPlans()">Reintentar</button>
          </div>
        } @else {
          <div class="plans-grid">
            @for (plan of plans(); track plan.id) {
              <div class="plan-card" [class.popular]="plan.code === 'PRO'">
                @if (plan.code === 'PRO') {
                  <div class="popular-ribbon">Más recomendado</div>
                }

                <div class="card-header">
                  <span class="plan-code">{{ plan.code }}</span>
                  <h2 class="plan-title">{{ plan.name }}</h2>
                  <p class="plan-desc">{{ plan.description }}</p>
                </div>

                <div class="card-price">
                  <div class="price-amount">
                    <span class="currency">{{ currencySymbol() }}</span>
                    <span class="value">{{ displayAmount(getPrice(plan)) }}</span>
                    <span class="currency-code">{{ currency() }} / {{ billingCycle() === 'ANNUAL' ? 'año' : 'mes' }}</span>
                  </div>
                  <span class="price-period">
                    Renovación automática{{ currency() !== 'USD' ? ' · se cobra USD ' + getPrice(plan) : '' }}
                  </span>
                </div>

                <div class="card-cta">
                  <button
                    type="button"
                    class="select-plan-btn"
                    [class.primary-btn]="plan.code === 'PRO'"
                    (click)="openSignupModal(plan)"
                  >
                    Contratar {{ plan.name }}
                  </button>
                  <a class="demo-link" routerLink="/register" [queryParams]="{ plan: plan.code }">o prueba la demo gratis 12 días</a>
                </div>

                <div class="card-limits">
                  <div class="limit-tile">
                    <b>{{ getLimit(plan, 'maxUsers') }}</b>
                    <span>usuarios</span>
                  </div>
                  <div class="limit-tile">
                    <b>{{ getLimit(plan, 'maxDocuments') }}</b>
                    <span>documentos</span>
                  </div>
                  <div class="limit-tile">
                    <b>{{ getStorage(plan) }}</b>
                    <span>almacenamiento</span>
                  </div>
                  <div class="limit-tile">
                    <b>{{ getLimit(plan, 'maxOcrPagesPerMonth') }}</b>
                    <span>páginas OCR / mes</span>
                  </div>
                </div>

                <div class="card-features">
                  <p class="features-title">Funcionalidades incluidas</p>
                  <ul>
                    @for (feat of sortedFeatures(plan); track feat.featureKey) {
                      <li [class.disabled]="!feat.enabled">
                        <span class="check-icon" aria-hidden="true">{{ feat.enabled ? '✓' : '–' }}</span>
                        <span>{{ feat.description || feat.featureKey }}</span>
                      </li>
                    }
                  </ul>
                </div>
              </div>
            }
          </div>

          <ul class="trust-strip">
            <li><span aria-hidden="true">🔒</span> Pago seguro con Stripe; NexoDocs no guarda tu tarjeta</li>
            <li><span aria-hidden="true">↻</span> Renovación automática, cancela cuando quieras</li>
            <li><span aria-hidden="true">🛡</span> Datos aislados por organización</li>
          </ul>
        }
      </main>

      <!-- Modal de alta: datos de la organización y pago recurrente con Stripe Checkout -->
      @if (selectedPlan()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <div>
                <span class="step-badge">Paso {{ step() }} de 3</span>
                <h2>Contratación · {{ selectedPlan()?.name }}</h2>
              </div>
              <button type="button" class="close-btn" (click)="closeModal()" aria-label="Cerrar modal">✕</button>
            </header>

            <!-- Paso 1: Datos de la Empresa -->
            @if (step() === 1) {
              <form (ngSubmit)="goToStep(2)" class="modal-form">
                <h3>1. Datos de tu empresa o institución médica</h3>
                <div class="form-group">
                  <label for="co-name">Nombre de la organización</label>
                  <input
                    id="co-name"
                    type="text"
                    [(ngModel)]="signupForm.companyName"
                    name="companyName"
                    placeholder="Ej. Clínica Santa María S.R.L."
                    required
                    maxlength="160"
                    class="modal-input"
                  />
                </div>
                <div class="form-group">
                  <label for="co-email">Correo corporativo</label>
                  <input
                    id="co-email"
                    type="email"
                    [(ngModel)]="signupForm.companyEmail"
                    name="companyEmail"
                    placeholder="contacto@clinica.com"
                    required
                    class="modal-input"
                  />
                </div>

                <div class="modal-footer">
                  <button type="button" class="btn-cancel" (click)="closeModal()">Cancelar</button>
                  <button type="submit" class="primary-btn">Continuar al paso 2 →</button>
                </div>
              </form>
            }

            <!-- Paso 2: Administrador Inicial -->
            @if (step() === 2) {
              <form (ngSubmit)="goToStep(3)" class="modal-form">
                <h3>2. Datos de la cuenta de Administrador Inicial</h3>
                <p class="step-desc">Esta cuenta tendrá acceso completo para configurar usuarios y gestionar el espacio.</p>

                <div class="form-group">
                  <label for="admin-name">Nombre y apellido del administrador</label>
                  <input
                    id="admin-name"
                    type="text"
                    [(ngModel)]="signupForm.adminName"
                    name="adminName"
                    placeholder="Dr. Roberto Méndez"
                    required
                    maxlength="160"
                    class="modal-input"
                  />
                </div>
                <div class="form-row">
                  <div class="form-group half">
                    <label for="admin-email">Correo personal del administrador</label>
                    <input
                      id="admin-email"
                      type="email"
                      [(ngModel)]="signupForm.adminEmail"
                      name="adminEmail"
                      placeholder="roberto.mendez@clinica.com"
                      required
                      class="modal-input"
                    />
                  </div>
                  <div class="form-group half">
                    <label for="admin-password">Contraseña deseada</label>
                    <input
                      id="admin-password"
                      type="password"
                      [(ngModel)]="signupForm.adminPassword"
                      name="adminPassword"
                      placeholder="Mínimo 8 caracteres"
                      required
                      minlength="8"
                      class="modal-input"
                    />
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" class="btn-cancel" (click)="goToStep(1)">← Volver</button>
                  <button type="submit" class="primary-btn">Revisar y pagar →</button>
                </div>
              </form>
            }

            <!-- Paso 3: Revisión y pago en Stripe -->
            @if (step() === 3) {
              <form (ngSubmit)="submitSignup()" class="modal-form">
                <h3>3. Revisión y pago seguro</h3>
                <div class="summary-card">
                  <div class="summary-row">
                    <span>Organización:</span>
                    <b>{{ signupForm.companyName }}</b>
                  </div>
                  <div class="summary-row">
                    <span>Administrador:</span>
                    <b>{{ signupForm.adminEmail }}</b>
                  </div>
                  <div class="summary-row">
                    <span>Plan contratado:</span>
                    <b>{{ selectedPlan()?.name }} ({{ billingCycle() === 'ANNUAL' ? 'Anual' : 'Mensual' }})</b>
                  </div>
                  <div class="summary-row total">
                    <span>Total del primer cobro:</span>
                    <b class="price-highlight">
                      USD {{ getPrice(selectedPlan()!) }}
                      @if (currency() !== 'USD') {
                        <small>(≈ {{ currencySymbol() }} {{ displayAmount(getPrice(selectedPlan()!)) }})</small>
                      }
                    </b>
                  </div>
                </div>

                <p class="step-desc">
                  Te llevaremos a la página segura de Stripe para ingresar tu tarjeta; NexoDocs no ve ni guarda sus datos.
                  Cuando Stripe confirme el pago se crea tu organización y la suscripción se renueva automáticamente
                  cada {{ billingCycle() === 'ANNUAL' ? 'año' : 'mes' }} hasta que la canceles.
                </p>

                @if (submitError()) {
                  <div class="modal-error" role="alert">
                    <span>⚠ {{ submitError() }}</span>
                  </div>
                }

                <div class="modal-footer">
                  <button type="button" class="btn-cancel" (click)="goToStep(2)" [disabled]="submitting()">← Volver</button>
                  <button type="submit" class="primary-btn pay-btn" [disabled]="submitting()">
                    @if (submitting()) {
                      <span>Redirigiendo a Stripe…</span>
                    } @else {
                      <span>Pagar con Stripe (\${{ getPrice(selectedPlan()!) }} USD)</span>
                    }
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Paleta del sistema (styles.css): --ink, --muted, --line, --canvas, --teal, --teal-strong, --mint. */
    :host {
      --p-ink: var(--ink, #153a39);
      --p-muted: var(--muted, #6b8583);
      --p-line: var(--line, #dcebe8);
      --p-teal: var(--teal, #087f7b);
      --p-teal-strong: var(--teal-strong, #05635f);
      --p-mint: var(--mint, #dff7f3);
      --p-deep: #0b2420;
      --p-deeper: #071916;
      --p-glow: #62e3c4;
    }
    .pricing-layout {
      min-height: 100vh;
      background:
        radial-gradient(circle at 8% 0%, #b7f2db 0, transparent 32%),
        radial-gradient(circle at 92% 12%, #dff7f3 0, transparent 28%),
        var(--canvas, #f6faf9);
      color: var(--p-ink);
    }

    /* Navegación */
    .pricing-nav {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--p-line);
      padding: 0.75rem 16px;
    }
    .nav-content {
      max-width: 1160px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--p-ink);
      font-weight: 800;
      font-size: 1.2rem;
    }
    .brand-icon { color: var(--p-teal); }
    .nav-actions {
      display: flex;
      gap: 1.25rem;
      align-items: center;
      white-space: nowrap;
    }
    .nav-link {
      text-decoration: none;
      color: var(--p-muted);
      font-weight: 600;
      font-size: 0.9rem;
      transition: color 0.15s;
    }
    .nav-link:hover { color: var(--p-teal); }
    .nav-cta {
      text-decoration: none;
      background: var(--p-mint);
      color: var(--p-teal-strong);
      border: 1px solid #bfe9df;
      padding: 0.45rem 0.95rem;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.85rem;
      transition: background 0.15s;
    }
    .nav-cta:hover { background: #c9f1ec; }

    /* Encabezado */
    .pricing-hero {
      text-align: center;
      padding: 3.5rem 16px 1.5rem;
      max-width: 820px;
      margin: 0 auto;
    }
    .hero-badge {
      display: inline-block;
      background: var(--p-mint);
      color: var(--p-teal-strong);
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      margin-bottom: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .pricing-hero h1 {
      font-size: clamp(2rem, 4.6vw, 3rem);
      font-weight: 800;
      line-height: 1.08;
      color: var(--p-ink);
      letter-spacing: -0.035em;
      margin: 0 0 1rem;
    }
    .hero-accent { color: var(--p-teal); }
    .hero-subtitle {
      font-size: 1.05rem;
      color: var(--p-muted);
      line-height: 1.6;
      margin: 0 auto 2rem;
      max-width: 620px;
    }

    /* Controles: ciclo y divisa */
    .controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
    }
    .segmented {
      display: inline-flex;
      gap: 0.25rem;
      padding: 0.3rem;
      background: #ffffff;
      border: 1px solid var(--p-line);
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(11, 66, 50, 0.06);
    }
    .segmented button {
      border: 0;
      background: transparent;
      color: var(--p-muted);
      font-weight: 700;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.15s, color 0.15s;
    }
    .segmented button:hover { color: var(--p-ink); }
    .segmented button.active {
      background: var(--p-teal);
      color: #ffffff;
    }
    .segmented button:focus-visible,
    .select-plan-btn:focus-visible,
    .nav-cta:focus-visible {
      outline: 2px solid var(--p-teal);
      outline-offset: 2px;
    }
    .currency-switch button { padding: 0.5rem 0.8rem; letter-spacing: 0.02em; }
    .discount-pill {
      background: var(--p-mint);
      color: var(--p-teal-strong);
      font-size: 0.7rem;
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
      font-weight: 800;
    }
    .segmented button.active .discount-pill {
      background: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }
    .currency-note {
      margin: 0.9rem 0 0;
      font-size: 0.8rem;
      color: var(--p-muted);
    }
    .checkout-notice {
      display: inline-block;
      margin: 1.25rem auto 0;
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      border-radius: 10px;
      padding: 0.6rem 1rem;
      font-size: 0.9rem;
    }

    /* Rejilla de planes */
    .plans-container {
      max-width: 1160px;
      margin: 0 auto;
      padding: 2.25rem 16px 4.5rem;
    }
    .plans-loading {
      text-align: center;
      padding: 4rem;
      color: var(--p-muted);
    }
    .plans-retry {
      border: 1px solid var(--p-line);
      border-radius: 10px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 0.6rem 1.2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--p-line);
      border-top-color: var(--p-teal);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 1.5rem;
      align-items: stretch;
    }
    .plan-card {
      background: #ffffff;
      border: 1px solid var(--p-line);
      border-radius: 22px;
      padding: 2rem 1.75rem;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 10px 30px rgba(11, 66, 50, 0.06);
    }
    .plan-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 45px rgba(11, 66, 50, 0.12);
    }
    .plan-card.popular {
      background: linear-gradient(180deg, var(--p-deep), var(--p-deeper));
      border-color: transparent;
      color: #dcf8ee;
      box-shadow: 0 24px 55px rgba(7, 25, 22, 0.35);
    }
    .popular-ribbon {
      position: absolute;
      top: -13px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--p-glow);
      color: var(--p-deep);
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0.3rem 0.9rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    .plan-code {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: var(--p-teal);
      margin-bottom: 0.4rem;
    }
    .plan-card.popular .plan-code { color: var(--p-glow); }
    .plan-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--p-ink);
      margin: 0 0 0.45rem;
    }
    .plan-card.popular .plan-title { color: #ffffff; }
    .plan-desc {
      font-size: 0.9rem;
      color: var(--p-muted);
      min-height: 2.6em;
      margin: 0 0 1.5rem;
      line-height: 1.45;
    }
    .plan-card.popular .plan-desc { color: #a9d9cb; }

    .card-price { margin-bottom: 1.5rem; }
    .price-amount {
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
      flex-wrap: wrap;
    }
    .currency {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--p-ink);
    }
    .value {
      font-size: 3rem;
      line-height: 1;
      font-weight: 800;
      color: var(--p-ink);
      letter-spacing: -0.045em;
    }
    .currency-code {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--p-muted);
    }
    .plan-card.popular .currency,
    .plan-card.popular .value { color: #ffffff; }
    .plan-card.popular .currency-code { color: #a9d9cb; }
    .price-period {
      display: block;
      font-size: 0.8rem;
      color: var(--p-muted);
      margin-top: 0.4rem;
    }
    .plan-card.popular .price-period { color: #8fc7b8; }

    .select-plan-btn {
      width: 100%;
      padding: 0.85rem 1.25rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      background: var(--p-mint);
      color: var(--p-teal-strong);
      border: 1px solid #bfe9df;
      transition: background 0.15s, transform 0.15s;
    }
    .select-plan-btn:hover { background: #c9f1ec; }
    .select-plan-btn.primary-btn {
      background: linear-gradient(135deg, #0f766e, #10b981);
      color: #ffffff;
      border: 0;
      box-shadow: 0 10px 24px rgba(16, 185, 129, 0.3);
    }
    .select-plan-btn.primary-btn:hover { transform: translateY(-1px); }
    .demo-link {
      display: block;
      margin-top: 0.7rem;
      text-align: center;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--p-teal);
      text-decoration: none;
    }
    .demo-link:hover { text-decoration: underline; }
    .plan-card.popular .demo-link { color: var(--p-glow); }

    .card-limits {
      margin: 1.6rem 0 1.4rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
    }
    .limit-tile {
      background: var(--canvas, #f6faf9);
      border: 1px solid var(--p-line);
      border-radius: 12px;
      padding: 0.7rem 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .limit-tile b {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--p-ink);
    }
    .limit-tile span {
      font-size: 0.75rem;
      color: var(--p-muted);
    }
    .plan-card.popular .limit-tile {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(98, 227, 196, 0.18);
    }
    .plan-card.popular .limit-tile b { color: #ffffff; }
    .plan-card.popular .limit-tile span { color: #a9d9cb; }

    .card-features { flex: 1; }
    .features-title {
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--p-muted);
      margin: 0 0 0.8rem;
    }
    .plan-card.popular .features-title { color: #8fc7b8; }
    .card-features ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .card-features li {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.875rem;
      line-height: 1.4;
      color: var(--p-ink);
    }
    .plan-card.popular .card-features li { color: #dcf8ee; }
    .card-features li.disabled { color: #9fb3b0; }
    .plan-card.popular .card-features li.disabled { color: #5f8279; }
    .check-icon {
      flex: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 0.7rem;
      font-weight: 800;
      background: var(--p-mint);
      color: var(--p-teal-strong);
    }
    .plan-card.popular .check-icon {
      background: rgba(98, 227, 196, 0.18);
      color: var(--p-glow);
    }
    .card-features li.disabled .check-icon {
      background: #eef3f2;
      color: #9fb3b0;
    }
    .plan-card.popular .card-features li.disabled .check-icon {
      background: rgba(255, 255, 255, 0.06);
      color: #5f8279;
    }

    .trust-strip {
      list-style: none;
      margin: 2.5rem 0 0;
      padding: 1.1rem 1.25rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem 2rem;
      background: #ffffff;
      border: 1px solid var(--p-line);
      border-radius: 16px;
      font-size: 0.875rem;
      color: var(--p-muted);
    }
    .trust-strip li { display: flex; align-items: center; gap: 0.5rem; }
    .trust-strip span { color: var(--p-teal); }

    /* Modal de contratación */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(7, 25, 22, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 1000;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 20px;
      width: 100%;
      max-width: 580px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 2rem;
      box-shadow: 0 30px 60px rgba(7, 25, 22, 0.3);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .step-badge {
      font-size: 0.72rem;
      font-weight: 800;
      color: var(--p-teal);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .modal-header h2 {
      margin: 0.25rem 0 0;
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--p-ink);
    }
    .close-btn {
      background: var(--canvas, #f6faf9);
      border: 1px solid var(--p-line);
      width: 34px;
      height: 34px;
      border-radius: 50%;
      font-size: 0.95rem;
      color: var(--p-muted);
      cursor: pointer;
    }
    .close-btn:hover { color: var(--p-ink); }
    .modal-form h3 {
      font-size: 1rem;
      font-weight: 700;
      color: var(--p-ink);
      margin: 0 0 1rem;
    }
    .step-desc {
      font-size: 0.85rem;
      color: var(--p-muted);
      line-height: 1.5;
      margin: 0 0 1.25rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--p-ink);
      margin-bottom: 0.4rem;
    }
    .form-row {
      display: flex;
      gap: 1rem;
    }
    .form-group.half { flex: 1; }
    .modal-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.7rem 0.85rem;
      border: 1px solid #cfe5df;
      border-radius: 10px;
      font-size: 0.95rem;
      color: var(--p-ink);
      background: #ffffff;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .modal-input:focus {
      outline: none;
      border-color: var(--p-teal);
      box-shadow: 0 0 0 3px rgba(8, 127, 123, 0.15);
    }
    .summary-card {
      background: var(--canvas, #f6faf9);
      border: 1px solid var(--p-line);
      border-radius: 12px;
      padding: 0.9rem 1rem;
      margin-bottom: 1.25rem;
      display: grid;
      gap: 0.35rem;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--p-muted);
    }
    .summary-row b { color: var(--p-ink); text-align: right; }
    .summary-row.total {
      margin-top: 0.4rem;
      padding-top: 0.6rem;
      border-top: 1px solid var(--p-line);
      font-size: 1rem;
      font-weight: 700;
      color: var(--p-ink);
    }
    .price-highlight { color: var(--p-teal) !important; }
    .price-highlight small { display: block; font-weight: 600; color: var(--p-muted); }
    .modal-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 0.75rem;
      border-radius: 10px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--p-line);
    }
    .btn-cancel {
      background: none;
      border: none;
      color: var(--p-muted);
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-cancel:hover { color: var(--p-ink); }
    .primary-btn {
      background: linear-gradient(135deg, #0f766e, #10b981);
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.4rem;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
    }
    .primary-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 640px) {
      .nav-actions .nav-link:first-child { display: none; }
      .pricing-hero { padding-top: 2.25rem; }
      .controls { flex-direction: column; align-items: center; }
      .form-row { flex-direction: column; gap: 0; }
      .modal-card { padding: 1.5rem 1.25rem; }
      .modal-footer { flex-direction: column-reverse; align-items: stretch; }
      .primary-btn { width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .plan-card, .select-plan-btn { transition: none; }
      .plan-card:hover { transform: none; }
    }
  `],
})
export class PricingPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly plans = signal<PlanCatalog[]>([]);
  readonly loadError = signal(false);
  readonly billingCycle = signal<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  readonly selectedPlan = signal<PlanCatalog | null>(null);
  readonly step = signal<number>(1);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly checkoutCancelled = signal(false);
  readonly currencies = CURRENCIES;
  readonly currency = signal<DisplayCurrency>(this.storedCurrency());

  signupForm = {
    companyName: '',
    companyEmail: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  };

  ngOnInit(): void {
    this.checkoutCancelled.set(this.route.snapshot.queryParamMap.get('cancelado') === '1');
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.http.get<PlanCatalog[]>('/api/v1/plans').subscribe({
      next: (data) => {
        this.plans.set(data);
        this.loading.set(false);
        this.openRequestedPlan();
      },
      // Sin catálogo no se muestran precios inventados: el precio debe coincidir con el vigente en Stripe.
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  setCycle(cycle: 'MONTHLY' | 'ANNUAL'): void {
    this.billingCycle.set(cycle);
  }

  toggleCycle(): void {
    this.billingCycle.update((c) => (c === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY'));
  }

  setCurrency(code: DisplayCurrency): void {
    this.currency.set(code);
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, code); } catch { /* storage unavailable */ }
  }

  currencySymbol(): string {
    return CURRENCIES.find((c) => c.code === this.currency())!.symbol;
  }

  /** USD price converted to the selected display currency, rounded to whole units. */
  displayAmount(usd: number): string {
    const rate = CURRENCIES.find((c) => c.code === this.currency())!.perUsd;
    return Math.round(usd * rate).toLocaleString('es-BO');
  }

  private storedCurrency(): DisplayCurrency {
    try {
      const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (CURRENCIES.some((c) => c.code === stored)) return stored as DisplayCurrency;
    } catch { /* storage unavailable */ }
    return 'USD';
  }

  /** ?comprar=PRO (from the welcome page) opens the purchase form for that plan right away. */
  private openRequestedPlan(): void {
    const code = this.route.snapshot.queryParamMap.get('comprar')?.toUpperCase();
    const plan = code ? this.plans().find((p) => p.code === code) : undefined;
    if (plan) this.openSignupModal(plan);
  }

  /** Included features first so each card leads with what the plan offers. */
  sortedFeatures(plan: PlanCatalog): PlanFeature[] {
    return [...(plan.features ?? [])].sort((a, b) => Number(b.enabled) - Number(a.enabled));
  }

  getPrice(plan: PlanCatalog): number {
    return this.billingCycle() === 'ANNUAL' ? plan.priceYearly : plan.priceMonthly;
  }

  getLimit(plan: PlanCatalog, key: string): string {
    const lim = plan.limits?.find((l) => l.resourceKey === key);
    if (!lim) return '-';
    return lim.resourceValue === -1 ? 'Ilimitados' : String(lim.resourceValue);
  }

  getStorage(plan: PlanCatalog): string {
    const lim = plan.limits?.find((l) => l.resourceKey === 'maxStorageMB');
    if (!lim) return '-';
    if (lim.resourceValue === -1) return 'Ilimitado';
    return lim.resourceValue >= 1024 ? `${lim.resourceValue / 1024} GB` : `${lim.resourceValue} MB`;
  }

  openSignupModal(plan: PlanCatalog): void {
    this.selectedPlan.set(plan);
    this.step.set(1);
    this.submitError.set(null);
  }

  closeModal(): void {
    this.selectedPlan.set(null);
    this.step.set(1);
    this.submitError.set(null);
  }

  goToStep(s: number): void {
    this.step.set(s);
  }

  submitSignup(): void {
    const plan = this.selectedPlan();
    if (!plan) return;

    this.submitting.set(true);
    this.submitError.set(null);

    // Solo se envían el plan y el ciclo: el precio lo resuelve el servidor con el catálogo de Stripe.
    const payload = {
      tenantName: this.signupForm.companyName,
      companyEmail: this.signupForm.companyEmail,
      administratorName: this.signupForm.adminName,
      adminEmail: this.signupForm.adminEmail,
      password: this.signupForm.adminPassword,
      planCode: plan.code,
      billingPeriod: this.billingCycle(),
    };

    this.http.post<SubscriptionCheckoutSession>('/api/v1/public/subscriptions/checkout', payload).subscribe({
      next: (session) => window.location.assign(session.url),
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(
          err?.error?.message || 'No se pudo iniciar el pago. Verifica los datos e inténtalo nuevamente.'
        );
      },
    });
  }
}
