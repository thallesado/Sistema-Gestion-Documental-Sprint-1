import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AddonOffer, AddonsApiService, AddonsOverview, ManualOrder, OwnedAddon } from '../../../core/api/addons-api.service';
import { BillingService } from '../../../core/billing/billing.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { RESOURCE_LABELS, addonTotal, canReduce, paymentMethodsFor, quantityLabel, validUnits } from './addons.logic';

const METHOD_LABELS: Record<string, string> = { STRIPE_CARD: 'Tarjeta (Stripe)', BANK_QR: 'QR bancario', CRYPTO_USDT: 'USDT' };
const SOURCE_LABELS: Record<string, string> = { PURCHASE: 'Comprado', MANUAL_PAYMENT: 'Pago manual', COURTESY: 'Cortesía de NexoDocs' };

/**
 * Pestaña Complementos de Gestionar suscripción (064): paquetes de almacenamiento, usuarios y OCR para
 * crecer sin cambiar de plan. Un recurrente se agrega a la suscripción de Stripe; un paquete OCR se paga
 * una vez; sin Stripe se paga por QR o USDT.
 */
@Component({
  selector: 'app-subscription-addons',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="addons">
      @if (loading() && !data()) { <p class="empty">Cargando complementos…</p> }
      @if (error()) {
        <div class="notice error" role="alert"><span>{{ error() }}</span><button type="button" (click)="load()">Reintentar</button></div>
      }
      @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }

      @if (data(); as d) {
        @if (d.upgradeSuggestion; as s) {
          <div class="notice tip" role="status">
            Tus complementos cuestan {{ usd(s.addonsMonthlyUsd) }} al mes, más que pasar al plan {{ s.planName }} ({{ usd(s.planDifferenceMonthlyUsd) }} de diferencia). Revisa la pestaña Plan.
          </div>
        }

        <h2>Tus complementos</h2>
        @for (a of d.owned; track a.id) {
          <article class="owned">
            <div>
              <b>{{ a.name }}</b>
              <span>{{ a.units }} × {{ quantity(a.resourceKey, a.unitQuantity) }} · {{ source(a.source) }}</span>
              @if (a.kind === 'CONSUMABLE') { <small>Quedan {{ a.remaining }} páginas · vence el {{ date(a.expiresAt) }}</small> }
              @else if (a.expiresAt) { <small>Vence el {{ date(a.expiresAt) }}</small> }
              @if (a.pendingUnits !== null) {
                <small class="pending">{{ a.pendingUnits === 0 ? 'Se quitará' : 'Pasará a ' + a.pendingUnits + ' unidad(es)' }} el {{ date(a.pendingAt) }}</small>
              }
              @if (a.coveredByPlan) { <small class="tip-text">Tu plan ya cubre tu uso de {{ resource(a.resourceKey) }}: puedes retirar este complemento.</small> }
            </div>
            @if (reducible(a)) {
              <div class="actions">
                <label>Unidades<input type="number" min="0" [max]="a.units - 1" [name]="'units-' + a.id" [(ngModel)]="reduceTo[a.id]" /></label>
                <button type="button" [disabled]="busy() || !validReduction(a)" (click)="reduce(a)">Reducir</button>
                <button type="button" class="danger" [disabled]="busy()" (click)="remove(a)">Quitar</button>
              </div>
            }
          </article>
        } @empty { <p class="empty">Todavía no tienes complementos.</p> }

        <h2>Agregar complementos</h2>
        @if (!d.canPurchase) { <p class="empty">{{ d.purchaseBlockedReason }}</p> }
        <div class="offers">
          @for (o of d.offers; track o.code) {
            <article class="offer" [class.selected]="selected()?.code === o.code">
              <b>{{ o.name }}</b>
              <span>{{ o.description || quantity(o.resourceKey, o.unitQuantity) }}</span>
              <strong>{{ usd(o.price) }}<small>{{ o.kind === 'CONSUMABLE' ? ' por paquete' : (o.billingCycle === 'ANNUAL' ? ' al año' : ' al mes') }}</small></strong>
              @if (o.kind === 'CONSUMABLE') { <small>Válido {{ o.validityMonths }} meses. Se usa cuando se agota la cuota mensual del plan.</small> }
              <button type="button" [disabled]="!d.canPurchase || !methodsFor(o, d).length" (click)="choose(o, d)">Elegir</button>
              @if (!methodsFor(o, d).length && d.canPurchase) { <small>Disponible pronto.</small> }
            </article>
          } @empty { <p class="empty">No hay complementos disponibles para tu plan.</p> }
        </div>

        @if (selected(); as o) {
          <section class="buy">
            <h3>{{ o.name }}</h3>
            <div class="row">
              <label>Unidades<input type="number" min="1" max="100" name="units" [(ngModel)]="units" /></label>
              @if (methods.length > 1) {
                <label>Medio de pago
                  <select name="method" [(ngModel)]="method">
                    @for (m of methods; track m) { <option [value]="m">{{ methodLabel(m) }}</option> }
                  </select>
                </label>
              }
              @if (method === 'CRYPTO_USDT') {
                <label>Red<select name="network" [(ngModel)]="network"><option>TRC20</option><option>POLYGON</option></select></label>
              }
            </div>
            <p>Total: <b>{{ usd(total(o)) }}</b>
              @if (o.kind === 'RECURRING' && d.stripeSubscription) { · se cobra ahora la parte proporcional y luego junto con tu plan en cada renovación }
            </p>
            @if (order(); as m) {
              <div class="manual">
                <p>Referencia <b>{{ m.externalReference }}</b> · {{ usd(m.amountUsd) }}</p>
                <small class="qr">{{ m.paymentData['qrPayload'] || m.paymentData['address'] }}</small>
                @if (method === 'CRYPTO_USDT') { <input name="tx" [(ngModel)]="confirmation" placeholder="Hash de la transacción (TxHash)" /> }
                <button type="button" class="primary" [disabled]="busy()" (click)="confirmManual(m)">Ya pagué, confirmar</button>
              </div>
            } @else {
              <div class="actions">
                <button type="button" (click)="selected.set(null)">Cancelar</button>
                <button type="button" class="primary" [disabled]="busy() || !validUnits(units)" (click)="buy(o)">
                  {{ busy() ? 'Procesando…' : method === 'STRIPE_CARD' ? (o.kind === 'CONSUMABLE' ? 'Pagar con Stripe' : 'Agregar a mi suscripción') : 'Generar orden de pago' }}
                </button>
              </div>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .addons { display: grid; gap: 12px; }
    h2 { font-size: 16px; margin: 8px 0 0; color: var(--ink, #153a39); }
    h3 { margin: 0; font-size: 15px; }
    .empty { color: var(--muted, #6b8583); margin: 0; }
    .notice { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .notice.error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .notice.tip { background: #eef6ff; border-color: #b9d4f2; color: #12385f; }
    .notice button { margin-left: auto; }
    .owned { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: #fff; border: 1px solid var(--line, #dcebe8); border-radius: 12px; padding: 12px 14px; }
    .owned > div:first-child { display: grid; gap: 2px; font-size: 13px; }
    .owned span, .owned small { color: var(--muted, #6b8583); }
    .owned .pending { color: #9a3412; }
    .owned .tip-text { color: #12385f; }
    .offers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .offer { display: grid; gap: 6px; align-content: start; background: #fff; border: 1px solid var(--line, #dcebe8); border-radius: 12px; padding: 14px; font-size: 13px; }
    .offer.selected { border-color: var(--teal, #087f7b); box-shadow: inset 0 0 0 1px var(--teal, #087f7b); }
    .offer span, .offer small { color: var(--muted, #6b8583); }
    .offer strong { font-size: 20px; color: var(--teal, #087f7b); }
    .offer strong small { font-size: 12px; font-weight: 400; }
    .buy { display: grid; gap: 10px; background: #fff; border: 1px solid var(--line, #dcebe8); border-radius: 12px; padding: 14px; }
    .buy p { margin: 0; font-size: 13px; }
    .row, .actions { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .actions { justify-content: flex-end; }
    label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; }
    input, select { border: 1px solid var(--line, #cfdfe4); border-radius: 8px; font: inherit; padding: 7px 9px; min-width: 0; width: 110px; }
    button { background: #fff; border: 1px solid var(--line, #cce1e2); border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 8px 14px; }
    button.primary { background: var(--teal, #087f7b); border-color: var(--teal, #087f7b); color: #fff; }
    button.danger { border-color: #e5b4b4; color: #9f1d1d; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .manual { display: grid; gap: 8px; }
    .qr { word-break: break-all; font-size: 11px; color: var(--muted, #6b8583); background: var(--canvas, #f2faf7); padding: 8px; border-radius: 8px; }
    .manual input { width: 100%; }
  `],
})
export class SubscriptionAddonsPanel implements OnInit {
  private readonly api = inject(AddonsApiService);
  private readonly billing = inject(BillingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly data = signal<AddonsOverview | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly selected = signal<AddonOffer | null>(null);
  readonly order = signal<ManualOrder | null>(null);
  units = 1;
  method = 'STRIPE_CARD';
  methods: string[] = [];
  network = 'TRC20';
  confirmation = '';
  reduceTo: Record<string, number> = {};

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const session = query.get('session_id');
    if (query.get('complementos') === 'ok' && session) {
      // Respaldo del webhook: confirma el paquete pagado en Stripe y limpia la URL.
      this.loading.set(true);
      this.api.confirmCheckout(session).subscribe({
        next: (overview) => { this.data.set(overview); this.loading.set(false); this.notice.set('Pago confirmado: el paquete ya está disponible.'); this.cleanUrl(); },
        error: () => { this.cleanUrl(); this.load(); },
      });
      return;
    }
    if (query.get('complementos') === 'cancelado') { this.notice.set('El pago fue cancelado y no se realizó ningún cobro.'); this.cleanUrl(); }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.overview().subscribe({
      next: (overview) => { this.data.set(overview); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudieron cargar los complementos.');
      },
    });
  }

  methodsFor(offer: AddonOffer, d: AddonsOverview): string[] { return paymentMethodsFor(offer.kind, d.stripeSubscription, offer.stripeReady); }

  choose(offer: AddonOffer, d: AddonsOverview): void {
    this.methods = this.methodsFor(offer, d);
    this.method = this.methods[0] ?? 'BANK_QR';
    this.units = 1;
    this.order.set(null);
    this.notice.set('');
    this.selected.set(offer);
  }

  buy(offer: AddonOffer): void {
    if (!validUnits(this.units)) return;
    this.busy.set(true);
    this.error.set('');
    this.api.purchase(offer.code, Number(this.units), this.method, this.method === 'CRYPTO_USDT' ? this.network : undefined).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.mode === 'CHECKOUT' && result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
        if (result.mode === 'MANUAL_ORDER' && result.order) { this.order.set(result.order); return; }
        if (result.overview) this.data.set(result.overview);
        this.selected.set(null);
        this.notice.set('Complemento agregado a tu suscripción. Ya puedes usarlo.');
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo comprar el complemento.'); },
    });
  }

  confirmManual(order: ManualOrder): void {
    this.busy.set(true);
    this.billing.confirm(order.transactionId, this.confirmation.trim()).subscribe({
      next: () => { this.busy.set(false); this.order.set(null); this.selected.set(null); this.notice.set('Pago confirmado: el complemento ya está activo.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo confirmar el pago.'); },
    });
  }

  reduce(addon: OwnedAddon): void { this.change(addon, Number(this.reduceTo[addon.id])); }

  remove(addon: OwnedAddon): void { this.change(addon, 0); }

  private change(addon: OwnedAddon, units: number): void {
    this.busy.set(true);
    this.error.set('');
    this.api.changeUnits(addon.id, units).subscribe({
      next: (overview) => {
        this.busy.set(false);
        this.data.set(overview);
        this.notice.set('El cambio se aplicará al final del período pagado; hasta entonces conservas lo contratado.');
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo cambiar el complemento.'); },
    });
  }

  private cleanUrl(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { complementos: null, session_id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  reducible(addon: OwnedAddon): boolean { return canReduce(addon); }
  validReduction(addon: OwnedAddon): boolean {
    const target = Number(this.reduceTo[addon.id]);
    return this.reduceTo[addon.id] !== undefined && Number.isInteger(target) && target >= 0 && target < addon.units;
  }
  total(offer: AddonOffer): number { return addonTotal(offer.price, this.units); }
  validUnits(units: number): boolean { return validUnits(units); }
  quantity(resource: string, value: number): string { return quantityLabel(resource, value); }
  resource(key: string): string { return (RESOURCE_LABELS[key] ?? key).toLowerCase(); }
  source(source: string): string { return SOURCE_LABELS[source] ?? source; }
  methodLabel(method: string): string { return METHOD_LABELS[method] ?? method; }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }

  usd(value: number | null | undefined): string {
    return 'USD ' + (Number(value) || 0).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
