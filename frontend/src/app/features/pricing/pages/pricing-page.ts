import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

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
            <a routerLink="/login" class="nav-link">Iniciar sesión</a>
            <a routerLink="/welcome" class="nav-link">Inicio</a>
          </div>
        </div>
      </nav>

      <!-- Encabezado de la página de precios -->
      <header class="pricing-hero">
        <span class="hero-badge">SaaS Universal para Salud y Empresas</span>
        <h1>Planes diseñados para cada etapa de tu institución</h1>
        <p class="hero-subtitle">
          Elige el plan ideal, registra los datos de tu empresa y comienza a operar en minutos con una cuenta de administración completa.
        </p>

        <!-- Conmutador Mensual / Anual -->
        <div class="billing-toggle-wrap">
          <span [class.active]="billingCycle() === 'MONTHLY'" (click)="setCycle('MONTHLY')">Facturación Mensual</span>
          <button
            type="button"
            class="toggle-switch"
            [class.annual]="billingCycle() === 'ANNUAL'"
            (click)="toggleCycle()"
            aria-label="Cambiar ciclo de facturación"
          >
            <span class="toggle-knob"></span>
          </button>
          <span [class.active]="billingCycle() === 'ANNUAL'" (click)="setCycle('ANNUAL')">
            Facturación Anual <span class="discount-pill">Ahorra hasta 2 meses</span>
          </span>
        </div>
      </header>

      <!-- Rejilla de planes -->
      <main class="plans-container">
        @if (loading()) {
          <div class="plans-loading">
            <div class="spinner"></div>
            <p>Cargando planes vigentes…</p>
          </div>
        } @else {
          <div class="plans-grid">
            @for (plan of plans(); track plan.id) {
              <div class="plan-card" [class.popular]="plan.code === 'PRO'">
                @if (plan.code === 'PRO') {
                  <div class="popular-ribbon">Más recomendado</div>
                }

                <div class="card-header">
                  <h2 class="plan-title">{{ plan.name }}</h2>
                  <p class="plan-desc">{{ plan.description }}</p>
                </div>

                <div class="card-price">
                  <div class="price-amount">
                    <span class="currency">$</span>
                    <span class="value">{{ getPrice(plan) }}</span>
                    <span class="currency-code">USD</span>
                  </div>
                  <span class="price-period">
                    {{ billingCycle() === 'ANNUAL' ? 'al año / pago único' : 'al mes / por organización' }}
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
                </div>

                <div class="card-limits">
                  <div class="limit-row">
                    <span class="limit-icon">👥</span>
                    <span class="limit-text"><b>{{ getLimit(plan, 'maxUsers') }}</b> usuarios incluidos</span>
                  </div>
                  <div class="limit-row">
                    <span class="limit-icon">📄</span>
                    <span class="limit-text"><b>{{ getLimit(plan, 'maxDocuments') }}</b> documentos</span>
                  </div>
                  <div class="limit-row">
                    <span class="limit-icon">💾</span>
                    <span class="limit-text"><b>{{ getStorage(plan) }}</b> almacenamiento</span>
                  </div>
                  <div class="limit-row">
                    <span class="limit-icon">📷</span>
                    <span class="limit-text"><b>{{ getLimit(plan, 'maxOcrPagesPerMonth') }}</b> páginas OCR / mes</span>
                  </div>
                </div>

                <div class="card-features">
                  <p class="features-title">Funcionalidades incluidas:</p>
                  <ul>
                    @for (feat of plan.features; track feat.featureKey) {
                      <li [class.disabled]="!feat.enabled">
                        <span class="check-icon">{{ feat.enabled ? '✓' : '✕' }}</span>
                        <span>{{ feat.description || feat.featureKey }}</span>
                      </li>
                    }
                  </ul>
                </div>
              </div>
            }
          </div>
        }
      </main>

      <!-- Modal de Registro y Pago Simulado (A3) -->
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

            @if (signupSuccess()) {
              <!-- Pantalla de Éxito y Cuenta Creada -->
              <div class="success-screen">
                <div class="success-icon">✓</div>
                <h3>¡Tu organización está lista!</h3>
                <p>Se ha registrado exitosamente la organización y se ha procesado el pago simulado.</p>

                <div class="credentials-box">
                  <div class="cred-row">
                    <span class="cred-label">Organización:</span>
                    <span class="cred-val">{{ createdResult()?.tenantName }}</span>
                  </div>
                  <div class="cred-row">
                    <span class="cred-label">Usuario Administrador:</span>
                    <span class="cred-val">{{ createdResult()?.adminUsername }}</span>
                  </div>
                  <div class="cred-row">
                    <span class="cred-label">Correo:</span>
                    <span class="cred-val">{{ createdResult()?.adminEmail }}</span>
                  </div>
                  <div class="cred-row">
                    <span class="cred-label">Referencia de Pago:</span>
                    <span class="cred-val code">{{ createdResult()?.paymentReference }}</span>
                  </div>
                </div>

                <div class="success-actions">
                  <button type="button" class="primary-btn enter-app-btn" (click)="goToWorkspace()">
                    Ingresar a NexoDocs
                  </button>
                </div>
              </div>
            } @else {
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
                      class="modal-input"
                    />
                  </div>
                  <div class="form-row">
                    <div class="form-group half">
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
                    <div class="form-group half">
                      <label for="co-slug">Identificador URL (opcional)</label>
                      <input
                        id="co-slug"
                        type="text"
                        [(ngModel)]="signupForm.companySlug"
                        name="companySlug"
                        placeholder="clinica-santa-maria"
                        class="modal-input"
                      />
                    </div>
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
                        minlength="6"
                        class="modal-input"
                      />
                    </div>
                  </div>

                  <div class="modal-footer">
                    <button type="button" class="btn-cancel" (click)="goToStep(1)">← Volver</button>
                    <button type="submit" class="primary-btn">Continuar al pago simulado →</button>
                  </div>
                </form>
              }

              <!-- Paso 3: Pago Simulado -->
              @if (step() === 3) {
                <form (ngSubmit)="submitSignup()" class="modal-form">
                  <div class="simulated-warning">
                    <span class="warning-badge">⚠️ ENTORNO DE PAGO SIMULADO</span>
                    <p>
                      Este es un proyecto académico de demostración. <b>No se realizará ningún cobro real</b> a tu tarjeta ni se requiere información bancaria auténtica.
                    </p>
                  </div>

                  <div class="summary-card">
                    <div class="summary-row">
                      <span>Plan contratado:</span>
                      <b>{{ selectedPlan()?.name }} ({{ billingCycle() === 'ANNUAL' ? 'Anual' : 'Mensual' }})</b>
                    </div>
                    <div class="summary-row total">
                      <span>Total a pagar (simulado):</span>
                      <b class="price-highlight">USD {{ getPrice(selectedPlan()!) }}</b>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="card-name">Nombre en la tarjeta (simulado)</label>
                    <input
                      id="card-name"
                      type="text"
                      [(ngModel)]="simulatedCard.name"
                      name="cardName"
                      placeholder="Dr. Roberto Méndez"
                      required
                      class="modal-input"
                    />
                  </div>
                  <div class="form-row">
                    <div class="form-group half">
                      <label for="card-num">Número de tarjeta ficticio</label>
                      <input
                        id="card-num"
                        type="text"
                        [(ngModel)]="simulatedCard.number"
                        name="cardNumber"
                        placeholder="4242 4242 4242 4242"
                        required
                        class="modal-input"
                      />
                    </div>
                    <div class="form-group quarter">
                      <label for="card-exp">Expira</label>
                      <input
                        id="card-exp"
                        type="text"
                        [(ngModel)]="simulatedCard.exp"
                        name="cardExp"
                        placeholder="12/28"
                        required
                        class="modal-input"
                      />
                    </div>
                    <div class="form-group quarter">
                      <label for="card-cvc">CVC</label>
                      <input
                        id="card-cvc"
                        type="text"
                        [(ngModel)]="simulatedCard.cvc"
                        name="cardCvc"
                        placeholder="123"
                        required
                        class="modal-input"
                      />
                    </div>
                  </div>

                  @if (submitError()) {
                    <div class="modal-error" role="alert">
                      <span>⚠ {{ submitError() }}</span>
                    </div>
                  }

                  <div class="modal-footer">
                    <button type="button" class="btn-cancel" (click)="goToStep(2)" [disabled]="submitting()">← Volver</button>
                    <button type="submit" class="primary-btn pay-btn" [disabled]="submitting()">
                      @if (submitting()) {
                        <span>Procesando pago simulado…</span>
                      } @else {
                        <span>Pagar y Activar Organización (\${{ getPrice(selectedPlan()!) }} USD)</span>
                      }
                    </button>
                  </div>
                </form>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .pricing-layout {
      min-height: 100vh;
      background: #f8fafc;
      font-family: inherit;
      color: #1e293b;
    }
    .pricing-nav {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0.85rem 2rem;
    }
    .nav-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: #0f172a;
      font-weight: 800;
      font-size: 1.25rem;
    }
    .brand-icon {
      color: var(--teal, #087f7b);
    }
    .nav-actions {
      display: flex;
      gap: 1.25rem;
      align-items: center;
    }
    .nav-link {
      text-decoration: none;
      color: #475569;
      font-weight: 600;
      font-size: 0.9rem;
      transition: color 0.15s;
    }
    .nav-link:hover {
      color: var(--teal, #087f7b);
    }

    .pricing-hero {
      text-align: center;
      padding: 3.5rem 1.5rem 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    .hero-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 0.3rem 0.85rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pricing-hero h1 {
      font-size: clamp(2rem, 4vw, 2.75rem);
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.03em;
      margin: 0 0 1rem;
    }
    .hero-subtitle {
      font-size: 1.1rem;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 2rem;
    }

    .billing-toggle-wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.85rem;
      background: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: 30px;
      border: 1px solid #e2e8f0;
      font-size: 0.9rem;
      font-weight: 600;
      color: #64748b;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .billing-toggle-wrap span {
      cursor: pointer;
    }
    .billing-toggle-wrap span.active {
      color: #0f172a;
    }
    .toggle-switch {
      width: 44px;
      height: 24px;
      background: #cbd5e1;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      position: relative;
      padding: 2px;
      transition: background-color 0.2s;
    }
    .toggle-switch.annual {
      background: var(--teal, #087f7b);
    }
    .toggle-knob {
      display: block;
      width: 20px;
      height: 20px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .toggle-switch.annual .toggle-knob {
      transform: translateX(20px);
    }
    .discount-pill {
      background: #ecfdf5;
      color: #059669;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      font-weight: 700;
      margin-left: 0.35rem;
    }

    /* Plans Grid */
    .plans-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem 5rem;
    }
    .plans-loading {
      text-align: center;
      padding: 4rem;
      color: #64748b;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: var(--teal, #087f7b);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 2rem;
      align-items: stretch;
    }
    .plan-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .plan-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.08);
    }
    .plan-card.popular {
      border: 2px solid var(--teal, #087f7b);
      box-shadow: 0 10px 25px -3px rgba(8, 127, 123, 0.15);
    }
    .popular-ribbon {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--teal, #087f7b);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.85rem;
      border-radius: 20px;
    }

    .plan-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.5rem;
    }
    .plan-desc {
      font-size: 0.9rem;
      color: #64748b;
      min-height: 40px;
      margin: 0 0 1.5rem;
      line-height: 1.4;
    }

    .card-price {
      margin-bottom: 1.5rem;
    }
    .price-amount {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
    }
    .currency {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }
    .value {
      font-size: 2.75rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.04em;
    }
    .currency-code {
      font-size: 0.9rem;
      font-weight: 700;
      color: #64748b;
    }
    .price-period {
      display: block;
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.25rem;
    }

    .select-plan-btn {
      width: 100%;
      padding: 0.85rem 1.25rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      transition: background 0.15s, color 0.15s;
    }
    .select-plan-btn:hover {
      background: #e2e8f0;
    }
    .select-plan-btn.primary-btn {
      background: var(--teal, #087f7b);
      color: #ffffff;
      border: 1px solid var(--teal, #087f7b);
    }
    .select-plan-btn.primary-btn:hover {
      opacity: 0.92;
    }

    .card-limits {
      margin: 1.75rem 0 1.25rem;
      padding: 1rem 0;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .limit-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: #334155;
    }
    .limit-icon {
      font-size: 1rem;
    }

    .card-features {
      flex: 1;
    }
    .features-title {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin: 0 0 0.75rem;
    }
    .card-features ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .card-features li {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: #334155;
    }
    .card-features li.disabled {
      color: #94a3b8;
      text-decoration: line-through;
    }
    .check-icon {
      font-weight: bold;
      color: var(--teal, #087f7b);
    }
    .card-features li.disabled .check-icon {
      color: #cbd5e1;
    }

    /* Modal de Checkout Simulado */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      z-index: 1000;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 580px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .step-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--teal, #087f7b);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .modal-header h2 {
      margin: 0.25rem 0 0;
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #64748b;
      padding: 0.25rem;
    }

    .modal-form h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.5rem;
    }
    .step-desc {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0 0 1.25rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      margin-bottom: 0.35rem;
    }
    .form-row {
      display: flex;
      gap: 1rem;
    }
    .form-group.half { flex: 1; }
    .form-group.quarter { width: 90px; }

    .modal-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.65rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.9rem;
      background: #f8fafc;
      outline: none;
    }
    .modal-input:focus {
      border-color: var(--teal, #087f7b);
      background: #ffffff;
    }

    .simulated-warning {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.25rem;
    }
    .warning-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 800;
      color: #b45309;
      margin-bottom: 0.25rem;
    }
    .simulated-warning p {
      margin: 0;
      font-size: 0.85rem;
      color: #92400e;
      line-height: 1.4;
    }

    .summary-card {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.25rem;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #475569;
    }
    .summary-row.total {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e2e8f0;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }
    .price-highlight {
      color: var(--teal, #087f7b);
    }

    .modal-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #f1f5f9;
    }
    .btn-cancel {
      background: none;
      border: none;
      color: #64748b;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .primary-btn {
      background: var(--teal, #087f7b);
      color: #ffffff;
      border: none;
      padding: 0.7rem 1.4rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }
    .primary-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Éxito */
    .success-screen {
      text-align: center;
      padding: 1rem 0;
    }
    .success-icon {
      width: 60px;
      height: 60px;
      background: #ecfdf5;
      color: #059669;
      border-radius: 50%;
      font-size: 2rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
    }
    .success-screen h3 {
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.5rem;
    }
    .success-screen p {
      color: #64748b;
      font-size: 0.9rem;
      margin: 0 0 1.5rem;
    }
    .credentials-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem 1.25rem;
      text-align: left;
      margin-bottom: 1.75rem;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      padding: 0.35rem 0;
      font-size: 0.85rem;
    }
    .cred-label { color: #64748b; }
    .cred-val { font-weight: 700; color: #0f172a; }
    .cred-val.code { font-family: monospace; color: var(--teal, #087f7b); }
    .enter-app-btn {
      width: 100%;
      padding: 0.85rem;
      font-size: 1rem;
    }
  `],
})
export class PricingPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly plans = signal<PlanCatalog[]>([]);
  readonly billingCycle = signal<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  readonly selectedPlan = signal<PlanCatalog | null>(null);
  readonly step = signal<number>(1);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly signupSuccess = signal(false);
  readonly createdResult = signal<any>(null);

  signupForm = {
    companyName: '',
    companyEmail: '',
    companySlug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  };

  simulatedCard = {
    name: '',
    number: '4242 •••• •••• 4242',
    exp: '12/28',
    cvc: '789',
  };

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.http.get<PlanCatalog[]>('/api/v1/plans').subscribe({
      next: (data) => {
        this.plans.set(data);
        this.loading.set(false);
      },
      error: () => {
        // Fallback a planes por defecto si la base está vacía o simulada
        this.plans.set([
          {
            id: '11111111-1111-1111-1111-111111111111',
            code: 'BASIC',
            name: 'Plan Básico',
            description: 'Para consultorios pequeños o profesionales independientes.',
            priceMonthly: 29,
            priceYearly: 290,
            limits: [
              { resourceKey: 'maxUsers', resourceValue: 3, unit: 'usuarios' },
              { resourceKey: 'maxDocuments', resourceValue: 500, unit: 'documentos' },
              { resourceKey: 'maxStorageMB', resourceValue: 1024, unit: 'MB' },
              { resourceKey: 'maxOcrPagesPerMonth', resourceValue: 50, unit: 'páginas' },
            ],
            features: [
              { featureKey: 'ocr', enabled: true, description: 'Digitalización OCR asistida' },
              { featureKey: 'workflows', enabled: false, description: 'Flujos de trabajo personalizados' },
              { featureKey: 'audit', enabled: true, description: 'Bitácora básica' },
            ],
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            code: 'PRO',
            name: 'Plan Intermedio (Pro)',
            description: 'Para clínicas medianas con múltiples consultorios y flujos documentales.',
            priceMonthly: 79,
            priceYearly: 790,
            limits: [
              { resourceKey: 'maxUsers', resourceValue: 15, unit: 'usuarios' },
              { resourceKey: 'maxDocuments', resourceValue: 5000, unit: 'documentos' },
              { resourceKey: 'maxStorageMB', resourceValue: 10240, unit: 'MB' },
              { resourceKey: 'maxOcrPagesPerMonth', resourceValue: 300, unit: 'páginas' },
            ],
            features: [
              { featureKey: 'ocr', enabled: true, description: 'Digitalización OCR asistida' },
              { featureKey: 'workflows', enabled: true, description: 'Diseñador de workflows' },
              { featureKey: 'audit', enabled: true, description: 'Bitácora criptográfica C3' },
              { featureKey: 'branding', enabled: true, description: 'Personalización de marca' },
            ],
          },
          {
            id: '33333333-3333-3333-3333-333333333333',
            code: 'ENTERPRISE',
            name: 'Plan Avanzado (Enterprise)',
            description: 'Para redes hospitalarias y grandes centros con alta demanda.',
            priceMonthly: 249,
            priceYearly: 2490,
            limits: [
              { resourceKey: 'maxUsers', resourceValue: -1, unit: 'usuarios ilimitados' },
              { resourceKey: 'maxDocuments', resourceValue: -1, unit: 'documentos ilimitados' },
              { resourceKey: 'maxStorageMB', resourceValue: 102400, unit: 'MB' },
              { resourceKey: 'maxOcrPagesPerMonth', resourceValue: 2000, unit: 'páginas' },
            ],
            features: [
              { featureKey: 'ocr', enabled: true, description: 'OCR de alta velocidad con Gemini' },
              { featureKey: 'workflows', enabled: true, description: 'Workflows multi-etapa ilimitados' },
              { featureKey: 'audit', enabled: true, description: 'Bitácora criptográfica completa' },
              { featureKey: 'branding', enabled: true, description: 'Marca blanca completa' },
              { featureKey: 'support', enabled: true, description: 'Soporte prioritario 24/7' },
            ],
          },
        ]);
        this.loading.set(false);
      },
    });
  }

  setCycle(cycle: 'MONTHLY' | 'ANNUAL'): void {
    this.billingCycle.set(cycle);
  }

  toggleCycle(): void {
    this.billingCycle.update((c) => (c === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY'));
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
    this.signupSuccess.set(false);
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

    const payload = {
      companyName: this.signupForm.companyName,
      companyEmail: this.signupForm.companyEmail,
      companySlug: this.signupForm.companySlug,
      planId: plan.id,
      planCode: plan.code,
      adminName: this.signupForm.adminName,
      adminEmail: this.signupForm.adminEmail,
      adminPassword: this.signupForm.adminPassword,
      paymentMethod: 'SIMULATED_CARD',
      amountUsd: this.getPrice(plan),
      billingPeriod: this.billingCycle(),
    };

    this.http.post<any>('/api/v1/public/signup', payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.createdResult.set(res);
        this.signupSuccess.set(true);
        if (res.auth) {
          this.authService.establishSession(res.auth);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(
          err?.error?.message || 'Error al procesar la suscripción. Verifica los datos e inténtalo nuevamente.'
        );
      },
    });
  }

  goToWorkspace(): void {
    this.closeModal();
    void this.router.navigateByUrl('/home');
  }
}
