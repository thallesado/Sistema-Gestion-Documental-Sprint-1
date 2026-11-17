import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AdministrationApiService } from '../../../core/api/administration-api.service';
import { SupportAccessApiService, SupportAccessRequest, SupportModule } from '../../../core/api/support-access-api.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { SUPPORT_STATUS_LABELS, supportRequestError, supportSessionUrl } from '../../auth/pages/support-session.logic';
import { MAX_REASON_LENGTH, isValidReason } from './platform-tenant.logic';

interface PendingAction { title: string; detail: string; run: (reason: string) => Observable<unknown> }

/**
 * Acceso de soporte con consentimiento (/platform/support-access): solicitar acceso de solo lectura a una
 * organización, abrir la sesión cuando la organización lo aprueba y las emergencias con doble aprobación.
 */
@Component({
  selector: 'app-platform-support-access-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page platform-support">
      <header class="ps-header">
        <div>
          <span class="ps-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Acceso de soporte</h1>
          <p>Para ver datos de una organización hace falta su aprobación. El acceso es de solo lectura, a los módulos pedidos, vence solo y cada acción queda en la auditoría de la organización.</p>
        </div>
        @if (canRequest) { <button type="button" class="primary" (click)="showForm.set(!showForm())">+ Solicitar acceso</button> }
      </header>

      @if (notice()) { <div class="ps-notice" role="status">{{ notice() }}</div> }
      @if (error()) { <div class="ps-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }

      @if (showForm()) {
        <section class="ps-panel">
          <h2>Nueva solicitud</h2>
          <div class="ps-row">
            <label>Organización
              <select name="tenant" [(ngModel)]="form.tenantId">
                <option value="">Elegir…</option>
                @for (t of tenants(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
              </select>
            </label>
            <label>Duración
              <select name="minutes" [(ngModel)]="form.minutes">
                <option [ngValue]="30">30 minutos</option><option [ngValue]="60">1 hora</option>
                <option [ngValue]="120">2 horas</option><option [ngValue]="240">4 horas</option>
              </select>
            </label>
          </div>
          <fieldset><legend>Módulos (solo lectura)</legend>
            @for (m of modules(); track m.code) {
              <label class="ps-check"><input type="checkbox" [checked]="form.modules.includes(m.code)" (change)="toggle(m.code)" /> {{ m.label }}</label>
            }
          </fieldset>
          <label>Motivo (lo ve la organización)
            <textarea name="reason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="form.reason"></textarea>
          </label>
          <label class="ps-check ps-danger"><input type="checkbox" name="breakGlass" [(ngModel)]="form.breakGlass" />
            Emergencia (break-glass): sin aprobación previa de la organización</label>
          @if (form.breakGlass) {
            <p class="ps-warn">Necesita la aprobación de un superadministrador y de otra persona con otro rol. Al activarse se avisa de inmediato a la organización, que puede revocarlo.</p>
          }
          @if (formError()) { <p class="ps-form-error">{{ formError() }}</p> }
          <div class="ps-actions">
            <button type="button" (click)="showForm.set(false)">Cancelar</button>
            <button type="button" class="primary" [disabled]="!!formError() || saving()" (click)="submit()">Enviar solicitud</button>
          </div>
        </section>
      }

      <section class="ps-panel">
        <h2>Solicitudes</h2>
        @if (loading() && !requests().length) { <p class="ps-muted">Cargando solicitudes…</p> }
        <div class="ps-table">
          <table>
            <thead><tr><th>Organización</th><th>Módulos</th><th>Solicitó</th><th>Estado</th><th>Vigencia</th><th></th></tr></thead>
            <tbody>
              @for (r of requests(); track r.id) {
                <tr>
                  <td><a [routerLink]="['/platform/tenants', r.tenantId]">{{ r.tenantName }}</a>
                    @if (r.breakGlass) { <small class="ps-tag">Emergencia</small> }<small>{{ r.reason }}</small></td>
                  <td>{{ moduleLabels(r.modules) }}<small>{{ r.durationMinutes }} min</small></td>
                  <td>{{ r.requestedBy }}<small>{{ dateTime(r.createdAt) }}</small></td>
                  <td>{{ status(r.status) }}
                    @if (r.decidedBy) { <small>{{ r.decidedBy }}</small> }
                    @for (a of r.approvals; track a.approver) { <small>✓ {{ a.approver }} ({{ a.roleCode }})</small> }</td>
                  <td>@if (r.expiresAt) { {{ dateTime(r.startsAt) }} → {{ dateTime(r.expiresAt) }} } @else { — }</td>
                  <td class="ps-row-actions">
                    @if (r.canStartSession) { <button type="button" class="primary" (click)="open(r)">Abrir sesión</button> }
                    @if (r.status === 'PENDING_INTERNAL' && !r.mine) { <button type="button" (click)="approveInternal(r)">Aprobar emergencia</button> }
                    @if (r.mine && (r.status === 'PENDING_TENANT' || r.status === 'PENDING_INTERNAL' || r.status === 'APPROVED')) {
                      <button type="button" class="link" (click)="cancel(r)">Anular</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="ps-muted">No hay solicitudes de acceso de soporte.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (pending(); as action) {
        <div class="ps-overlay" (click)="close()" aria-hidden="true"></div>
        <section class="ps-dialog" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title">
          <h2 id="ps-dialog-title">{{ action.title }}</h2>
          <p>{{ action.detail }}</p>
          <label>Motivo (obligatorio, queda en la auditoría de plataforma)
            <textarea name="dialogReason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="reason"></textarea>
          </label>
          @if (dialogError()) { <p class="ps-form-error" role="alert">{{ dialogError() }}</p> }
          <div class="ps-actions">
            <button type="button" (click)="close()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!validReason() || saving()" (click)="confirm()">{{ saving() ? 'Aplicando…' : 'Confirmar' }}</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-support { display: grid; gap: 14px; }
    .ps-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .ps-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .ps-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .ps-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 700px; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 8px 12px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    button.link { border: 0; background: none; color: #087f7b; padding: 0; }
    .ps-header button.primary { background: #62e3c4; border-color: #62e3c4; color: #0b2420; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .ps-notice { padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .ps-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .ps-error button { margin-left: auto; }
    .ps-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; display: grid; gap: 10px; min-width: 0; }
    .ps-panel h2 { margin: 0; font-size: 16px; color: #153a39; }
    label { display: grid; gap: 4px; font-size: 13px; font-weight: 700; color: #153a39; }
    input, select, textarea { border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; min-width: 0; }
    .ps-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .ps-row label { flex: 1 1 200px; }
    .ps-check { display: inline-flex !important; align-items: center; gap: 6px; font-weight: 600; margin-right: 14px; }
    .ps-danger { color: #9a3412; }
    .ps-warn { margin: 0; padding: 8px 12px; border-radius: 9px; background: #fff7ed; color: #9a3412; font-size: 13px; }
    fieldset { border: 1px solid #eef3f2; border-radius: 10px; padding: 8px 12px; margin: 0; }
    legend { font-size: 12px; font-weight: 800; color: #51717d; padding: 0 4px; }
    .ps-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .ps-muted { margin: 0; font-size: 13px; color: #51717d; }
    .ps-form-error { margin: 0; font-size: 13px; color: #991b1b; }
    .ps-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #51717d; background: #f2f7f8; padding: 8px 10px; white-space: nowrap; }
    td { padding: 8px 10px; border-bottom: 1px solid #eef3f2; vertical-align: top; }
    td small { display: block; color: #6b8583; font-size: 12px; }
    td a { color: #087f7b; font-weight: 700; }
    .ps-tag { display: inline-block !important; margin-left: 6px; padding: 1px 8px; border-radius: 999px; background: #fee2e2; color: #991b1b !important; font-weight: 800; }
    .ps-row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .ps-overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .ps-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 480px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; display: grid; gap: 12px; }
    .ps-dialog h2 { margin: 0; font-size: 18px; }
    .ps-dialog p { margin: 0; font-size: 14px; color: #415e5a; }
  `],
})
export class PlatformSupportAccessPage implements OnInit {
  private readonly api = inject(SupportAccessApiService);
  private readonly administration = inject(AdministrationApiService);
  private readonly route = inject(ActivatedRoute);
  readonly canRequest = inject(PermissionService).can('platform:support:access');

  readonly requests = signal<SupportAccessRequest[]>([]);
  readonly modules = signal<SupportModule[]>([]);
  readonly tenants = signal<{ id: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly showForm = signal(false);
  readonly pending = signal<PendingAction | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly maxReason = MAX_REASON_LENGTH;
  reason = '';
  form = { tenantId: '', modules: [] as string[], minutes: 120, breakGlass: false, reason: '' };

  ngOnInit(): void {
    const tenant = this.route.snapshot.queryParamMap.get('tenantId');
    if (tenant) { this.form.tenantId = tenant; this.showForm.set(this.canRequest); }
    this.api.modules().subscribe({ next: (m) => this.modules.set(m), error: () => undefined });
    this.administration.tenants().subscribe({
      next: (list) => this.tenants.set(list.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name))),
      error: () => undefined,
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list().subscribe({
      next: (list) => { this.requests.set(list); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudieron cargar las solicitudes.'); },
    });
  }

  formError(): string | null { return supportRequestError(this.form.tenantId, this.form.modules, this.form.minutes, this.form.reason); }

  toggle(code: string): void {
    this.form.modules = this.form.modules.includes(code) ? this.form.modules.filter((m) => m !== code) : [...this.form.modules, code];
  }

  submit(): void {
    if (this.formError()) return;
    this.saving.set(true);
    this.api.request({ tenantId: this.form.tenantId, modules: this.form.modules, durationMinutes: Number(this.form.minutes),
      breakGlass: this.form.breakGlass, reason: this.form.reason.trim() }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.showForm.set(false);
        this.notice.set(created.breakGlass ? 'Emergencia registrada: espera las dos aprobaciones internas.'
          : 'Solicitud enviada: la organización debe aprobarla en su Configuración.');
        this.form = { tenantId: '', modules: [], minutes: 120, breakGlass: false, reason: '' };
        this.load();
      },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo enviar la solicitud.'); },
    });
  }

  /** La sesión se abre en otra pestaña: la de plataforma sigue con su propia sesión. */
  open(r: SupportAccessRequest): void {
    this.api.session(r.id).subscribe({
      next: (session) => { window.open(supportSessionUrl(session.token), '_blank', 'noopener'); },
      error: (err: HttpErrorResponse) => this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo abrir la sesión de soporte.'),
    });
  }

  approveInternal(r: SupportAccessRequest): void {
    this.ask({
      title: `Aprobar la emergencia en ${r.tenantName}`,
      detail: 'Con la aprobación de un superadministrador y la de otro rol, el acceso se activa y la organización recibe el aviso en ese momento.',
      run: (reason) => this.api.approveInternal(r.id, reason),
    });
  }

  cancel(r: SupportAccessRequest): void {
    this.ask({
      title: `Anular el acceso a ${r.tenantName}`, detail: 'Si estaba vigente, la sesión de soporte deja de funcionar de inmediato.',
      run: (reason) => this.api.cancel(r.id, reason),
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
      next: () => { this.saving.set(false); this.pending.set(null); this.notice.set('Cambio aplicado y registrado en la auditoría de plataforma.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.dialogError.set(friendlyApiMessage(err.error?.message) || 'No se pudo aplicar el cambio.'); },
    });
  }

  moduleLabels(codes: string[]): string {
    return codes.map((code) => this.modules().find((m) => m.code === code)?.label ?? code).join(', ');
  }

  status(value: string): string { return SUPPORT_STATUS_LABELS[value] ?? value; }

  dateTime(value: string | null): string {
    return value ? new Date(value).toLocaleString(activeLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  }
}
