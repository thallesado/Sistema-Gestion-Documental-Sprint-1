import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AddonCatalogItem, AddonsApiService } from '../../../core/api/addons-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { RESOURCE_LABELS, quantityLabel } from '../../billing/pages/addons.logic';
import { isValidAmount } from './platform-plans.logic';
import { MAX_REASON_LENGTH, isValidReason } from './platform-tenant.logic';

const PLAN_CODES = ['BASIC', 'PRO', 'ENTERPRISE'];
const CYCLE_LABELS: Record<string, string> = { MONTHLY: 'Mensual', ANNUAL: 'Anual', ONE_TIME: 'Pago único' };

interface PendingAction { title: string; detail: string; run: (reason: string) => Observable<unknown>; done: (result: unknown) => void }

/** Catálogo de complementos (/platform/addons): planes en que se ofrecen y precios versionados en Stripe. */
@Component({
  selector: 'app-platform-addons-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page platform-addons">
      <header class="pa-header">
        <div>
          <span class="pa-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Complementos</h1>
          <p>Paquetes que amplían un límite del plan sin cambiar de plan. Los precios se crean en Stripe; quien ya compró conserva su precio.</p>
        </div>
        <button type="button" class="primary" (click)="startCreate()">+ Nuevo complemento</button>
      </header>

      @if (notice()) { <div class="pa-notice" role="status">{{ notice() }}</div> }
      @if (error()) { <div class="pa-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }
      @if (loading() && !items().length) { <div class="pa-loading"><span class="spinner"></span> Cargando complementos…</div> }

      @if (createForm) {
        <section class="pa-panel">
          <h2>Nuevo complemento</h2>
          <div class="pa-row">
            <label>Código<input name="code" maxlength="50" [(ngModel)]="createForm.code" placeholder="STORAGE_50GB" /></label>
            <label>Nombre<input name="name" maxlength="100" [(ngModel)]="createForm.name" /></label>
            <label>Tipo
              <select name="kind" [(ngModel)]="createForm.kind" (ngModelChange)="onKind()">
                <option value="RECURRING">Recurrente</option><option value="CONSUMABLE">Paquete consumible</option>
              </select>
            </label>
            <label>Recurso
              <select name="resource" [(ngModel)]="createForm.resourceKey" [disabled]="createForm.kind === 'CONSUMABLE'">
                <option value="maxStorageMB">Almacenamiento (MB)</option><option value="maxUsers">Usuarios</option><option value="maxOcrPagesPerMonth">Páginas OCR</option>
              </select>
            </label>
            <label>Cantidad por unidad<input type="number" min="1" name="qty" [(ngModel)]="createForm.unitQuantity" /></label>
            @if (createForm.kind === 'CONSUMABLE') { <label>Validez (meses)<input type="number" min="1" max="36" name="validity" [(ngModel)]="createForm.validityMonths" /></label> }
          </div>
          <label>Descripción<input name="description" maxlength="500" [(ngModel)]="createForm.description" /></label>
          <div class="pa-row">
            @for (cycle of cyclesFor(createForm.kind); track cycle) {
              <label>Precio {{ cycleLabel(cycle).toLowerCase() }} (USD)<input type="number" min="0.01" step="0.01" [name]="'price-' + cycle" [(ngModel)]="createForm.prices[cycle]" /></label>
            }
          </div>
          <fieldset><legend>Planes en que se ofrece</legend>
            @for (plan of planCodes; track plan) {
              <label class="pa-check"><input type="checkbox" [checked]="createForm.plans.has(plan)" (change)="togglePlan(createForm.plans, plan)" /> {{ plan }}</label>
            }
          </fieldset>
          <p class="pa-hint">Los precios se guardan sin Stripe: publícalos después con «Publicar en Stripe».</p>
          <div class="pa-actions">
            <button type="button" (click)="createForm = null">Cancelar</button>
            <button type="button" class="primary" [disabled]="!createValid()" (click)="create()">Crear complemento</button>
          </div>
        </section>
      }

      @for (item of items(); track item.id) {
        <section class="pa-panel">
          <header class="pa-item-head">
            <div>
              <h2>{{ item.name }} <small>{{ item.code }}</small></h2>
              <p>{{ item.kind === 'CONSUMABLE' ? 'Paquete consumible' : 'Recurrente' }} · {{ quantity(item) }} por unidad
                @if (item.validityMonths) { · válido {{ item.validityMonths }} meses } · {{ item.activeTenants }} organización(es) lo usan</p>
            </div>
            <span class="pa-badge" [class.off]="!item.active">{{ item.active ? 'A la venta' : 'Fuera de venta' }}</span>
          </header>

          @if (edits[item.id]; as e) {
            <div class="pa-row">
              <label>Nombre<input [name]="'n-' + item.id" maxlength="100" [(ngModel)]="e.name" /></label>
              <label>Orden<input type="number" min="0" [name]="'o-' + item.id" [(ngModel)]="e.sortOrder" /></label>
              <label class="pa-check"><input type="checkbox" [name]="'a-' + item.id" [(ngModel)]="e.active" /> A la venta</label>
            </div>
            <label>Descripción<input [name]="'d-' + item.id" maxlength="500" [(ngModel)]="e.description" /></label>
            <fieldset><legend>Planes en que se ofrece</legend>
              @for (plan of planCodes; track plan) {
                <label class="pa-check"><input type="checkbox" [checked]="e.plans.has(plan)" (change)="togglePlan(e.plans, plan)" /> {{ plan }}</label>
              }
            </fieldset>
            <div class="pa-actions"><button type="button" class="primary" (click)="save(item)">Guardar</button></div>
          }

          <div class="pa-prices">
            @for (cycle of cyclesFor(item.kind); track cycle) {
              <article>
                <h3>{{ cycleLabel(cycle) }}</h3>
                <table>
                  <thead><tr><th>Desde</th><th class="num">Precio</th><th>Stripe</th><th>Estado</th></tr></thead>
                  <tbody>
                    @for (p of history(item, cycle); track p.id) {
                      <tr><td>{{ date(p.effectiveFrom) }}</td><td class="num">{{ usd(p.amountUsd) }}</td>
                        <td>{{ p.stripePriceId ? 'Publicado' : 'Sin publicar' }}</td><td>{{ p.archivedAt ? 'Archivado' : 'Vigente' }}</td></tr>
                    }
                  </tbody>
                </table>
                <div class="pa-row">
                  @if (current(item, cycle); as c) {
                    @if (!c.stripePriceId) { <button type="button" (click)="price(item, cycle, c.amountUsd, true)">Publicar en Stripe</button> }
                  }
                  <label>Precio nuevo (USD)<input type="number" min="0.01" step="0.01" [name]="'np-' + item.id + cycle" [(ngModel)]="newPrice[item.id + cycle]" /></label>
                  <button type="button" class="primary" [disabled]="!validAmount(newPrice[item.id + cycle])" (click)="price(item, cycle, newPrice[item.id + cycle]!, false)">Crear versión</button>
                </div>
              </article>
            }
          </div>
        </section>
      }

      @if (pending(); as action) {
        <div class="pa-overlay" (click)="close()" aria-hidden="true"></div>
        <section class="pa-dialog" role="dialog" aria-modal="true" aria-labelledby="pa-dialog-title">
          <h2 id="pa-dialog-title">{{ action.title }}</h2>
          <p>{{ action.detail }}</p>
          <label>Motivo (obligatorio, queda en la auditoría de plataforma)
            <textarea name="reason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="reason"></textarea>
          </label>
          @if (dialogError()) { <p class="pa-dialog-error" role="alert">{{ dialogError() }}</p> }
          <div class="pa-actions">
            <button type="button" (click)="close()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!validReason() || saving()" (click)="confirm()">{{ saving() ? 'Aplicando…' : 'Confirmar' }}</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-addons { display: grid; gap: 14px; }
    .pa-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pa-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pa-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pa-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 640px; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 9px 14px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    .pa-header button.primary { background: #62e3c4; border-color: #62e3c4; color: #0b2420; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .pa-notice { padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .pa-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pa-error button { margin-left: auto; }
    .pa-loading { display: flex; align-items: center; gap: 10px; padding: 40px; justify-content: center; color: #087f7b; }
    .spinner { width: 20px; height: 20px; border: 3px solid #dcebe8; border-top-color: #087f7b; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pa-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; display: grid; gap: 10px; min-width: 0; }
    .pa-panel h2 { margin: 0; font-size: 16px; color: #153a39; }
    .pa-panel h2 small { color: #6b8583; font-weight: 400; font-size: 12px; }
    .pa-panel h3 { margin: 0; font-size: 14px; }
    .pa-item-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .pa-item-head p { margin: 2px 0 0; font-size: 12px; color: #6b8583; }
    .pa-badge { align-self: flex-start; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; background: #def8ef; color: #047857; }
    .pa-badge.off { background: #edf2f5; color: #5a6d79; }
    label { display: grid; gap: 4px; font-size: 13px; font-weight: 700; color: #153a39; }
    input, select, textarea { border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; min-width: 0; }
    textarea { resize: vertical; }
    .pa-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .pa-row label { flex: 1 1 150px; }
    .pa-check { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; margin-right: 12px; }
    .pa-check input { width: auto; }
    fieldset { border: 1px solid #eef3f2; border-radius: 10px; padding: 8px 12px; margin: 0; }
    legend { font-size: 12px; font-weight: 800; color: #51717d; padding: 0 4px; }
    .pa-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .pa-hint { margin: 0; font-size: 12px; color: #51717d; }
    .pa-prices { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .pa-prices article { display: grid; gap: 8px; align-content: start; min-width: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #51717d; background: #f2f7f8; padding: 8px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eef3f2; }
    .num { text-align: right; white-space: nowrap; }
    .pa-overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .pa-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 480px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; display: grid; gap: 12px; }
    .pa-dialog h2 { margin: 0; font-size: 18px; }
    .pa-dialog p { margin: 0; font-size: 14px; color: #415e5a; }
    .pa-dialog-error { color: #991b1b !important; }
  `],
})
export class PlatformAddonsPage implements OnInit {
  private readonly api = inject(AddonsApiService);

  readonly items = signal<AddonCatalogItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal<PendingAction | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly planCodes = PLAN_CODES;
  readonly maxReason = MAX_REASON_LENGTH;
  reason = '';
  edits: Record<string, { name: string; description: string; active: boolean; sortOrder: number; plans: Set<string> }> = {};
  newPrice: Record<string, number | null> = {};
  createForm: {
    code: string; name: string; description: string; kind: 'RECURRING' | 'CONSUMABLE'; resourceKey: string; unitQuantity: number;
    validityMonths: number; prices: Record<string, number | null>; plans: Set<string>;
  } | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.catalog().subscribe({
      next: (items) => { this.setItems(items); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo cargar el catálogo de complementos.'); },
    });
  }

  private setItems(items: AddonCatalogItem[]): void {
    this.items.set(items);
    this.edits = Object.fromEntries(items.map((i) => [i.id, { name: i.name, description: i.description ?? '', active: i.active, sortOrder: i.sortOrder, plans: new Set(i.planCodes) }]));
  }

  private replace(item: AddonCatalogItem): void {
    const list = this.items();
    this.setItems(list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]);
  }

  startCreate(): void {
    this.createForm = { code: '', name: '', description: '', kind: 'RECURRING', resourceKey: 'maxStorageMB', unitQuantity: 1, validityMonths: 12, prices: {}, plans: new Set(['PRO']) };
  }

  onKind(): void { if (this.createForm?.kind === 'CONSUMABLE') this.createForm.resourceKey = 'maxOcrPagesPerMonth'; if (this.createForm) this.createForm.prices = {}; }

  createValid(): boolean {
    const f = this.createForm;
    return !!f && /^[A-Z][A-Z0-9_]{2,49}$/.test(f.code.trim()) && f.name.trim().length > 0 && Number(f.unitQuantity) >= 1
      && this.cyclesFor(f.kind).every((c) => isValidAmount(f.prices[c]) && Number(f.prices[c]) > 0);
  }

  create(): void {
    const f = this.createForm;
    if (!f || !this.createValid()) return;
    const body = {
      code: f.code.trim(), name: f.name.trim(), description: f.description.trim() || null, resourceKey: f.resourceKey,
      unitQuantity: Number(f.unitQuantity), kind: f.kind, validityMonths: f.kind === 'CONSUMABLE' ? Number(f.validityMonths) : null,
      planCodes: [...f.plans], prices: Object.fromEntries(this.cyclesFor(f.kind).map((c) => [c, Number(f.prices[c])])),
    };
    this.ask({
      title: `Crear el complemento ${body.code}`, detail: 'Se agrega al catálogo; publícalo en Stripe para venderlo con tarjeta.',
      run: (reason) => this.api.create({ ...body, reason }),
      done: (result) => { this.replace(result as AddonCatalogItem); this.createForm = null; },
    });
  }

  save(item: AddonCatalogItem): void {
    const e = this.edits[item.id];
    this.ask({
      title: `Guardar ${item.name}`, detail: e.active ? 'Se actualiza el catálogo que ven los clientes.' : 'Deja de venderse; quien lo tiene lo conserva.',
      run: (reason) => this.api.update(item.id, { name: e.name.trim(), description: e.description.trim() || null, planCodes: [...e.plans], active: e.active, sortOrder: Number(e.sortOrder) || 0, reason }),
      done: (result) => this.replace(result as AddonCatalogItem),
    });
  }

  price(item: AddonCatalogItem, cycle: string, amount: number, publish: boolean): void {
    this.ask({
      title: publish ? `Publicar ${item.name} en Stripe` : `Nuevo precio de ${item.name}`,
      detail: publish ? `Se crea en Stripe el precio vigente de ${this.usd(amount)}.`
        : `Se crea en Stripe un precio de ${this.usd(amount)} para nuevas compras; quien ya lo tiene conserva el suyo.`,
      run: (reason) => this.api.createPrice(item.id, cycle, Number(amount), reason),
      done: (result) => { this.replace(result as AddonCatalogItem); this.newPrice[item.id + cycle] = null; },
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

  togglePlan(set: Set<string>, plan: string): void { if (set.has(plan)) set.delete(plan); else set.add(plan); }
  cyclesFor(kind: string): string[] { return kind === 'CONSUMABLE' ? ['ONE_TIME'] : ['MONTHLY', 'ANNUAL']; }
  cycleLabel(cycle: string): string { return CYCLE_LABELS[cycle] ?? cycle; }
  history(item: AddonCatalogItem, cycle: string) { return item.prices.filter((p) => p.billingCycle === cycle); }
  current(item: AddonCatalogItem, cycle: string) { return item.prices.find((p) => p.billingCycle === cycle && !p.archivedAt) ?? null; }
  quantity(item: AddonCatalogItem): string { return quantityLabel(item.resourceKey, item.unitQuantity); }
  resource(key: string): string { return RESOURCE_LABELS[key] ?? key; }
  validAmount(value: number | null | undefined): boolean { return value !== null && value !== undefined && isValidAmount(value) && Number(value) > 0; }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }

  usd(value: number | null | undefined): string {
    return 'USD ' + (Number(value) || 0).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
