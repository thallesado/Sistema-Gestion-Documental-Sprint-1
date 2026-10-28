import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlatformApiService, PlatformTenantOverview, PlatformUsageItem } from '../../../core/api/platform-api.service';
import { AddonCatalogItem, AddonsApiService } from '../../../core/api/addons-api.service';
import { quantityLabel } from '../../billing/pages/addons.logic';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import {
  LIFECYCLE_LABELS, MAX_REASON_LENGTH, actionLabel, availableActions, formatBytes, isValidReason,
  needsOverLimitConfirmation, usageBar,
} from './platform-tenant.logic';

type ActionKind = 'suspend' | 'reactivate' | 'extendTrial' | 'changePlan' | 'courtesy' | 'revoke';

const METHOD_LABELS: Record<string, string> = { STRIPE_CARD: 'Tarjeta (Stripe)', BANK_QR: 'QR bancario', CRYPTO_USDT: 'USDT' };
const PAYMENT_LABELS: Record<string, string> = { COMPLETED: 'Completado', PENDING: 'Pendiente', FAILED: 'Fallido' };
const ACTION_TITLES: Record<ActionKind, string> = {
  suspend: 'Suspender organización', reactivate: 'Reactivar organización',
  extendTrial: 'Extender la prueba', changePlan: 'Cambiar de plan',
  courtesy: 'Conceder complemento de cortesía', revoke: 'Retirar cortesía',
};
const ADDON_SOURCE_LABELS: Record<string, string> = { PURCHASE: 'Comprado', MANUAL_PAYMENT: 'Pago manual', COURTESY: 'Cortesía' };

/**
 * Ficha de organización del administrador global (/platform/tenants/:id). Solo muestra los datos
 * permitidos (anexo A): números de uso, nunca nombres ni contenido de documentos o pacientes.
 */
@Component({
  selector: 'app-platform-tenant-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page platform-tenant">
      <a routerLink="/tenants" class="pt-back">← Organizaciones</a>

      @if (error()) {
        <div class="pt-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div>
      }
      @if (loading() && !data()) {
        <div class="pt-loading"><span class="spinner"></span> Cargando la ficha de la organización…</div>
      }

      @if (data(); as d) {
        <header class="pt-header">
          <div>
            <span class="pt-kicker">FICHA DE ORGANIZACIÓN</span>
            <h1>{{ d.summary.name }}</h1>
            <p>{{ d.summary.code }} · {{ d.summary.slug }}</p>
          </div>
          <span class="pt-badge" [class]="'pt-badge s-' + d.summary.lifecycleState">{{ lifecycleLabel(d.summary.lifecycleState) }}</span>
        </header>

        @if (notice()) { <div class="pt-notice" role="status">{{ notice() }}</div> }

        <section class="pt-actions" aria-label="Acciones">
          @if (actions().suspend) { <button type="button" class="danger" (click)="open('suspend')">Suspender</button> }
          @if (actions().reactivate) { <button type="button" (click)="open('reactivate')">Reactivar</button> }
          @if (actions().extendTrial) { <button type="button" (click)="open('extendTrial')">Extender la prueba</button> }
          @if (actions().changePlan) { <button type="button" (click)="open('changePlan')">Cambiar de plan</button> }
          @if (actions().suspend || actions().reactivate) { <button type="button" (click)="openCourtesy()">Conceder complemento</button> }
          <a class="pt-link" routerLink="/platform/audit" [queryParams]="{ tenantId: d.summary.id }">Ver en la auditoría de plataforma →</a>
        </section>
        @if (d.subscription.stripeManaged) {
          <p class="pt-hint">La organización paga con Stripe: el plan se cambia desde su suscripción y la prueba no se puede extender.</p>
        }

        <div class="pt-grid">
          <section class="pt-panel">
            <h2>Resumen</h2>
            <dl>
              <div><dt>Correo de contacto</dt><dd>{{ d.summary.email }}</dd></div>
              <div><dt>Teléfono</dt><dd>{{ d.summary.phone || '—' }}</dd></div>
              <div><dt>Alta</dt><dd>{{ date(d.summary.createdAt) }}</dd></div>
              <div><dt>Estado del ciclo de vida</dt><dd>{{ lifecycleLabel(d.summary.lifecycleState) }}</dd></div>
            </dl>
            <h3>Administradores</h3>
            @for (admin of d.administrators; track admin.email) {
              <p class="pt-admin"><b>{{ admin.fullName }}</b><span>{{ admin.email }}</span><small>Último acceso: {{ date(admin.lastLoginAt) }}</small></p>
            } @empty { <p class="pt-empty">Sin administrador registrado.</p> }
          </section>

          <section class="pt-panel">
            <h2>Suscripción</h2>
            <dl>
              <div><dt>Plan</dt><dd>{{ d.subscription.planName || 'Sin plan' }}</dd></div>
              <div><dt>Ciclo</dt><dd>{{ d.subscription.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensual' }}</dd></div>
              <div><dt>Cobro</dt><dd>{{ d.subscription.stripeManaged ? 'Tarjeta (Stripe)' : 'Manual' }}</dd></div>
              <div><dt>Fin de la prueba</dt><dd>{{ date(d.subscription.trialEndsAt) }}</dd></div>
              <div><dt>Renovación</dt><dd>{{ date(d.subscription.currentPeriodEnd) }}</dd></div>
              <div><dt>Renovación automática</dt><dd>{{ d.subscription.autoRenew ? 'Sí' : 'No renovar' }}</dd></div>
              @if (d.subscription.scheduledPlanCode) {
                <div><dt>Cambio programado</dt><dd>{{ d.subscription.scheduledPlanCode }} · {{ date(d.subscription.scheduledChangeAt) }}</dd></div>
              }
              @if (d.subscription.canceledAt) {
                <div><dt>Cancelada</dt><dd>{{ date(d.subscription.canceledAt) }}</dd></div>
                <div><dt>Borrado programado</dt><dd>{{ date(d.subscription.deletionScheduledAt) }}</dd></div>
              }
              @if (d.subscription.purgedAt) { <div><dt>Eliminada</dt><dd>{{ date(d.subscription.purgedAt) }}</dd></div> }
            </dl>
            @if (d.subscription.inGracePeriod) {
              <p class="pt-hint warn">En período de gracia: se puede reactivar hasta el {{ date(d.subscription.deletionScheduledAt) }}.</p>
            }
          </section>
        </div>

        <section class="pt-panel">
          <h2>Uso frente a límites</h2>
          <div class="pt-usage">
            @for (item of usageItems(); track item.label) {
              <article>
                <header><span>{{ item.label }}</span><b>{{ item.text }}</b></header>
                <div class="pt-bar" [class]="'pt-bar ' + item.bar.tone" role="progressbar" [attr.aria-label]="item.label"
                     [attr.aria-valuenow]="item.bar.percent" aria-valuemin="0" aria-valuemax="100">
                  <span [style.width.%]="item.bar.percent"></span>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="pt-panel">
          <h2>Complementos</h2>
          <div class="pt-table-wrap">
            <table>
              <thead><tr><th>Complemento</th><th>Unidades</th><th>Origen</th><th>Vence</th><th></th></tr></thead>
              <tbody>
                @for (a of d.addons; track a.id) {
                  <tr>
                    <td><b>{{ a.name }}</b><small>{{ quantity(a.resourceKey, a.unitQuantity) }} por unidad{{ a.kind === 'CONSUMABLE' ? ' · quedan ' + a.remaining : '' }}</small></td>
                    <td>{{ a.units }}@if (a.pendingUnits !== null) { <small>→ {{ a.pendingUnits }} al renovar</small> }</td>
                    <td>{{ addonSource(a.source) }}</td>
                    <td>{{ date(a.expiresAt) }}</td>
                    <td>@if (a.source === 'COURTESY') { <button type="button" class="link" (click)="openRevoke(a.id, a.name)">Retirar</button> }</td>
                  </tr>
                } @empty { <tr><td colspan="5" class="pt-empty">Sin complementos activos. Los límites de uso ya incluyen los complementos.</td></tr> }
              </tbody>
            </table>
          </div>
        </section>

        <section class="pt-panel">
          <h2>Facturas y pagos</h2>
          <div class="pt-table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Plan</th><th>Método</th><th>Estado</th><th>Ciclo</th><th class="num">Monto</th><th>Referencia</th></tr></thead>
              <tbody>
                @for (p of d.payments; track p.id) {
                  <tr>
                    <td>{{ date(p.createdAt) }}</td><td>{{ p.planName }}</td><td>{{ methodLabel(p.method) }}</td>
                    <td>{{ paymentLabel(p.status) }}</td><td>{{ p.billingPeriod === 'ANNUAL' ? 'Anual' : 'Mensual' }}</td>
                    <td class="num">{{ usd(p.amountUsd) }}</td><td class="ref">{{ p.reference }}</td>
                  </tr>
                } @empty { <tr><td colspan="7" class="pt-empty">La organización no tiene pagos registrados.</td></tr> }
              </tbody>
            </table>
          </div>
        </section>

        <section class="pt-panel">
          <h2>Historial</h2>
          <ol class="pt-history">
            @for (event of d.history; track $index) {
              <li [class.platform]="event.source === 'PLATFORM'">
                <time>{{ dateTime(event.occurredAt) }}</time>
                <div>
                  <b>{{ actionLabel(event.action) }}</b>
                  <small>{{ event.source === 'PLATFORM' ? 'Plataforma · ' + event.actor : 'Ciclo de vida de la suscripción' }}</small>
                  @if (event.reason) { <p>{{ event.reason }}</p> }
                </div>
              </li>
            } @empty { <li class="pt-empty">Sin eventos registrados.</li> }
          </ol>
        </section>
      }

      @if (action(); as kind) {
        <div class="pt-overlay" (click)="close()" aria-hidden="true"></div>
        <section class="pt-dialog" role="dialog" aria-modal="true" aria-labelledby="pt-dialog-title">
          <h2 id="pt-dialog-title">{{ actionTitle(kind) }}</h2>
          @if (kind === 'suspend') { <p>Los usuarios de la organización no podrán trabajar mientras esté suspendida. Sus datos se conservan.</p> }
          @if (kind === 'reactivate') { <p>La organización vuelve a operar. Si estaba cancelada, se anula el borrado programado.</p> }
          @if (kind === 'extendTrial') {
            <label>Días adicionales<input type="number" name="days" min="1" max="90" [(ngModel)]="days" /></label>
          }
          @if (kind === 'courtesy') {
            <p>Sin cobro: amplía el límite de la organización hasta la fecha de vencimiento.</p>
            <label>Complemento
              <select name="courtesyAddon" [(ngModel)]="courtesyCode">
                @for (item of addonCatalog(); track item.code) { <option [value]="item.code">{{ item.name }} ({{ quantity(item.resourceKey, item.unitQuantity) }})</option> }
              </select>
            </label>
            <label>Unidades<input type="number" name="courtesyUnits" min="1" max="100" [(ngModel)]="courtesyUnits" /></label>
            <label>Vence el<input type="date" name="courtesyExpires" [(ngModel)]="courtesyExpires" /></label>
          }
          @if (kind === 'revoke') { <p>Se retira «{{ revokeName }}» de inmediato. Los límites vuelven a los del plan y los demás complementos.</p> }
          @if (kind === 'changePlan') {
            <p>Cambio sin cobro (cortesía o corrección). No modifica Stripe.</p>
            <label>Plan nuevo
              <select name="planCode" [(ngModel)]="planCode" (ngModelChange)="onPlanChange()">
                @for (plan of planOptions; track plan.code) { <option [value]="plan.code">{{ plan.label }}</option> }
              </select>
            </label>
            @if (overLimitWarning()) {
              <p class="pt-hint warn" role="alert">{{ overLimitWarning() }}</p>
            }
          }
          <label>Motivo (obligatorio, queda en la auditoría de plataforma)
            <textarea name="reason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="reason"></textarea>
          </label>
          @if (dialogError()) { <p class="pt-dialog-error" role="alert">{{ dialogError() }}</p> }
          <div class="pt-dialog-actions">
            <button type="button" (click)="close()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!canSubmit() || saving()" (click)="submit()">
              {{ saving() ? 'Aplicando…' : overLimitWarning() ? 'Aplicar de todos modos' : 'Confirmar' }}
            </button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-tenant { display: grid; gap: 14px; }
    .pt-back, .pt-link { color: #087f7b; font-weight: 700; font-size: 13px; text-decoration: none; }
    .pt-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pt-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pt-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; overflow-wrap: anywhere; }
    .pt-header p { margin: 0; color: #b6d7ce; font-size: 14px; }
    .pt-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pt-error button { margin-left: auto; border: 0; background: #991b1b; color: #fff; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
    .pt-notice { padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .pt-loading { display: flex; align-items: center; gap: 10px; padding: 40px; justify-content: center; color: #087f7b; }
    .spinner { width: 20px; height: 20px; border: 3px solid #dcebe8; border-top-color: #087f7b; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pt-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 9px 14px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    button.danger { border-color: #e5b4b4; color: #9f1d1d; }
    button.link { border: 0; background: none; color: #087f7b; padding: 0; }
    td small { display: block; color: #6b8583; font-size: 11px; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .pt-actions .pt-link { margin-left: auto; }
    .pt-hint { margin: 0; font-size: 13px; color: #415e5a; }
    .pt-hint.warn { padding: 10px 12px; border-radius: 10px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; }
    .pt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .pt-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; min-width: 0; }
    .pt-panel h2 { margin: 0 0 12px; font-size: 16px; color: #153a39; }
    .pt-panel h3 { margin: 16px 0 8px; font-size: 13px; color: #51717d; text-transform: uppercase; letter-spacing: .06em; }
    dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
    dl div { display: grid; gap: 2px; min-width: 0; }
    dt { color: #6b8583; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    dd { margin: 0; color: #153a39; overflow-wrap: anywhere; }
    .pt-admin { display: grid; gap: 2px; margin: 0 0 8px; font-size: 13px; }
    .pt-admin span, .pt-admin small { color: #6b8583; overflow-wrap: anywhere; }
    .pt-usage { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .pt-usage header { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: #415e5a; margin-bottom: 6px; flex-wrap: wrap; }
    .pt-usage b { color: #153a39; }
    .pt-bar { height: 10px; border-radius: 999px; background: #edf2f5; overflow: hidden; }
    .pt-bar span { display: block; height: 100%; border-radius: 999px; background: #10b981; transition: width .5s ease; }
    .pt-bar.warn span { background: #f59e0b; }
    .pt-bar.over span { background: #dc2626; }
    .pt-bar.unlimited span { background: transparent; }
    .pt-table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #51717d; background: #f2f7f8; padding: 10px 12px; white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid #eef3f2; color: #153a39; }
    td.ref { font-family: ui-monospace, monospace; font-size: 12px; color: #6b8583; overflow-wrap: anywhere; }
    .num { text-align: right; white-space: nowrap; }
    .pt-empty { color: #6b8583; text-align: center; padding: 16px; }
    .pt-history { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .pt-history li { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 10px 12px; border-left: 3px solid #cfdfe4; background: #f7fbfa; border-radius: 0 10px 10px 0; }
    .pt-history li.platform { border-left-color: #087f7b; }
    .pt-history time { font-size: 12px; color: #6b8583; }
    .pt-history small { display: block; color: #6b8583; font-size: 12px; }
    .pt-history p { margin: 4px 0 0; font-size: 13px; color: #415e5a; overflow-wrap: anywhere; }
    .pt-badge { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; background: #edf2f5; color: #5a6d79; }
    .pt-badge.s-ACTIVE { background: #def8ef; color: #047857; }
    .pt-badge.s-TRIAL { background: #fff7df; color: #986200; }
    .pt-badge.s-PAST_DUE { background: #ffedd5; color: #c2410c; }
    .pt-badge.s-EXPIRED, .pt-badge.s-CANCELED, .pt-badge.s-PENDING_DELETION, .pt-badge.s-PURGED { background: #fde8e8; color: #b42318; }
    .pt-badge.s-SUSPENDED { background: #ece9f9; color: #5b45a6; }
    .pt-overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .pt-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 480px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; display: grid; gap: 12px; max-height: calc(100vh - 32px); overflow-y: auto; }
    .pt-dialog h2 { margin: 0; font-size: 18px; }
    .pt-dialog p { margin: 0; font-size: 14px; color: #415e5a; }
    .pt-dialog label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #153a39; }
    .pt-dialog input, .pt-dialog select, .pt-dialog textarea { border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; }
    .pt-dialog textarea { resize: vertical; }
    .pt-dialog-error { color: #991b1b !important; }
    .pt-dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    @media (max-width: 1100px) { .pt-usage { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) {
      .pt-grid, .pt-usage, dl { grid-template-columns: 1fr; }
      .pt-actions .pt-link { margin-left: 0; }
      .pt-history li { grid-template-columns: 1fr; gap: 4px; }
    }
  `],
})
export class PlatformTenantPage implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly addons = inject(AddonsApiService);
  private readonly route = inject(ActivatedRoute);
  readonly addonCatalog = signal<AddonCatalogItem[]>([]);
  courtesyCode = '';
  courtesyUnits = 1;
  courtesyExpires = '';
  revokeId = '';
  revokeName = '';

  readonly data = signal<PlatformTenantOverview | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly action = signal<ActionKind | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly overLimitWarning = signal('');
  readonly maxReason = MAX_REASON_LENGTH;
  readonly planOptions = [
    { code: 'BASIC', label: 'Básico' }, { code: 'PRO', label: 'Pro' }, { code: 'ENTERPRISE', label: 'Enterprise' },
  ];
  reason = '';
  days = 7;
  planCode = 'PRO';
  private tenantId = '';

  readonly actions = computed(() => {
    const d = this.data();
    return d ? availableActions(d.summary.lifecycleState, d.subscription.stripeManaged)
      : { suspend: false, reactivate: false, extendTrial: false, changePlan: false };
  });

  readonly usageItems = computed(() => {
    const usage = this.data()?.usage;
    if (!usage) return [];
    const count = (item: PlatformUsageItem) => `${item.used} / ${item.limit === -1 ? 'ilimitado' : item.limit}`;
    return [
      { label: 'Usuarios activos', text: count(usage.users), bar: usageBar(usage.users.used, usage.users.limit) },
      { label: 'Almacenamiento', bar: usageBar(usage.storageBytes.used, usage.storageBytes.limit),
        text: `${formatBytes(usage.storageBytes.used)} / ${usage.storageBytes.limit === -1 ? 'ilimitado' : formatBytes(usage.storageBytes.limit)}` },
      { label: 'Documentos', text: count(usage.documents), bar: usageBar(usage.documents.used, usage.documents.limit) },
      { label: 'Páginas OCR del mes', text: count(usage.ocrPagesMonth), bar: usageBar(usage.ocrPagesMonth.used, usage.ocrPagesMonth.limit) },
    ];
  });

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tenantOverview(this.tenantId).subscribe({
      next: (overview) => { this.data.set(overview); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 404 ? 'La organización no existe.' : friendlyApiMessage(err.error?.message) || 'No se pudo cargar la ficha de la organización.');
      },
    });
  }

  open(kind: ActionKind): void {
    this.reason = '';
    this.days = 7;
    this.planCode = this.planOptions.find((p) => p.code !== this.data()?.subscription.planCode)?.code ?? 'PRO';
    this.dialogError.set('');
    this.overLimitWarning.set('');
    this.notice.set('');
    this.action.set(kind);
  }

  close(): void { if (!this.saving()) this.action.set(null); }

  canSubmit(): boolean {
    if (!isValidReason(this.reason)) return false;
    if (this.action() === 'extendTrial') return Number.isInteger(Number(this.days)) && this.days >= 1 && this.days <= 90;
    if (this.action() === 'courtesy') {
      return !!this.courtesyCode && Number.isInteger(Number(this.courtesyUnits)) && this.courtesyUnits >= 1 && this.courtesyUnits <= 100
        && !!this.courtesyExpires && new Date(this.courtesyExpires + 'T23:59:59Z').getTime() > Date.now();
    }
    return true;
  }

  submit(): void {
    const kind = this.action();
    if (!kind || !this.canSubmit()) return;
    const reason = this.reason.trim();
    const request = kind === 'suspend' ? this.api.changeStatus(this.tenantId, 'SUSPENDED', reason)
      : kind === 'reactivate' ? this.api.changeStatus(this.tenantId, 'ACTIVE', reason)
      : kind === 'extendTrial' ? this.api.extendTrial(this.tenantId, Number(this.days), reason)
      : kind === 'courtesy' ? this.addons.grantCourtesy(this.tenantId, this.courtesyCode, Number(this.courtesyUnits),
          new Date(this.courtesyExpires + 'T23:59:59Z').toISOString(), reason)
      : kind === 'revoke' ? this.addons.revokeCourtesy(this.tenantId, this.revokeId, reason)
      : this.api.changePlan(this.tenantId, this.planCode, !!this.overLimitWarning(), reason);
    this.saving.set(true);
    this.dialogError.set('');
    request.subscribe({
      next: (overview) => {
        this.saving.set(false);
        this.data.set(overview);
        this.action.set(null);
        this.notice.set('Acción aplicada y registrada en la auditoría de plataforma.');
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (kind === 'changePlan' && needsOverLimitConfirmation(err.status, err.error)) {
          this.overLimitWarning.set(err.error?.message ?? 'El uso actual no cabe en el plan elegido.');
          return;
        }
        this.dialogError.set(friendlyApiMessage(err.error?.message) || 'No se pudo aplicar la acción.');
      },
    });
  }

  onPlanChange(): void { this.overLimitWarning.set(''); }

  openCourtesy(): void {
    this.courtesyUnits = 1;
    this.courtesyExpires = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    this.open('courtesy');
    this.addons.catalog().subscribe({
      next: (items) => { this.addonCatalog.set(items); this.courtesyCode = items[0]?.code ?? ''; },
      error: () => this.dialogError.set('No se pudo cargar el catálogo de complementos.'),
    });
  }

  openRevoke(id: string, name: string): void {
    this.revokeId = id;
    this.revokeName = name;
    this.open('revoke');
  }

  quantity(resource: string, value: number): string { return quantityLabel(resource, value); }
  addonSource(source: string): string { return ADDON_SOURCE_LABELS[source] ?? source; }

  actionTitle(kind: ActionKind): string { return ACTION_TITLES[kind]; }
  actionLabel(action: string): string { return actionLabel(action); }
  lifecycleLabel(state: string): string { return LIFECYCLE_LABELS[state] ?? state; }
  methodLabel(method: string): string { return METHOD_LABELS[method] ?? method; }
  paymentLabel(status: string): string { return PAYMENT_LABELS[status] ?? status; }

  date(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }

  dateTime(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  usd(value: number | null | undefined): string {
    return 'USD ' + (Number(value) || 0).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
