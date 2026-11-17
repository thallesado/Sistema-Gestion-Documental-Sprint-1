import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupportAccessApiService, SupportAccessRequest } from '../../../core/api/support-access-api.service';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { activeLocale } from '../../../core/i18n/i18n.service';
import { LocalizedContentDirective } from '../../../core/i18n/localized-content.directive';
import { SUPPORT_MODULE_LABELS, SUPPORT_STATUS_LABELS } from '../../auth/pages/support-session.logic';

/**
 * Acceso de soporte (/settings/support-access): el administrador de la organización decide si el equipo
 * de NexoDocs puede ver sus datos, en qué módulos, en solo lectura y por cuánto tiempo, y puede revocarlo.
 */
@Component({
  selector: 'app-support-access-page',
  standalone: true,
  imports: [FormsModule, RouterLink, LocalizedContentDirective],
  template: `
<main class="support-access" i18nContent>
  <a class="back" routerLink="/settings">← Configuración</a>
  <header>
    <p class="kicker">Sistema · Configuración</p>
    <h1>Acceso de soporte</h1>
    <span>El equipo de NexoDocs no puede ver tus datos sin tu aprobación. Si lo apruebas, el acceso es de solo lectura, a los módulos indicados, vence solo y cada acción queda en tu auditoría.</span>
  </header>

  @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
  @if (error()) { <div class="notice error" role="alert">{{ error() }} <button type="button" (click)="load()">Reintentar</button></div> }
  @if (loading() && !requests().length) { <p class="muted">Cargando solicitudes…</p> }

  @for (r of requests(); track r.id) {
    <section class="card" [class.active]="r.status === 'APPROVED'" [class.emergency]="r.breakGlass">
      <div class="head">
        <div>
          <h2>{{ moduleLabels(r.modules) }}</h2>
          <p class="muted">{{ requestLine(r) }}</p>
        </div>
        <span class="pill">{{ status(r.status) }}</span>
      </div>
      @if (r.breakGlass) { <p class="warn">Acceso de emergencia aprobado internamente por dos personas de NexoDocs.</p> }
      <p><b>Motivo:</b> {{ r.reason }}</p>
      @if (r.expiresAt) { <p class="muted">{{ windowLine(r) }}</p> }
      @if (r.decidedBy) { <p class="muted">{{ decidedLine(r) }}</p> }
      <div class="actions">
        @if (r.status === 'PENDING_TENANT') {
          <button type="button" class="primary" [disabled]="busy()" (click)="decide(r, 'approve')">Aprobar</button>
          <button type="button" [disabled]="busy()" (click)="decide(r, 'reject')">Rechazar</button>
        }
        @if (r.status === 'APPROVED' || r.status === 'PENDING_INTERNAL') {
          <button type="button" class="danger" [disabled]="busy()" (click)="decide(r, 'revoke')">Revocar acceso</button>
        }
        @if (r.status === 'APPROVED' || r.status === 'EXPIRED' || r.status === 'REVOKED') {
          <a routerLink="/audit">Ver en la auditoría</a>
        }
      </div>
    </section>
  } @empty {
    @if (!loading()) { <p class="muted">No hay solicitudes de acceso de soporte.</p> }
  }
</main>`,
  styles: [`
    .support-access{padding:32px;max-width:960px;margin:auto;color:var(--ink,#173f38);display:grid;gap:14px}
    .back{color:var(--teal);font-size:13px;font-weight:700;text-decoration:none}
    .kicker{color:var(--teal);font-size:11px;font-weight:800;letter-spacing:.12em;margin:0;text-transform:uppercase}h1{font-size:28px;margin:5px 0}header span,.muted{color:var(--muted,#66857f)}
    .notice{background:#eef7ff;border:1px solid #cfe3f5;border-radius:12px;color:#356d9e;padding:12px 16px}.notice.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}
    .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;display:grid;gap:8px}
    .card.active{border-color:#f3d28d;box-shadow:0 0 0 3px #fff8e6}.card.emergency{border-color:#fecaca}
    .head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.head h2{margin:0;font-size:17px}.head p{margin:2px 0 0;font-size:13px}
    .pill{align-self:flex-start;background:var(--tint,#e6f7f4);border-radius:999px;font-size:12px;font-weight:800;padding:4px 10px}
    .warn{background:#fff7ed;border-radius:9px;color:#9a3412;font-size:13px;margin:0;padding:8px 12px}
    p{margin:0;font-size:14px}
    .actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.actions a{color:var(--teal);font-size:13px;font-weight:700}
    button{border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--teal-strong,#125a51);cursor:pointer;font:700 13px inherit;padding:9px 14px}button:disabled{opacity:.55;cursor:not-allowed}
    .primary{background:var(--teal);border-color:var(--teal);color:#fff}.danger{border-color:#f3d2d0;color:#a65050}
    @media(max-width:700px){.support-access{padding:20px 16px}}
  `],
})
export class SupportAccessPage implements OnInit {
  private readonly api = inject(SupportAccessApiService);
  readonly requests = signal<SupportAccessRequest[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tenantList().subscribe({
      next: (list) => { this.requests.set(list); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudieron cargar las solicitudes.'); },
    });
  }

  decide(r: SupportAccessRequest, decision: 'approve' | 'reject' | 'revoke'): void {
    this.busy.set(true);
    this.notice.set('');
    this.api.decide(r.id, decision, null).subscribe({
      next: (list) => {
        this.busy.set(false);
        this.requests.set(list);
        this.notice.set(decision === 'approve' ? 'Acceso aprobado. Puedes revocarlo cuando quieras.'
          : decision === 'reject' ? 'Solicitud rechazada.' : 'Acceso revocado: la sesión de soporte deja de funcionar.');
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.error.set(friendlyApiMessage(err.error?.message) || 'No se pudo registrar la decisión.'); },
    });
  }

  moduleLabels(codes: string[]): string { return codes.map((code) => SUPPORT_MODULE_LABELS[code] ?? code).join(', '); }
  status(value: string): string { return SUPPORT_STATUS_LABELS[value] ?? value; }
  requestLine(r: SupportAccessRequest): string { return `Solicitado por ${r.requestedBy} el ${this.dateTime(r.createdAt)} · ${r.durationMinutes} minutos`; }
  windowLine(r: SupportAccessRequest): string { return `Vigente del ${this.dateTime(r.startsAt)} al ${this.dateTime(r.expiresAt)}`; }
  decidedLine(r: SupportAccessRequest): string { return `Decidido por ${r.decidedBy} el ${this.dateTime(r.decidedAt)}`; }

  private dateTime(value: string | null): string {
    return value ? new Date(value).toLocaleString(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }
}
