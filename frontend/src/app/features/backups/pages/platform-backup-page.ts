import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { friendlyApiMessage } from '../../../core/http/tenant-session';
import { PlatformBackupViewState, describeStartFailure, isTerminalStatus, viewStateForStatus } from './platform-backup.logic';

interface PlatformBackupStatus { id: string; status?: string; stage?: string; message?: string }

const API = '/api/v1/platform/backups/full';
const POLL_MS = 3000;

@Component({
  selector: 'app-platform-backup-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="platform-backup">
      <header>
        <p class="eyebrow">ADMINISTRACIÓN GLOBAL · RESPALDO DE PLATAFORMA</p>
        <h1>Respaldo completo de la plataforma</h1>
        <p class="lead">Genera una copia de toda la plataforma (todos los tenants y sus archivos). El proceso lo ejecuta el servidor y continúa aunque cierres esta pantalla.</p>
      </header>

      @if (state() === 'unavailable') {
        <section class="notice warn" role="status" data-testid="platform-backup-unavailable">
          <h2>El respaldo completo no está disponible en este entorno</h2>
          <p>{{ message() }}</p>
          <p>Este respaldo lo ejecuta un operador externo en el servidor anfitrión. Pide al responsable de infraestructura que lo active y vuelve a intentarlo.</p>
        </section>
      }
      @if (state() === 'busy') {
        <section class="notice info" role="status"><h2>Respaldo en curso</h2><p>{{ message() }}</p></section>
      }
      @if (state() === 'error') {
        <section class="notice error" role="alert"><h2>No se pudo completar la solicitud</h2><p>{{ message() }}</p></section>
      }

      @if (current(); as backup) {
        <section class="card" aria-live="polite">
          <h2>Último respaldo solicitado</h2>
          <dl>
            <div><dt>Identificador</dt><dd>{{ backup.id }}</dd></div>
            <div><dt>Estado</dt><dd>{{ statusLabel() }}</dd></div>
            @if (backup.stage) { <div><dt>Etapa</dt><dd>{{ backup.stage }}</dd></div> }
            @if (backup.message) { <div><dt>Detalle</dt><dd>{{ safeDetail() }}</dd></div> }
          </dl>
          @if (state() === 'running') { <p class="progress" role="status">Procesando en el servidor… se actualiza automáticamente.</p> }
        </section>
      }

      <div class="actions">
        <button type="button" class="primary" (click)="askConfirm()" [disabled]="state() === 'running' || starting()">
          {{ starting() ? 'Iniciando…' : 'Iniciar respaldo completo' }}
        </button>
      </div>

      @if (confirming()) {
        <div class="overlay" (click)="cancelConfirm()" aria-hidden="true"></div>
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="platform-backup-confirm-title">
          <h2 id="platform-backup-confirm-title">¿Iniciar el respaldo completo?</h2>
          <p>Se respaldarán todos los tenants. Puede tardar varios minutos y consumir recursos del servidor.</p>
          <label class="reason">Motivo (queda en la auditoría de plataforma)
            <textarea name="backupReason" rows="3" maxlength="1000" [(ngModel)]="reason"></textarea>
          </label>
          <div class="dialog-actions">
            <button type="button" (click)="cancelConfirm()">Cancelar</button>
            <button type="button" class="primary" (click)="start()" [disabled]="reason.trim().length < 5">Sí, iniciar respaldo</button>
          </div>
        </section>
      }
    </main>
  `,
  styles: [`
    :host { display: block; color: var(--ink, #102d2a); }
    .platform-backup { display: grid; gap: 18px; margin: 0 auto; max-width: 860px; padding: 28px 20px; }
    .eyebrow { color: var(--teal, #087f7b); font-size: 11px; font-weight: 800; letter-spacing: .1em; margin: 0 0 6px; }
    h1 { font-size: 26px; margin: 0 0 8px; }
    .lead { color: var(--muted, #648280); line-height: 1.5; margin: 0; }
    .notice, .card { background: #fff; border: 1px solid var(--line, #e2ece9); border-radius: 12px; padding: 16px 18px; }
    .notice h2, .card h2 { font-size: 15px; margin: 0 0 6px; }
    .notice p { line-height: 1.5; margin: 4px 0 0; }
    .notice.warn { background: #fff8e6; border-color: #e8cf8a; color: #5c4300; }
    .notice.info { background: #eef6ff; border-color: #b9d4f2; color: #12385f; }
    .notice.error { background: #fdeeee; border-color: #e5b4b4; color: #7a1f1f; }
    dl { display: grid; gap: 10px; margin: 0; }
    dl div { display: grid; gap: 2px; }
    dt { color: var(--muted, #648280); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .progress { color: var(--muted, #648280); margin: 12px 0 0; }
    .actions { display: flex; }
    button { background: #fff; border: 1px solid var(--line, #cce1e2); border-radius: 9px; cursor: pointer; font: inherit; font-weight: 700; padding: 10px 16px; }
    button.primary { background: var(--teal, #087f7b); border-color: var(--teal, #087f7b); color: #fff; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    button:focus-visible { outline: 3px solid var(--teal, #087f7b); outline-offset: 3px; }
    .overlay { background: rgba(9, 39, 38, .4); inset: 0; position: fixed; z-index: 90; }
    .dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(9, 39, 38, .3); left: 50%; max-width: 440px; padding: 22px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 32px); z-index: 91; }
    .dialog h2 { margin: 0 0 8px; }
    .reason { display: grid; gap: 6px; font-size: 13px; font-weight: 700; margin-top: 12px; }
    .reason textarea { border: 1px solid var(--line, #cce1e2); border-radius: 9px; font: inherit; font-weight: 400; padding: 8px 10px; resize: vertical; }
    .dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  `],
})
export class PlatformBackupPage {
  private readonly http = inject(HttpClient);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly current = signal<PlatformBackupStatus | null>(null);
  readonly state = signal<PlatformBackupViewState>('idle');
  readonly message = signal('');
  readonly starting = signal(false);
  readonly confirming = signal(false);
  reason = '';
  readonly statusLabel = computed(() => {
    const status = String(this.current()?.status ?? '').toUpperCase();
    return ({ COMPLETED: 'Completado', SUCCESS: 'Completado', FAILED: 'Fallido', ERROR: 'Fallido', RUNNING: 'En proceso', PENDING: 'En cola', ACCEPTED: 'Aceptado' } as Record<string, string>)[status] || status || 'En proceso';
  });
  readonly safeDetail = computed(() => friendlyApiMessage(this.current()?.message));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  askConfirm(): void { this.reason = ''; this.confirming.set(true); }
  cancelConfirm(): void { this.confirming.set(false); }

  start(): void {
    this.confirming.set(false);
    this.starting.set(true);
    this.message.set('');
    this.http.post<PlatformBackupStatus>(API, {}, { params: { reason: this.reason.trim() } }).subscribe({
      next: (backup) => {
        this.starting.set(false);
        this.current.set(backup);
        this.state.set(viewStateForStatus(backup.status ?? 'RUNNING'));
        if (!isTerminalStatus(backup.status)) this.startPolling(backup.id);
      },
      error: (error: HttpErrorResponse) => {
        this.starting.set(false);
        const failure = describeStartFailure(error.status, error.error?.message ?? error.error?.detail);
        this.state.set(failure.state);
        this.message.set(failure.message);
      },
    });
  }

  private startPolling(id: string): void {
    this.stopPolling();
    this.timer = setInterval(() => this.poll(id), POLL_MS);
  }

  private stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private poll(id: string): void {
    this.http.get<PlatformBackupStatus>(`${API}/${encodeURIComponent(id)}`).subscribe({
      next: (backup) => {
        this.current.set({ ...backup, id: backup.id ?? id });
        this.state.set(viewStateForStatus(backup.status));
        if (isTerminalStatus(backup.status)) this.stopPolling();
      },
      // A transient failure keeps the last known state; polling continues.
      error: () => undefined,
    });
  }
}
