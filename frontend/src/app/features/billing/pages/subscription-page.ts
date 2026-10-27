import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BillingCycle, BillingService, SubscriptionDetails } from '../../../core/billing/billing.service';
import { SubscriptionPlan, SubscriptionService } from '../../../core/subscription/subscription.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LocalizedContentDirective } from '../../../core/i18n/localized-content.directive';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { planDirection } from './subscription-rules';

type Confirm = { title: string; message: string; action: string; danger?: boolean; run: () => void };

const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'En prueba', ACTIVE: 'Activa', PAST_DUE: 'Pago pendiente', EXPIRED: 'Vencida', SUSPENDED: 'Suspendida', CANCELED: 'Cancelada',
};
const FEATURE_LABELS: Record<string, string> = {
  workflows: 'Workflows de aprobación', ocr_scanning: 'Digitalización y OCR', advanced_analytics: 'Reportes avanzados',
  clinical_module: 'Módulo clínico', dicom_imaging: 'Imágenes DICOM',
};
const CANCEL_REASONS = ['Es demasiado caro', 'No lo usamos lo suficiente', 'Nos cambiamos a otra herramienta',
  'Faltan funcionalidades', 'Cerramos la organización', 'Otro motivo'];

@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LocalizedContentDirective],
  template: `
<main class="sub" i18nContent>
  <a class="back" routerLink="/billing">← Facturación</a>
  <header>
    <p class="kicker">Suscripción</p>
    <h1>Gestionar suscripción</h1>
    <span>Mejora tu plan, programa un cambio para el próximo período, detén la renovación o cancela la suscripción.</span>
  </header>

  @if (loading()) { <p class="empty">Cargando suscripción…</p> }
  @else if (loadError()) {
    <div class="notice error" role="alert"><b>No se pudo cargar la suscripción</b><span>{{ loadError() }}</span><button type="button" (click)="load()">Reintentar</button></div>
  } @else if (details(); as d) {
    @if (message()) { <div class="notice" [class.error]="isError()" role="status">{{ message() }}</div> }

    <section class="current">
      <div class="current-main">
        <span class="pill" [class]="'pill ' + d.status.toLowerCase()">{{ statusLabel(d.status) }}</span>
        <h2>Plan {{ d.planName || d.planCode }}</h2>
        <p class="price">{{ currentPrice(d) | currency:'USD' }} <small>/ {{ d.billingCycle === 'ANNUAL' ? 'año' : 'mes' }}</small></p>
        <dl>
          @if (d.status === 'TRIAL') {
            <div><dt>Prueba hasta</dt><dd>{{ fmt(d.trialEndsAt) }}</dd></div>
          } @else {
            <div><dt>{{ d.autoRenew ? 'Próxima renovación' : 'Acceso hasta' }}</dt><dd>{{ d.currentPeriodEnd ? fmt(d.currentPeriodEnd) : 'Sin período registrado' }}</dd></div>
          }
          <div><dt>Medio de pago</dt><dd>{{ methodLabel(d.paymentMethod, d.stripeManaged) }}</dd></div>
          <div><dt>Organización</dt><dd>{{ d.organizationName }}</dd></div>
        </dl>
        @if (!d.stripeManaged) {
          <!-- Sin cobro automático (prueba, QR o USDT) cada período se paga desde el checkout. -->
          <a class="pay" routerLink="/billing/checkout" [queryParams]="{ plan: d.planCode, cycle: d.billingCycle }">{{ d.status === 'TRIAL' ? 'Pagar y activar este plan' : 'Pagar o renovar ahora' }}</a>
        }
      </div>
      <div class="current-side">
        @if (d.scheduledPlanCode) {
          <div class="callout blue">
            <b>Cambio programado</b>
            <!-- Una sola frase (un nodo de texto) para que i18nContent la traduzca con su patrón. -->
            <p>{{ scheduledText(d) }}</p>
            <button type="button" (click)="cancelScheduled()" [disabled]="busy()">Anular cambio programado</button>
          </div>
        }
        @if (!d.autoRenew) {
          <div class="callout amber">
            <b>La suscripción no se renovará</b>
            <p>Conservas el acceso hasta el {{ fmt(d.currentPeriodEnd) }}. Después la organización queda cancelada y sus datos se eliminan a los {{ d.retentionDays }} días.</p>
            <button type="button" (click)="resume()" [disabled]="busy()">Reanudar renovación</button>
          </div>
        }
        @if (d.status === 'PAST_DUE') {
          <div class="callout red"><b>Pago pendiente</b><p>El último cobro no se completó. Actualiza el medio de pago para evitar la suspensión.</p>
            @if (d.stripeManaged) { <button type="button" (click)="openPortal()">Actualizar tarjeta</button> }</div>
        }
        @if (d.autoRenew && !d.scheduledPlanCode && d.status !== 'PAST_DUE') {
          <div class="callout"><b>Todo en orden</b><p>{{ d.status === 'TRIAL' ? 'Elige un plan para seguir usando NexoDocs al terminar la prueba.' : 'Tu suscripción se renovará automáticamente con el mismo plan.' }}</p></div>
        }
      </div>
    </section>

    <section class="plans-head">
      <h2>Planes</h2>
      <div class="cycle" role="group" aria-label="Ciclo de facturación">
        <button type="button" [class.active]="cycle() === 'MONTHLY'" (click)="cycle.set('MONTHLY')">Mensual</button>
        <button type="button" [class.active]="cycle() === 'ANNUAL'" (click)="cycle.set('ANNUAL')">Anual</button>
      </div>
    </section>
    <section class="plans">
      @for (plan of plans(); track plan.code) {
        @let move = direction(plan, d);
        <article [class.current-plan]="move === 'current'" [class.highlight]="plan.code === requestedPlan">
          <p class="plan-code">{{ plan.code }}</p>
          <h3>{{ plan.name }}</h3>
          <p class="plan-price">{{ (cycle() === 'ANNUAL' ? plan.priceYearly : plan.priceMonthly) | currency:'USD' }} <small>/ {{ cycle() === 'ANNUAL' ? 'año' : 'mes' }}</small></p>
          <ul>
            <li>{{ usersLabel(plan) }}</li>
            <li>{{ storageLabel(plan) }}</li>
            @for (feature of plan.features; track feature.featureKey) {
              <li [class.off]="!feature.enabled">{{ feature.enabled ? '✓' : '—' }} {{ featureLabel(feature.featureKey) }}</li>
            }
          </ul>
          <div class="plan-actions">
            @switch (move) {
              @case ('current') { <span class="tag">Plan actual</span> }
              @case ('upgrade') {
                <button type="button" class="primary" (click)="upgrade(plan, d)" [disabled]="busy() || !d.autoRenew && d.stripeManaged">Mejorar ahora</button>
                @if (d.status !== 'TRIAL') { <button type="button" (click)="schedule(plan, d)" [disabled]="busy() || !d.autoRenew">Desde el próximo período</button> }
              }
              @case ('downgrade') {
                <button type="button" (click)="schedule(plan, d)" [disabled]="busy() || !d.autoRenew || d.status === 'TRIAL'">Cambiar desde el próximo período</button>
              }
            }
            @if (d.scheduledPlanCode === plan.code) { <span class="tag blue">Programado</span> }
          </div>
        </article>
      } @empty { <p class="empty">No hay planes disponibles.</p> }
    </section>
    <p class="note">«Mejorar ahora» aplica el plan de inmediato y cobra la diferencia prorrateada. Un cambio «desde el próximo período» mantiene tu plan actual hasta la fecha de renovación y la siguiente factura ya cobra el plan nuevo. Para bajar de plan, el uso actual (usuarios y almacenamiento) debe caber en el nuevo.</p>

    @if (d.status !== 'TRIAL') {
      <section class="block">
        <div><h2>Renovación automática</h2><p>{{ d.autoRenew ? 'Al terminar el período se cobra automáticamente el siguiente.' : 'Desactivada: la suscripción termina al final del período pagado.' }}</p></div>
        @if (d.autoRenew) { <button type="button" (click)="stopRenewal(d)" [disabled]="busy()">No renovar suscripción</button> }
        @else { <button type="button" class="primary" (click)="resume()" [disabled]="busy()">Reanudar renovación</button> }
      </section>
    }

    <section class="block danger">
      <div><h2>Cancelar suscripción</h2><p>Anula la suscripción de inmediato y programa la eliminación definitiva de la organización y de todos sus datos.</p></div>
      <button type="button" class="danger-btn" (click)="openCancel()">Cancelar suscripción</button>
    </section>
  }

  @if (confirm(); as c) {
    <div class="overlay" role="presentation"><section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{{ c.title }}</h2><p>{{ c.message }}</p>
      <div class="actions"><button type="button" (click)="confirm.set(null)">Volver</button><button type="button" [class.primary]="!c.danger" [class.danger-btn]="c.danger" (click)="runConfirm()">{{ c.action }}</button></div>
    </section></div>
  }

  @if (cancelOpen()) {
    <div class="overlay" role="presentation"><section class="dialog wide" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      @if (deletionDate()) {
        <h2 id="cancel-title">Suscripción cancelada</h2>
        <p>La organización quedó cancelada y se cerraron todas las sesiones. Sus datos se eliminarán definitivamente el {{ fmt(deletionDate()) }}. Hasta esa fecha puedes recuperarla contactando al soporte de NexoDocs.</p>
        <div class="actions"><button type="button" class="primary" (click)="finish()">Salir</button></div>
      } @else {
        <h2 id="cancel-title">Cancelar suscripción y eliminar organización</h2>
        <ul class="consequences">
          <li><b>Acceso:</b> la suscripción se anula ahora y nadie de la organización podrá volver a iniciar sesión.</li>
          <li><b>Cobros:</b> no se harán más cargos. El período ya pagado no se reembolsa automáticamente.</li>
          <li><b>Período de gracia:</b> los datos se conservan {{ details()?.retentionDays }} días por si quieres recuperar la organización.</li>
          <li><b>Eliminación definitiva:</b> al terminar ese plazo se borran documentos, versiones, expedientes, pacientes, workflows, archivos, respaldos y configuración, y se anonimizan los usuarios. No se puede deshacer.</li>
          <li><b>Lo que se conserva:</b> facturas y bitácora de auditoría, que la ley obliga a mantener.</li>
        </ul>
        <div class="callout blue"><b>Antes de continuar</b><p>Descarga una copia de tus datos desde <a routerLink="/settings/backups" (click)="cancelOpen.set(false)">Respaldos</a>.</p></div>
        @if (cancelError()) { <div class="notice error" role="alert">{{ cancelError() }}</div> }
        <label>Motivo
          <select [(ngModel)]="cancelReason" name="reason">
            <option value="">Selecciona un motivo</option>
            @for (reason of reasons; track reason) { <option [value]="reason">{{ reason }}</option> }
          </select>
        </label>
        <label>Escribe <b>{{ details()?.organizationName }}</b> para confirmar<input [(ngModel)]="cancelName" name="org" autocomplete="off" /></label>
        <label>Tu contraseña<input type="password" [(ngModel)]="cancelPassword" name="password" autocomplete="current-password" /></label>
        <div class="actions">
          <button type="button" (click)="cancelOpen.set(false)">Conservar suscripción</button>
          <button type="button" class="danger-btn" (click)="submitCancel()" [disabled]="busy() || !cancelReady()">{{ busy() ? 'Cancelando…' : 'Cancelar y programar eliminación' }}</button>
        </div>
      }
    </section></div>
  }
</main>`,
  styles: [`
    .sub{padding:32px;max-width:1240px;margin:auto;color:var(--ink,#173f38)}
    .back{color:var(--teal);font-size:13px;font-weight:700;text-decoration:none}
    header{margin:14px 0 22px}.kicker{color:var(--teal);font-size:11px;font-weight:800;letter-spacing:.12em;margin:0;text-transform:uppercase}
    h1{font-size:31px;margin:5px 0}header span{color:var(--muted,#66857f)}
    button{border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--teal-strong,#125a51);cursor:pointer;font:700 13px inherit;padding:10px 14px}
    button:disabled{cursor:not-allowed;opacity:.5}.primary{background:var(--teal);border-color:var(--teal);color:#fff}
    .danger-btn{background:#c53043;border-color:#c53043;color:#fff}
    .notice{background:#eef7ff;border:1px solid #cfe3f5;border-radius:12px;color:#356d9e;display:grid;gap:6px;margin-bottom:16px;padding:14px 16px}
    .notice.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}.notice button{justify-self:start}
    .empty{color:var(--muted);padding:30px 0}
    .current{display:grid;gap:16px;grid-template-columns:1.3fr 1fr;margin-bottom:26px}
    .current-main,.current-side>div,.plans article,.block{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px}
    .current-main h2{font-size:24px;margin:10px 0 4px}.price{font-size:26px;font-weight:800;margin:0 0 12px}.price small,.plan-price small{color:var(--muted);font-size:13px;font-weight:600}
    dl{display:grid;gap:8px;margin:0}dl div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:8px;font-size:13px}dt{color:var(--muted)}dd{margin:0;font-weight:700;text-align:right}
    .pay{background:var(--teal);border-radius:10px;color:#fff;display:inline-block;font-size:13px;font-weight:700;margin-top:14px;padding:10px 14px;text-decoration:none}
    .pill{border-radius:99px;font-size:11px;font-weight:800;padding:5px 10px;background:#e3f8eb;color:#218450}
    .pill.trial{background:#eef7ff;color:#356d9e}.pill.past_due,.pill.expired{background:#fff1e4;color:#aa6d1c}.pill.canceled,.pill.suspended{background:#fff4f3;color:#a65050}
    .current-side{display:grid;gap:12px;align-content:start}.callout b{display:block;margin-bottom:4px}.callout p{color:var(--muted);font-size:13px;line-height:1.5;margin:0 0 10px}
    .callout.blue{background:#eff7ff;border-color:#d4e7fb}.callout.amber{background:#fff8e7;border-color:#f4df9e}.callout.red{background:#fff4f3;border-color:#f3d2d0}
    .plans-head{align-items:center;display:flex;justify-content:space-between;margin-bottom:12px}.plans-head h2{margin:0}
    .cycle{display:flex;gap:6px}.cycle .active{background:var(--teal);border-color:var(--teal);color:#fff}
    .plans{display:grid;gap:14px;grid-template-columns:repeat(3,1fr)}
    .plans article{display:flex;flex-direction:column}.plans article.current-plan{box-shadow:inset 0 0 0 2px var(--teal)}.plans article.highlight{box-shadow:0 0 0 3px var(--tint,#e6f7f4)}
    .plan-code{color:var(--teal);font-size:11px;font-weight:800;letter-spacing:.1em;margin:0}.plans h3{margin:4px 0}.plan-price{font-size:22px;font-weight:800;margin:4px 0 12px}
    ul{display:grid;gap:7px;list-style:none;margin:0 0 16px;padding:0;font-size:13px}li.off{color:#9badab}
    .plan-actions{display:grid;gap:8px;margin-top:auto}.tag{background:var(--mint);border-radius:99px;color:var(--teal-strong);font-size:12px;font-weight:800;justify-self:start;padding:6px 12px}.tag.blue{background:#eff7ff;color:#356d9e}
    .note{color:var(--muted);font-size:12px;line-height:1.6;margin:12px 0 26px}
    .block{align-items:center;display:flex;gap:16px;justify-content:space-between;margin-bottom:14px}.block h2{font-size:17px;margin:0 0 4px}.block p{color:var(--muted);font-size:13px;margin:0}
    .block.danger{border-color:#f3d2d0}
    .overlay{align-items:center;background:#04221c7a;display:flex;inset:0;justify-content:center;padding:16px;position:fixed;z-index:60}
    .dialog{background:#fff;border-radius:18px;box-shadow:0 20px 70px #06241b55;max-height:calc(100dvh - 32px);max-width:480px;overflow:auto;padding:24px;width:100%}
    .dialog.wide{max-width:640px}.dialog h2{margin:0 0 10px}.dialog>p{color:var(--muted);line-height:1.6}
    .consequences{gap:9px;line-height:1.5}.dialog label{display:grid;font-size:12px;font-weight:700;gap:6px;margin-top:12px;color:var(--muted)}
    .dialog input,.dialog select{border:1px solid var(--line);border-radius:9px;font:inherit;padding:10px}
    .actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:18px}
    @media(max-width:800px){.sub{padding:20px 16px}.current,.plans{grid-template-columns:1fr}.block{align-items:stretch;flex-direction:column}}
  `],
})
export class SubscriptionPage implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly details = this.billing.subscription;
  readonly plans = this.subscriptions.plans;
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly cycle = signal<BillingCycle>('MONTHLY');
  readonly confirm = signal<Confirm | null>(null);
  readonly cancelOpen = signal(false);
  readonly cancelError = signal('');
  readonly deletionDate = signal<string | null>(null);
  readonly reasons = CANCEL_REASONS;
  readonly requestedPlan = new URLSearchParams(location.search).get('plan');
  cancelReason = '';
  cancelName = '';
  cancelPassword = '';

  ngOnInit(): void {
    this.subscriptions.loadPlans();
    this.load();
  }

  load(): void {
    this.loading.set(true); this.loadError.set('');
    this.billing.loadSubscription().subscribe({
      next: (d) => { this.details.set(d); this.cycle.set(d.billingCycle ?? 'MONTHLY'); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.loadError.set(apiError(err, 'Inténtalo de nuevo en unos segundos.')); },
    });
  }

  direction(plan: SubscriptionPlan, d: SubscriptionDetails) {
    return planDirection(plan, d.planCode, d.billingCycle, this.cycle(), this.plans());
  }

  upgrade(plan: SubscriptionPlan, d: SubscriptionDetails): void {
    if (!d.stripeManaged) {
      // Sin suscripción con tarjeta el cambio se paga: se abre el checkout con el plan elegido.
      void this.router.navigate(['/billing/checkout'], { queryParams: { plan: plan.code, cycle: this.cycle() } });
      return;
    }
    this.confirm.set({
      title: `Mejorar a ${plan.name}`, action: 'Mejorar y pagar la diferencia',
      message: `El plan ${plan.name} se aplica ahora. Stripe cobrará hoy la diferencia prorrateada hasta el ${formatDate(d.currentPeriodEnd)} y luego renovará con el precio del nuevo plan.`,
      run: () => this.act(this.billing.upgradeNow(plan.code, this.cycle()), `Tu plan ahora es ${plan.name}.`),
    });
  }

  schedule(plan: SubscriptionPlan, d: SubscriptionDetails): void {
    this.confirm.set({
      title: `Cambiar a ${plan.name} en la próxima renovación`, action: 'Programar cambio',
      message: `Mantienes ${d.planName ?? d.planCode} hasta el ${formatDate(d.currentPeriodEnd)}. Desde esa fecha se aplicará ${plan.name} (${this.cycle() === 'ANNUAL' ? 'anual' : 'mensual'}) y se cobrará ese plan.`,
      run: () => this.act(this.billing.scheduleChange(plan.code, this.cycle()), `Cambio a ${plan.name} programado.`),
    });
  }

  cancelScheduled(): void { this.act(this.billing.cancelScheduledChange(), 'Se anuló el cambio programado.'); }

  stopRenewal(d: SubscriptionDetails): void {
    this.confirm.set({
      title: 'No renovar la suscripción', action: 'No renovar', danger: true,
      message: `Conservas el acceso hasta el ${formatDate(d.currentPeriodEnd)}. No se harán más cobros; al terminar el período la organización quedará cancelada y sus datos se eliminarán a los ${d.retentionDays} días. Puedes reanudar la renovación antes de esa fecha.`,
      run: () => this.act(this.billing.stopRenewal(), 'La suscripción no se renovará.'),
    });
  }

  resume(): void { this.act(this.billing.resumeRenewal(), 'La renovación automática está activa de nuevo.'); }

  openPortal(): void { this.billing.portal().subscribe({ next: (p) => window.location.assign(p.url) }); }

  openCancel(): void {
    this.cancelReason = ''; this.cancelName = ''; this.cancelPassword = '';
    this.cancelError.set(''); this.deletionDate.set(null); this.cancelOpen.set(true);
  }

  submitCancel(): void {
    const d = this.details();
    if (!d) return;
    if (normalize(this.cancelName) !== normalize(d.organizationName)) { this.cancelError.set('El nombre de la organización no coincide.'); return; }
    if (!this.cancelReason || !this.cancelPassword) { this.cancelError.set('Selecciona un motivo e ingresa tu contraseña.'); return; }
    this.busy.set(true); this.cancelError.set('');
    this.billing.cancelSubscription(this.cancelName, this.cancelPassword, this.cancelReason).subscribe({
      next: (r) => { this.busy.set(false); this.deletionDate.set(r.deletionScheduledAt); },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.cancelError.set(apiError(err, 'No se pudo cancelar la suscripción.')); },
    });
  }

  /** El botón final solo se habilita con nombre exacto, motivo y contraseña. */
  cancelReady(): boolean {
    return !!this.cancelReason && !!this.cancelPassword && normalize(this.cancelName) === normalize(this.details()?.organizationName);
  }

  /** Las sesiones ya están revocadas: se limpia la local y se vuelve a la web pública. */
  finish(): void { this.cancelOpen.set(false); this.auth.logout(); }

  /** Fecha en el idioma activo (el pipe date de Angular usa siempre en-US). */
  fmt(value: string | null | undefined): string { return formatDate(value ?? null); }

  scheduledText(d: SubscriptionDetails): string {
    const cycle = d.scheduledBillingCycle === 'ANNUAL' ? 'anual' : 'mensual';
    return `Desde el ${formatDate(d.scheduledChangeAt)} pasarás al plan ${d.scheduledPlanCode} (${cycle})`
      + (d.stripeManaged ? ' y esa será la próxima factura.' : '; el siguiente pago ya será por ese plan.');
  }

  runConfirm(): void { const c = this.confirm(); this.confirm.set(null); c?.run(); }

  statusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }
  featureLabel(key: string): string { return FEATURE_LABELS[key] ?? key; }
  currentPrice(d: SubscriptionDetails): number { return (d.billingCycle === 'ANNUAL' ? d.priceYearly : d.priceMonthly) ?? 0; }
  methodLabel(method: string | null, stripe: boolean): string {
    if (stripe) return 'Tarjeta (Stripe, cobro automático)';
    return ({ STRIPE_CARD: 'Tarjeta', BANK_QR: 'QR bancario (pago manual)', CRYPTO_USDT: 'USDT (pago manual)' } as Record<string, string>)[method ?? ''] ?? 'Sin medio de pago';
  }
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

  private act(request: ReturnType<BillingService['stopRenewal']>, okMessage: string): void {
    this.busy.set(true); this.message.set('');
    request.subscribe({
      next: (d) => {
        this.busy.set(false); this.details.set(d); this.isError.set(false); this.message.set(okMessage);
        this.subscriptions.loadCurrentSubscription(true);
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.isError.set(true); this.message.set(apiError(err, 'No se pudo completar la operación.')); },
    });
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : 'la fecha de renovación';
}

function apiError(error: HttpErrorResponse, fallback: string): string {
  if (error.status === 0) return 'No se pudo conectar con la API.';
  const serverMessage = error.error?.message;
  if (serverMessage) return friendlyApiMessage(serverMessage, fallback);
  if (error.status === 401 || error.status === 403) return 'No tienes permisos para gestionar la suscripción.';
  return fallback;
}
