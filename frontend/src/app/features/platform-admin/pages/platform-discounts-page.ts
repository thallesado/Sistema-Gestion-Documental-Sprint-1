import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { CouponView, DiscountRedemption, DiscountsApiService, DiscountsOverview, LoyaltyCandidate } from '../../../core/api/discounts-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import {
  CouponForm, DISCOUNT_SOURCE_LABELS, DISCOUNT_STATUS_LABELS, couponFormError, discountValueLabel, durationLabel, endOfDayIso,
  normalizePromotionCode, promotionCodeFormError,
} from '../../billing/pages/discounts.logic';
import { MAX_REASON_LENGTH, isValidReason } from './platform-tenant.logic';

const PLAN_CODES = ['BASIC', 'PRO', 'ENTERPRISE'];

interface PendingAction { title: string; detail: string; run: (reason: string) => Observable<unknown>; done: (result: unknown) => void }
interface CodeForm { code: string; maxRedemptions: number | null; expiresAt: string; firstTimeOnly: boolean }

/** Descuentos y promociones (/platform/discounts): cupones, códigos, canjes y clientes frecuentes. */
@Component({
  selector: 'app-platform-discounts-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page platform-discounts">
      <header class="pd-header">
        <div>
          <span class="pd-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Descuentos y promociones</h1>
          <p>Cupones y códigos promocionales creados en Stripe. Todo descuento tiene fecha de fin y un tope; los clientes frecuentes se aprueban uno por uno.</p>
        </div>
        <button type="button" class="primary" (click)="startCreate()">+ Nuevo cupón</button>
      </header>

      @if (notice()) { <div class="pd-notice" role="status">{{ notice() }}</div> }
      @if (error()) { <div class="pd-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }
      @if (loading() && !overview()) { <div class="pd-loading"><span class="spinner"></span> Cargando descuentos…</div> }

      @if (overview(); as o) {
        <div class="pd-kpis">
          <article><span>Cupones vigentes</span><b>{{ activeCoupons() }}</b></article>
          <article><span>Descuentos vigentes</span><b>{{ activeDiscounts() }}</b></article>
          <article><span>Descontado en facturas</span><b>{{ usd(totalDiscounted()) }}</b></article>
          <article><span>Tope de descuento</span><b>{{ o.maxPercentOff }} %</b></article>
        </div>
      }

      @if (createForm) {
        <section class="pd-panel">
          <h2>Nuevo cupón</h2>
          <div class="pd-row">
            <label>Código interno<input name="code" maxlength="40" [(ngModel)]="createForm.code" placeholder="LANZAMIENTO-20" /></label>
            <label>Nombre<input name="name" maxlength="100" [(ngModel)]="createForm.name" placeholder="Lanzamiento 2026" /></label>
            <label>Tipo
              <select name="type" [(ngModel)]="createForm.type"><option value="PERCENT">Porcentaje</option><option value="AMOUNT">Monto fijo (USD)</option></select>
            </label>
            <label>{{ createForm.type === 'PERCENT' ? 'Porcentaje' : 'Monto (USD)' }}<input type="number" min="0.01" step="0.01" name="value" [(ngModel)]="createForm.value" /></label>
          </div>
          <div class="pd-row">
            <label>Duración
              <select name="duration" [(ngModel)]="createForm.duration"><option value="ONCE">Un solo pago</option><option value="REPEATING">Varios meses</option></select>
            </label>
            @if (createForm.duration === 'REPEATING') { <label>Meses<input type="number" min="1" max="36" name="months" [(ngModel)]="createForm.months" /></label> }
            <label>Fecha de fin (obligatoria)<input type="date" name="redeemBy" [(ngModel)]="createForm.redeemBy" /></label>
          </div>
          <fieldset><legend>Planes a los que se aplica</legend>
            @for (plan of planCodes; track plan) {
              <label class="pd-check"><input type="checkbox" [checked]="createForm.plans.includes(plan)" (change)="togglePlan(createForm.plans, plan)" /> {{ plan }}</label>
            }
          </fieldset>
          <p class="pd-hint">Después de la fecha de fin ya no se puede canjear; los descuentos aplicados terminan según su duración.</p>
          @if (createError()) { <p class="pd-form-error">{{ createError() }}</p> }
          <div class="pd-actions">
            <button type="button" (click)="createForm = null">Cancelar</button>
            <button type="button" class="primary" [disabled]="!!createError()" (click)="create()">Crear cupón</button>
          </div>
        </section>
      }

      @for (c of overview()?.coupons ?? []; track c.id) {
        <section class="pd-panel">
          <header class="pd-item-head">
            <div>
              <h2>{{ c.name }} <small>{{ c.code }}</small></h2>
              <p>{{ value(c.percentOff, c.amountOffUsd) }} {{ duration(c.duration, c.durationInMonths) }} · Planes: {{ c.planCodes.join(', ') }} · Fin: {{ date(c.redeemBy) }}</p>
            </div>
            <div class="pd-head-actions">
              <span class="pd-badge" [class.off]="!c.active">{{ c.active ? 'Vigente' : 'Retirado' }}</span>
              @if (c.active) { <button type="button" (click)="deactivateCoupon(c)">Retirar</button> }
            </div>
          </header>
          <div class="pd-stats">
            <span>Canjes <b>{{ c.redemptions }}</b></span>
            <span>Vigentes <b>{{ c.activeDiscounts }}</b></span>
            <span>Descontado <b>{{ usd(c.discountedUsd) }}</b></span>
            <span>Cobrado con descuento <b>{{ usd(c.revenueUsd) }}</b></span>
          </div>
          <table>
            <thead><tr><th>Código</th><th class="num">Canjes</th><th>Vence</th><th>Restricción</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (p of c.promotionCodes; track p.id) {
                <tr>
                  <td><b>{{ p.code }}</b></td>
                  <td class="num">{{ p.redemptions }}{{ p.maxRedemptions ? ' / ' + p.maxRedemptions : '' }}</td>
                  <td>{{ date(p.expiresAt) }}</td>
                  <td>{{ p.firstTimeOnly ? 'Solo primer pago' : 'Cualquier pago' }}</td>
                  <td>{{ p.active ? 'Activo' : 'Inactivo' }}</td>
                  <td>@if (p.active) { <button type="button" class="link" (click)="deactivateCode(p.id, p.code)">Desactivar</button> }</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="pd-muted">Sin códigos promocionales.</td></tr>
              }
            </tbody>
          </table>
          @if (c.active) {
            @if (codeForms[c.id]; as f) {
              <div class="pd-row">
                <label>Código<input [name]="'pc-' + c.id" maxlength="40" [(ngModel)]="f.code" placeholder="LANZAMIENTO2026" /></label>
                <label>Límite de canjes<input type="number" min="1" [name]="'pm-' + c.id" [(ngModel)]="f.maxRedemptions" placeholder="Sin límite" /></label>
                <label>Vence<input type="date" [name]="'pe-' + c.id" [(ngModel)]="f.expiresAt" /></label>
                <label class="pd-check"><input type="checkbox" [name]="'pf-' + c.id" [(ngModel)]="f.firstTimeOnly" /> Solo primer pago</label>
                <button type="button" class="primary" [disabled]="!!codeError(c)" (click)="createCode(c)">Crear código</button>
              </div>
              @if (codeError(c); as e) { @if (f.code || f.expiresAt) { <p class="pd-form-error">{{ e }}</p> } }
            }
          }
        </section>
      } @empty {
        @if (overview()) { <section class="pd-panel pd-muted">Todavía no hay cupones.</section> }
      }

      <section class="pd-panel">
        <h2>Clientes frecuentes</h2>
        <p class="pd-hint">Sugeridos: pagan con Stripe hace {{ overview()?.loyaltyMonths ?? 12 }} meses o más, sin pagos fallidos en ese período y sin descuento vigente. El descuento no se aplica solo: apruébalo con un cupón y un motivo.</p>
        <table>
          <thead><tr><th>Organización</th><th>Plan</th><th class="num">Meses</th><th class="num">Pagos</th><th class="num">Pagado</th><th>Cupón</th><th></th></tr></thead>
          <tbody>
            @for (t of candidates(); track t.tenantId) {
              <tr>
                <td><a [routerLink]="['/platform/tenants', t.tenantId]">{{ t.tenantName }}</a></td>
                <td>{{ t.planName }}</td>
                <td class="num">{{ t.monthsActive }}</td>
                <td class="num">{{ t.payments }}</td>
                <td class="num">{{ usd(t.totalPaidUsd) }}</td>
                <td>
                  <select [name]="'cc-' + t.tenantId" [(ngModel)]="candidateCoupon[t.tenantId]" aria-label="Cupón">
                    <option [ngValue]="undefined">Elegir cupón…</option>
                    @for (c of couponsFor(t.planCode); track c.id) { <option [ngValue]="c.id">{{ c.name }} · {{ value(c.percentOff, c.amountOffUsd) }}</option> }
                  </select>
                </td>
                <td><button type="button" class="primary" [disabled]="!candidateCoupon[t.tenantId]" (click)="approve(t)">Aprobar</button></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="pd-muted">No hay clientes que cumplan los criterios.</td></tr>
            }
          </tbody>
        </table>
      </section>

      <section class="pd-panel">
        <h2>Canjes y descuentos aplicados</h2>
        <table>
          <thead><tr><th>Organización</th><th>Cupón</th><th>Origen</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Aprobó</th><th class="num">Descontado</th></tr></thead>
          <tbody>
            @for (r of redemptions(); track r.id) {
              <tr>
                <td><a [routerLink]="['/platform/tenants', r.tenantId]">{{ r.tenantName }}</a></td>
                <td>{{ r.couponCode }}@if (r.promotionCode) { <small> · {{ r.promotionCode }}</small> }</td>
                <td>{{ source(r.source) }}</td>
                <td>{{ date(r.startsAt) }}</td>
                <td>{{ date(r.endsAt) }}</td>
                <td>{{ status(r.status) }}</td>
                <td>{{ r.approvedBy ?? '—' }}</td>
                <td class="num">{{ usd(r.discountedUsd) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="pd-muted">Todavía no hay canjes.</td></tr>
            }
          </tbody>
        </table>
      </section>

      @if (pending(); as action) {
        <div class="pd-overlay" (click)="close()" aria-hidden="true"></div>
        <section class="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-dialog-title">
          <h2 id="pd-dialog-title">{{ action.title }}</h2>
          <p>{{ action.detail }}</p>
          <label>Motivo (obligatorio, queda en la auditoría de plataforma)
            <textarea name="reason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="reason"></textarea>
          </label>
          @if (dialogError()) { <p class="pd-form-error" role="alert">{{ dialogError() }}</p> }
          <div class="pd-actions">
            <button type="button" (click)="close()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!validReason() || saving()" (click)="confirm()">{{ saving() ? 'Aplicando…' : 'Confirmar' }}</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-discounts { display: grid; gap: 14px; }
    .pd-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pd-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pd-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pd-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 680px; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 9px 14px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    button.link { border: 0; background: none; color: #087f7b; padding: 0; }
    .pd-header button.primary { background: #62e3c4; border-color: #62e3c4; color: #0b2420; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .pd-notice { padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .pd-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pd-error button { margin-left: auto; }
    .pd-loading { display: flex; align-items: center; gap: 10px; padding: 40px; justify-content: center; color: #087f7b; }
    .spinner { width: 20px; height: 20px; border: 3px solid #dcebe8; border-top-color: #087f7b; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pd-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .pd-kpis article { background: #fff; border: 1px solid #dcebe8; border-radius: 12px; padding: 12px 14px; display: grid; gap: 4px; }
    .pd-kpis span { font-size: 12px; color: #51717d; font-weight: 700; }
    .pd-kpis b { font-size: 20px; color: #153a39; }
    .pd-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; display: grid; gap: 10px; min-width: 0; overflow-x: auto; }
    .pd-panel h2 { margin: 0; font-size: 16px; color: #153a39; }
    .pd-panel h2 small { color: #6b8583; font-weight: 400; font-size: 12px; }
    .pd-item-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .pd-item-head p { margin: 2px 0 0; font-size: 12px; color: #6b8583; }
    .pd-head-actions { display: flex; gap: 8px; align-items: center; }
    .pd-badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; background: #def8ef; color: #047857; }
    .pd-badge.off { background: #edf2f5; color: #5a6d79; }
    .pd-stats { display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; color: #51717d; }
    .pd-stats b { color: #153a39; margin-left: 4px; }
    label { display: grid; gap: 4px; font-size: 13px; font-weight: 700; color: #153a39; }
    input, select, textarea { border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; min-width: 0; }
    textarea { resize: vertical; }
    .pd-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .pd-row label { flex: 1 1 150px; }
    .pd-check { display: inline-flex !important; align-items: center; gap: 6px; font-weight: 600; margin-right: 12px; }
    .pd-check input { width: auto; }
    fieldset { border: 1px solid #eef3f2; border-radius: 10px; padding: 8px 12px; margin: 0; }
    legend { font-size: 12px; font-weight: 800; color: #51717d; padding: 0 4px; }
    .pd-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .pd-hint, .pd-muted { margin: 0; font-size: 12px; color: #51717d; }
    .pd-form-error { margin: 0; font-size: 13px; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #51717d; background: #f2f7f8; padding: 8px 10px; white-space: nowrap; }
    td { padding: 8px 10px; border-bottom: 1px solid #eef3f2; }
    td a { color: #087f7b; font-weight: 700; }
    .num { text-align: right; white-space: nowrap; }
    .pd-overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .pd-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 480px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; display: grid; gap: 12px; }
    .pd-dialog h2 { margin: 0; font-size: 18px; }
    .pd-dialog p { margin: 0; font-size: 14px; color: #415e5a; }
  `],
})
export class PlatformDiscountsPage implements OnInit {
  private readonly api = inject(DiscountsApiService);

  readonly overview = signal<DiscountsOverview | null>(null);
  readonly redemptions = signal<DiscountRedemption[]>([]);
  readonly candidates = signal<LoyaltyCandidate[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal<PendingAction | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly planCodes = PLAN_CODES;
  readonly maxReason = MAX_REASON_LENGTH;
  readonly activeCoupons = computed(() => (this.overview()?.coupons ?? []).filter((c) => c.active).length);
  readonly activeDiscounts = computed(() => (this.overview()?.coupons ?? []).reduce((sum, c) => sum + c.activeDiscounts, 0));
  readonly totalDiscounted = computed(() => (this.overview()?.coupons ?? []).reduce((sum, c) => sum + Number(c.discountedUsd || 0), 0));
  reason = '';
  createForm: CouponForm | null = null;
  codeForms: Record<string, CodeForm> = {};
  candidateCoupon: Record<string, string | undefined> = {};

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ overview: this.api.overview(), redemptions: this.api.redemptions(), candidates: this.api.candidates() }).subscribe({
      next: ({ overview, redemptions, candidates }) => {
        this.setOverview(overview);
        this.redemptions.set(redemptions);
        this.candidates.set(candidates);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudieron cargar los descuentos.'); },
    });
  }

  private setOverview(overview: DiscountsOverview): void {
    this.overview.set(overview);
    for (const c of overview.coupons) this.codeForms[c.id] ??= { code: '', maxRedemptions: null, expiresAt: '', firstTimeOnly: true };
  }

  startCreate(): void {
    this.createForm = { code: '', name: '', type: 'PERCENT', value: null, duration: 'ONCE', months: 3, plans: ['PRO'], redeemBy: '' };
  }

  createError(): string | null {
    return this.createForm ? couponFormError(this.createForm, this.overview()?.maxPercentOff ?? 50) : null;
  }

  create(): void {
    const f = this.createForm;
    if (!f || this.createError()) return;
    const percent = f.type === 'PERCENT';
    const code = f.code.trim().toUpperCase();
    this.ask({
      title: `Crear el cupón ${code}`,
      detail: 'Se crea primero en Stripe. Después podrás crear códigos promocionales o aplicarlo a organizaciones.',
      run: (reason) => this.api.createCoupon({
        code, name: f.name.trim(), percentOff: percent ? Number(f.value) : null, amountOffUsd: percent ? null : Number(f.value),
        duration: f.duration, durationInMonths: f.duration === 'REPEATING' ? Number(f.months) : null, planCodes: [...f.plans],
        redeemBy: endOfDayIso(f.redeemBy), reason,
      }),
      done: (result) => { this.setOverview(result as DiscountsOverview); this.createForm = null; },
    });
  }

  deactivateCoupon(c: CouponView): void {
    this.ask({
      title: `Retirar el cupón ${c.code}`,
      detail: 'Deja de poder canjearse y sus códigos se desactivan. Los descuentos ya aplicados siguen hasta su fin.',
      run: (reason) => this.api.deactivateCoupon(c.id, reason),
      done: (result) => this.setOverview(result as DiscountsOverview),
    });
  }

  codeError(c: CouponView): string | null {
    const f = this.codeForms[c.id];
    return f ? promotionCodeFormError(f.code, f.expiresAt, c.redeemBy, f.maxRedemptions || null) : null;
  }

  createCode(c: CouponView): void {
    const f = this.codeForms[c.id];
    if (!f || this.codeError(c)) return;
    const code = normalizePromotionCode(f.code);
    this.ask({
      title: `Crear el código ${code}`,
      detail: 'Se crea en Stripe; los clientes lo escriben al pagar con tarjeta.',
      run: (reason) => this.api.createPromotionCode(c.id, {
        code, maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null, expiresAt: endOfDayIso(f.expiresAt, c.redeemBy),
        firstTimeOnly: f.firstTimeOnly, reason,
      }),
      done: (result) => { this.codeForms[c.id] = { code: '', maxRedemptions: null, expiresAt: '', firstTimeOnly: true }; this.setOverview(result as DiscountsOverview); },
    });
  }

  deactivateCode(id: string, code: string): void {
    this.ask({
      title: `Desactivar el código ${code}`, detail: 'Deja de aceptarse en el checkout; quien ya lo canjeó conserva su descuento.',
      run: (reason) => this.api.deactivatePromotionCode(id, reason),
      done: (result) => this.setOverview(result as DiscountsOverview),
    });
  }

  couponsFor(planCode: string): CouponView[] {
    return (this.overview()?.coupons ?? []).filter((c) => c.active && c.stripePublished && c.planCodes.includes(planCode));
  }

  approve(t: LoyaltyCandidate): void {
    const coupon = this.couponsFor(t.planCode).find((c) => c.id === this.candidateCoupon[t.tenantId]);
    if (!coupon) return;
    this.ask({
      title: `Aprobar descuento para ${t.tenantName}`,
      detail: `Se aplica ${this.value(coupon.percentOff, coupon.amountOffUsd)} ${this.duration(coupon.duration, coupon.durationInMonths)} a su suscripción de Stripe desde la próxima factura. Quedas registrado como aprobador.`,
      run: (reason) => this.api.applyToTenant(t.tenantId, coupon.id, reason),
      done: () => this.load(),
    });
  }

  private ask(action: PendingAction): void { this.reason = ''; this.dialogError.set(''); this.notice.set(''); this.pending.set(action); }

  close(): void { if (!this.saving()) this.pending.set(null); }

  validReason(): boolean { return isValidReason(this.reason); }

  confirm(): void {
    const action = this.pending();
    if (!action || !this.validReason()) return;
    this.saving.set(true);
    action.run(this.reason.trim()).subscribe({
      next: (result) => { this.saving.set(false); this.pending.set(null); action.done(result); this.notice.set('Cambio aplicado y registrado en la auditoría de plataforma.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.dialogError.set(friendlyApiMessage(err.error?.message) || 'No se pudo aplicar el cambio.'); },
    });
  }

  togglePlan(plans: string[], plan: string): void {
    const index = plans.indexOf(plan);
    if (index >= 0) plans.splice(index, 1); else plans.push(plan);
  }

  value(percent: number | null, amount: number | null): string { return discountValueLabel(percent, amount); }
  duration(kind: string, months: number | null): string { return durationLabel(kind, months); }
  source(value: string): string { return DISCOUNT_SOURCE_LABELS[value] ?? value; }
  status(value: string): string { return DISCOUNT_STATUS_LABELS[value] ?? value; }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }

  usd(value: number | null | undefined): string {
    return 'USD ' + (Number(value) || 0).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
