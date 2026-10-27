import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  PlatformMigrationResult, PlatformPermissionOption, PlatformPlan, PlatformPlansApiService, PlatformRoleTemplate,
  PlatformRoleTemplateCatalog,
} from '../../../core/api/platform-plans-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import {
  LIMIT_KEYS, LIMIT_LABELS, annualSavingsPercent, changedFeatures, changedLimits, featureLabel, grandfatheredTenants,
  groupByModule, isValidAmount, needsImpactConfirmation,
} from './platform-plans.logic';
import { MAX_REASON_LENGTH, isValidReason } from './platform-tenant.logic';

type Tab = 'plans' | 'templates';

/** Acción pendiente de motivo; accept = true repite la solicitud tras el aviso de impacto. */
interface PendingAction {
  title: string;
  detail: string;
  run: (reason: string, accept: boolean) => Observable<unknown>;
  done: (result: unknown) => void;
}

/**
 * Catálogo de planes editable (/platform/plans): datos, límites, funcionalidades y precios versionados,
 * más los grupos que se crean en cada organización nueva. Cada cambio pide motivo y queda auditado.
 */
@Component({
  selector: 'app-platform-plans-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page platform-plans">
      <header class="pp-header">
        <div>
          <span class="pp-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Planes y precios</h1>
          <p>Edita el catálogo que ven los clientes. Un precio nuevo se crea en Stripe y los clientes actuales conservan el suyo hasta que decidas migrarlos.</p>
        </div>
        <nav class="pp-tabs" aria-label="Secciones">
          <button type="button" [class.active]="tab() === 'plans'" (click)="tab.set('plans')">Planes</button>
          <button type="button" [class.active]="tab() === 'templates'" (click)="openTemplates()">Grupos por defecto</button>
        </nav>
      </header>

      @if (notice()) { <div class="pp-notice" role="status">{{ notice() }}</div> }
      @if (error()) {
        <div class="pp-error" role="alert">⚠ {{ error() }} <button type="button" (click)="reload()">Reintentar</button></div>
      }

      @if (tab() === 'plans') {
        @if (loading() && !plans().length) {
          <div class="pp-loading"><span class="spinner"></span> Cargando el catálogo de planes…</div>
        } @else {
          <div class="pp-plan-tabs" role="tablist">
            @for (plan of plans(); track plan.id) {
              <button type="button" role="tab" [attr.aria-selected]="plan.id === selectedId()" [class.active]="plan.id === selectedId()" (click)="select(plan)">
                <b>{{ plan.name }}</b>
                <small>{{ plan.code }} · {{ plan.tenants }} cliente(s){{ plan.active ? '' : ' · Fuera de venta' }}</small>
              </button>
            }
          </div>

          @if (selected(); as plan) {
            <div class="pp-grid">
              <section class="pp-panel">
                <h2>Datos del plan</h2>
                <label>Nombre<input name="planName" maxlength="100" [(ngModel)]="form.name" /></label>
                <label>Descripción<textarea name="planDescription" rows="3" maxlength="2000" [(ngModel)]="form.description"></textarea></label>
                <div class="pp-row">
                  <label>Orden<input type="number" name="sortOrder" min="0" [(ngModel)]="form.sortOrder" /></label>
                  <label class="pp-check"><input type="checkbox" name="active" [(ngModel)]="form.active" /> Disponible para nuevas ventas</label>
                </div>
                @if (!form.active && plan.tenants) {
                  <p class="pp-hint">Retirarlo de la venta no afecta a los {{ plan.tenants }} cliente(s) que ya lo tienen.</p>
                }
                <div class="pp-actions"><button type="button" class="primary" (click)="savePlan(plan)">Guardar datos</button></div>
              </section>

              <section class="pp-panel">
                <h2>Límites</h2>
                <p class="pp-hint">-1 significa ilimitado. Bajar un límite no bloquea a quien ya lo supera: solo le impide crecer.</p>
                @for (key of limitKeys; track key) {
                  <label>{{ limitLabel(key) }}<input type="number" min="-1" step="1" [name]="'limit-' + key" [(ngModel)]="limits[key]" /></label>
                }
                <div class="pp-actions"><button type="button" class="primary" (click)="saveLimits(plan)">Guardar límites</button></div>
              </section>

              <section class="pp-panel">
                <h2>Funcionalidades</h2>
                <p class="pp-hint">Al retirar una, sus permisos dejan de concederse de inmediato en la base y desaparecen del menú al renovar sesión.</p>
                @for (feature of plan.features; track feature.key) {
                  <label class="pp-check"><input type="checkbox" [name]="'feature-' + feature.key" [(ngModel)]="features[feature.key]" /> {{ featureName(feature.key) }}</label>
                }
                <div class="pp-actions"><button type="button" class="primary" (click)="saveFeatures(plan)">Guardar funcionalidades</button></div>
              </section>

              <section class="pp-panel pp-prices">
                <h2>Precios</h2>
                @for (cycle of cycles; track cycle) {
                  <article>
                    <header>
                      <h3>{{ cycle === 'ANNUAL' ? 'Anual' : 'Mensual' }}</h3>
                      @if (current(plan, cycle); as price) {
                        <b>{{ usd(price.amountUsd) }}</b>
                        <small>{{ price.stripePriceId ? 'En Stripe' : 'Sin precio propio en Stripe (usa la configuración del servidor)' }}</small>
                      }
                    </header>
                    @if (cycle === 'ANNUAL' && savings(plan) > 0) { <p class="pp-hint">Ahorro frente a 12 meses: {{ savings(plan) }} %</p> }
                    <div class="pp-row">
                      <label>Precio nuevo (USD)<input type="number" min="0" step="0.01" [name]="'price-' + cycle" [(ngModel)]="newPrice[cycle]" /></label>
                      <button type="button" class="primary" [disabled]="!validAmount(newPrice[cycle])" (click)="createPrice(plan, cycle)">Crear versión</button>
                    </div>
                    <table>
                      <thead><tr><th>Desde</th><th class="num">Precio</th><th>Estado</th><th class="num">Clientes</th><th></th></tr></thead>
                      <tbody>
                        @for (price of history(plan, cycle); track price.id) {
                          <tr>
                            <td>{{ date(price.effectiveFrom) }}</td>
                            <td class="num">{{ usd(price.amountUsd) }}</td>
                            <td>{{ price.archivedAt ? 'Archivado el ' + date(price.archivedAt) : 'Vigente' }}</td>
                            <td class="num">{{ price.tenants }}@if (price.pendingMigration) { <small> (+{{ price.pendingMigration }} programados)</small> }</td>
                            <td>
                              @if (!price.archivedAt && price.stripePriceId && grandfathered(plan, cycle) > 0) {
                                <button type="button" class="link" (click)="migrate(plan, price.id, cycle)">Migrar clientes</button>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </article>
                }
              </section>
            </div>
          }
        }
      }

      @if (tab() === 'templates') {
        @if (!catalog()) {
          <div class="pp-loading"><span class="spinner"></span> Cargando los grupos por defecto…</div>
        } @else {
          <section class="pp-panel">
            <h2>Grupos que se crean en cada organización nueva</h2>
            <p class="pp-hint">Además de «Administrador de tenant», que recibe todos los permisos del plan. Cada grupo recibe solo los permisos que su plan habilita. Los cambios no afectan a organizaciones ya creadas. No se crean permisos nuevos desde aquí.</p>
            <ul class="pp-templates">
              @for (template of catalog()!.templates; track template.id) {
                <li>
                  <div><b>{{ template.name }}</b>@if (!template.active) { <small> · Inactiva</small> }<span>{{ template.description || '—' }}</span><small>{{ template.permissionCodes.length }} permiso(s)</small></div>
                  <div class="pp-actions">
                    <button type="button" (click)="editTemplate(template)">Editar</button>
                    <button type="button" class="danger" (click)="deleteTemplate(template)">Eliminar</button>
                  </div>
                </li>
              } @empty { <li class="pp-empty">No hay grupos por defecto.</li> }
            </ul>
            <div class="pp-actions"><button type="button" class="primary" (click)="editTemplate(null)">+ Nuevo grupo</button></div>
          </section>

          @if (templateForm) {
            <section class="pp-panel">
              <h2>{{ templateForm.id ? 'Editar grupo' : 'Nuevo grupo' }}</h2>
              <div class="pp-row">
                <label>Nombre<input name="templateName" maxlength="80" [(ngModel)]="templateForm.name" /></label>
                <label>Orden<input type="number" name="templateOrder" min="0" [(ngModel)]="templateForm.sortOrder" /></label>
                <label class="pp-check"><input type="checkbox" name="templateActive" [(ngModel)]="templateForm.active" /> Activo</label>
              </div>
              <label>Descripción<input name="templateDescription" maxlength="255" [(ngModel)]="templateForm.description" /></label>
              <div class="pp-permissions">
                @for (group of permissionGroups(); track group.module) {
                  <fieldset>
                    <legend>{{ group.module }}</legend>
                    @for (permission of group.items; track permission.code) {
                      <label class="pp-check" [title]="permission.description || permission.code">
                        <input type="checkbox" [checked]="templateForm.codes.has(permission.code)" (change)="toggleCode(permission.code)" />
                        {{ permission.code }}
                        @if (permission.requiredFeature) { <small>({{ featureName(permission.requiredFeature) }})</small> }
                      </label>
                    }
                  </fieldset>
                }
              </div>
              <div class="pp-actions">
                <button type="button" (click)="templateForm = null">Cancelar</button>
                <button type="button" class="primary" [disabled]="templateForm.name.trim().length < 3 || !templateForm.codes.size" (click)="saveTemplate()">Guardar grupo</button>
              </div>
            </section>
          }
        }
      }

      @if (pending(); as action) {
        <div class="pp-overlay" (click)="closeDialog()" aria-hidden="true"></div>
        <section class="pp-dialog" role="dialog" aria-modal="true" aria-labelledby="pp-dialog-title">
          <h2 id="pp-dialog-title">{{ action.title }}</h2>
          <p>{{ action.detail }}</p>
          @if (impact()) {
            <div class="pp-hint warn" role="alert">
              <p>{{ impact()!.message }}</p>
              @if (impact()!.examples.length) { <p class="pp-examples">{{ impact()!.examples.join(', ') }}</p> }
            </div>
          }
          <label>Motivo (obligatorio, queda en la auditoría de plataforma)
            <textarea name="reason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="reason"></textarea>
          </label>
          @if (dialogError()) { <p class="pp-dialog-error" role="alert">{{ dialogError() }}</p> }
          <div class="pp-actions">
            <button type="button" (click)="closeDialog()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!validReason() || saving()" (click)="confirm()">
              {{ saving() ? 'Aplicando…' : impact() ? 'Aplicar de todos modos' : 'Confirmar' }}
            </button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-plans { display: grid; gap: 14px; }
    .pp-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pp-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pp-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pp-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 640px; }
    .pp-tabs { display: flex; gap: 6px; }
    .pp-tabs button { background: rgba(255, 255, 255, .1); border-color: rgba(255, 255, 255, .2); color: #e6fbf3; }
    .pp-tabs button.active { background: #62e3c4; border-color: #62e3c4; color: #0b2420; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 9px 14px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    button.danger { border-color: #e5b4b4; color: #9f1d1d; }
    button.link { border: 0; background: none; color: #087f7b; padding: 0; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .pp-notice { padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .pp-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pp-error button { margin-left: auto; }
    .pp-loading { display: flex; align-items: center; gap: 10px; padding: 40px; justify-content: center; color: #087f7b; }
    .spinner { width: 20px; height: 20px; border: 3px solid #dcebe8; border-top-color: #087f7b; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pp-plan-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .pp-plan-tabs button { display: grid; gap: 2px; text-align: left; min-width: 160px; }
    .pp-plan-tabs button small { font-weight: 400; color: #6b8583; }
    .pp-plan-tabs button.active { border-color: #087f7b; box-shadow: inset 0 0 0 1px #087f7b; }
    .pp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .pp-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; display: grid; gap: 10px; align-content: start; min-width: 0; }
    .pp-panel h2 { margin: 0; font-size: 16px; color: #153a39; }
    .pp-panel h3 { margin: 0; font-size: 14px; color: #153a39; }
    label { display: grid; gap: 4px; font-size: 13px; font-weight: 700; color: #153a39; }
    input, textarea, select { border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; min-width: 0; }
    textarea { resize: vertical; }
    .pp-check { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .pp-check input { width: auto; }
    .pp-check small { color: #6b8583; font-weight: 400; }
    .pp-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .pp-row label { flex: 1 1 140px; }
    .pp-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .pp-hint { margin: 0; font-size: 12px; color: #51717d; }
    .pp-hint.warn { padding: 10px 12px; border-radius: 10px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 13px; }
    .pp-hint.warn p { margin: 0; }
    .pp-examples { margin-top: 6px !important; font-size: 12px; }
    .pp-prices { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .pp-prices > h2 { grid-column: 1 / -1; }
    .pp-prices article { display: grid; gap: 10px; align-content: start; min-width: 0; }
    .pp-prices article header { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .pp-prices article header b { font-size: 20px; color: #087f7b; }
    .pp-prices article header small { color: #6b8583; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #51717d; background: #f2f7f8; padding: 8px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eef3f2; color: #153a39; }
    td small { color: #6b8583; }
    .num { text-align: right; white-space: nowrap; }
    .pp-templates { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .pp-templates li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid #eef3f2; border-radius: 10px; flex-wrap: wrap; }
    .pp-templates li > div:first-child { display: grid; gap: 2px; font-size: 13px; }
    .pp-templates span, .pp-templates small { color: #6b8583; }
    .pp-empty { color: #6b8583; justify-content: center; }
    .pp-permissions { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    fieldset { border: 1px solid #eef3f2; border-radius: 10px; padding: 8px 12px; display: grid; gap: 4px; margin: 0; min-width: 0; }
    legend { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #51717d; padding: 0 4px; }
    fieldset .pp-check { font-size: 12px; overflow-wrap: anywhere; }
    .pp-overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .pp-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 500px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; display: grid; gap: 12px; max-height: calc(100vh - 32px); overflow-y: auto; }
    .pp-dialog h2 { margin: 0; font-size: 18px; }
    .pp-dialog > p { margin: 0; font-size: 14px; color: #415e5a; }
    .pp-dialog-error { color: #991b1b; margin: 0; }
    @media (max-width: 1100px) { .pp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .pp-grid, .pp-prices { grid-template-columns: 1fr; } .pp-plan-tabs button { flex: 1 1 100%; } }
  `],
})
export class PlatformPlansPage implements OnInit {
  private readonly api = inject(PlatformPlansApiService);

  readonly tab = signal<Tab>('plans');
  readonly plans = signal<PlatformPlan[]>([]);
  readonly selectedId = signal('');
  readonly catalog = signal<PlatformRoleTemplateCatalog | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal<PendingAction | null>(null);
  readonly impact = signal<{ message: string; examples: string[] } | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly limitKeys = LIMIT_KEYS;
  readonly cycles = ['MONTHLY', 'ANNUAL'] as const;
  readonly maxReason = MAX_REASON_LENGTH;
  reason = '';
  form = { name: '', description: '', active: true, sortOrder: 0 };
  limits: Record<string, number> = {};
  features: Record<string, boolean> = {};
  newPrice: Record<string, number | null> = { MONTHLY: null, ANNUAL: null };
  templateForm: { id: string | null; name: string; description: string; active: boolean; sortOrder: number; codes: Set<string> } | null = null;

  readonly selected = computed(() => this.plans().find((p) => p.id === this.selectedId()) ?? null);
  readonly permissionGroups = computed(() => groupByModule<PlatformPermissionOption>(this.catalog()?.permissions ?? []));

  ngOnInit(): void { this.loadPlans(); }

  reload(): void { if (this.tab() === 'plans') this.loadPlans(); else this.loadTemplates(); }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.plans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
        const keep = plans.find((p) => p.id === this.selectedId()) ?? plans[0];
        if (keep) this.select(keep);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo cargar el catálogo de planes.');
      },
    });
  }

  select(plan: PlatformPlan): void {
    this.selectedId.set(plan.id);
    this.form = { name: plan.name, description: plan.description ?? '', active: plan.active, sortOrder: plan.sortOrder };
    this.limits = { ...plan.limits };
    this.features = Object.fromEntries(plan.features.map((f) => [f.key, f.enabled]));
    this.newPrice = { MONTHLY: null, ANNUAL: null };
  }

  private replace(plan: PlatformPlan): void {
    this.plans.update((list) => list.map((p) => (p.id === plan.id ? plan : p)));
    this.select(plan);
  }

  savePlan(plan: PlatformPlan): void {
    if (this.form.name.trim().length < 1) { this.notice.set(''); this.error.set('El nombre del plan es obligatorio.'); return; }
    const body = { name: this.form.name.trim(), description: this.form.description.trim() || null, active: this.form.active, sortOrder: Number(this.form.sortOrder) || 0 };
    this.ask({
      title: `Guardar datos de ${plan.name}`,
      detail: body.active === plan.active ? 'Se actualizan nombre, descripción y orden en el catálogo público.'
        : body.active ? 'El plan vuelve a estar disponible para nuevas ventas.' : 'El plan deja de venderse; los clientes actuales lo conservan.',
      run: (reason) => this.api.updatePlan(plan.id, { ...body, reason }),
      done: (result) => this.replace(result as PlatformPlan),
    });
  }

  saveLimits(plan: PlatformPlan): void {
    const changes = changedLimits(plan.limits, this.limits);
    if (!changes) { this.error.set('Los límites deben ser números enteros iguales o mayores que -1.'); return; }
    if (!Object.keys(changes).length) { this.error.set('No hay cambios en los límites.'); return; }
    this.error.set('');
    this.ask({
      title: `Guardar límites de ${plan.name}`,
      detail: Object.entries(changes).map(([k, v]) => `${this.limitLabel(k)}: ${plan.limits[k]} → ${v}`).join(' · '),
      run: (reason, accept) => this.api.updateLimits(plan.id, changes, accept, reason),
      done: (result) => this.replace(result as PlatformPlan),
    });
  }

  saveFeatures(plan: PlatformPlan): void {
    const changes = changedFeatures(plan.features, this.features);
    if (!Object.keys(changes).length) { this.error.set('No hay cambios en las funcionalidades.'); return; }
    this.error.set('');
    this.ask({
      title: `Guardar funcionalidades de ${plan.name}`,
      detail: Object.entries(changes).map(([k, v]) => `${v ? 'Activar' : 'Retirar'}: ${this.featureName(k)}`).join(' · '),
      run: (reason, accept) => this.api.updateFeatures(plan.id, changes, accept, reason),
      done: (result) => this.replace(result as PlatformPlan),
    });
  }

  createPrice(plan: PlatformPlan, cycle: 'MONTHLY' | 'ANNUAL'): void {
    const amount = Number(this.newPrice[cycle]);
    if (!isValidAmount(amount)) return;
    this.ask({
      title: `Nuevo precio ${cycle === 'ANNUAL' ? 'anual' : 'mensual'} de ${plan.name}`,
      detail: `Se crea en Stripe un precio de ${this.usd(amount)} para nuevas ventas. Los clientes actuales conservan su precio hasta que los migres.`,
      run: (reason) => this.api.createPrice(plan.id, cycle, amount, reason),
      done: (result) => this.replace(result as PlatformPlan),
    });
  }

  migrate(plan: PlatformPlan, priceId: string, cycle: string): void {
    this.ask({
      title: 'Migrar clientes al precio vigente',
      detail: `${this.grandfathered(plan, cycle)} cliente(s) con un precio anterior pasarán al vigente en su primera renovación con al menos 30 días de aviso. Se les avisa por correo y notificación.`,
      run: (reason) => this.api.migrate(priceId, reason),
      done: (result) => {
        const r = result as PlatformMigrationResult;
        const skipped = r.skipped.map((s) => `${s.tenant}: ${s.reason}`).join('; ');
        this.notice.set(`Migración programada para ${r.scheduled} cliente(s).${skipped ? ' Omitidos: ' + skipped : ''}`);
        this.loadPlans();
      },
    });
  }

  // ------------------------------------------------------------ plantillas

  openTemplates(): void {
    this.tab.set('templates');
    if (!this.catalog()) this.loadTemplates();
  }

  loadTemplates(): void {
    this.error.set('');
    this.api.roleTemplates().subscribe({
      next: (catalog) => this.catalog.set(catalog),
      error: (err: HttpErrorResponse) => this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudieron cargar los grupos por defecto.'),
    });
  }

  editTemplate(template: PlatformRoleTemplate | null): void {
    this.templateForm = template
      ? { id: template.id, name: template.name, description: template.description ?? '', active: template.active, sortOrder: template.sortOrder, codes: new Set(template.permissionCodes) }
      : { id: null, name: '', description: '', active: true, sortOrder: (this.catalog()?.templates.length ?? 0) + 1, codes: new Set() };
  }

  toggleCode(code: string): void {
    if (!this.templateForm) return;
    const codes = new Set(this.templateForm.codes);
    if (codes.has(code)) codes.delete(code); else codes.add(code);
    this.templateForm = { ...this.templateForm, codes };
  }

  saveTemplate(): void {
    const form = this.templateForm;
    if (!form) return;
    const body = { name: form.name.trim(), description: form.description.trim() || null, permissionCodes: [...form.codes].sort(),
      active: form.active, sortOrder: Number(form.sortOrder) || 0 };
    this.ask({
      title: form.id ? `Guardar el grupo ${body.name}` : `Crear el grupo ${body.name}`,
      detail: `${body.permissionCodes.length} permiso(s). Se aplicará a las organizaciones que se creen desde ahora.`,
      run: (reason) => form.id ? this.api.updateRoleTemplate(form.id, { ...body, reason }) : this.api.createRoleTemplate({ ...body, reason }),
      done: (result) => { this.catalog.set(result as PlatformRoleTemplateCatalog); this.templateForm = null; },
    });
  }

  deleteTemplate(template: PlatformRoleTemplate): void {
    this.ask({
      title: `Eliminar el grupo ${template.name}`,
      detail: 'Las organizaciones nuevas ya no lo recibirán. Las existentes conservan su grupo.',
      run: (reason) => this.api.deleteRoleTemplate(template.id, reason),
      done: (result) => this.catalog.set(result as PlatformRoleTemplateCatalog),
    });
  }

  // --------------------------------------------------------------- diálogo

  private ask(action: PendingAction): void {
    this.reason = '';
    this.impact.set(null);
    this.dialogError.set('');
    this.notice.set('');
    this.pending.set(action);
  }

  closeDialog(): void { if (!this.saving()) this.pending.set(null); }

  validReason(): boolean { return isValidReason(this.reason); }

  confirm(): void {
    const action = this.pending();
    if (!action || !this.validReason()) return;
    this.saving.set(true);
    this.dialogError.set('');
    action.run(this.reason.trim(), !!this.impact()).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.pending.set(null);
        action.done(result);
        if (!this.notice()) this.notice.set('Cambio aplicado y registrado en la auditoría de plataforma.');
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (needsImpactConfirmation(err.status, err.error)) {
          this.impact.set({ message: err.error?.message ?? 'El cambio afecta a organizaciones existentes.', examples: err.error?.examples ?? [] });
          return;
        }
        this.dialogError.set(friendlyApiMessage(err.error?.message) || 'No se pudo aplicar el cambio.');
      },
    });
  }

  // ------------------------------------------------------------- utilidades

  current(plan: PlatformPlan, cycle: string) { return plan.prices.find((p) => p.billingCycle === cycle && !p.archivedAt) ?? null; }
  history(plan: PlatformPlan, cycle: string) { return plan.prices.filter((p) => p.billingCycle === cycle); }
  grandfathered(plan: PlatformPlan, cycle: string): number { return grandfatheredTenants(plan.prices, cycle); }
  savings(plan: PlatformPlan): number {
    return annualSavingsPercent(Number(this.current(plan, 'MONTHLY')?.amountUsd), Number(this.current(plan, 'ANNUAL')?.amountUsd));
  }
  validAmount(value: number | null): boolean { return value !== null && isValidAmount(value); }
  limitLabel(key: string): string { return LIMIT_LABELS[key] ?? key; }
  featureName(key: string): string { return featureLabel(key); }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }

  usd(value: number | null | undefined): string {
    return 'USD ' + (Number(value) || 0).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
