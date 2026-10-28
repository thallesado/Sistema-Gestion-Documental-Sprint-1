import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BillingCycle, BillingService, CheckoutResponse, PaymentMethod } from '../../../core/billing/billing.service';
import { SubscriptionPlan, SubscriptionService } from '../../../core/subscription/subscription.service';
import { LocalizedContentDirective } from '../../../core/i18n/localized-content.directive';
import { friendlyApiMessage } from '../../../core/http/tenant-session';

const FEATURE_LABELS: Record<string, string> = {
  workflows: 'Workflows de aprobación', ocr_scanning: 'Digitalización y OCR', advanced_analytics: 'Reportes avanzados',
  clinical_module: 'Módulo clínico', dicom_imaging: 'Imágenes DICOM',
};

/**
 * Resumen del plan antes de pagar. La tarjeta se ingresa solo en Stripe Checkout: esta pantalla
 * nunca pide datos de tarjeta. QR bancario y USDT quedan como pago manual de un período.
 */
@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LocalizedContentDirective],
  template: `
<main class="checkout" i18nContent>
  <a class="back" routerLink="/billing/subscription">← Gestionar suscripción</a>
  <header><p class="kicker">Pago seguro</p><h1>Revisa tu plan</h1><span>Confirma el plan y el ciclo antes de pagar. Podrás cambiarlo o cancelarlo cuando quieras.</span></header>

  @if (cancelled) { <div class="notice" role="status">El pago en Stripe se canceló; no se hizo ningún cargo.</div> }
  @if (error()) { <div class="notice error" role="alert">{{ error() }}</div> }

  @if (!plan()) {
    <p class="empty">{{ plansLoaded() ? 'El plan solicitado no existe.' : 'Cargando planes…' }}</p>
  } @else if (stripeManaged()) {
    <div class="notice" role="status">Tu organización ya tiene una suscripción con tarjeta. Los cambios de plan se hacen desde <a routerLink="/billing/subscription">Gestionar suscripción</a> («Mejorar ahora» cobra solo la diferencia).</div>
  } @else {
    <div class="layout">
      <section class="card plan">
        <div class="plan-tabs" role="tablist" aria-label="Plan">
          @for (p of plans(); track p.code) {
            <button type="button" role="tab" [class.active]="p.code === plan()!.code" (click)="selectPlan(p.code)">{{ p.name }}</button>
          }
        </div>
        <p class="code">{{ plan()!.code }}</p>
        <h2>{{ plan()!.name }}</h2>
        @if (plan()!.description) { <p class="muted">{{ plan()!.description }}</p> }
        <h3>Incluye</h3>
        <ul>
          <li>✓ {{ usersLabel(plan()!) }}</li>
          <li>✓ {{ storageLabel(plan()!) }}</li>
          @for (f of plan()!.features; track f.featureKey) {
            <li [class.off]="!f.enabled">{{ f.enabled ? '✓' : '✕' }} {{ featureLabel(f.featureKey) }}</li>
          }
        </ul>
      </section>

      <aside class="card summary">
        <h2>Resumen</h2>
        <div class="cycle" role="group" aria-label="Ciclo de facturación">
          <button type="button" [class.active]="cycle() === 'MONTHLY'" (click)="cycle.set('MONTHLY')">Mensual</button>
          <button type="button" [class.active]="cycle() === 'ANNUAL'" (click)="cycle.set('ANNUAL')">Anual @if (annualSaving() > 0) { <small>ahorra {{ annualSaving() | currency:'USD':'symbol':'1.0-0' }}</small> }</button>
        </div>
        <dl>
          <div><dt>Plan</dt><dd>{{ plan()!.name }}</dd></div>
          <div><dt>Ciclo</dt><dd>{{ cycle() === 'ANNUAL' ? 'Anual' : 'Mensual' }}</dd></div>
          <div class="total"><dt>Total hoy</dt><dd>{{ total() | currency:'USD' }}</dd></div>
        </dl>

        <fieldset [disabled]="busy() || !!manual()">
          <legend>Medio de pago</legend>
          <label class="method" [class.selected]="method() === 'STRIPE_CARD'"><input type="radio" name="method" value="STRIPE_CARD" [ngModel]="method()" (ngModelChange)="method.set($event)" />
            <span><b>Tarjeta · Stripe</b><small>Pagas en la página segura de Stripe. Renovación automática cada {{ cycle() === 'ANNUAL' ? 'año' : 'mes' }}.</small></span></label>
          <label class="method" [class.selected]="method() === 'BANK_QR'"><input type="radio" name="method" value="BANK_QR" [ngModel]="method()" (ngModelChange)="method.set($event)" />
            <span><b>QR bancario</b><small>Pago manual de un período; se renueva pagando de nuevo.</small></span></label>
          <label class="method" [class.selected]="method() === 'CRYPTO_USDT'"><input type="radio" name="method" value="CRYPTO_USDT" [ngModel]="method()" (ngModelChange)="method.set($event)" />
            <span><b>USDT</b><small>Pago manual de un período en la red elegida.</small></span></label>
          @if (method() === 'CRYPTO_USDT') {
            <select [(ngModel)]="network" name="network" aria-label="Red"><option>TRC20</option><option>POLYGON</option></select>
          }
        </fieldset>

        @if (manual(); as m) {
          <div class="manual">
            <div class="qr">▣<small>{{ m.paymentData['qrPayload'] }}</small></div>
            <p>Referencia <b>{{ m.externalReference }}</b> · {{ m.amountUsd | currency:'USD' }}</p>
            @if (method() === 'CRYPTO_USDT') { <input [(ngModel)]="confirmation" name="tx" placeholder="Hash de la transacción (TxHash)" /> }
            <button type="button" class="primary" (click)="confirmManual()" [disabled]="busy()">Ya pagué, confirmar</button>
            <button type="button" (click)="manual.set(null)">Elegir otro medio</button>
          </div>
        } @else {
          <button type="button" class="primary pay" (click)="pay()" [disabled]="busy()">
            {{ busy() ? 'Preparando el pago…' : method() === 'STRIPE_CARD' ? 'Continuar a Stripe' : 'Generar orden de pago' }}
          </button>
          @if (method() === 'STRIPE_CARD') { <p class="secure">🔒 Los datos de la tarjeta se ingresan solo en Stripe; NexoDocs no los ve ni los guarda.</p> }
        }
      </aside>
    </div>
  }
</main>`,
  styles: [`
    .checkout{padding:32px;max-width:1100px;margin:auto;color:var(--ink,#173f38)}
    .back{color:var(--teal);font-size:13px;font-weight:700;text-decoration:none}
    header{margin:14px 0 22px}.kicker{color:var(--teal);font-size:11px;font-weight:800;letter-spacing:.12em;margin:0;text-transform:uppercase}h1{font-size:30px;margin:5px 0}header span,.muted{color:var(--muted,#66857f)}
    button{border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--teal-strong,#125a51);cursor:pointer;font:700 13px inherit;padding:10px 14px}button:disabled{cursor:not-allowed;opacity:.55}
    .primary{background:var(--teal);border-color:var(--teal);color:#fff}
    .notice{background:#eef7ff;border:1px solid #cfe3f5;border-radius:12px;color:#356d9e;margin-bottom:16px;padding:14px 16px}.notice.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}
    .empty{color:var(--muted)}
    .layout{display:grid;gap:18px;grid-template-columns:1.4fr 1fr;align-items:start}
    .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px}
    .plan-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}.plan-tabs .active,.cycle .active{background:var(--teal);border-color:var(--teal);color:#fff}
    .code{color:var(--teal);font-size:11px;font-weight:800;letter-spacing:.1em;margin:0}.plan h2{font-size:26px;margin:4px 0 6px}.plan h3{font-size:14px;margin:20px 0 10px}
    ul{display:grid;gap:9px;list-style:none;margin:0;padding:0;font-size:14px}li.off{color:#9badab}
    .summary h2{font-size:18px;margin:0 0 14px}.cycle{display:flex;gap:6px;margin-bottom:14px}.cycle button{flex:1}.cycle small{display:block;font-size:10px;font-weight:600}
    dl{display:grid;gap:8px;margin:0 0 16px}dl div{display:flex;justify-content:space-between;font-size:13px;border-top:1px solid var(--line);padding-top:8px}dt{color:var(--muted)}dd{margin:0;font-weight:700}
    .total dd{font-size:22px}
    fieldset{border:0;display:grid;gap:8px;margin:0 0 14px;padding:0}legend{color:var(--muted);font-size:12px;font-weight:800;margin-bottom:8px}
    .method{align-items:flex-start;border:1px solid var(--line);border-radius:12px;cursor:pointer;display:flex;gap:10px;padding:11px}.method.selected{border-color:var(--teal);box-shadow:0 0 0 3px var(--tint,#e6f7f4)}
    .method span{display:grid;gap:3px;font-size:13px}.method small{color:var(--muted);font-size:12px}
    select,.manual input{border:1px solid var(--line);border-radius:9px;font:inherit;padding:10px}
    .pay{width:100%;font-size:15px;padding:13px}.secure{color:var(--muted);font-size:12px;margin:10px 0 0;text-align:center}
    .manual{display:grid;gap:10px;text-align:center}.qr{background:var(--canvas,#f2faf7);border:1px dashed var(--teal-muted,#8ecabb);border-radius:12px;display:grid;font-size:64px;padding:12px}.qr small{font-size:9px;word-break:break-all}
    @media(max-width:800px){.checkout{padding:20px 16px}.layout{grid-template-columns:1fr}}
  `],
})
export class CheckoutPage implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly plans = this.subscriptions.plans;
  readonly plansLoaded = computed(() => this.plans().length > 0);
  readonly planCode = signal('PRO');
  readonly cycle = signal<BillingCycle>('MONTHLY');
  readonly method = signal<PaymentMethod>('STRIPE_CARD');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly manual = signal<CheckoutResponse | null>(null);
  readonly stripeManaged = computed(() => this.billing.subscription()?.stripeManaged === true);
  readonly plan = computed(() => this.plans().find((p) => p.code === this.planCode()) ?? null);
  readonly total = computed(() => { const p = this.plan(); return p ? (this.cycle() === 'ANNUAL' ? p.priceYearly : p.priceMonthly) : 0; });
  readonly annualSaving = computed(() => { const p = this.plan(); return p ? p.priceMonthly * 12 - p.priceYearly : 0; });
  readonly cancelled = this.route.snapshot.queryParamMap.get('checkout') === 'cancelled';
  network = 'TRC20';
  confirmation = '';

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const requested = (query.get('plan') ?? 'PRO').toUpperCase();
    this.planCode.set(['BASIC', 'PRO', 'ENTERPRISE'].includes(requested) ? requested : 'PRO');
    if (query.get('cycle') === 'ANNUAL') this.cycle.set('ANNUAL');
    this.subscriptions.loadPlans();
    this.billing.loadSubscription().subscribe({ next: (d) => this.billing.subscription.set(d), error: () => undefined });
  }

  selectPlan(code: string): void { this.planCode.set(code); this.manual.set(null); this.error.set(''); }

  pay(): void {
    this.busy.set(true); this.error.set('');
    this.billing.initiate(this.planCode(), this.method(), this.cycle(), this.network).subscribe({
      next: (response) => {
        const url = response.paymentData['checkoutUrl'];
        if (typeof url === 'string') { window.location.assign(url); return; } // Stripe Checkout
        if (this.method() === 'STRIPE_CARD') {
          this.busy.set(false); this.billing.loading.set(false);
          this.error.set('Los pagos con tarjeta no están configurados en este servidor. Usa QR bancario o USDT.');
          return;
        }
        this.busy.set(false); this.billing.loading.set(false); this.manual.set(response);
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.billing.loading.set(false); this.error.set(apiError(err, 'No se pudo iniciar el pago.')); },
    });
  }

  confirmManual(): void {
    const order = this.manual();
    if (!order?.transactionId) return;
    const proof = this.confirmation || (this.method() === 'CRYPTO_USDT' ? `sandbox_tx_${order.transactionId.replace(/-/g, '')}` : order.externalReference);
    this.busy.set(true); this.error.set('');
    this.billing.confirm(order.transactionId, proof).subscribe({
      next: (overview) => {
        this.billing.overview.set(overview); this.subscriptions.loadCurrentSubscription(true);
        void this.router.navigate(['/billing'], { queryParams: { checkout: 'success' } });
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.error.set(apiError(err, 'No se pudo confirmar el pago.')); },
    });
  }

  featureLabel(key: string): string { return FEATURE_LABELS[key] ?? key; }
  usersLabel(plan: SubscriptionPlan): string {
    const value = plan.limits.find((l) => l.resourceKey === 'maxUsers')?.resourceValue;
    return value === -1 ? 'Usuarios ilimitados' : `Hasta ${value ?? 0} usuarios`;
  }
  storageLabel(plan: SubscriptionPlan): string {
    const value = plan.limits.find((l) => l.resourceKey === 'maxStorageMB')?.resourceValue;
    if (value === -1) return 'Almacenamiento ilimitado';
    if (value == null) return 'Almacenamiento configurable';
    return value >= 1024 ? `${(value / 1024).toFixed(0)} GB de almacenamiento` : `${value} MB de almacenamiento`;
  }
}

function apiError(error: HttpErrorResponse, fallback: string): string {
  if (error.status === 0) return 'No se pudo conectar con la API.';
  const serverMessage = error.error?.message;
  if (serverMessage) return friendlyApiMessage(serverMessage, fallback);
  if (error.status === 401 || error.status === 403) return 'No tienes permisos para pagar la suscripción.';
  return fallback;
}
