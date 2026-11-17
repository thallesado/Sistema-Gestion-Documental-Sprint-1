import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { PlatformMember, PlatformTeam, SupportAccessApiService } from '../../../core/api/support-access-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { MAX_REASON_LENGTH, isValidReason } from './platform-tenant.logic';
import { ROLE_LABELS, memberFormError } from './platform-team.logic';

interface PendingAction { title: string; detail: string; run: (reason: string) => Observable<PlatformTeam> }

/** Equipo de plataforma (/platform/team): cuentas internas, rol, activación y doble factor. Solo superadministrador. */
@Component({
  selector: 'app-platform-team-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page platform-team">
      <header class="pt-header">
        <div>
          <span class="pt-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Equipo de plataforma</h1>
          <p>Cada cuenta interna tiene un rol que limita lo que puede hacer. Todas entran con doble factor obligatorio.</p>
        </div>
        <button type="button" class="primary" (click)="showForm.set(!showForm())">+ Nueva cuenta</button>
      </header>

      @if (notice()) { <div class="pt-notice" role="status">{{ notice() }}</div> }
      @if (error()) { <div class="pt-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }

      @if (showForm()) {
        <section class="pt-panel">
          <h2>Nueva cuenta de plataforma</h2>
          <div class="pt-row">
            <label>Nombre<input name="first" maxlength="100" [(ngModel)]="form.firstName" /></label>
            <label>Apellido<input name="last" maxlength="100" [(ngModel)]="form.lastName" /></label>
            <label>Usuario<input name="username" maxlength="60" [(ngModel)]="form.username" /></label>
            <label>Correo<input name="email" type="email" maxlength="150" [(ngModel)]="form.email" /></label>
          </div>
          <div class="pt-row">
            <label>Rol
              <select name="role" [(ngModel)]="form.roleCode">
                @for (r of team()?.roles ?? []; track r.code) { <option [value]="r.code">{{ roleLabel(r.code) }}</option> }
              </select>
            </label>
            <label>Contraseña temporal<input name="password" type="password" autocomplete="new-password" [(ngModel)]="form.temporaryPassword" /></label>
          </div>
          <p class="pt-hint">Al entrar por primera vez cambia la contraseña y registra su doble factor.</p>
          @if (formError()) { <p class="pt-form-error">{{ formError() }}</p> }
          <div class="pt-actions">
            <button type="button" (click)="showForm.set(false)">Cancelar</button>
            <button type="button" class="primary" [disabled]="!!formError()" (click)="create()">Crear cuenta</button>
          </div>
        </section>
      }

      <section class="pt-panel">
        <h2>Cuentas</h2>
        @if (loading() && !team()) { <p class="pt-hint">Cargando equipo…</p> }
        <div class="pt-table">
          <table>
            <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Doble factor</th><th>Último acceso</th><th></th></tr></thead>
            <tbody>
              @for (m of team()?.members ?? []; track m.id) {
                <tr>
                  <td><b>{{ m.fullName || m.username }}</b><small>{{ m.username }} · {{ m.email }}</small></td>
                  <td>
                    @if (m.id === me) { {{ roleLabel(m.roleCode) }} }
                    @else {
                      <select [name]="'r-' + m.id" [ngModel]="m.roleCode" (ngModelChange)="changeRole(m, $event)" aria-label="Rol">
                        @for (r of team()?.roles ?? []; track r.code) { <option [value]="r.code">{{ roleLabel(r.code) }}</option> }
                      </select>
                    }
                  </td>
                  <td>{{ m.status === 'ACTIVE' ? 'Activa' : 'Inactiva' }}</td>
                  <td>{{ m.mfaEnabled ? 'Activo' : 'Pendiente de registrar' }}</td>
                  <td>{{ date(m.lastLoginAt) }}</td>
                  <td class="pt-row-actions">
                    @if (m.id !== me) {
                      <button type="button" (click)="toggleStatus(m)">{{ m.status === 'ACTIVE' ? 'Desactivar' : 'Activar' }}</button>
                      @if (m.mfaEnabled) { <button type="button" class="link" (click)="resetMfa(m)">Reiniciar doble factor</button> }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="pt-roles">
        @for (r of team()?.roles ?? []; track r.code) {
          <article><h3>{{ roleLabel(r.code) }}</h3><p>{{ r.description }}</p></article>
        }
      </section>

      @if (pending(); as action) {
        <div class="pt-overlay" (click)="close()" aria-hidden="true"></div>
        <section class="pt-dialog" role="dialog" aria-modal="true" aria-labelledby="pt-dialog-title">
          <h2 id="pt-dialog-title">{{ action.title }}</h2>
          <p>{{ action.detail }}</p>
          <label>Motivo (obligatorio, queda en la auditoría de plataforma)
            <textarea name="reason" rows="3" [attr.maxlength]="maxReason" [(ngModel)]="reason"></textarea>
          </label>
          @if (dialogError()) { <p class="pt-form-error" role="alert">{{ dialogError() }}</p> }
          <div class="pt-actions">
            <button type="button" (click)="close()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!validReason() || saving()" (click)="confirm()">{{ saving() ? 'Aplicando…' : 'Confirmar' }}</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-team { display: grid; gap: 14px; }
    .pt-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pt-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pt-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pt-header p { margin: 0; color: #b6d7ce; font-size: 14px; max-width: 640px; }
    button { background: #fff; border: 1px solid #cce1e2; border-radius: 9px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 8px 12px; color: #153a39; }
    button.primary { background: #087f7b; border-color: #087f7b; color: #fff; }
    button.link { border: 0; background: none; color: #087f7b; padding: 0; }
    .pt-header button.primary { background: #62e3c4; border-color: #62e3c4; color: #0b2420; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .pt-notice { padding: 10px 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .pt-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pt-error button { margin-left: auto; }
    .pt-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; display: grid; gap: 10px; min-width: 0; }
    .pt-panel h2 { margin: 0; font-size: 16px; color: #153a39; }
    label { display: grid; gap: 4px; font-size: 13px; font-weight: 700; color: #153a39; }
    input, select, textarea { border: 1px solid #cfdfe4; border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; min-width: 0; }
    .pt-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .pt-row label { flex: 1 1 180px; }
    .pt-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .pt-hint { margin: 0; font-size: 12px; color: #51717d; }
    .pt-form-error { margin: 0; font-size: 13px; color: #991b1b; }
    .pt-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #51717d; background: #f2f7f8; padding: 8px 10px; white-space: nowrap; }
    td { padding: 8px 10px; border-bottom: 1px solid #eef3f2; }
    td small { display: block; color: #6b8583; font-size: 12px; }
    .pt-row-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .pt-roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .pt-roles article { background: #fff; border: 1px solid #dcebe8; border-radius: 12px; padding: 12px 14px; }
    .pt-roles h3 { margin: 0 0 4px; font-size: 14px; }
    .pt-roles p { margin: 0; font-size: 12px; color: #51717d; }
    .pt-overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .pt-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 480px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; display: grid; gap: 12px; }
    .pt-dialog h2 { margin: 0; font-size: 18px; }
    .pt-dialog p { margin: 0; font-size: 14px; color: #415e5a; }
  `],
})
export class PlatformTeamPage implements OnInit {
  private readonly api = inject(SupportAccessApiService);
  readonly me = inject(AuthService).user()?.id ?? '';

  readonly team = signal<PlatformTeam | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly showForm = signal(false);
  readonly pending = signal<PendingAction | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly maxReason = MAX_REASON_LENGTH;
  reason = '';
  form = { firstName: '', lastName: '', username: '', email: '', roleCode: 'SUPPORT', temporaryPassword: '' };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.team().subscribe({
      next: (team) => { this.team.set(team); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo cargar el equipo.'); },
    });
  }

  formError(): string | null { return memberFormError(this.form); }

  create(): void {
    if (this.formError()) return;
    const body = { ...this.form, username: this.form.username.trim(), email: this.form.email.trim() };
    this.ask({
      title: `Crear la cuenta ${body.username}`, detail: `Rol: ${this.roleLabel(body.roleCode)}. Entrará con la contraseña temporal y registrará su doble factor.`,
      run: (reason) => this.api.createMember({ ...body, reason }),
    }, () => { this.showForm.set(false); this.form = { firstName: '', lastName: '', username: '', email: '', roleCode: 'SUPPORT', temporaryPassword: '' }; });
  }

  changeRole(m: PlatformMember, roleCode: string): void {
    if (roleCode === m.roleCode) return;
    this.ask({
      title: `Cambiar el rol de ${m.fullName || m.username}`, detail: `Pasa a ${this.roleLabel(roleCode)}. Sus sesiones se cierran para aplicar el rol nuevo.`,
      run: (reason) => this.api.changeRole(m.id, roleCode, reason),
    });
  }

  toggleStatus(m: PlatformMember): void {
    const next = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.ask({
      title: `${next === 'ACTIVE' ? 'Activar' : 'Desactivar'} la cuenta de ${m.fullName || m.username}`,
      detail: next === 'ACTIVE' ? 'Podrá volver a iniciar sesión.' : 'No podrá iniciar sesión y sus sesiones se cierran.',
      run: (reason) => this.api.changeStatus(m.id, next, reason),
    });
  }

  resetMfa(m: PlatformMember): void {
    this.ask({
      title: `Reiniciar el doble factor de ${m.fullName || m.username}`,
      detail: 'Se borra su clave actual; en el próximo inicio de sesión registra una nueva.',
      run: (reason) => this.api.resetMfa(m.id, reason),
    });
  }

  private afterSave: (() => void) | null = null;

  private ask(action: PendingAction, afterSave: (() => void) | null = null): void {
    this.reason = ''; this.dialogError.set(''); this.notice.set(''); this.afterSave = afterSave; this.pending.set(action);
  }

  close(): void {
    if (this.saving()) return;
    this.pending.set(null);
    // Un rol elegido en la lista y no confirmado vuelve al valor guardado: se vuelve a pintar la tabla.
    const current = this.team();
    this.team.set(null);
    queueMicrotask(() => this.team.set(current));
  }

  validReason(): boolean { return isValidReason(this.reason); }

  confirm(): void {
    const action = this.pending();
    if (!action || !this.validReason()) return;
    this.saving.set(true);
    action.run(this.reason.trim()).subscribe({
      next: (team) => {
        this.saving.set(false); this.pending.set(null); this.team.set(team); this.afterSave?.(); this.afterSave = null;
        this.notice.set('Cambio aplicado y registrado en la auditoría de plataforma.');
      },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.dialogError.set(friendlyApiMessage(err.error?.message) || 'No se pudo aplicar el cambio.'); },
    });
  }

  roleLabel(code: string | null): string { return code ? ROLE_LABELS[code] ?? code : 'Sin rol'; }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca';
  }
}
